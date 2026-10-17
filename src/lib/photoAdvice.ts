/**
 * Recomendaciones sobre las fotos de una propiedad y orden de "recorrido".
 * Todo se calcula con datos medibles (cantidad, etiquetas, tamaño, brillo): sin
 * IA y sin costo. No juzga la calidad artística de una foto.
 */
export const TOUR_ORDER = [
  'Frente', 'Entrada', 'Living', 'Comedor', 'Cocina',
  'Dormitorio principal', 'Dormitorio 2', 'Dormitorio 3', 'Baño',
  'Jardín', 'Pileta', 'Quincho', 'Garage / Cochera', 'Otro',
] as const

/** Lo primero que mira quien compra. */
export const ESSENTIAL_ROOMS = ['Frente', 'Living', 'Cocina', 'Dormitorio principal', 'Baño'] as const

export const UNLABELED = 'Sin etiquetar'

/** Imágenes internas: nunca se muestran en una ficha, un video ni un aviso. */
export const PRIVATE_LABELS = ['Plano', 'Documento (privado)'] as const
const PRIVATE_RE = /plano|documento|escritura|dni|c[eé]dula|partida|contrato|certificado/i

/** Una foto es publicable salvo que su etiqueta indique un plano o un documento. */
export function isPublishable(label: string): boolean {
  return !PRIVATE_RE.test(label || '')
}

/** Ordena como un recorrido: de la calle hacia adentro y después lo exterior. Lo no reconocido queda al final, en su orden. */
export function tourOrder<T extends { label: string }>(photos: T[]): T[] {
  const rank = (l: string) => {
    const i = (TOUR_ORDER as readonly string[]).indexOf(l)
    return i === -1 ? TOUR_ORDER.length : i
  }
  return photos.map((p, i) => ({ p, i })).sort((a, b) => rank(a.p.label) - rank(b.p.label) || a.i - b.i).map(x => x.p)
}

export interface PhotoInfo {
  id: string
  label: string
  isCover?: boolean
  width?: number
  height?: number
  /** Brillo medio de 0 (negro) a 255 (blanco). */
  brightness?: number
}

export type Severity = 'high' | 'medium' | 'info'
export interface Advice { id: string; severity: Severity; text: string }

const ORDER: Record<Severity, number> = { high: 0, medium: 1, info: 2 }

export function advisePhotos(all: PhotoInfo[]): Advice[] {
  const out: Advice[] = []
  // Los planos y documentos no cuentan como fotos de la propiedad.
  const photos = all.filter(p => isPublishable(p.label))
  const n = photos.length
  if (n === 0) return out

  if (n < 8) out.push({ id: 'count', severity: n < 4 ? 'high' : 'medium', text: `Tenés ${n} ${n === 1 ? 'foto' : 'fotos'}. Con 8 o más se ve completa y se consulta más.` })

  const unlabeled = photos.filter(p => !p.label || p.label === UNLABELED)
  if (unlabeled.length > 0) out.push({ id: 'unlabeled', severity: 'medium', text: `${unlabeled.length} ${unlabeled.length === 1 ? 'foto sin etiquetar' : 'fotos sin etiquetar'}. Etiquetalas en Mi propiedad (Living, Cocina…) para que el recorrido salga en orden.` })

  const labeled = new Set(photos.map(p => p.label))
  if (labeled.size > 1 || (labeled.size === 1 && !labeled.has(UNLABELED))) {
    const missing = ESSENTIAL_ROOMS.filter(r => !labeled.has(r))
    if (missing.length > 0) out.push({ id: 'missing', severity: 'high', text: `Faltan fotos de: ${missing.join(', ')}. Son lo primero que busca quien compra.` })
  }

  if (!photos.some(p => p.isCover)) out.push({ id: 'cover', severity: 'info', text: 'Elegí una portada: es la foto que decide si abren tu aviso. Que sea la de más impacto, de día.' })

  for (const p of photos) {
    const name = p.label && p.label !== UNLABELED ? p.label : 'Una foto'
    if (p.brightness !== undefined && p.brightness < 70) out.push({ id: `dark-${p.id}`, severity: 'medium', text: `${name} está oscura. Sacala de día, con luz natural y las ventanas abiertas.` })
    if (p.brightness !== undefined && p.brightness > 215) out.push({ id: `bright-${p.id}`, severity: 'info', text: `${name} está muy clara y puede perder detalle. Probá sacarla sin el sol de frente.` })
    if (p.width && p.width < 1000) out.push({ id: `small-${p.id}`, severity: 'medium', text: `${name} tiene poca resolución (${p.width} px de ancho). Con el celular en calidad normal alcanza.` })
    if (p.width && p.height && p.height > p.width * 1.15) out.push({ id: `tall-${p.id}`, severity: 'info', text: `${name} es vertical: los portales y el video la recortan. Mejor en horizontal.` })
  }

  return out.sort((a, b) => ORDER[a.severity] - ORDER[b.severity])
}

/** Mide ancho, alto y brillo medio de una foto. Solo navegador. */
export async function measurePhoto(url: string): Promise<{ width: number; height: number; brightness: number } | null> {
  if (typeof document === 'undefined') return null
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.crossOrigin = 'anonymous'
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('foto'))
      i.src = url
    })
    const c = document.createElement('canvas')
    c.width = 48; c.height = 48
    const ctx = c.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, 48, 48)
    const d = ctx.getImageData(0, 0, 48, 48).data
    let sum = 0
    for (let k = 0; k < d.length; k += 4) sum += 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]
    return { width: img.naturalWidth, height: img.naturalHeight, brightness: sum / (d.length / 4) }
  } catch { return null }
}
