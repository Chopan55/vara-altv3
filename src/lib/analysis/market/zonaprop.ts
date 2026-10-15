/**
 * Registro de Zonaprop (vía Bright Data) → `ListingFacts`.
 *
 * Reglas:
 *  - Los datos de contacto (teléfonos, vendedor) NO se leen: ni se guardan ni
 *    se exponen. Solo entra lo que hace falta para comparar propiedades.
 *  - Un 0 en baños, dormitorios o ambientes se toma como dato ausente: el
 *    scraper codifica así lo que no pudo leer (una casa de 728 m² con 0 baños).
 *  - `Fecha_de_publicacion` vino con la fecha de hoy en las cinco muestras
 *    reales: es una fecha de actualización o renovación, no de publicación.
 *    Se usa como `lastUpdatedAt`. La antigüedad real la mide el store con la
 *    primera vez que vimos el aviso.
 */

import { detectAmenities, detectCommunity } from '../normalize'
import { isPlausiblePrice } from '../priceIntelligence'
import type { ListingFacts, PropertyCondition, PropertyKind } from '../types'

export type ZonapropRecord = Record<string, unknown>

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined

/** Número positivo desde number o string ("2159", "1.250,5"). 0 y vacío son ausencia. */
function pos(v: unknown): number | undefined {
  if (typeof v === 'number') return isFinite(v) && v > 0 ? v : undefined
  const s = str(v)
  if (!s) return undefined
  const cleaned = s.replace(/[^\d.,]/g, '')
  if (!cleaned) return undefined
  const normalized = cleaned.includes(',') && cleaned.includes('.')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned.replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')
  const n = parseFloat(normalized)
  return isFinite(n) && n > 0 ? n : undefined
}

function currencyOf(v: unknown): 'USD' | 'ARS' | undefined {
  const s = (str(v) ?? '').toLowerCase()
  if (/^(usd|u\$s|us\$|dolar|dólar)/.test(s)) return 'USD'
  if (/^(ars|\$|peso)/.test(s)) return 'ARS'
  return undefined
}

function kindOf(v: unknown): PropertyKind | undefined {
  const s = (str(v) ?? '').toLowerCase()
  if (s.includes('casa')) return 'house'
  if (s.includes('departamento') || s.includes('depto')) return 'apartment'
  if (/\bph\b/.test(s)) return 'ph'
  if (s.includes('terreno') || s.includes('lote')) return 'lot'
  return s ? 'other' : undefined
}

/** "10/15/26" (MM/DD/YY) → ISO. null si no se puede leer. */
export function parseZonapropDate(v: unknown): string | undefined {
  const m = (str(v) ?? '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!m) return undefined
  const month = Number(m[1])
  const day = Number(m[2])
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined
  const d = new Date(Date.UTC(year, month - 1, day))
  return isFinite(d.getTime()) ? d.toISOString() : undefined
}

function ageAndCondition(v: unknown): { ageYears?: number; condition?: PropertyCondition } {
  const s = (str(v) ?? '').toLowerCase()
  if (!s) return {}
  if (/estrenar|nueva/.test(s)) return { ageYears: 0, condition: 'new' }
  const m = s.match(/(\d{1,3})\s*a[ñn]os?/)
  if (m) return { ageYears: Number(m[1]) }
  return {} // "En construcción" y similares: sin dato de antigüedad
}

function statusOf(v: unknown): ListingFacts['status'] {
  const s = (str(v) ?? '').toLowerCase()
  if (!s) return 'unknown'
  if (s === 'online' || s === 'active') return 'active'
  if (/offline|inactive|sold|vendid|expired|removed/.test(s)) return 'removed'
  return 'unknown'
}

function photoKeys(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined
  const keys = v
    .filter((x): x is string => typeof x === 'string')
    .slice(0, 5)
    .map(u => u.split('?')[0].split('/').pop() ?? '')
    .filter(k => k.length > 6)
  return keys.length ? keys : undefined
}

export function listingFromZonaprop(r: ZonapropRecord, observedAt: Date = new Date()): ListingFacts | null {
  const url = str(r.url)
  const postingId = str(r.posting_id) ?? (typeof r.posting_id === 'number' ? String(r.posting_id) : undefined)
  if (!url || !/^https:\/\/(www\.)?zonaprop\.com\.ar\//.test(url)) return null
  const id = postingId ? `zp-${postingId}` : `zp-${url}`

  const rawPrice = pos(r.Precio)
  const currency = currencyOf(r.Currency)
  // "Consultar precio" llega a veces como USD 1: no es un precio de venta.
  const price = rawPrice && isPlausiblePrice(rawPrice, currency) ? rawPrice : undefined
  const hasPrice = !!price && !!currency
  const title = str(r.Title)
  const address = str(r.address)
  const description = str(r.Description)
  const text = [title, address, description].filter(Boolean).join(' . ')
  const community = detectCommunity(text)
  const amenities = detectAmenities(text)
  const { ageYears, condition } = ageAndCondition(r.Nueva_usada)
  const lat = typeof r.latitude === 'number' && isFinite(r.latitude) ? r.latitude : undefined
  const lng = typeof r.longitude === 'number' && isFinite(r.longitude) ? r.longitude : undefined

  return {
    id,
    url,
    source: 'Zonaprop',
    title,
    country: 'AR',
    city: str(r.Zona2),
    neighborhood: str(r.Zona3),
    community,
    communityType: community ? 'gated' : undefined,
    address,
    lat, lng,
    kind: kindOf(r.Tipo),
    price: hasPrice ? price : undefined,
    currency: hasPrice ? currency : undefined,
    priceProvenance: hasPrice ? 'ASKING_PRICE' : 'UNKNOWN',
    bedrooms: pos(r.Dormitorios),
    bathrooms: pos(r.Banos),
    coveredArea: pos(r.Dimension_propiedad),
    landArea: pos(r.Dimension_terreno),
    ageYears,
    condition,
    pool: amenities.includes('pileta') ? true : undefined,
    amenities: amenities.length ? amenities : undefined,
    expenses: pos(r.expenses),
    lastUpdatedAt: parseZonapropDate(r.Fecha_de_publicacion),
    status: statusOf(r.estatus),
    observedAt: observedAt.toISOString(),
    photoHashes: photoKeys(r.Imagenes),
  }
}

export function listingsFromZonaprop(records: ZonapropRecord[], observedAt: Date = new Date()): ListingFacts[] {
  const out: ListingFacts[] = []
  for (const r of records) {
    const l = listingFromZonaprop(r, observedAt)
    if (l) out.push(l)
  }
  return out
}
