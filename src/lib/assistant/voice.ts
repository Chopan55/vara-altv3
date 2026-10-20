/**
 * Voz del Asistente VARA: la lógica, sin React ni audio real (se prueba con dobles).
 *
 *  - Una sola respuesta suena por vez: pedir otra detiene la anterior.
 *  - Si el audio falla (sin permiso, tope, red, navegador que bloquea) el chat sigue igual: no hay excepción ni alerta.
 *  - Nunca se pide voz para mensajes de error.
 *  - El estado del avatar sale de lo que pasa de verdad: pensando mientras espera, hablando solo mientras suena.
 */

import { sanitizeSpeechText } from '@/lib/analysis/speech'

export type OrbMood = 'idle' | 'thinking' | 'speaking'
export type VoiceStatus = 'idle' | 'loading' | 'speaking'

export interface VoiceSnapshot {
  status: VoiceStatus
  /** Mensaje que suena (o se está preparando). */
  activeId: string | null
  /** Último mensaje cuya voz se pidió a mano y no pudo sonar. Para un aviso discreto; nunca para el autoplay. */
  failedId: string | null
}

export const IDLE_VOICE: VoiceSnapshot = { status: 'idle', activeId: null, failedId: null }

export const AUTOREAD_KEY = 'vara.assistant.autoread'

/** Mensajes técnicos que a veces quedaron guardados en el historial como si fueran respuestas. */
const ERROR_TEXT = /^(No autorizado|Error al procesar|No pude conectarme|No pudimos conectarnos|Tu sesión venció)/i

/** El historial restaurado no debe conservar errores como si fueran respuestas del asistente. */
export function isErrorMessage(text: string): boolean {
  return ERROR_TEXT.test(text.trim())
}

/** ¿Tiene sentido leerlo en voz alta? No para errores, ni para texto vacío o sin contenido. */
export function isSpeakable(text: string): boolean {
  return !isErrorMessage(text) && sanitizeSpeechText(text) !== null
}

/**
 * Estado del avatar. No depende de la animación para transmitir nada: el texto de estado sale de acá también.
 * Un error no cambia nada: el chat termina de cargar y el avatar vuelve a reposo, sin animación falsa.
 */
export function orbMoodFor(s: { chatLoading: boolean; voice: VoiceStatus }): OrbMood {
  if (s.voice === 'speaking') return 'speaking'
  if (s.chatLoading || s.voice === 'loading') return 'thinking'
  return 'idle'
}

export function moodLabel(mood: OrbMood): string {
  return mood === 'speaking' ? 'Hablando…' : mood === 'thinking' ? 'Pensando…' : 'Lista para ayudarte'
}

// ───────────────────────── Preferencia "Leer respuestas" ─────────────────────────

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

/** Por defecto apagada: la voz gasta crédito y no se activa sola. */
export function readAutoRead(storage: StorageLike | undefined = safeStorage()): boolean {
  try { return storage?.getItem(AUTOREAD_KEY) === '1' } catch { return false }
}

export function writeAutoRead(on: boolean, storage: StorageLike | undefined = safeStorage()): void {
  try { storage?.setItem(AUTOREAD_KEY, on ? '1' : '0') } catch { /* sin storage: queda para esta sesión */ }
}

function safeStorage(): StorageLike | undefined {
  try { return typeof localStorage === 'undefined' ? undefined : localStorage } catch { return undefined }
}

// ───────────────────────── Controlador ─────────────────────────

/** Lo que el controlador necesita del reproductor real (`useVaraVoice`). */
export interface SpeechPlayer {
  start: (h: { onStart: () => void; onProgress: (p: number) => void; onEnd: () => void }) => Promise<boolean>
}

export interface VoiceDeps {
  /** Pide el audio. null si no se pudo (sin permiso, tope, error). */
  prepare: (text: string) => Promise<SpeechPlayer | null>
  /** Corta lo que esté sonando. */
  stopAudio: () => void
}

export function createVoiceController(deps: VoiceDeps) {
  let snap: VoiceSnapshot = IDLE_VOICE
  /** Cada pedido nuevo o cada "detener" invalida los anteriores: lo que llegue tarde se descarta. */
  let seq = 0
  const listeners = new Set<() => void>()
  const set = (next: VoiceSnapshot) => {
    snap = next
    listeners.forEach(l => l())
  }

  return {
    getSnapshot: (): VoiceSnapshot => snap,

    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },

    /** Detiene la lectura (o cancela el pedido en curso) y vuelve a reposo. */
    stop(): void {
      seq++
      deps.stopAudio()
      set(IDLE_VOICE)
    },

    /**
     * Lee un mensaje. Detiene el anterior. `silent` (autoplay) no deja aviso si falla; el pedido manual sí.
     * Nunca lanza: si algo falla, el chat sigue con texto.
     */
    async play(id: string, text: string, opts: { silent?: boolean } = {}): Promise<void> {
      if (!isSpeakable(text)) return
      const mine = ++seq
      deps.stopAudio()
      set({ status: 'loading', activeId: id, failedId: null })

      const fail = () => {
        if (mine === seq) set({ ...IDLE_VOICE, failedId: opts.silent ? null : id })
      }

      let player: SpeechPlayer | null = null
      try { player = await deps.prepare(text) } catch { player = null }
      if (mine !== seq) return // otra lectura o un "detener" se adelantaron
      if (!player) return fail()

      let started = false
      try {
        started = await player.start({
          onStart: () => { if (mine === seq) set({ status: 'speaking', activeId: id, failedId: null }) },
          onProgress: () => {},
          onEnd: () => { if (mine === seq) set(IDLE_VOICE) },
        })
      } catch {
        started = false
      }
      if (!started) fail()
    },

    /** Al salir de la pantalla: corta el audio y suelta a los suscriptores, sin avisarles. */
    dispose(): void {
      seq++
      deps.stopAudio()
      snap = IDLE_VOICE
      listeners.clear()
    },
  }
}

export type VoiceController = ReturnType<typeof createVoiceController>
