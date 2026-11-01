/**
 * Conversación de voz en tiempo real con VARA: la lógica, sin React ni red (se prueba con eventos de ejemplo).
 *
 *  - Los eventos que manda OpenAI Realtime por el canal de datos se convierten en un estado (escuchando / pensando /
 *    hablando) y en un transcript ordenado.
 *  - Si la persona empieza a hablar mientras VARA responde, manda "escuchando": es la interrupción (barge-in).
 *  - El transcript sale en orden aunque la transcripción del usuario llegue después de la respuesta.
 */

export type LiveStatus = 'off' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error'

/** Estado del avatar mientras hay una sesión de voz (null si no la hay). */
export function liveOrbMood(status: LiveStatus): 'idle' | 'listening' | 'thinking' | 'speaking' | null {
  if (status === 'listening' || status === 'thinking' || status === 'speaking') return status
  if (status === 'connecting') return 'thinking'
  return null
}

export function liveLabel(status: LiveStatus): string {
  switch (status) {
    case 'connecting': return 'Conectando la voz…'
    case 'listening': return 'Te escucho…'
    case 'thinking': return 'Pensando…'
    case 'speaking': return 'Hablando…'
    case 'error': return 'La voz no está disponible'
    default: return ''
  }
}

export type LiveErrorCode = 'unsupported' | 'mic-denied' | 'mic-missing' | 'not-allowed' | 'limit' | 'unavailable' | 'dropped' | 'timeout'

/** Mensajes para la persona; todos aclaran que el chat de texto sigue. */
export function liveErrorMessage(code: LiveErrorCode): string {
  switch (code) {
    case 'unsupported': return 'Tu navegador no permite hablar con VARA por voz. Podés seguir por texto.'
    case 'mic-denied': return 'Necesito permiso para usar el micrófono. Activalo en tu navegador o seguí por texto.'
    case 'mic-missing': return 'No encontré un micrófono. Podés seguir por texto.'
    case 'not-allowed': return 'La conversación por voz todavía no está habilitada para tu cuenta. El chat de texto sigue igual.'
    case 'limit': return 'Llegaste al tope de voz por ahora. Probá más tarde; el chat de texto sigue igual.'
    case 'dropped': return 'Se cortó la conexión de voz. Podés volver a intentar o seguir por texto.'
    case 'timeout': return 'Cerré la voz por inactividad. Tocá "Hablar con VARA" para retomar.'
    default: return 'No pude iniciar la voz ahora. El chat de texto sigue igual.'
  }
}

/** Tiempos de la sesión: no se deja nada colgado ni gastando crédito. */
export const LIVE_LIMITS = {
  /** Duración máxima de una sesión. */
  maxSessionMs: 5 * 60_000,
  /** Sin que nadie hable ni VARA responda. */
  idleMs: 75_000,
} as const

// ───────────────────────── Transcript ─────────────────────────

export interface LiveEntry {
  /** item_id de la conversación en OpenAI. */
  id: string
  role: 'user' | 'assistant'
  text: string
  /** true cuando el texto ya no va a cambiar. */
  final: boolean
}

export interface LiveState {
  status: 'listening' | 'thinking' | 'speaking'
  userSpeaking: boolean
  /** Terminó de hablar y todavía no empezó la respuesta. */
  awaiting: boolean
  responding: boolean
  audioPlaying: boolean
  /** Ya llegó texto de la respuesta actual. */
  deltaSeen: boolean
  entries: LiveEntry[]
}

export const INITIAL_LIVE: LiveState = {
  status: 'listening',
  userSpeaking: false,
  awaiting: false,
  responding: false,
  audioPlaying: false,
  deltaSeen: false,
  entries: [],
}

/** Evento del canal de datos (solo lo que usamos). */
export interface RealtimeEvent {
  type?: string
  item_id?: string
  delta?: string
  transcript?: string
  [k: string]: unknown
}

type Core = Omit<LiveState, 'status'>

function statusOf(s: Core): LiveState['status'] {
  if (s.userSpeaking) return 'listening' // interrumpir a VARA tiene prioridad sobre todo
  if (s.audioPlaying || (s.responding && s.deltaSeen)) return 'speaking'
  if (s.awaiting || s.responding) return 'thinking'
  return 'listening'
}

const withStatus = (s: Core): LiveState => ({ ...s, status: statusOf(s) })

function upsert(entries: LiveEntry[], id: string, role: LiveEntry['role'], patch: (e: LiveEntry) => LiveEntry): LiveEntry[] {
  const i = entries.findIndex(e => e.id === id)
  if (i === -1) return [...entries, patch({ id, role, text: '', final: false })]
  return entries.map((e, k) => (k === i ? patch(e) : e))
}

/** Aplica un evento del servidor. Los eventos que no conocemos no cambian nada. */
export function applyRealtimeEvent(prev: LiveState, ev: RealtimeEvent): LiveState {
  const id = typeof ev.item_id === 'string' ? ev.item_id : ''
  switch (ev.type) {
    case 'input_audio_buffer.speech_started':
      return withStatus({ ...prev, userSpeaking: true, awaiting: false })

    case 'input_audio_buffer.speech_stopped':
      return withStatus({ ...prev, userSpeaking: false, awaiting: true })

    // Se reserva el lugar del mensaje del usuario: queda antes de la respuesta aunque su transcripción llegue tarde.
    case 'input_audio_buffer.committed':
      return id ? withStatus({ ...prev, entries: upsert(prev.entries, id, 'user', e => e) }) : prev

    case 'conversation.item.input_audio_transcription.completed':
      return id
        ? withStatus({ ...prev, entries: upsert(prev.entries, id, 'user', e => ({ ...e, text: String(ev.transcript ?? '').trim(), final: true })) })
        : prev

    case 'conversation.item.input_audio_transcription.failed':
      return id ? withStatus({ ...prev, entries: upsert(prev.entries, id, 'user', e => ({ ...e, final: true })) }) : prev

    case 'response.created':
      return withStatus({ ...prev, responding: true, awaiting: false, deltaSeen: false })

    case 'response.output_audio_transcript.delta':
      return id
        ? withStatus({
            ...prev,
            deltaSeen: true,
            entries: upsert(prev.entries, id, 'assistant', e => ({ ...e, text: e.text + String(ev.delta ?? '') })),
          })
        : prev

    case 'response.output_audio_transcript.done':
      return id
        ? withStatus({
            ...prev,
            entries: upsert(prev.entries, id, 'assistant', e => ({
              ...e,
              text: typeof ev.transcript === 'string' && ev.transcript ? ev.transcript : e.text,
              final: true,
            })),
          })
        : prev

    case 'output_audio_buffer.started':
      return withStatus({ ...prev, audioPlaying: true })

    // Terminó de sonar, o se cortó la reproducción (interrupción).
    case 'output_audio_buffer.stopped':
    case 'output_audio_buffer.cleared':
      return withStatus({ ...prev, audioPlaying: false })

    case 'response.done': {
      // Una respuesta interrumpida deja su texto parcial como definitivo.
      const entries = prev.entries.map(e => (e.role === 'assistant' && !e.final ? { ...e, final: true } : e))
      return withStatus({ ...prev, responding: false, deltaSeen: false, entries })
    }

    default:
      return prev
  }
}

/**
 * Saca del principio del transcript lo que ya quedó definitivo y en orden (descarta mensajes vacíos).
 * Si un mensaje del usuario todavía se está transcribiendo, nada posterior sale antes que él.
 */
export function takeFinished(state: LiveState): { done: LiveEntry[]; state: LiveState } {
  let n = 0
  while (n < state.entries.length && state.entries[n].final) n++
  if (n === 0) return { done: [], state }
  const done = state.entries.slice(0, n).filter(e => e.text.trim().length > 0)
  return { done, state: { ...state, entries: state.entries.slice(n) } }
}

/** Lo que se está diciendo ahora (para mostrarlo mientras pasa). */
export function livePartial(state: LiveState): LiveEntry[] {
  return state.entries.filter(e => !e.final && e.text.trim().length > 0)
}

// ───────────────────────── Contexto del chat de texto ─────────────────────────

/** Los últimos mensajes del chat, para que la voz retome la conversación y no arranque de cero. */
export function historySeed(
  messages: { role: 'user' | 'assistant'; content: string }[],
  isError: (t: string) => boolean,
  max = 6,
  maxChars = 600,
): { role: 'user' | 'assistant'; text: string }[] {
  return messages
    .filter(m => m.content.trim() && !isError(m.content))
    .slice(-max)
    .map(m => ({ role: m.role, text: m.content.trim().slice(0, maxChars) }))
}
