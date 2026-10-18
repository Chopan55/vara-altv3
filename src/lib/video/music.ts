/**
 * Música de fondo para el recorrido en video.
 *
 * Los 4 estilos incluidos se GENERAN acá con el audio del navegador (Web Audio):
 * son instrumentales propios de VARA, sin derechos de autor, sin archivos que
 * bajar y sin costo. Es música sintetizada, pensada como fondo suave.
 *
 * La parte de notas es pura (se puede probar sin navegador); solo `playEvents`
 * y `decodeAudioFile` necesitan Web Audio.
 */
export type MusicStyleId = 'calida' | 'moderna' | 'elegante' | 'luminosa'

export interface MusicStyle {
  id: MusicStyleId
  label: string
  description: string
  bpm: number
  /** Nota MIDI de la tónica del acorde base. */
  root: number
  /** Acordes de un compás cada uno, como semitonos sobre la tónica. */
  progression: number[][]
  /** Cada cuántos pulsos suena una nota del arpegio. */
  arpEvery: number
  wave: OscillatorType
  padGain: number
  arpGain: number
}

export const MUSIC_STYLES: MusicStyle[] = [
  { id: 'calida', label: 'Cálida', description: 'Suave y acogedora, para casas familiares', bpm: 72, root: 60,
    progression: [[0, 4, 7, 14], [-3, 0, 4, 7], [-7, -3, 0, 5], [-5, -1, 2, 7]], arpEvery: 1, wave: 'triangle', padGain: 0.05, arpGain: 0.06 },
  { id: 'moderna', label: 'Moderna', description: 'Limpia y actual, para departamentos', bpm: 96, root: 57,
    progression: [[0, 3, 7, 10], [-4, 0, 3, 7], [-9, -5, -2, 3], [-2, 2, 5, 9]], arpEvery: 0.5, wave: 'triangle', padGain: 0.04, arpGain: 0.05 },
  { id: 'elegante', label: 'Elegante', description: 'Pausada y sofisticada, para propiedades premium', bpm: 60, root: 62,
    progression: [[0, 4, 7, 11], [-5, -1, 2, 7], [-3, 0, 4, 9], [-7, -3, 0, 4]], arpEvery: 1, wave: 'sine', padGain: 0.05, arpGain: 0.07 },
  { id: 'luminosa', label: 'Luminosa', description: 'Alegre y con energía, para mostrar espacios abiertos', bpm: 112, root: 67,
    progression: [[0, 4, 7, 12], [-5, -1, 2, 7], [-3, 0, 4, 9], [-7, -3, 0, 5]], arpEvery: 0.5, wave: 'triangle', padGain: 0.035, arpGain: 0.05 },
]

export interface NoteEvent { start: number; dur: number; freq: number; gain: number; type: OscillatorType }

export const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

/** Todas las notas del estilo para cubrir `totalSeconds`, sin pasarse del final. */
export function buildEvents(style: MusicStyle, totalSeconds: number): NoteEvent[] {
  const beat = 60 / style.bpm
  const bar = beat * 4
  const events: NoteEvent[] = []
  const end = Math.max(0, totalSeconds)
  for (let b = 0, t = 0; t < end; b++, t += bar) {
    const chord = style.progression[b % style.progression.length]
    // Colchón: el acorde completo, una octava abajo, con un poco de solapamiento para que no corte.
    for (const semi of chord) {
      events.push({ start: t, dur: Math.min(bar * 1.08, end - t + 0.4), freq: midiToFreq(style.root + semi - 12), gain: style.padGain, type: 'sine' })
    }
    // Arpegio: sube y baja por las notas del acorde.
    const steps = Math.round(bar / (style.arpEvery * beat))
    for (let i = 0; i < steps; i++) {
      const at = t + i * style.arpEvery * beat
      if (at >= end) break
      const pattern = [0, 1, 2, 3, 2, 1]
      const tone = chord[pattern[i % pattern.length] % chord.length]
      events.push({ start: at, dur: Math.min(style.arpEvery * beat * 1.8, end - at + 0.3), freq: midiToFreq(style.root + tone), gain: style.arpGain, type: style.wave })
    }
  }
  return events
}

/** Reproduce las notas en cualquier destino de Web Audio, a partir de `startAt` (segundos del contexto). */
export function playEvents(ctx: BaseAudioContext, out: AudioNode, events: NoteEvent[], startAt: number): void {
  for (const e of events) {
    const t0 = startAt + e.start
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = e.type
    osc.frequency.value = e.freq
    const attack = Math.min(0.35, e.dur * 0.3)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.linearRampToValueAtTime(e.gain, t0 + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + e.dur)
    osc.connect(g).connect(out)
    osc.start(t0)
    osc.stop(t0 + e.dur + 0.05)
  }
}

export const MAX_AUDIO_BYTES = 15 * 1024 * 1024

/** Valida el archivo antes de leerlo. Devuelve el motivo si no sirve. */
export function audioFileProblem(file: { name: string; type: string; size: number }): string | null {
  const isMp3 = /\.mp3$/i.test(file.name) || file.type === 'audio/mpeg' || file.type === 'audio/mp3'
  if (!isMp3) return 'Subí un archivo MP3.'
  if (file.size > MAX_AUDIO_BYTES) return 'El archivo pesa más de 15 MB. Probá con uno más corto o más liviano.'
  if (file.size === 0) return 'El archivo está vacío.'
  return null
}

/** Lee un MP3 en el navegador. Nada se sube a ningún servidor. */
export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const ctx = new window.AudioContext()
  try {
    return await ctx.decodeAudioData(await file.arrayBuffer())
  } finally {
    void ctx.close()
  }
}

export const MUSIC_RIGHTS_NOTE = 'Usá música que sea tuya o que tenga licencia para usar en un aviso. Los portales y las redes pueden silenciar o bajar videos con música protegida.'
