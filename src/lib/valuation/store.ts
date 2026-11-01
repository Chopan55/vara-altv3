import type { Property } from '@/types'
import type { ScrapedData } from '@/app/api/scrape-property/route'
import type { ValuationComp, ValuationSubject } from '@/lib/valuation/model'

/**
 * Comparables de cada propiedad: los que la persona cargó (link o a mano). Se guardan en este navegador
 * para que no se pierdan al salir de la pantalla. Sincronizarlos con la cuenta requiere una tabla (queda anotado).
 */
export const COMPS_KEY = 'vara_valuation_comps'

type Store = Record<string, ValuationComp[]>

function read(): Store {
  if (typeof localStorage === 'undefined') return {}
  try {
    const parsed = JSON.parse(localStorage.getItem(COMPS_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Store) : {}
  } catch { return {} }
}

function write(all: Store): void {
  try { localStorage.setItem(COMPS_KEY, JSON.stringify(all)) } catch { /* sin acceso al almacenamiento */ }
}

export function loadComps(propertyId: string): ValuationComp[] {
  const list = read()[propertyId]
  return Array.isArray(list) ? list : []
}

export function addComp(propertyId: string, comp: ValuationComp): ValuationComp[] {
  const all = read()
  const current = all[propertyId] ?? []
  // El mismo aviso no entra dos veces (mismo link o mismo id).
  const exists = current.some(c => c.id === comp.id || (comp.url && c.url === comp.url))
  const next = exists ? current : [...current, comp]
  write({ ...all, [propertyId]: next })
  return next
}

export function removeComp(propertyId: string, compId: string): ValuationComp[] {
  const all = read()
  const next = (all[propertyId] ?? []).filter(c => c.id !== compId)
  write({ ...all, [propertyId]: next })
  return next
}

const POOL = /pileta|piscina/i
const GARAGE = /cochera|garage|garaje/i

function typeKey(raw?: string): string | undefined {
  const t = (raw ?? '').toLowerCase()
  if (!t) return undefined
  if (/\bph\b/.test(t)) return 'ph'
  if (/depart|depto|monoamb/.test(t)) return 'apartment'
  if (/casa|chalet|duplex|quinta/.test(t)) return 'house'
  if (/terreno|lote/.test(t)) return 'land'
  return t
}

const PROPERTY_TYPE: Record<string, string> = { HOUSE: 'house', PH: 'ph', APARTMENT: 'apartment', LAND: 'land' }

const positive = (n?: number) => (typeof n === 'number' && n > 0 ? n : undefined)

/** La propiedad que se está evaluando, con solo los datos que realmente tiene. */
export function subjectFromProperty(p: Property): ValuationSubject {
  const text = [...(p.features ?? []), p.description ?? ''].join(' ')
  return {
    price: p.price,
    currency: p.currency === 'ARS' ? 'ARS' : 'USD',
    type: PROPERTY_TYPE[p.type] ?? undefined,
    neighborhood: p.neighborhood || undefined,
    city: p.city || undefined,
    bedrooms: positive(p.bedrooms),
    bathrooms: positive(p.bathrooms),
    coveredSurface: positive(p.coveredSurface),
    surface: positive(p.surface),
    ageYears: p.ageYears,
    garage: p.garage ? true : GARAGE.test(text) ? true : undefined,
    // Que no se mencione una pileta no prueba que no haya: queda sin dato.
    pool: POOL.test(text) ? true : undefined,
  }
}

/** Un aviso leído por el scraper → comparable. Null si no trae un precio. */
export function compFromScraped(url: string, data: ScrapedData): ValuationComp | null {
  if (!positive(data.price)) return null
  const text = [...(data.features ?? []), data.description ?? ''].join(' ')
  const age = (data.features ?? []).map(f => f.match(/antig[uü]edad:?\s*(\d+)/i)).find(Boolean)
  return {
    id: `link-${url}`,
    url,
    title: data.title || 'Propiedad comparable',
    price: data.price as number,
    currency: data.currency === 'ARS' ? 'ARS' : 'USD',
    type: typeKey(data.propertyType ?? data.title),
    neighborhood: data.neighborhood || undefined,
    city: data.city || undefined,
    bedrooms: positive(data.bedrooms),
    bathrooms: positive(data.bathrooms),
    coveredSurface: positive(data.coveredM2),
    surface: positive(data.totalM2),
    ageYears: age ? Number(age[1]) : undefined,
    garage: GARAGE.test(text) ? true : undefined,
    pool: POOL.test(text) ? true : undefined,
  }
}
