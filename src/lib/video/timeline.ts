/**
 * Línea de tiempo del video de presentación: cuánto dura cada foto, cuándo se
 * cruza con la siguiente y cuánto zoom lleva. Pura, sin navegador, testeable.
 */
export interface Segment { index: number; start: number; end: number }

export const MAX_PHOTOS = 12
export const SECONDS_PER_PHOTO = 3
export const FADE_SECONDS = 0.6

export function planTimeline(count: number, secondsPerPhoto = SECONDS_PER_PHOTO): { segments: Segment[]; total: number } {
  const n = Math.max(0, Math.min(Math.floor(count), MAX_PHOTOS))
  const segments: Segment[] = Array.from({ length: n }, (_, i) => ({ index: i, start: i * secondsPerPhoto, end: (i + 1) * secondsPerPhoto }))
  return { segments, total: n * secondsPerPhoto }
}

/** Qué foto se ve en el segundo t, y con qué opacidad entra la siguiente (0 a 1). */
export function frameAt(t: number, count: number, secondsPerPhoto = SECONDS_PER_PHOTO, fade = FADE_SECONDS): { current: number; next: number | null; mix: number; zoom: number } {
  const { segments, total } = planTimeline(count, secondsPerPhoto)
  if (segments.length === 0) return { current: 0, next: null, mix: 0, zoom: 1 }
  const tt = Math.min(Math.max(t, 0), total - 1e-6)
  const current = Math.min(Math.floor(tt / secondsPerPhoto), segments.length - 1)
  const local = tt - current * secondsPerPhoto
  const hasNext = current < segments.length - 1
  const mix = hasNext && local > secondsPerPhoto - fade ? (local - (secondsPerPhoto - fade)) / fade : 0
  // Zoom suave de 1.00 a 1.08 durante la foto.
  const zoom = 1 + 0.08 * (local / secondsPerPhoto)
  return { current, next: hasNext && mix > 0 ? current + 1 : null, mix, zoom }
}

export interface Motion { zoom: number; panX: number; panY: number }

/**
 * Movimiento de cámara de cada foto, para que se sienta un recorrido y no una
 * presentación quieta. Rota entre cuatro: acercar, alejar y paneo a cada lado.
 * `p` es el avance dentro de la foto (0 a 1); panX va de -1 (borde derecho) a 1 (borde izquierdo).
 */
export function motionAt(index: number, p: number): Motion {
  const t = Math.min(Math.max(p, 0), 1)
  switch (((index % 4) + 4) % 4) {
    case 0: return { zoom: 1 + 0.12 * t, panX: 0, panY: 0 }
    case 1: return { zoom: 1.12 - 0.12 * t, panX: 0, panY: 0 }
    case 2: return { zoom: 1.12, panX: -1 + 2 * t, panY: 0 }
    default: return { zoom: 1.12, panX: 1 - 2 * t, panY: 0 }
  }
}
