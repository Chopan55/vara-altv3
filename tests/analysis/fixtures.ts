/**
 * Datos SINTÉTICOS para probar el motor de análisis.
 *
 * Existen solo en tests: nombres, precios y avisos inventados a propósito para
 * poder afirmar resultados esperados. Nada de acá puede importarse desde `src`
 * ni mostrarse en una pantalla.
 */

import type { ScrapeResult } from '@/app/api/scrape-property/route'
import type { ComparableProvider } from '@/lib/analysis/retrieval'
import type { Confidence, ListingFacts, PricePosition, SearchScope } from '@/lib/analysis/types'

export const NOW = new Date('2026-10-15T12:00:00Z')
const DAY = 86_400_000
export const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY).toISOString()

let seq = 0

/** Token único por aviso: títulos distintos, como en el mundo real. */
function uniqueWord(n: number): string {
  let s = ''
  let x = n + 1
  while (x > 0) { s = String.fromCharCode(97 + ((x - 1) % 26)) + s; x = Math.floor((x - 1) / 26) }
  return `zeta${s}`
}

/** Un aviso base: casa de 4 dormitorios en una comunidad inventada. */
export function L(over: Partial<ListingFacts> = {}): ListingFacts {
  seq += 1
  return {
    id: `fx-${seq}`,
    url: `https://portal.test/aviso-${seq}`,
    source: 'portal.test',
    title: `Aviso ${uniqueWord(seq)} ${uniqueWord(seq + 1000)}`,
    country: 'AR',
    city: 'Ciudad Test',
    neighborhood: 'Zona Test',
    community: 'Comunidad Uno',
    communityType: 'gated',
    kind: 'house',
    price: 400_000,
    currency: 'USD',
    priceProvenance: 'ASKING_PRICE',
    bedrooms: 4,
    bathrooms: 3,
    coveredArea: 250,
    landArea: 800,
    ageYears: 10,
    condition: 'good',
    publishedAt: daysAgo(20),
    status: 'active',
    observedAt: NOW.toISOString(),
    photoHashes: [`ph-${seq}`],
    ...over,
  }
}

/** Seis comparables fuertes, frescos, de la misma comunidad y precios 385–410k. */
export function strongSet(overrides: Partial<ListingFacts> = {}): ListingFacts[] {
  return [385_000, 390_000, 395_000, 400_000, 405_000, 410_000].map((price, i) =>
    L({ price, coveredArea: [245, 255, 248, 252, 250, 258][i], ...overrides }),
  )
}

/** La propiedad que analiza la persona, como la devolvería el importador. */
export function scrape(over: Partial<ScrapeResult['data']> = {}): ScrapeResult {
  return {
    status: 'success',
    url: 'https://sujeto.test/propiedad',
    portal: 'Zonaprop',
    method: 'json-ld',
    photos: [],
    missingFields: [],
    data: {
      title: 'Casa 4 dormitorios en barrio cerrado Comunidad Uno',
      description: '10 años de antigüedad',
      price: 400_000,
      currency: 'USD',
      neighborhood: 'Zona Test',
      city: 'Ciudad Test',
      propertyType: 'Casa',
      bedrooms: 4,
      bathrooms: 3,
      coveredM2: 250,
      totalM2: 1050,
      ...over,
    },
  }
}

export function provider(list: ListingFacts[], name = 'fixture'): ComparableProvider {
  return { name, fetch: async () => list }
}

// ───────────────────────── Casos curados ─────────────────────────

export interface EvalCase {
  name: string
  subject: ScrapeResult
  listings: ListingFacts[]
  expect: {
    confidence: Confidence
    scope?: SearchScope
    position?: PricePosition
    /** Rango de avisos fuertes esperado. */
    strong?: [number, number]
    duplicatesMerged?: number
    expanded?: boolean
  }
}

const dupSource = L({ title: 'Casa con jardín', price: 395_000, address: 'Calle Falsa 123 lote 45', photoHashes: ['dup-1', 'dup-2'] })

export const CASES: EvalCase[] = [
  {
    name: 'misma comunidad, evidencia fuerte, precio en línea',
    subject: scrape(),
    listings: strongSet(),
    expect: { confidence: 'HIGH', scope: 'SAME_COMMUNITY', position: 'WITHIN', strong: [6, 6], expanded: false },
  },
  {
    name: 'precio pedido muy por encima',
    subject: scrape({ price: 480_000 }),
    listings: strongSet(),
    expect: { confidence: 'HIGH', position: 'ABOVE' },
  },
  {
    name: 'precio pedido por debajo',
    subject: scrape({ price: 330_000 }),
    listings: strongSet(),
    expect: { confidence: 'HIGH', position: 'BELOW' },
  },
  {
    name: 'solo dos comparables débiles',
    subject: scrape(),
    listings: strongSet().slice(0, 2),
    expect: { confidence: 'INSUFFICIENT', position: 'UNKNOWN' },
  },
  {
    name: 'tres URLs de la misma propiedad cuentan una vez',
    subject: scrape(),
    listings: [
      dupSource,
      L({ title: 'Casa jardín venta', price: 395_000, photoHashes: ['dup-2', 'dup-9'] }),
      L({ title: 'Casa de jardín', price: 395_000, address: 'Calle Falsa 123 lote 45', coveredArea: dupSource.coveredArea, photoHashes: [] }),
      ...strongSet().slice(0, 3),
    ],
    expect: { confidence: 'MEDIUM', duplicatesMerged: 2, strong: [4, 4] },
  },
  {
    name: 'avisos muy viejos bajan la confianza',
    subject: scrape(),
    listings: strongSet({ publishedAt: daysAgo(300) }),
    expect: { confidence: 'MEDIUM' },
  },
  {
    name: 'poca evidencia local: amplía al barrio y lo registra',
    subject: scrape(),
    listings: [...strongSet().slice(0, 2), ...strongSet({ community: 'Comunidad Dos' }).slice(0, 4)],
    expect: { confidence: 'HIGH', scope: 'NEIGHBORHOOD', expanded: true },
  },
  {
    name: 'solo hay avisos de otra zona de la ciudad',
    subject: scrape(),
    listings: strongSet({ community: undefined, neighborhood: 'Otra Zona' }),
    expect: { confidence: 'MEDIUM', scope: 'CITY', expanded: true },
  },
  {
    name: 'un precio extremo no mueve el rango',
    subject: scrape(),
    listings: [...strongSet(), L({ price: 1_200_000, title: 'Comparable extremo' })],
    expect: { confidence: 'HIGH', position: 'WITHIN' },
  },
  {
    name: 'departamentos no son comparables de una casa',
    subject: scrape(),
    listings: strongSet({ kind: 'apartment', landArea: undefined }),
    expect: { confidence: 'INSUFFICIENT', strong: [0, 0] },
  },
  {
    name: 'la propiedad no informa superficie cubierta',
    subject: scrape({ coveredM2: undefined }),
    listings: strongSet(),
    expect: { confidence: 'MEDIUM' },
  },
]
