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

const area = (l: ListingFacts) => l.coveredArea ?? l.totalArea

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

export function pairSignal(a: ListingFacts, b: ListingFacts): Signal {
  const ka = identityKey(a)
  const kb = identityKey(b)
  if (ka && kb && ka === kb) return 'CERTAIN'

  if (a.photoHashes?.length && b.photoHashes?.length) {
    const set = new Set(a.photoHashes)
    if (b.photoHashes.some(h => set.has(h))) return 'CERTAIN'
  }

  // Tipo distinto nunca es el mismo inmueble.
  if (a.kind && b.kind && a.kind !== b.kind) return null
  if (a.bedrooms !== undefined && b.bedrooms !== undefined && a.bedrooms !== b.bedrooms) return null

  const sameArea = within(area(a), area(b), 0.03)
  // Para la vía "solo características" las tolerancias son más estrictas: ahí
  // no hay dirección ni foto que respalde, y dos casas distintas pueden ser parecidas.
  const tightArea = within(area(a), area(b), 0.02)
  const samePrice = within(a.price, b.price, a.price && b.price && a.currency === b.currency ? 0.03 : 0)

  const addrA = norm(a.address ?? '')
  const addrB = norm(b.address ?? '')
  if (isSpecificAddress(addrA) && addrA === addrB && sameArea !== false) {
    const farPrice = within(a.price, b.price, 0.15) === false
    return farPrice ? 'PROBABLE' : 'CERTAIN'
  }

  // Solo por características: exige cuatro coincidencias y texto parecido.
  const sameLand = within(a.landArea, b.landArea, 0.05)
  const place = (l: ListingFacts) => norm(l.community ?? l.neighborhood ?? '')
  const sameLocation = !!place(a) && place(a) === place(b)
  const sameBeds = a.bedrooms !== undefined && a.bedrooms === b.bedrooms

  const hits = [sameBeds, tightArea === true, sameLocation, samePrice === true].filter(Boolean).length
  const contradicts = sameArea === false || sameLand === false
  const textSim = jaccard(tokens(a.title ?? a.description), tokens(b.title ?? b.description))

  if (hits >= 4 && !contradicts && textSim >= 0.6) return 'PROBABLE'
  return null
}

function completeness(l: ListingFacts): number {
  return Object.values(l).filter(v => v !== undefined && v !== null && v !== '').length
}

export function dedupeListings(listings: ListingFacts[]): DedupeResult {
  const n = listings.length
  const parent = Array.from({ length: n }, (_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  const weakEdge: [number, number][] = []

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const s = pairSignal(listings[i], listings[j])
      if (!s) continue
      parent[find(j)] = find(i)
      if (s === 'PROBABLE') weakEdge.push([i, j])
    }
  }

  const groups = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const root = find(i)
    groups.set(root, [...(groups.get(root) ?? []), i])
  }

  const kept: ListingFacts[] = []
  const mergedInto = new Map<string, string[]>()
  const uncertain = new Set<string>()
  let duplicatesMerged = 0

  for (const members of groups.values()) {
    const rep = members.reduce((a, b) => (completeness(listings[b]) > completeness(listings[a]) ? b : a))
    const repListing = listings[rep]
    kept.push(repListing)
    const others = members.filter(m => m !== rep).map(m => listings[m].id)
    mergedInto.set(repListing.id, others)
    duplicatesMerged += others.length
    if (weakEdge.some(([a, b]) => members.includes(a) && members.includes(b))) uncertain.add(repListing.id)
  }

  return { kept, mergedInto, uncertain, duplicatesMerged }
}
