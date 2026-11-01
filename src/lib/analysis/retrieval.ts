/**
 * Capa A — Recuperación de comparables.
 *
 * Busca posibles comparables en los proveedores disponibles y decide hasta
 * dónde ampliar la búsqueda. Orden: la misma entidad (barrio cerrado, edificio,
 * desarrollo) primero; en barrios abiertos, lo más local posible. Solo se
 * amplía cuando la evidencia fuerte no alcanza, y queda registrado por qué.
 *
 * Cada país o fuente es un `ComparableProvider`: el núcleo no sabe de portales.
 * Hoy los proveedores reales son los avisos que pega la persona y sus
 * candidatos; una búsqueda automática por zona sería otro proveedor.
 *
 * Con los datos actuales la geografía llega hasta barrio/ciudad: sin
 * coordenadas no se puede decir "a 3 cuadras", y no lo decimos.
 */

import { log } from '@/lib/observability/logger'
import { computeFreshness } from './freshness'
import { dedupeListings } from './dedupe'
import { isStrongMatch, scoreSimilarity } from './similarity'
import { norm, } from './normalize'
import { pairSignal } from './dedupe'
import type {
  ListingFacts, RetrievalSummary, ScoredComparable, SearchScope,
} from './types'

export interface ProviderQuery {
  subject: ListingFacts
  scope: SearchScope
}

export interface ComparableProvider {
  name: string
  fetch(query: ProviderQuery): Promise<ListingFacts[]>
}

export interface RetrievalOptions {
  now?: Date
  /** Con tantos avisos fuertes no se amplía más. */
  targetStrong?: number
  /** Barrios que la persona o el sistema consideran equivalentes (solo si se informan). */
  equivalentNeighborhoods?: string[]
}

export interface RetrievalResult {
  matches: ScoredComparable[]
  summary: RetrievalSummary
}

const SCOPE_LABEL: Record<SearchScope, string> = {
  SAME_COMMUNITY: 'dentro de la misma comunidad',
  SAME_MICROZONE: 'en la misma microzona',
  NEIGHBORHOOD: 'en el mismo barrio',
  CITY: 'en la misma ciudad',
  EQUIVALENT_ZONE: 'en zonas equivalentes',
}

const eq = (a?: string, b?: string) => !!a && !!b && norm(a) === norm(b)

export function classifyScope(
  subject: ListingFacts,
  cand: ListingFacts,
  equivalent: string[] = [],
): SearchScope | null {
  if (eq(subject.community, cand.community)) return 'SAME_COMMUNITY'
  if (eq(subject.microzone, cand.microzone)) return 'SAME_MICROZONE'
  if (eq(subject.neighborhood, cand.neighborhood)) return 'NEIGHBORHOOD'
  if (eq(subject.city, cand.city)) return 'CITY'
  if (cand.neighborhood && equivalent.some(e => eq(e, cand.neighborhood))) return 'EQUIVALENT_ZONE'
  return null
}

export function scopeLadder(subject: ListingFacts, equivalent: string[] = []): SearchScope[] {
  const ladder: SearchScope[] = []
  if (subject.community) ladder.push('SAME_COMMUNITY')
  else if (subject.microzone) ladder.push('SAME_MICROZONE')
  if (subject.neighborhood) ladder.push('NEIGHBORHOOD')
  if (subject.city) ladder.push('CITY')
  if (equivalent.length) ladder.push('EQUIVALENT_ZONE')
  // Sin ninguna ubicación no hay por dónde empezar.
  return ladder.length ? ladder : ['CITY']
}

export async function retrieveComparables(
  subject: ListingFacts,
  providers: ComparableProvider[],
  opts: RetrievalOptions = {},
): Promise<RetrievalResult> {
  const now = opts.now ?? new Date()
  const target = opts.targetStrong ?? 5
  const equivalent = opts.equivalentNeighborhoods ?? []
  const ladder = scopeLadder(subject, equivalent)

  const providerStats = new Map<string, { name: string; ok: boolean; count: number; reason?: string }>()
  const pool = new Map<string, ListingFacts>()
  const tried: SearchScope[] = []
  let expansionReason: string | null = null
  let matches: ScoredComparable[] = []
  let candidatesFound = 0
  let afterDedup = 0
  let duplicatesMerged = 0

  for (let i = 0; i < ladder.length; i++) {
    const scope = ladder[i]
    tried.push(scope)

    await Promise.all(providers.map(async p => {
      try {
        const got = await p.fetch({ subject, scope })
        const prev = providerStats.get(p.name)
        providerStats.set(p.name, { name: p.name, ok: true, count: (prev?.count ?? 0) + got.length })
        for (const l of got) pool.set(l.id, l)
      } catch (err) {
        // Un proveedor caído nunca rompe el análisis: queda anotado y seguimos.
        log.warn('analysis.provider.failed', p.name, { scope })
        providerStats.set(p.name, {
          name: p.name, ok: false, count: providerStats.get(p.name)?.count ?? 0,
          reason: err instanceof Error ? err.message.slice(0, 120) : 'error',
        })
      }
    }))

    // La propiedad analizada puede estar publicada en otro portal: no es su propio comparable.
    const candidates = [...pool.values()].filter(l => pairSignal(subject, l) !== 'CERTAIN')
    candidatesFound = candidates.length

    const dedup = dedupeListings(candidates)
    afterDedup = dedup.kept.length
    duplicatesMerged = dedup.duplicatesMerged

    matches = dedup.kept
      .map((l): ScoredComparable | null => {
        const cls = classifyScope(subject, l, equivalent)
        if (!cls || ladder.indexOf(cls) < 0 || ladder.indexOf(cls) > i) return null
        const sim = scoreSimilarity(subject, l, cls)
        const freshness = computeFreshness(l, now)
        const completeness = Math.max(0.5, 1 - sim.missing.length * 0.05)
        return {
          listing: l,
          scope: cls,
          similarityScore: sim.score,
          similarityReasons: sim.reasons,
          importantDifferences: sim.differences,
          missingComparisonFields: sim.missing,
          freshness,
          weight: Math.round((sim.score / 100) * freshness.weight * completeness * 1000) / 1000,
          mergedDuplicateIds: dedup.mergedInto.get(l.id) ?? [],
          duplicateUncertain: dedup.uncertain.has(l.id),
        }
      })
      .filter((m): m is ScoredComparable => m !== null)
      .sort((a, b) => b.similarityScore - a.similarityScore)

    const strong = matches.filter(m => isStrongMatch(m.similarityScore)).length
    if (strong >= target || i === ladder.length - 1) break

    expansionReason =
      `Encontré ${strong} aviso${strong === 1 ? '' : 's'} fuerte${strong === 1 ? '' : 's'} ${SCOPE_LABEL[scope]}; ` +
      `amplié la búsqueda para incluir avisos ${SCOPE_LABEL[ladder[i + 1]]}.`
  }

  // El alcance informado es el más amplio que de verdad aportó avisos fuertes:
  // intentar una zona más grande y no encontrar nada nuevo no debilita la evidencia.
  const strongScopes = matches.filter(m => isStrongMatch(m.similarityScore)).map(m => ladder.indexOf(m.scope))
  const reachedIdx = strongScopes.length ? Math.max(...strongScopes) : ladder.indexOf(tried[tried.length - 1])
  const reached = ladder[reachedIdx]
  const widenedWithoutGain = tried.length > 1 && reachedIdx < ladder.indexOf(tried[tried.length - 1])

  // Sin ningún aviso disponible no hubo nada que ampliar: decirlo sería ruido.
  let reason: string | null = null
  if (tried.length > 1 && candidatesFound > 0) {
    reason = widenedWithoutGain
      ? `Busqué también ${SCOPE_LABEL[tried[tried.length - 1]]} y no apareció nada más parecido.`
      : expansionReason
  }

  return {
    matches,
    summary: {
      searchScope: reached,
      searchExpansionReason: reason,
      scopesTried: tried,
      candidatesFound,
      afterDedup,
      duplicatesMerged,
      providers: [...providerStats.values()],
    },
  }
}
