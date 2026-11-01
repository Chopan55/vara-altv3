/**
 * Frescura de un aviso.
 *
 * Un aviso viejo no se descarta: se pondera. Una publicación de hace ocho
 * meses dice algo (nadie pagó ese precio todavía), pero no pesa lo que una de
 * ayer. Si no hay ninguna fecha del portal, lo único que sabemos es cuándo lo
 * vimos nosotros, que no es cuándo se publicó: se trata como desconocido y se
 * le da un peso intermedio en vez de fingir que es fresco.
 */

import type { FreshnessInfo, ListingFacts } from './types'

export const FRESHNESS_CONFIG = {
  /** Cada tantos días el peso se reduce a la mitad. */
  halfLifeDays: 60,
  /** Piso: un aviso viejo nunca llega a cero. */
  minWeight: 0.15,
  /** Desde acá se lo marca como viejo y se lo muestra al usuario. */
  staleAfterDays: 120,
  /** Peso cuando no hay fecha del portal. */
  unknownWeight: 0.6,
  /** Multiplicador si el aviso figura dado de baja. */
  removedFactor: 0.3,
} as const

const DAY_MS = 86_400_000

function daysBetween(fromIso: string, now: Date): number | null {
  const t = Date.parse(fromIso)
  if (!isFinite(t)) return null
  return Math.max(0, Math.floor((now.getTime() - t) / DAY_MS))
}

/** La fecha más reciente que conocemos, con la que la respalda. */
function bestDate(l: ListingFacts, now: Date): { age: number; basis: FreshnessInfo['basis'] } | null {
  const candidates: { age: number | null; basis: FreshnessInfo['basis'] }[] = [
    { age: l.priceChangedAt ? daysBetween(l.priceChangedAt, now) : null, basis: 'PRICE_CHANGE' },
    { age: l.lastUpdatedAt ? daysBetween(l.lastUpdatedAt, now) : null, basis: 'LAST_UPDATE' },
    { age: l.publishedAt ? daysBetween(l.publishedAt, now) : null, basis: 'PUBLICATION' },
  ]
  const known = candidates.filter((c): c is { age: number; basis: FreshnessInfo['basis'] } => c.age !== null)
  if (known.length === 0) return null
  return known.reduce((a, b) => (b.age < a.age ? b : a))
}

export function computeFreshness(
  l: ListingFacts,
  now: Date = new Date(),
  cfg = FRESHNESS_CONFIG,
): FreshnessInfo {
  const best = bestDate(l, now)
  const removed = l.status === 'removed'

  if (!best) {
    const seen = daysBetween(l.observedAt, now)
    return {
      ageDays: seen,
      basis: 'OBSERVED',
      weight: removed ? cfg.unknownWeight * cfg.removedFactor : cfg.unknownWeight,
      stale: removed,
      note: removed
        ? 'El aviso figura dado de baja y no tiene fecha de publicación.'
        : 'El aviso no informa desde cuándo está publicado.',
    }
  }

  const decay = Math.pow(0.5, best.age / cfg.halfLifeDays)
  let weight = Math.max(cfg.minWeight, decay)
  if (removed) weight *= cfg.removedFactor
  const stale = removed || best.age > cfg.staleAfterDays

  return {
    ageDays: best.age,
    basis: best.basis,
    weight: Math.round(weight * 1000) / 1000,
    stale,
    note: stale
      ? removed
        ? 'El aviso figura dado de baja.'
        : `Publicado hace más de ${Math.round(cfg.staleAfterDays / 30)} meses.`
      : undefined,
  }
}
