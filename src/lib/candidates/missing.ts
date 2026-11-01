/**
 * Datos que faltan en una propiedad para poder compararla, dichos en lenguaje
 * humano y con una acción concreta: escribirlos o preguntárselos al anunciante.
 */
export type MissingField = 'precio' | 'superficie' | 'ubicación'

const ARTICLE: Record<string, string> = { precio: 'el precio', superficie: 'la superficie', ubicación: 'la ubicación' }

function join(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`
}

/** "Me falta la superficie para poder compararla bien." */
export function sentenceFor(missing: string[]): string {
  if (missing.length === 0) return ''
  return `Me ${missing.length > 1 ? 'faltan' : 'falta'} ${join(missing.map(m => ARTICLE[m] ?? m))} para poder compararla bien.`
}

/** Cambio a guardar en la propiedad cuando la persona escribe el dato; null si no sirve. */
export function patchFor(field: string, raw: string): { price?: number; surface?: number; city?: string } | null {
  const value = raw.trim()
  if (!value) return null
  if (field === 'ubicación') return { city: value.slice(0, 80) }
  const n = Number(value.toLowerCase().replace(/m\s*[²2]|mts?|metros?/g, '').replace(/\D/g, ''))
  if (!Number.isFinite(n) || n <= 0) return null
  return field === 'precio' ? { price: n } : field === 'superficie' ? { surface: n } : null
}

/** Mensaje listo para mandarle al anunciante. */
export function advertiserMessage(missing: string[], title?: string): string {
  const what = join(missing.map(m => ARTICLE[m] ?? m))
  const about = title ? ` “${title}”` : ' que publicaron'
  return `Hola, buen día. Me interesa la propiedad${about}. ¿Me podrían confirmar ${what}? Muchas gracias.`
}
