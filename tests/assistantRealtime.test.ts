/**
 * Asistente VARA — conversación de voz en tiempo real.
 * Eventos de OpenAI Realtime → estado del avatar y transcript; sesión que arma el servidor; seguridad
 * (la clave no sale del servidor, todo se cierra al salir). Sin red ni micrófono.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  INITIAL_LIVE, LIVE_LIMITS, applyRealtimeEvent, historySeed, liveErrorMessage, liveLabel, livePartial, liveOrbMood,
  takeFinished, type LiveErrorCode, type LiveState, type RealtimeEvent,
} from '@/lib/assistant/realtime'
import { CLIENT_SECRET_TTL_SECONDS, DEFAULT_REALTIME_MODEL, VOICE_INSTRUCTIONS, buildRealtimeSession } from '@/lib/assistant/realtimeSession'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const run = (events: RealtimeEvent[], from: LiveState = INITIAL_LIVE) => events.reduce(applyRealtimeEvent, from)

describe('estados del avatar según los eventos', () => {
  it('un turno completo: escucha, piensa, habla y vuelve a escuchar', () => {
    let s = run([{ type: 'input_audio_buffer.speech_started' }])
    expect(s.status).toBe('listening')
    s = run([{ type: 'input_audio_buffer.speech_stopped' }], s)
    expect(s.status).toBe('thinking')
    s = run([{ type: 'response.created' }], s)
    expect(s.status).toBe('thinking')
    s = run([{ type: 'response.output_audio_transcript.delta', item_id: 'a1', delta: 'Hola' }], s)
    expect(s.status).toBe('speaking')
    s = run([{ type: 'output_audio_buffer.started' }, { type: 'response.done' }], s)
    expect(s.status).toBe('speaking') // el audio sigue sonando aunque la respuesta ya se generó entera
    s = run([{ type: 'output_audio_buffer.stopped' }], s)
    expect(s.status).toBe('listening')
  })

  it('interrupción: si la persona habla mientras VARA responde, pasa a escuchar y corta lo que sonaba', () => {
    let s = run([
      { type: 'response.created' },
      { type: 'response.output_audio_transcript.delta', item_id: 'a1', delta: 'Para escriturar necesitás' },
      { type: 'output_audio_buffer.started' },
    ])
    expect(s.status).toBe('speaking')
    s = run([{ type: 'input_audio_buffer.speech_started' }], s)
    expect(s.status).toBe('listening')
    s = run([{ type: 'output_audio_buffer.cleared' }, { type: 'response.done' }], s)
    expect(s.status).toBe('listening')
    // lo que alcanzó a decir queda como mensaje definitivo
    expect(s.entries.find(e => e.id === 'a1')).toMatchObject({ text: 'Para escriturar necesitás', final: true })
  })

  it('eventos desconocidos o sin datos no cambian nada', () => {
    expect(applyRealtimeEvent(INITIAL_LIVE, { type: 'session.updated' })).toBe(INITIAL_LIVE)
    expect(applyRealtimeEvent(INITIAL_LIVE, {})).toBe(INITIAL_LIVE)
    expect(applyRealtimeEvent(INITIAL_LIVE, { type: 'response.output_audio_transcript.delta', delta: 'x' })).toBe(INITIAL_LIVE)
  })

  it('el avatar y los textos de estado cubren listening/thinking/speaking y la conexión', () => {
    expect(liveOrbMood('listening')).toBe('listening')
    expect(liveOrbMood('thinking')).toBe('thinking')
    expect(liveOrbMood('speaking')).toBe('speaking')
    expect(liveOrbMood('connecting')).toBe('thinking')
    // sin sesión o con error: el avatar vuelve a su estado normal (null = lo decide el chat)
    expect(liveOrbMood('off')).toBeNull()
    expect(liveOrbMood('error')).toBeNull()
    expect(liveLabel('listening')).toBe('Te escucho…')
    expect(liveLabel('thinking')).toBe('Pensando…')
    expect(liveLabel('speaking')).toBe('Hablando…')
  })
})

describe('transcript', () => {
  const userTurn: RealtimeEvent[] = [
    { type: 'input_audio_buffer.speech_started' },
    { type: 'input_audio_buffer.speech_stopped' },
    { type: 'input_audio_buffer.committed', item_id: 'u1' },
  ]

  it('el texto de VARA se arma con los fragmentos y queda definitivo al terminar', () => {
    let s = run([
      { type: 'response.created' },
      { type: 'response.output_audio_transcript.delta', item_id: 'a1', delta: 'Hola, ' },
      { type: 'response.output_audio_transcript.delta', item_id: 'a1', delta: 'te escucho.' },
    ])
    expect(livePartial(s)).toEqual([{ id: 'a1', role: 'assistant', text: 'Hola, te escucho.', final: false }])
    s = run([{ type: 'response.output_audio_transcript.done', item_id: 'a1', transcript: 'Hola, te escucho.' }], s)
    const { done, state } = takeFinished(s)
    expect(done).toEqual([{ id: 'a1', role: 'assistant', text: 'Hola, te escucho.', final: true }])
    expect(state.entries).toEqual([])
  })

  it('queda en orden aunque la transcripción del usuario llegue después de la respuesta', () => {
    let s = run([
      ...userTurn,
      { type: 'response.created' },
      { type: 'response.output_audio_transcript.delta', item_id: 'a1', delta: 'Cuesta alrededor del 2%.' },
      { type: 'response.output_audio_transcript.done', item_id: 'a1', transcript: 'Cuesta alrededor del 2%.' },
    ])
    // la respuesta ya está lista, pero la pregunta todavía no se transcribió: no sale primero
    expect(takeFinished(s).done).toEqual([])
    s = run([{ type: 'conversation.item.input_audio_transcription.completed', item_id: 'u1', transcript: ' ¿Cuánto cuesta escriturar? ' }], s)
    const { done } = takeFinished(s)
    expect(done.map(e => [e.role, e.text])).toEqual([
      ['user', '¿Cuánto cuesta escriturar?'],
      ['assistant', 'Cuesta alrededor del 2%.'],
    ])
  })

  it('una transcripción que falló o quedó vacía no ensucia el chat ni bloquea lo que sigue', () => {
    let s = run([
      ...userTurn,
      { type: 'conversation.item.input_audio_transcription.failed', item_id: 'u1' },
      { type: 'response.output_audio_transcript.delta', item_id: 'a1', delta: 'No te entendí, ¿me repetís?' },
      { type: 'response.output_audio_transcript.done', item_id: 'a1' },
    ])
    const { done } = takeFinished(s)
    expect(done.map(e => e.id)).toEqual(['a1'])
    s = run([{ type: 'conversation.item.input_audio_transcription.completed', item_id: 'u2', transcript: '   ' }])
    expect(takeFinished(s).done).toEqual([])
  })
})

describe('contexto del chat de texto', () => {
  const isError = (t: string) => /^Error/.test(t)
  it('la voz retoma los últimos mensajes, sin errores y acotados', () => {
    const msgs = Array.from({ length: 10 }, (_, i) => ({ role: (i % 2 ? 'assistant' : 'user') as 'user' | 'assistant', content: `mensaje ${i}` }))
    msgs.push({ role: 'assistant', content: 'Error al procesar tu consulta.' }, { role: 'user', content: 'x'.repeat(2000) })
    const seed = historySeed(msgs, isError)
    expect(seed).toHaveLength(6)
    expect(seed.some(m => isError(m.text))).toBe(false)
    expect(seed.at(-1)!.text).toHaveLength(600)
  })
})

describe('mensajes cuando la voz falla: el chat de texto sigue', () => {
  const codes: LiveErrorCode[] = ['unsupported', 'mic-denied', 'mic-missing', 'not-allowed', 'limit', 'unavailable', 'dropped', 'timeout']
  it('cada causa tiene un mensaje claro y ninguno expone detalles técnicos', () => {
    for (const c of codes) {
      const m = liveErrorMessage(c)
      expect(m.length).toBeGreaterThan(20)
      expect(m).not.toMatch(/OpenAI|token|secret|API|error 5\d\d/i)
    }
    expect(liveErrorMessage('mic-denied')).toMatch(/micrófono/)
  })
  it('hay tope de duración y de inactividad', () => {
    expect(LIVE_LIMITS.maxSessionMs).toBeLessThanOrEqual(10 * 60_000)
    expect(LIVE_LIMITS.idleMs).toBeLessThan(LIVE_LIMITS.maxSessionMs)
  })
})

describe('sesión que arma el servidor', () => {
  it('modelo por defecto o el configurado; transcripción en español e interrupción activadas', () => {
    const d = buildRealtimeSession()
    expect(d.session.model).toBe(DEFAULT_REALTIME_MODEL)
    expect(buildRealtimeSession(' gpt-realtime ').session.model).toBe('gpt-realtime')
    expect(d.session.type).toBe('realtime')
    expect(d.session.audio.input.transcription.language).toBe('es')
    expect(d.session.audio.input.turn_detection).toMatchObject({ create_response: true, interrupt_response: true })
  })
  it('el secreto vence enseguida y las instrucciones son de voz rioplatense', () => {
    expect(buildRealtimeSession().expires_after).toEqual({ anchor: 'created_at', seconds: CLIENT_SECRET_TTL_SECONDS })
    expect(CLIENT_SECRET_TTL_SECONDS).toBeLessThanOrEqual(120)
    expect(VOICE_INSTRUCTIONS).toMatch(/rioplatense/)
    expect(VOICE_INSTRUCTIONS).toMatch(/Nunca inventes/)
  })
})

describe('seguridad y limpieza', () => {
  const route = read('src/app/api/assistant/realtime/route.ts')
  const hook = read('src/hooks/useRealtimeVoice.ts')
  const page = read('src/app/asistente/page.tsx')

  it('la ruta exige usuario autorizado, tiene topes y no devuelve la clave real', () => {
    expect(route).toContain('allowedUser()')
    expect(route).toContain('status: 403')
    expect(route).toContain('status: 429')
    expect(route).toContain('createRateLimiter(')
    expect(route).toContain('/v1/realtime/client_secrets')
    // al navegador solo vuelve el secreto efímero
    expect(route).toContain('NextResponse.json({ value: data.value }')
    // el navegador solo aporta el contexto de la operación (sanitizado y acotado): no elige modelo ni instrucciones
    expect(route).not.toMatch(/req\.json\(/)
    expect(route).toContain('sanitizeContextText(')
    expect(route).toContain('raw.length > 12_000')
  })

  it('la clave de OpenAI no existe en el navegador', () => {
    expect(hook).not.toMatch(/OPENAI_API_KEY|NEXT_PUBLIC_OPENAI/)
    expect(page).not.toMatch(/OPENAI_API_KEY|NEXT_PUBLIC_OPENAI/)
    expect(hook).toContain("fetch('/api/assistant/realtime'")
    expect(hook).toContain('Bearer ${secret}')
  })

  it('al terminar o salir se cierran micrófono, conexión, audio y temporizadores', () => {
    expect(hook).toContain('getTracks().forEach(t => t.stop())')
    expect(hook).toContain('r.pc?.close()')
    expect(hook).toContain('r.dc?.close()')
    expect(hook).toContain('clearTimeout(r.maxTimer)')
    expect(hook).toContain('clearTimeout(r.idleTimer)')
    expect(hook).toContain("addEventListener('pagehide'")
    expect(hook).toContain('LIVE_LIMITS.maxSessionMs')
    expect(hook).toContain('LIVE_LIMITS.idleMs')
    // el cleanup del efecto de desmontaje también cierra todo
    expect(hook).toMatch(/return \(\) => \{\s*window\.removeEventListener\('pagehide', onHide\)\s*teardown\(\)/)
  })

  it('la interrupción corta el audio local y la conexión usa el canal de eventos de OpenAI', () => {
    expect(hook).toContain("'output_audio_buffer.clear'")
    expect(hook).toContain("createDataChannel('oai-events')")
    expect(hook).toContain('https://api.openai.com/v1/realtime/calls')
  })

  it('/asistente: botón de voz, fallback al chat de texto e historial intactos', () => {
    expect(page).toContain('Hablar con VARA')
    expect(page).toContain('Terminar conversación')
    expect(page).toContain('aria-pressed={liveActive}')
    expect(page).toContain('liveErrorMessage(live.errorCode)')
    // el chat de texto sigue siendo la base
    expect(page).toContain("fetch('/api/chat'")
    expect(page).toContain('vara_chat_history')
    expect(page).toContain('BUYER_FAQS')
    // lo que se dice por voz entra al mismo historial
    expect(page).toContain('onFinal: entries => setMessages(')
    // no hay lectura de respuestas encima de la conversación
    expect(page).toContain('voice.autoRead && !liveActive')
  })
})
