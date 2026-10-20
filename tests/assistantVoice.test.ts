/**
 * Asistente VARA — avatar + voz.
 * El controlador de voz (una respuesta por vez, errores silenciosos, sin voz para errores), el estado del avatar,
 * la preferencia "Leer respuestas" y las garantías de la pantalla /asistente. Sin red ni audio real.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import {
  AUTOREAD_KEY, createVoiceController, isErrorMessage, isSpeakable, moodLabel, orbMoodFor, readAutoRead, writeAutoRead,
  type SpeechPlayer, type VoiceSnapshot,
} from '@/lib/assistant/voice'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

/** Promesa que se resuelve a mano: sirve para simular respuestas que llegan tarde. */
function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>(r => { resolve = r })
  return { promise, resolve }
}

type Handlers = Parameters<SpeechPlayer['start']>[0]

/** Reproductor falso: guarda los handlers para poder simular "empezó" y "terminó". */
function fakePlayer(startsOk = true) {
  const p = { handlers: null as Handlers | null, started: false }
  const player: SpeechPlayer = {
    start: async h => {
      p.handlers = h
      p.started = true
      if (startsOk) h.onStart()
      return startsOk
    },
  }
  return { player, p }
}

function setup(prepare: (text: string) => Promise<SpeechPlayer | null>) {
  const stopAudio = vi.fn()
  const controller = createVoiceController({ prepare, stopAudio })
  const seen: VoiceSnapshot[] = []
  controller.subscribe(() => seen.push(controller.getSnapshot()))
  return { controller, stopAudio, seen }
}

const flush = () => new Promise(r => setTimeout(r, 0))
const TEXT = 'Para escriturar en Buenos Aires necesitás el certificado de dominio vigente.'

describe('leer una respuesta', () => {
  it('pasa de reposo a preparando, a hablando y vuelve a reposo cuando termina', async () => {
    const { player, p } = fakePlayer()
    const { controller, seen } = setup(async () => player)
    await controller.play('3', TEXT)
    expect(seen.map(s => s.status)).toEqual(['loading', 'speaking'])
    expect(controller.getSnapshot()).toMatchObject({ status: 'speaking', activeId: '3' })
    p.handlers!.onEnd()
    expect(controller.getSnapshot()).toMatchObject({ status: 'idle', activeId: null })
  })

  it('"Detener" corta el audio y vuelve a reposo', async () => {
    const { player } = fakePlayer()
    const { controller, stopAudio } = setup(async () => player)
    await controller.play('1', TEXT)
    stopAudio.mockClear()
    controller.stop()
    expect(stopAudio).toHaveBeenCalledTimes(1)
    expect(controller.getSnapshot().status).toBe('idle')
  })
})

describe('una sola respuesta por vez', () => {
  it('pedir otra detiene la anterior y suena solo la nueva', async () => {
    const a = fakePlayer()
    const b = fakePlayer()
    const { controller, stopAudio } = setup(async text => (text.includes('primera') ? a.player : b.player))
    await controller.play('1', 'Esta es la primera respuesta del asistente.')
    stopAudio.mockClear()
    await controller.play('2', 'Esta es la segunda respuesta del asistente.')
    expect(stopAudio).toHaveBeenCalled() // se cortó la anterior antes de empezar
    expect(controller.getSnapshot()).toMatchObject({ status: 'speaking', activeId: '2' })
    // Que la primera "termine" tarde no pisa a la segunda
    a.p.handlers!.onEnd()
    expect(controller.getSnapshot()).toMatchObject({ status: 'speaking', activeId: '2' })
  })

  it('si el audio de la anterior llega tarde, se descarta y nunca suena', async () => {
    const slow = deferred<SpeechPlayer | null>()
    const first = fakePlayer()
    const second = fakePlayer()
    let calls = 0
    const { controller } = setup(() => (++calls === 1 ? slow.promise : Promise.resolve(second.player)))
    const p1 = controller.play('1', 'Primera respuesta larga que tarda en generarse.')
    const p2 = controller.play('2', 'Segunda respuesta que llega antes que la otra.')
    await p2
    slow.resolve(first.player) // recién ahora llega el audio de la primera
    await p1
    expect(first.p.started).toBe(false)
    expect(second.p.started).toBe(true)
    expect(controller.getSnapshot()).toMatchObject({ status: 'speaking', activeId: '2' })
  })

  it('cancelar mientras se prepara descarta el audio que llegue después', async () => {
    const slow = deferred<SpeechPlayer | null>()
    const late = fakePlayer()
    const { controller } = setup(() => slow.promise)
    const pending = controller.play('1', TEXT)
    expect(controller.getSnapshot().status).toBe('loading')
    controller.stop()
    slow.resolve(late.player)
    await pending
    expect(late.p.started).toBe(false)
    expect(controller.getSnapshot().status).toBe('idle')
  })
})

describe('si la voz falla, el chat sigue y no hay alarmas', () => {
  it('sin permiso, tope o error del servidor (prepare devuelve null): vuelve a reposo, sin lanzar', async () => {
    const { controller } = setup(async () => null)
    await expect(controller.play('1', TEXT)).resolves.toBeUndefined()
    expect(controller.getSnapshot()).toEqual({ status: 'idle', activeId: null, failedId: '1' })
  })

  it('el autoplay (silent) falla sin dejar ningún aviso; el pedido manual deja uno discreto', async () => {
    const { controller } = setup(async () => null)
    await controller.play('1', TEXT, { silent: true })
    expect(controller.getSnapshot().failedId).toBeNull()
    await controller.play('2', TEXT)
    expect(controller.getSnapshot().failedId).toBe('2')
    controller.stop()
    expect(controller.getSnapshot().failedId).toBeNull()
  })

  it('si prepare lanza una excepción, no se propaga', async () => {
    const { controller } = setup(async () => { throw new Error('red caída') })
    await expect(controller.play('1', TEXT)).resolves.toBeUndefined()
    expect(controller.getSnapshot().status).toBe('idle')
  })

  it('si el navegador bloquea el audio (start devuelve false) o falla, vuelve a reposo', async () => {
    const blocked = fakePlayer(false)
    const a = setup(async () => blocked.player)
    await a.controller.play('1', TEXT, { silent: true })
    expect(a.controller.getSnapshot()).toEqual({ status: 'idle', activeId: null, failedId: null })

    const boom: SpeechPlayer = { start: async () => { throw new Error('NotAllowedError') } }
    const b = setup(async () => boom)
    await expect(b.controller.play('1', TEXT)).resolves.toBeUndefined()
    expect(b.controller.getSnapshot().status).toBe('idle')
  })
})

describe('no se genera voz para errores', () => {
  const errors = [
    'No autorizado. Iniciá sesión.',
    'Error al procesar tu consulta.',
    'No pude conectarme con el asistente.',
    'No pudimos conectarnos. Revisá tu conexión.',
    'Tu sesión venció. Ingresá de nuevo para seguir conversando.',
  ]

  it('los mensajes de error no se leen y ni siquiera se pide el audio', async () => {
    const prepare = vi.fn(async () => fakePlayer().player)
    const { controller, seen } = setup(prepare)
    for (const e of errors) {
      expect(isErrorMessage(e)).toBe(true)
      expect(isSpeakable(e)).toBe(false)
      await controller.play('x', e)
    }
    await controller.play('y', '   ')
    expect(prepare).not.toHaveBeenCalled()
    expect(seen).toEqual([])
  })

  it('una respuesta normal sí es leíble', () => {
    expect(isSpeakable(TEXT)).toBe(true)
    expect(isErrorMessage(TEXT)).toBe(false)
  })
})

describe('al salir de la pantalla', () => {
  it('dispose corta el audio y descarta lo que llegue después, sin avisar a nadie', async () => {
    const slow = deferred<SpeechPlayer | null>()
    const late = fakePlayer()
    const { controller, stopAudio, seen } = setup(() => slow.promise)
    const pending = controller.play('1', TEXT)
    const before = seen.length
    stopAudio.mockClear()
    controller.dispose()
    expect(stopAudio).toHaveBeenCalledTimes(1)
    slow.resolve(late.player)
    await pending
    await flush()
    expect(late.p.started).toBe(false)
    expect(seen.length).toBe(before)
  })
})

describe('estado del avatar', () => {
  it('pensando mientras espera la respuesta o prepara la voz; hablando solo mientras suena; si no, reposo', () => {
    expect(orbMoodFor({ chatLoading: false, voice: 'idle' })).toBe('idle')
    expect(orbMoodFor({ chatLoading: true, voice: 'idle' })).toBe('thinking')
    expect(orbMoodFor({ chatLoading: false, voice: 'loading' })).toBe('thinking')
    expect(orbMoodFor({ chatLoading: false, voice: 'speaking' })).toBe('speaking')
    expect(orbMoodFor({ chatLoading: true, voice: 'speaking' })).toBe('speaking')
  })

  it('un error vuelve a reposo: no queda ninguna animación falsa', () => {
    // El chat dejó de cargar (loading=false) y la voz falló (idle): reposo.
    expect(orbMoodFor({ chatLoading: false, voice: 'idle' })).toBe('idle')
  })

  it('el estado también está escrito, no depende de la animación', () => {
    expect(moodLabel('idle')).toBe('Lista para ayudarte')
    expect(moodLabel('thinking')).toBe('Pensando…')
    expect(moodLabel('speaking')).toBe('Hablando…')
  })
})

describe('"Leer respuestas"', () => {
  const memory = () => {
    const m = new Map<string, string>()
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }
  }

  it('viene apagada por defecto (la voz gasta crédito) y recuerda lo que se elija', () => {
    const s = memory()
    expect(readAutoRead(s)).toBe(false)
    writeAutoRead(true, s)
    expect(s.m.get(AUTOREAD_KEY)).toBe('1')
    expect(readAutoRead(s)).toBe(true)
    writeAutoRead(false, s)
    expect(readAutoRead(s)).toBe(false)
  })

  it('sin storage (o con storage roto) no falla', () => {
    const roto = { getItem: () => { throw new Error('bloqueado') }, setItem: () => { throw new Error('bloqueado') } }
    expect(readAutoRead(roto)).toBe(false)
    expect(() => writeAutoRead(true, roto)).not.toThrow()
    expect(readAutoRead(undefined)).toBe(false)
  })
})

describe('la pantalla /asistente', () => {
  const page = read('src/app/asistente/page.tsx')

  it('el avatar reemplaza al ícono Bot y no se repite en cada mensaje', () => {
    expect(page.match(/<VaraOrb/g)).toHaveLength(1)
    expect(page).not.toMatch(/\bBot\b/)
    expect(page).toContain('state={mood}')
    expect(page).toContain('levelRef={voice.levelRef}')
  })

  it('el chat sigue igual: texto como fuente principal, historial, FAQs y errores', () => {
    expect(page).toContain("fetch('/api/chat'")
    expect(page).toContain('vara_chat_history')
    expect(page).toContain('BUYER_FAQS')
    expect(page).toContain('SELLER_FAQS')
    expect(page).toContain('chatError')
    expect(page).toContain('role="alert"')
    expect(page).toContain('{msg.content}')
  })

  it('controles de voz con nombre accesible: leer respuestas (switch), escuchar y detener', () => {
    expect(page).toContain('role="switch"')
    expect(page).toContain('aria-checked={voice.autoRead}')
    expect(page).toContain('Leer respuestas')
    expect(page).toContain('aria-label="Escuchar respuesta"')
    expect(page).toContain('aria-label="Detener lectura"')
    expect(page).toContain('aria-label="Cancelar lectura"')
    expect(page).toContain('role="status" aria-live="polite"')
  })

  it('el autoplay solo lee respuestas reales, en silencio si falla; y se corta al enviar otra pregunta', () => {
    expect(page).toContain('if (voice.autoRead) void voice.play(')
    expect(page).toContain('{ silent: true }')
    expect(page).toMatch(/voice\.stop\(\)[^\n]*\n/)
    // el autoplay está en la rama de éxito: nunca después de un error
    const ok = page.indexOf('if (voice.autoRead)')
    const err = page.indexOf('setChatError({ auth: res.status === 401')
    expect(err).toBeLessThan(ok)
  })

  it('respeta prefers-reduced-motion: sin animaciones fuera de motion-safe y el avatar entra en modo calmo', () => {
    expect(page).not.toMatch(/(?<!motion-safe:)animate-(bounce|spin|ping|pulse)/)
    expect(read('src/components/buy-v3/VaraOrb.tsx')).toContain('prefers-reduced-motion')
  })

  it('usa la voz existente y no abre frentes nuevos (sin Realtime, sin micrófono, sin STT)', () => {
    expect(read('src/components/buy-v3/useVaraVoice.ts')).toContain('/api/v3/speak')
    const all = page + read('src/hooks/useAssistantVoice.ts') + read('src/lib/assistant/voice.ts')
    expect(all).not.toMatch(/getUserMedia|SpeechRecognition|webkitSpeechRecognition|MediaRecorder|realtime|WebSocket/i)
  })
})
