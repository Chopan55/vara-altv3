/**
 * Proveedores de comparables que existen hoy y son reales.
 *
 * No hay búsqueda automática por zona (los portales la bloquean; ver
 * docs/VARA_BUY_WOW_V3_AUDIT.md §8). Lo que sí hay:
 *   - los avisos que la persona suma pegando links o texto
 *   - las propiedades que ya guardó o analizó
 * Un aviso que eligió la persona suele ser mejor comparable que uno que
 * encuentra una búsqueda. Una futura búsqueda automática sería otro
 * `ComparableProvider`, sin tocar el núcleo.
 */

import type { ScrapeResult } from '@/app/api/scrape-property/route'
import type { PropertyCandidate } from '@/lib/candidates/model'
import type { Property, PropertyType } from '@/types'
import type { UserProperty } from '@/lib/userProperties'
import { detectAmenities, detectCommunity } from './normalize'
import type { ComparableProvider } from './retrieval'
import type { ListingFacts, PropertyKind } from './types'

const KIND: Partial<Record<PropertyType, PropertyKind>> = {
  HOUSE: 'house', APARTMENT: 'apartment', PH: 'ph', LAND: 'lot',
}

export function listingFromCandidate(c: PropertyCandidate, now: Date = new Date()): ListingFacts | null {
  if (c.isMock) return null
  const text = [c.title, c.description, ...(c.features ?? [])].filter(Boolean).join(' . ')
  const amenities = detectAmenities(text)
  const currency = c.currency === 'USD' || c.currency === 'ARS' ? c.currency : undefined
  const hasPrice = c.price > 0 && !!currency

  return {
    id: c.id,
    url: c.sourceUrl,
    source: c.portal ?? 'propiedad guardada',
    title: c.title,
    country: c.country ?? 'AR',
    city: c.city || undefined,
    neighborhood: c.neighborhood || undefined,
    community: detectCommunity(text),
    address: c.address || undefined,
    kind: KIND[c.type],
    price: hasPrice ? c.price : undefined,
    currency: hasPrice ? currency : undefined,
    priceProvenance: hasPrice ? 'ASKING_PRICE' : 'UNKNOWN',
    bedrooms: c.bedrooms > 0 ? c.bedrooms : undefined,
    bathrooms: c.bathrooms > 0 ? c.bathrooms : undefined,
    coveredArea: c.coveredSurface && c.coveredSurface > 0 ? c.coveredSurface : undefined,
    totalArea: c.surface > 0 ? c.surface : undefined,
    ageYears: c.ageYears,
    expenses: c.expenses,
    amenities: amenities.length ? amenities : undefined,
    pool: amenities.includes('pileta') ? true : undefined,
    status: 'unknown',
    observedAt: new Date(c.addedAt || now.getTime()).toISOString(),
  }
}

export function candidatesProvider(candidates: PropertyCandidate[]): ComparableProvider {
  const listings = candidates
    .map(c => listingFromCandidate(c))
    .filter((l): l is ListingFacts => l !== null)
  return { name: 'Tus propiedades guardadas', fetch: async () => listings }
}

// ───────────────────────── Avisos que suma la persona ─────────────────────────

const COMPARABLES_KEY = 'vara_v3_comparables'
const MAX_USER_COMPARABLES = 30

export function readUserComparables(): ListingFacts[] {
  try {
    const raw = localStorage.getItem(COMPARABLES_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as ListingFacts[]) : []
  } catch { return [] }
}

export function addUserComparable(l: ListingFacts): ListingFacts[] {
  const next = [l, ...readUserComparables().filter(x => x.id !== l.id)].slice(0, MAX_USER_COMPARABLES)
  try { localStorage.setItem(COMPARABLES_KEY, JSON.stringify(next)) } catch { /* sin almacenamiento */ }
  return next
}

export function removeUserComparable(id: string): ListingFacts[] {
  const next = readUserComparables().filter(x => x.id !== id)
  try { localStorage.setItem(COMPARABLES_KEY, JSON.stringify(next)) } catch { /* sin almacenamiento */ }
  return next
}

export function userListingsProvider(listings: ListingFacts[]): ComparableProvider {
  return { name: 'Avisos que sumaste', fetch: async () => listings }
}

// ───────────────────────── Guardar la propiedad analizada ─────────────────────────

/** La propiedad analizada como `UserProperty`, para guardarla en el store de candidatos existente. */
export function userPropertyFromScrape(scrape: ScrapeResult): UserProperty {
  const d = scrape.data
  const n = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : 0)
  const text = [d.title, d.propertyType].filter(Boolean).join(' ').toLowerCase()
  const type: PropertyType =
    /\bph\b/.test(text) ? 'PH'
    : /departamento|depto|dpto/.test(text) ? 'APARTMENT'
    : /terreno|lote/.test(text) ? 'LAND' : 'HOUSE'

  const base: Property = {
    id: `v3-${Date.now()}`,
    type,
    operationType: 'sale',
    price: n(d.price),
    currency: d.currency === 'ARS' ? 'ARS' : 'USD',
    title: d.title?.trim() || 'Propiedad analizada',
    address: d.address ?? '',
    neighborhood: d.neighborhood ?? '',
    city: d.city ?? '',
    province: d.province ?? '',
    surface: n(d.totalM2) || n(d.coveredM2),
    coveredSurface: n(d.coveredM2) || undefined,
    rooms: n(d.rooms),
    bedrooms: n(d.bedrooms),
    bathrooms: n(d.bathrooms),
    garage: false,
    description: d.description ?? '',
    images: scrape.photos,
    features: d.features ?? [],
    expenses: n(d.expenses) || undefined,
  }
  return { ...base, source: 'imported', sourceUrl: scrape.url, portal: scrape.portal, incompleteFields: scrape.missingFields }
}
