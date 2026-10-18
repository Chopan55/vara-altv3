/**
 * Clips de recorrido generados con IA (Google Veo, vía Gemini API) a partir de una
 * foto. Lógica pura: arma el pedido, valida lo que viene de afuera y traduce la
 * respuesta de Google. El cobro es de Google por cada clip generado.
 *
 * Todo lo que sale es una VISUALIZACIÓN generada, nunca una filmación de la propiedad.
 */
export const GEMINI_BASE = 'https://generativelanguage.googleapis.com'
export const DEFAULT_VEO_MODEL = 'veo-3.1-lite-generate-preview'
export const CLIP_SECONDS = 4
export const MAX_CLIPS_PER_TOUR = 6
export const CLIP_LABEL = 'Video generado por IA · visualización, no es una filmación de la propiedad'

/** Tarifa publicada por Google para Veo 3.1 Lite en 720p (USD por segundo). Verificar en su página de precios. */
export const LITE_USD_PER_SECOND = 0.05

export function estimateCostUsd(clips: number, usdPerSecond = LITE_USD_PER_SECOND): number {
  return Math.round(Math.max(0, clips) * CLIP_SECONDS * usdPerSecond * 100) / 100
}

const ROOMS = [
  'Frente', 'Entrada', 'Living', 'Comedor', 'Cocina', 'Dormitorio principal', 'Dormitorio 2', 'Dormitorio 3',
  'Baño', 'Jardín', 'Pileta', 'Quincho', 'Garage / Cochera',
]

/** Solo se acepta un ambiente conocido: el texto libre del usuario nunca entra al pedido. */
export function safeRoom(label?: string): string {
  return ROOMS.find(r => r === label) ?? 'ambiente'
}

export function buildClipPrompt(label?: string): string {
  const room = safeRoom(label)
  return (
    `Recorrido inmobiliario realista del ${room === 'ambiente' ? 'ambiente' : room.toLowerCase()}. ` +
    'Movimiento de cámara lento y suave, como avanzando un par de pasos hacia adentro del lugar. ' +
    'Mantené exactamente la misma estructura, paredes, aberturas, muebles y terminaciones de la foto: no agregues ni quites nada. ' +
    'Sin personas, sin texto, sin logos, sin cambios de color. Luz natural, imagen nítida y estable.'
  )
}

/** Nombre de operación que devuelve Google al crear el pedido. Se valida antes de usarlo en una URL. */
export function isValidOperationName(name: unknown): name is string {
  return typeof name === 'string' && /^models\/[A-Za-z0-9._-]+\/operations\/[A-Za-z0-9_-]+$/.test(name)
}

/** Solo se descarga desde el dominio de Google; nunca desde una URL que pase el cliente. */
export function isAllowedVideoUri(uri: unknown): uri is string {
  if (typeof uri !== 'string') return false
  try {
    const u = new URL(uri)
    return u.protocol === 'https:' && u.hostname === 'generativelanguage.googleapis.com'
  } catch { return false }
}

export type ClipStatus =
  | { state: 'pending' }
  | { state: 'ready'; videoUri: string }
  | { state: 'failed'; message: string }

interface OperationJson {
  done?: boolean
  error?: { message?: string }
  response?: { generateVideoResponse?: { generatedSamples?: { video?: { uri?: string } }[]; raiMediaFilteredReasons?: string[] } }
}

export function parseOperation(op: unknown): ClipStatus {
  const o = (op ?? {}) as OperationJson
  if (!o.done) return { state: 'pending' }
  if (o.error) return { state: 'failed', message: 'Google no pudo generar este clip. Probá con otra foto.' }
  const filtered = o.response?.generateVideoResponse?.raiMediaFilteredReasons
  if (filtered && filtered.length > 0) return { state: 'failed', message: 'El filtro de seguridad no permitió generar este clip. Probá con otra foto.' }
  const uri = o.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri
  if (!isAllowedVideoUri(uri)) return { state: 'failed', message: 'El clip terminó pero no se pudo obtener el video.' }
  return { state: 'ready', videoUri: uri }
}
