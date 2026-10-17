/**
 * Capa C — Ranking por similitud.
 *
 * La cercanía sola no hace a un comparable: una casa y un departamento en la
 * misma calle son un mal par. Este módulo puntúa qué tan parecidos son dos
 * avisos y explica cada punto: nada de puntajes sin motivo.
 *
 * Un único sistema configurable (`SIMILARITY_CONFIG`). Los datos que faltan no
 * se toman como coincidencia: bajan el puntaje por completitud y se devuelven
 * en `missingComparisonFields`.
 */

import type { ListingFacts, PropertyCondition, SearchScope } from './types'

export const SIMILARITY_CONFIG = {
  /** Peso de cada dimensión. Importancia alta ≥ 15, fuerte 8–14, adicional < 8. */
  weights: {
    location: 20, kind: 15, bedrooms: 15, coveredArea: 15,
    landArea: 10, condition: 8, age: 4, bathrooms: 3,
    parking: 3, pool: 3, amenities: 2, expenses: 1, orientation: 1,
  },
  /** Cuánto vale la ubicación según el alcance en que apareció el aviso. */
  scopeValue: {
    SAME_COMMUNITY: 1, SAME_MICROZONE: 0.9, NEIGHBORHOOD: 0.6, CITY: 0.3, EQUIVALENT_ZONE: 0.25,
  } as Record<SearchScope, number>,
  /** Tipo distinto (casa vs departamento): el puntaje no puede superar esto. */
  kindMismatchCap: 25,
  /** Desde este puntaje cuenta como "realmente comparable". */
  strongThreshold: 60,
  /** La completitud puede restar hasta este porcentaje del puntaje. */
  maxCompletenessPenalty: 0.4,
} as const

type DimKey = keyof typeof SIMILARITY_CONFIG.weights

const CONDITION_ORDER: PropertyCondition[] = ['to_renovate', 'to_refresh', 'good', 'excellent', 'new']
const CONDITION_LABEL: Record<PropertyCondition, string> = {
  new: 'a estrenar', excellent: 'en excelente estado', good: 'en buen estado',
  to_refresh: 'a actualizar', to_renovate: 'a refaccionar',
}
const KIND_LABEL = { house: 'una casa', apartment: 'un departamento', ph: 'un PH', lot: 'un lote', other: 'otro tipo' } as const
const DIM_LABEL: Record<DimKey, string> = {
  location: 'ubicación', kind: 'tipo de propiedad', bedrooms: 'dormitorios',
  coveredArea: 'superficie cubierta', landArea: 'terreno', condition: 'estado',
  age: 'antigüedad', bathrooms: 'baños', parking: 'cocheras', pool: 'pileta',
  amenities: 'comodidades', expenses: 'expensas', orientation: 'orientación',
}

interface Dim { sim: number; reason?: string; diff?: string }

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

function areaSim(a: number, b: number, noun: string): Dim {
  const ratio = Math.min(a, b) / Math.max(a, b)
  const sim = clamp01((ratio - 0.5) / 0.5)
  if (ratio >= 0.93) return { sim, reason: `${noun} muy parecida (${Math.round(a)} m² vs ${Math.round(b)} m²)` }
  if (ratio < 0.8) return { sim, diff: `${noun}: ${Math.round(b)} m² contra ${Math.round(a)} m² del aviso que analizás` }
  return { sim }
}

function countSim(a: number, b: number, noun: string): Dim {
  const d = Math.abs(a - b)
  const sim = d === 0 ? 1 : d === 1 ? 0.55 : d === 2 ? 0.2 : 0
  if (d === 0) return { sim, reason: `Mismos ${noun} (${a})` }
  if (d >= 1) return { sim, diff: `Tiene ${b} ${noun} y el tuyo ${a}` }
  return { sim }
}

function compare(subject: ListingFacts, cand: ListingFacts, scope: SearchScope): Partial<Record<DimKey, Dim>> {
  const out: Partial<Record<DimKey, Dim>> = {}
  const scopeSim = SIMILARITY_CONFIG.scopeValue[scope]
  out.location = {
    sim: scopeSim,
    reason: scope === 'SAME_COMMUNITY'
      ? `Mismo ${subject.communityType === 'building' ? 'edificio' : 'barrio cerrado'}${subject.community ? ` (${subject.community})` : ''}`
      : scope === 'SAME_MICROZONE' ? 'Misma microzona'
      : scope === 'NEIGHBORHOOD' ? 'Mismo barrio' : undefined,
    diff: scope === 'CITY' || scope === 'EQUIVALENT_ZONE'
      ? 'Está en otra zona; sirve como referencia amplia' : undefined,
  }

  if (subject.kind && cand.kind) {
    const same = subject.kind === cand.kind
    out.kind = same
      ? { sim: 1, reason: `Ambas son ${KIND_LABEL[cand.kind]}` }
      : { sim: 0, diff: `Es ${KIND_LABEL[cand.kind]} y la tuya es ${KIND_LABEL[subject.kind]}` }
  }
  if (subject.bedrooms !== undefined && cand.bedrooms !== undefined) {
    out.bedrooms = countSim(subject.bedrooms, cand.bedrooms, 'dormitorios')
  }
  if (subject.coveredArea && cand.coveredArea) {
    out.coveredArea = areaSim(subject.coveredArea, cand.coveredArea, 'Superficie cubierta')
  } else if (subject.totalArea && cand.totalArea && !subject.coveredArea && !cand.coveredArea) {
    out.coveredArea = areaSim(subject.totalArea, cand.totalArea, 'Superficie total')
  }
  if (subject.landArea && cand.landArea) out.landArea = areaSim(subject.landArea, cand.landArea, 'Terreno')
  if (subject.condition && cand.condition) {
    const d = Math.abs(CONDITION_ORDER.indexOf(subject.condition) - CONDITION_ORDER.indexOf(cand.condition))
    const sim = d === 0 ? 1 : d === 1 ? 0.6 : d === 2 ? 0.25 : 0
    out.condition = d === 0
      ? { sim, reason: `Mismo estado (${CONDITION_LABEL[cand.condition]})` }
      : { sim, diff: `Está ${CONDITION_LABEL[cand.condition]} y la tuya ${CONDITION_LABEL[subject.condition]}` }
  }
  if (subject.ageYears !== undefined && cand.ageYears !== undefined) {
    const d = Math.abs(subject.ageYears - cand.ageYears)
    const sim = d <= 3 ? 1 : d <= 10 ? 0.7 : d <= 20 ? 0.4 : 0.1
    out.age = d <= 3 ? { sim, reason: 'Antigüedad similar' } : d > 10 ? { sim, diff: `Antigüedad: ${cand.ageYears} años contra ${subject.ageYears}` } : { sim }
  }
  if (subject.bathrooms !== undefined && cand.bathrooms !== undefined) {
    out.bathrooms = countSim(subject.bathrooms, cand.bathrooms, 'baños')
  }
  if (subject.parking !== undefined && cand.parking !== undefined) {
    out.parking = countSim(subject.parking, cand.parking, 'cocheras')
  }
  if (subject.pool !== undefined && cand.pool !== undefined) {
    out.pool = subject.pool === cand.pool
      ? { sim: 1 }
      : { sim: 0, diff: cand.pool ? 'Tiene pileta y la tuya no' : 'No tiene pileta y la tuya sí' }
  }
  if (subject.amenities?.length && cand.amenities?.length) {
    const a = new Set(subject.amenities)
    const shared = cand.amenities.filter(x => a.has(x)).length
    out.amenities = { sim: shared / Math.max(a.size, cand.amenities.length) }
  }
  if (subject.expenses && cand.expenses) {
    out.expenses = { sim: clamp01((Math.min(subject.expenses, cand.expenses) / Math.max(subject.expenses, cand.expenses) - 0.5) / 0.5) }
  }
  if (subject.orientation && cand.orientation) {
    out.orientation = { sim: subject.orientation === cand.orientation ? 1 : 0.3 }
  }
  return out
}

export interface SimilarityResult {
  score: number
  reasons: string[]
  differences: string[]
  missing: string[]
}

export function scoreSimilarity(
  subject: ListingFacts,
  cand: ListingFacts,
  scope: SearchScope,
): SimilarityResult {
  const w = SIMILARITY_CONFIG.weights
  const dims = compare(subject, cand, scope)
  const totalWeight = Object.values(w).reduce((a, b) => a + b, 0)

  let earned = 0
  let available = 0
  const reasons: string[] = []
  const differences: string[] = []
  const missing: string[] = []

  for (const key of Object.keys(w) as DimKey[]) {
    const d = dims[key]
    if (!d) {
      // Solo reportamos como faltante lo que importa para decidir (peso ≥ 3).
      if (w[key] >= 3 && key !== 'location') missing.push(DIM_LABEL[key])
      continue
    }
    available += w[key]
    earned += d.sim * w[key]
    if (d.reason) reasons.push(d.reason)
    if (d.diff) differences.push(d.diff)
  }

  if (available === 0) return { score: 0, reasons, differences, missing }

  const base = earned / available
  const coverage = available / totalWeight
  let score = base * (1 - SIMILARITY_CONFIG.maxCompletenessPenalty * (1 - coverage)) * 100

  const kindMismatch = dims.kind && dims.kind.sim === 0
  if (kindMismatch) score = Math.min(score, SIMILARITY_CONFIG.kindMismatchCap)

  return { score: Math.round(score), reasons, differences, missing }
}

export function isStrongMatch(score: number): boolean {
  return score >= SIMILARITY_CONFIG.strongThreshold
}
