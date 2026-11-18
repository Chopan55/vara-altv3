/**
 * Los títulos de MercadoLibre llevan la ubicación ("Casa en venta ubicado en Estancias Del Pilar, Pilar, G.b.a. Zona Norte")
 * aunque la lectura no traiga la dirección. Sin barrio ni ciudad el análisis no tiene dónde buscar comparables.
 *
 * Regla acotada: solo se usa cuando faltan barrio Y ciudad, y solo con el patrón "ubicado en A, B[, región]".
 * Nunca pisa un dato que ya vino del aviso.
 */

const REGION = /(^|\b)(g\.?\s?b\.?\s?a\.?|gran buenos aires|zona\s+(norte|sur|oeste)|capital federal|caba|bs\.?\s?as\.?|buenos aires|provincia)(\b|$)/i

const isRegion = (s: string) => REGION.test(s)

export function locationFromTitle(title?: string): { neighborhood?: string; city?: string } {
  if (!title) return {}
  const m = title.match(/\bubicad[oa]s?\s+en\s+(.+)$/i)
  if (!m) return {}
  const parts = m[1].split(',').map(p => p.trim()).filter(Boolean)
  while (parts.length > 1 && isRegion(parts[parts.length - 1])) parts.pop()
  // Con un solo dato no se sabe si es barrio o ciudad: mejor no inventar.
  if (parts.length < 2) return {}
  const [neighborhood, city] = parts
  return { neighborhood, city }
}

/** Completa barrio y ciudad desde el título, solo si el aviso no trajo ninguno. */
export function withLocationFromTitle<T extends { title?: string; neighborhood?: string; city?: string }>(data: T): T {
  if (data.neighborhood || data.city) return data
  const loc = locationFromTitle(data.title)
  return loc.neighborhood || loc.city ? { ...data, ...loc } : data
}
