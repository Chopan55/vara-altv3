/**
 * Los títulos de MercadoLibre llevan la ubicación ("Casa en venta ubicado en Estancias Del Pilar, Pilar, G.b.a. Zona Norte")
 * aunque la lectura no traiga la dirección. Sin barrio ni ciudad el análisis no tiene dónde buscar comparables.
 *
 * Regla conservadora: solo con el patrón exacto "ubicado en A, B, <región>" (la región es obligatoria y se descarta),
 * con exactamente dos nombres de lugar no vacíos. Cualquier otra forma se rechaza: es mejor no tener ubicación que inventarla.
 * Solo se usa cuando faltan barrio Y ciudad y nunca pisa un dato del aviso. Quien la usa debe marcarla como inferida.
 */

const REGION = /^(g\.?\s?b\.?\s?a\.?(\s+(zona\s+)?(norte|sur|oeste))?|gran buenos aires|zona\s+(norte|sur|oeste)|capital federal|caba|bs\.?\s?as\.?(\s+g\.?\s?b\.?\s?a\.?(\s+(zona\s+)?(norte|sur|oeste))?)?|buenos aires|provincia de buenos aires)$/i

/** Un nombre de lugar: letras, números, espacios y . ' - ( ); corto y sin comas. */
const PLACE = /^[\p{L}0-9][\p{L}0-9 .'()-]{1,58}$/u

export function locationFromTitle(title?: string): { neighborhood?: string; city?: string } {
  if (!title) return {}
  const m = title.match(/\bubicad[oa]s?\s+en\s+(.+)$/i)
  if (!m) return {}
  const parts = m[1].split(',').map(p => p.trim())
  if (parts.some(p => p === '')) return {} // "A, , B": forma rota, no se interpreta
  let regions = 0
  while (parts.length > 2 && REGION.test(parts[parts.length - 1])) { parts.pop(); regions++ }
  if (regions === 0 || parts.length !== 2) return {}
  const [neighborhood, city] = parts
  if (!PLACE.test(neighborhood) || !PLACE.test(city) || REGION.test(neighborhood) || REGION.test(city)) return {}
  return { neighborhood, city }
}

/** Completa barrio y ciudad desde el título, solo si el aviso no trajo ninguno, y lo deja marcado como inferido. */
export function withLocationFromTitle<T extends { title?: string; neighborhood?: string; city?: string; locationFromTitle?: boolean }>(data: T): T {
  if (data.neighborhood || data.city) return data
  const loc = locationFromTitle(data.title)
  return loc.neighborhood && loc.city ? { ...data, ...loc, locationFromTitle: true } : data
}

const plain = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * Un aviso pegado como texto no trae barrio ni ciudad estructurados, y sin ellos no se puede ubicar entre los comparables.
 * Si el título o el comienzo de su texto nombra EXACTAMENTE el barrio de la propiedad analizada, se usa ese barrio (y su ciudad)
 * y queda marcado como inferido. Si no lo nombra, no se inventa nada.
 */
export function withSubjectLocation<T extends { title?: string; description?: string; neighborhood?: string; city?: string; locationFromTitle?: boolean }>(
  data: T, subject: { neighborhood?: string; city?: string } | undefined,
): T {
  if (data.neighborhood || data.city) return data
  const nb = subject?.neighborhood?.trim()
  if (!nb || nb.length < 4) return data
  const hay = plain(`${data.title ?? ''}\n${(data.description ?? '').slice(0, 300)}`)
  const needle = plain(nb).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (!new RegExp(`(^|[^a-z0-9])${needle}([^a-z0-9]|$)`).test(hay)) return data
  return { ...data, neighborhood: nb, ...(subject?.city ? { city: subject.city } : {}), locationFromTitle: true }
}
