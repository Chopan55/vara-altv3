/**
 * Modelo de confianza.
 *
 * No es decorativo: sale de reglas explícitas y cada rebaja queda escrita en
 * `reasons`. Se parte de la cantidad de comparables fuertes y se baja un
 * escalón por cada debilidad medible.
 *
 *   base   n ≥ 6 → HIGH   |   n 4–5 → MEDIUM   |   n = 3 → LOW   |   n < 3 → INSUFFICIENT
 *   rebajas (una por cada una que aplique, mínimo LOW si n ≥ 3):
 *     · el alcance geográfico se amplió a ciudad o zona equivalente
 *     · la similitud mediana de los usados es menor a 70
 *     · más de la mitad de los avisos son viejos
 *     · la dispersión (ancho de banda / mediana) supera 35 %
 *     · más del 30 % de los avisos salió de una fusión de duplicados incierta
 *     · la propiedad analizada no informa su superficie cubierta
 */

import type { Confidence, ScoredComparable, SearchScope } from './types'

export const CONFIDENCE_CONFIG = {
  minUsable: 3,
  highAt: 6,
  mediumAt: 4,
  minMedianSimilarity: 70,
  maxStaleShare: 0.5,
  maxDispersion: 0.35,
  /** Desde acá el rango no sirve y la confianza es INSUFFICIENT. */
  maxUsableDispersion: 1,
  maxUncertainDuplicateShare: 0.3,
} as const

export interface ConfidenceInput {
  used: ScoredComparable[]
  scope: SearchScope
  band: { low: number; high: number; median: number } | null
  subjectHasCoveredArea: boolean
}

export interface ConfidenceResult {
  level: Confidence
  reasons: string[]
}

const ORDER: Confidence[] = ['INSUFFICIENT', 'LOW', 'MEDIUM', 'HIGH']

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function assessConfidence(input: ConfidenceInput, cfg = CONFIDENCE_CONFIG): ConfidenceResult {
  const n = input.used.length
  const reasons: string[] = []

  if (n < cfg.minUsable) {
    reasons.push(
      n === 0
        ? 'No hay avisos suficientemente parecidos.'
        : `Solo ${n} aviso${n > 1 ? 's' : ''} realmente comparable${n > 1 ? 's' : ''}; se necesitan al menos ${cfg.minUsable}.`,
    )
    return { level: 'INSUFFICIENT', reasons }
  }

  // Una banda más ancha que su propia mediana no es una referencia: es ruido.
  if (input.band && input.band.median > 0 && (input.band.high - input.band.low) / input.band.median > cfg.maxUsableDispersion) {
    reasons.push('Los precios de los avisos son tan distintos entre sí que no forman una referencia.')
    return { level: 'INSUFFICIENT', reasons }
  }

  let idx = n >= cfg.highAt ? 3 : n >= cfg.mediumAt ? 2 : 1
  reasons.push(`${n} avisos comparables fuertes.`)
  const drop = (why: string) => { idx = Math.max(1, idx - 1); reasons.push(why) }

  if (input.scope === 'CITY' || input.scope === 'EQUIVALENT_ZONE') {
    drop('Hubo que ampliar la búsqueda a una zona más amplia.')
  }
  if (median(input.used.map(c => c.similarityScore)) < cfg.minMedianSimilarity) {
    drop('Los avisos se parecen solo en parte a la propiedad.')
  }
  if (input.used.filter(c => c.freshness.stale).length / n > cfg.maxStaleShare) {
    drop('Más de la mitad de los avisos lleva mucho tiempo publicado.')
  }
  if (input.band && input.band.median > 0) {
    const dispersion = (input.band.high - input.band.low) / input.band.median
    if (dispersion > cfg.maxDispersion) drop('Los precios de los avisos están muy dispersos.')
  }
  if (input.used.filter(c => c.duplicateUncertain).length / n > cfg.maxUncertainDuplicateShare) {
    drop('No se pudo confirmar si algunos avisos son la misma propiedad.')
  }
  if (!input.subjectHasCoveredArea) {
    drop('Falta la superficie cubierta de esta propiedad para compararla bien.')
  }

  return { level: ORDER[idx], reasons }
}
