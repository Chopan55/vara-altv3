/**
 * Deduplicación de avisos.
 *
 * La misma propiedad aparece en varios portales, con varias inmobiliarias y
 * con links distintos. Contarla tres veces infla la evidencia: tres avisos
 * parecen un mercado y son una sola casa.
 *
 * Dos niveles de certeza:
 *   CERTAIN   mismo id/link, o comparten una foto, o misma dirección + medidas.
 *   PROBABLE  mismas características y texto parecido, sin dirección ni foto
 *             en común. Se fusionan pero se marcan inciertos, porque dos
 *             unidades idénticas del mismo edificio existen. La confianza
 *             final baja cuando hay fusiones inciertas.
 *
 * Rendimiento: comparar todos contra todos es O(n²). Lo caro (normalizar
 * textos, parsear URLs, armar conjuntos) se hace UNA vez por aviso en
 * `prepare`, y cada par solo hace comparaciones baratas. Medido con 350
 * avisos: de ~2,9 s a decenas de milisegundos por análisis.
 */

import type { ListingFacts } from './types'
import { norm } from './normalize'

type Signal = 'CERTAIN' | 'PROBABLE' | null

export interface DedupeResult {
  kept: ListingFacts[]
  /** id del representante → ids fusionados dentro de él. */
  mergedInto: Map<string, string[]>
  /** Representantes cuyo grupo incluye una fusión no confirmada. */
  uncertain: Set<string>
  duplicatesMerged: number
}

function identityKey(l: ListingFacts): string | null {
  const meli = (l.url ?? l.id).match(/MLA-?(\d{6,})/i)
  if (meli) return `mla:${meli[1]}`
  if (!l.url) return null
  try {
    const u = new URL(l.url)
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`.toLowerCase()
  } catch {
    return l.url.toLowerCase()
  }
}

function within(a: number | undefined, b: number | undefined, tol: number): boolean | null {
  if (!a || !b) return null
  return Math.abs(a - b) / Math.max(a, b) <= tol
}

/**
 * Una dirección identifica una propiedad solo si trae un número de calle real.
 * Las comunidades publican la misma dirección para todas sus casas
 * ("Mayling c.c 0, Mayling, Pilar"): tratarla como identidad fusionaría casas distintas.
 */
export function isSpecificAddress(normalized: string): boolean {
  if (normalized.length < 6) return false
  return normalized.split(' ').some(t => /^\d+$/.test(t) && Number(t) > 0)
}

function tokens(s?: string): Set<string> {
  return new Set(norm(s ?? '').split(/\s+/).filter(t => t.length > 3))
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  return inter / (a.size + b.size - inter)
}

/** Lo que hace falta de un aviso para compararlo, calculado una sola vez. */
interface Prepared {
  l: ListingFacts
  key: string | null
  photos: Set<string> | null
  addr: string | null        // solo si es una dirección específica
  place: string
  area: number | undefined
  tokens: Set<string>
  completeness: number
}

function prepare(l: ListingFacts): Prepared {
  const addr = norm(l.address ?? '')
  return {
    l,
    key: identityKey(l),
    photos: l.photoHashes?.length ? new Set(l.photoHashes) : null,
    addr: isSpecificAddress(addr) ? addr : null,
    place: norm(l.community ?? l.neighborhood ?? ''),
    area: l.coveredArea ?? l.totalArea,
    tokens: tokens(l.title ?? l.description),
    completeness: Object.values(l).filter(v => v !== undefined && v !== null && v !== '').length,
  }
}

function signal(a: Prepared, b: Prepared): Signal {
  if (a.key && b.key && a.key === b.key) return 'CERTAIN'

  if (a.photos && b.photos) {
    for (const h of b.photos) if (a.photos.has(h)) return 'CERTAIN'
  }

  // Tipo distinto nunca es el mismo inmueble.
  if (a.l.kind && b.l.kind && a.l.kind !== b.l.kind) return null
  if (a.l.bedrooms !== undefined && b.l.bedrooms !== undefined && a.l.bedrooms !== b.l.bedrooms) return null

  const sameArea = within(a.area, b.area, 0.03)

  if (a.addr && a.addr === b.addr && sameArea !== false) {
    const farPrice = within(a.l.price, b.l.price, 0.15) === false
    return farPrice ? 'PROBABLE' : 'CERTAIN'
  }

  // Solo por características: exige cuatro coincidencias y texto parecido. Las
  // tolerancias son más estrictas: ahí no hay dirección ni foto que respalde, y
  // dos casas distintas pueden ser parecidas.
  const tightArea = within(a.area, b.area, 0.02)
  const samePrice = within(a.l.price, b.l.price, a.l.price && b.l.price && a.l.currency === b.l.currency ? 0.03 : 0)
  const sameLand = within(a.l.landArea, b.l.landArea, 0.05)
  const sameLocation = !!a.place && a.place === b.place
  const sameBeds = a.l.bedrooms !== undefined && a.l.bedrooms === b.l.bedrooms

  const hits = [sameBeds, tightArea === true, sameLocation, samePrice === true].filter(Boolean).length
  if (hits < 4) return null
  const contradicts = sameArea === false || sameLand === false
  if (contradicts) return null

  return jaccard(a.tokens, b.tokens) >= 0.6 ? 'PROBABLE' : null
}

export function pairSignal(a: ListingFacts, b: ListingFacts): Signal {
  return signal(prepare(a), prepare(b))
}

export function dedupeListings(listings: ListingFacts[]): DedupeResult {
  const n = listings.length
  const prepared = listings.map(prepare)
  const parent = Array.from({ length: n }, (_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  const weakEdge: [number, number][] = []

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const s = signal(prepared[i], prepared[j])
      if (!s) continue
      parent[find(j)] = find(i)
      if (s === 'PROBABLE') weakEdge.push([i, j])
    }
  }

  const groups = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const root = find(i)
    const g = groups.get(root)
    if (g) g.push(i)
    else groups.set(root, [i])
  }

  const kept: ListingFacts[] = []
  const mergedInto = new Map<string, string[]>()
  const uncertain = new Set<string>()
  let duplicatesMerged = 0

  for (const members of groups.values()) {
    const rep = members.reduce((a, b) => (prepared[b].completeness > prepared[a].completeness ? b : a))
    const repListing = listings[rep]
    kept.push(repListing)
    const others = members.filter(m => m !== rep).map(m => listings[m].id)
    mergedInto.set(repListing.id, others)
    duplicatesMerged += others.length
    if (members.length > 1) {
      const set = new Set(members)
      if (weakEdge.some(([a, b]) => set.has(a) && set.has(b))) uncertain.add(repListing.id)
    }
  }

  return { kept, mergedInto, uncertain, duplicatesMerged }
}
