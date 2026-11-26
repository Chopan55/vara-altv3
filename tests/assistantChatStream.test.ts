import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { readFileSync } from 'node:fs'
import { parseStreamEvent, readChatStream, splitNdjson, streamingDisplay } from '@/lib/assistant/chatStream'

describe('piezas puras de la transmisión', () => {
  it('parte líneas completas y guarda lo que quedó a medias', () => {
    const a = splitNdjson('', '{"t":"d","v":"Ho"}\n{"t":"d","v":"la"')
    expect(a.lines).toEqual(['{"t":"d","v":"Ho"}'])
    const b = splitNdjson(a.rest, '}\n{"t":"f","reply":"Hola"}\n')
    expect(b.lines).toEqual(['{"t":"d","v":"la"}', '{"t":"f","reply":"Hola"}'])
    expect(b.rest).toBe('')
  })

  it('valida los eventos y descarta lo ilegible', () => {
    expect(parseStreamEvent('{"t":"d","v":"hola"}')).toEqual({ t: 'd', v: 'hola' })
    expect(parseStreamEvent('{"t":"f","reply":"ok","sources":[]}')).toMatchObject({ t: 'f', reply: 'ok' })
    expect(parseStreamEvent('{"t":"e","status":429,"error":"x"}')).toEqual({ t: 'e', status: 429, error: 'x' })
    expect(parseStreamEvent('{"t":"e"}')).toMatchObject({ t: 'e', status: 500 })
    for (const bad of ['no es json', '{"t":"d"}', '{"t":"x"}', '[]', 'null', '{"t":"f"}']) {
      expect(parseStreamEvent(bad), bad).toBeNull()
    }
  })

  it('mientras llega, oculta el borrador, el comienzo de la marca y el markdown', () => {
    const user = [{ role: 'user', content: 'ayudame' }]
    expect(streamingDisplay('**Hola** mundo', user)).toBe('Hola mundo')
    expect(streamingDisplay('Mandalo hoy.\nBORRADOR\nHola [nombre]', user)).toBe('Mandalo hoy.')
    expect(streamingDisplay('Mandalo hoy.\nBORR', user)).toBe('Mandalo hoy.')
    expect(streamingDisplay('Mandalo hoy.\nBuenas', user)).toBe('Mandalo hoy.\nBuenas')
  })

  it('mientras llega, tapa el tope que la persona contó', () => {
    const user = [{ role: 'user', content: 'Mi tope es USD 130.000.' }]
    expect(streamingDisplay('Podés subir hasta USD 130.000 si cerramos.', user)).toContain('[tu límite privado]')
  })
})

function bodyOf(...pieces: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  return new ReadableStream({ start(c) { for (const p of pieces) c.enqueue(enc.encode(p)); c.close() } })
}

describe('lector de la transmisión', () => {
  const user = [{ role: 'user', content: 'hola' }]

  it('va mostrando el texto provisorio y devuelve la respuesta final del servidor', async () => {
    const seen: string[] = []
    const out = await readChatStream(
      bodyOf('{"t":"d","v":"Ho"}\n{"t":"d","v":"la"}\n', '{"t":"f","reply":"Hola, ¿en qué te ayudo?","sources":[]}\n'),
      user, t => seen.push(t),
    )
    expect(seen).toEqual(['Ho', 'Hola'])
    expect(out).toEqual({ kind: 'final', payload: { reply: 'Hola, ¿en qué te ayudo?', sources: [] } })
  })

  it('arma bien una línea que llegó partida en dos pedazos', async () => {
    const out = await readChatStream(bodyOf('{"t":"f","rep', 'ly":"Listo"}\n'), user, () => {})
    expect(out).toMatchObject({ kind: 'final', payload: { reply: 'Listo' } })
  })

  it('un error del servidor se devuelve como error, no como respuesta', async () => {
    const out = await readChatStream(bodyOf('{"t":"d","v":"Ho"}\n{"t":"e","status":429,"error":"Demasiados pedidos"}\n'), user, () => {})
    expect(out).toEqual({ kind: 'error', status: 429, error: 'Demasiados pedidos' })
  })

  it('si la conexión se corta sin respuesta final, devuelve «cut»: nunca una respuesta a medias', async () => {
    expect(await readChatStream(bodyOf('{"t":"d","v":"Ho"}\n'), user, () => {})).toEqual({ kind: 'cut' })
    const broken = new ReadableStream<Uint8Array>({ pull(c) { c.error(new Error('caída')) } })
    expect(await readChatStream(broken, user, () => {})).toEqual({ kind: 'cut' })
  })

  it('procesa una última línea que llegó sin salto de línea', async () => {
    const out = await readChatStream(bodyOf('{"t":"d","v":"Ho"}\n{"t":"f","reply":"Listo"}'), user, () => {})
    expect(out).toMatchObject({ kind: 'final', payload: { reply: 'Listo' } })
  })

  it('ignora líneas ilegibles y sigue', async () => {
    const out = await readChatStream(bodyOf('basura\n{"t":"f","reply":"ok"}\n'), user, () => {})
    expect(out).toMatchObject({ kind: 'final' })
  })

  it('la pantalla pide transmisión, pinta como mucho una vez por cuadro y reemplaza lo provisorio por la respuesta final', () => {
    const page = readFileSync(new URL('../src/app/asistente/page.tsx', import.meta.url), 'utf8')
    expect(page).toContain('stream: true')
    expect(page).toContain('requestAnimationFrame')
    expect(page).toContain('setStreamText(null)')
    expect(page).toContain("data.reply")
    // el texto provisorio nunca queda guardado como mensaje: solo la respuesta final del servidor
    expect(page).not.toMatch(/setMessages\([^)]*streamText/)
  })
})

const { complete } = vi.hoisted(() => ({ complete: vi.fn() }))
vi.mock('openai', () => ({ default: class { chat = { completions: { create: complete } } } }))
vi.mock('@supabase/ssr', () => ({ createServerClient: () => ({ from: vi.fn() }) }))
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [] }) }))
vi.mock('@/lib/api/aiAccess', () => ({ requireAiAccess: async () => ({ userId: 'u1' }) }))

import { POST } from '@/app/api/chat/route'

const ask = (content: string, extra: Record<string, unknown> = {}) =>
  POST(new NextRequest('http://localhost/api/chat', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content }], ...extra }) }))

async function* chunks(...parts: string[]) {
  for (const p of parts) yield { choices: [{ delta: { content: p } }] }
}

async function readEvents(res: Response) {
  const text = await res.text()
  return text.split('\n').filter(Boolean).map(l => JSON.parse(l) as Record<string, unknown>)
}

describe('ruta del chat transmitida', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '')
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('manda los pedazos en orden y cierra con la respuesta final, con el tope tapado y el borrador aparte', async () => {
    complete.mockImplementation(async (args: { stream?: boolean }) =>
      args.stream
        ? chunks('Podés ofrecer hasta USD 130.000.\n', 'BORRADOR\nHola, ofrezco USD 130.000.\n', 'FIN BORRADOR')
        : { choices: [{ message: { content: 'x' } }] })
    const res = await ask('Mi tope es USD 130.000, armame un mensaje.', { stream: true })
    expect(res.headers.get('content-type')).toContain('application/x-ndjson')
    expect(res.headers.get('cache-control')).toBe('no-store')
    const events = await readEvents(res)
    expect(events.filter(e => e.t === 'd').map(e => e.v).join('')).toContain('BORRADOR')
    const final = events[events.length - 1]
    expect(final.t).toBe('f')
    expect(JSON.stringify(final)).not.toContain('130.000')
    expect(final.draft).toContain('[tu límite privado]')
    expect((final.sources as { kind: string }[])[0].kind).toBe('general')
    expect(complete.mock.calls[0][0].stream).toBe(true)
  })

  it('si falla antes de empezar, manda un evento de error con el mismo criterio que la ruta normal', async () => {
    complete.mockRejectedValue(new Error('429 rate limit'))
    const events = await readEvents(await ask('hola', { stream: true }))
    expect(events).toEqual([{ t: 'e', status: 429, error: 'Demasiados pedidos seguidos. Esperá un minuto y reintentá.' }])
  })

  it('si la transmisión se corta a la mitad, avisa del error y no deja una respuesta final inventada', async () => {
    complete.mockImplementation(async () => (async function* () {
      yield { choices: [{ delta: { content: 'Hola' } }] }
      throw new Error('conexión caída')
    })())
    const events = await readEvents(await ask('hola', { stream: true }))
    expect(events.map(e => e.t)).toEqual(['d', 'e'])
  })

  it('en preguntas de costos no transmite: responde en JSON con la herramienta como siempre', async () => {
    complete.mockResolvedValue({ choices: [{ message: { content: 'Necesito el precio en dólares.' } }] })
    const res = await ask('¿Cuánto cuesta escriturar?', { stream: true })
    expect(res.headers.get('content-type')).toContain('application/json')
    expect((await res.json()).reply).toBe('Necesito el precio en dólares.')
    expect(complete.mock.calls[0][0].stream).toBeUndefined()
  })

  it('sin pedir transmisión sigue respondiendo en JSON, igual que antes', async () => {
    complete.mockResolvedValue({ choices: [{ message: { content: 'Hola.' } }] })
    const res = await ask('hola')
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await res.json()).toMatchObject({ reply: 'Hola.' })
  })

  it('si la persona cancela a mitad de la respuesta, se aborta el pedido a OpenAI y no se sigue enviando', async () => {
    let upstreamSignal: AbortSignal | undefined
    let produced = 0
    complete.mockImplementation(async (_args: unknown, options?: { signal?: AbortSignal }) => {
      upstreamSignal = options?.signal
      return (async function* () {
        for (let i = 0; i < 50; i++) {
          if (options?.signal?.aborted) return
          produced++
          yield { choices: [{ delta: { content: `p${i} ` } }] }
          await new Promise(r => setTimeout(r, 5))
        }
      })()
    })
    const res = await ask('hola', { stream: true })
    const reader = res.body!.getReader()
    await reader.read() // llegó el primer pedazo
    await reader.cancel()
    await new Promise(r => setTimeout(r, 60))
    expect(upstreamSignal?.aborted).toBe(true)
    expect(produced).toBeLessThan(50)
  })

  it('si el navegador se desconecta (abort de la petición), también se aborta el pedido a OpenAI', async () => {
    const controller = new AbortController()
    let upstreamSignal: AbortSignal | undefined
    complete.mockImplementation(async (_args: unknown, options?: { signal?: AbortSignal }) => {
      upstreamSignal = options?.signal
      return chunks('Hola')
    })
    const req = new NextRequest('http://localhost/api/chat', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: 'hola' }], stream: true }), signal: controller.signal })
    await POST(req)
    controller.abort()
    expect(upstreamSignal?.aborted).toBe(true)
  })
})
