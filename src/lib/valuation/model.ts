/**
 * Motor de Valor de Referencia.
 *
 * Qué hace: toma el precio publicado de una propiedad y lo compara contra propiedades PARECIDAS que la
 * persona cargó (no contra un precio por m² genérico). Cada comparable recibe un puntaje de similitud;
 * con los más parecidos se arma un RANGO, una CONFIANZA y una lectura del precio publicado.
 *
 * Qué NO hace, a propósito:
 *  - No devuelve "vale USD 397.842". Devuelve un rango, porque el mercado no tiene esa precisión.
 *  - No es una tasación: compara precios PEDIDOS, no de cierre.
 *  - Con menos de MIN_USED comparables parecidos no estima: dice cuántos faltan.
 *  - Un precio bajo no es "oportunidad": es "revisá qué lo explica".
 *
 * Supuesto declarado: el precio crece menos que proporcional a la superficie cubierta, así que se ajusta
 * con un exponente (SIZE_ELASTICITY) y solo entre superficies de 0,5× a 2×.
 */

export interface ValuationSubject {
  price: number
  currency: 'USD' | 'ARS'
  type?: string
  neighborhood?: string
  city?: string
  bedrooms?: number
  bathrooms?: number
  coveredSurface?: number
  /** Superficie total / lote. */
  surface?: number
  ageYears?: number
  garage?: boolean
  pool?: boolean
}

export interface ValuationComp extends Omit<ValuationSubject, 'garage' | 'pool'> {
  id: string
  title: string
  url?: string
  garage?: boolean
  pool?: boolean
}

export const MIN_USED = 3
export const USED_THRESHOLD = 0.6
export const SIZE_ELASTICITY = 0.7

const WEIGHTS = { zone: 22, type: 14, bedrooms: 14, covered: 14, lot: 8, age: 8, bathrooms: 6, garage: 5, pool: 5 } as const
type Factor = keyof typeof WEIGHTS

const norm = (s?: string) => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
const has = (n?: number): n is number => typeof n === 'number' && isFinite(n) && n > 0

function ratioScore(a?: number, b?: number): number | null {
  if (!has(a) || !has(b)) return null
  const r = Math.min(a, b) / Math.max(a, b)
  if (r >= 0.9) return 1
  if (r <= 0.5) return 0
  return (r - 0.5) / 0.4
}
const stepScore = (a: number | undefined, b: number | undefined, full: number, half: number): number | null => {
  if (a === undefined || b === undefined) return null
  const d = Math.abs(a - b)
  return d <= full ? 1 : d <= half ? 0.5 : 0
}

export interface Similarity {
  /** 0–1. */
  score: number
  /** Qué parte del puntaje se pudo evaluar (0–1). Con poco dato, el puntaje se penaliza. */
  coverage: number
  matches: string[]
  differences: string[]
}

export function similarity(s: ValuationSubject, c: ValuationComp): Similarity {
  const parts: Partial<Record<Factor, number | null>> = {}

  const sz = norm(s.neighborhood), cz = norm(c.neighborhood)
  if (sz && cz) parts.zone = sz === cz || sz.includes(cz) || cz.includes(sz) ? 1 : (norm(s.city) && norm(s.city) === norm(c.city) ? 0.4 : 0)
  else if (norm(s.city) && norm(c.city)) parts.zone = norm(s.city) === norm(c.city) ? 0.4 : 0
  else parts.zone = null

  const st = norm(s.type), ct = norm(c.type)
  parts.type = st && ct ? (st === ct ? 1 : ['house', 'ph'].includes(st) && ['house', 'ph'].includes(ct) ? 0.3 : 0) : null
  parts.bedrooms = stepScore(s.bedrooms, c.bedrooms, 0, 1)
  parts.covered = ratioScore(s.coveredSurface, c.coveredSurface)
  parts.lot = ratioScore(s.surface, c.surface)
  parts.age = stepScore(s.ageYears, c.ageYears, 3, 10)
  parts.bathrooms = stepScore(s.bathrooms, c.bathrooms, 0, 1)
  parts.garage = s.garage === undefined || c.garage === undefined ? null : s.garage === c.garage ? 1 : 0
  parts.pool = s.pool === undefined || c.pool === undefined ? null : s.pool === c.pool ? 1 : 0

  let total = 0, evaluated = 0, got = 0
  const matches: string[] = [], differences: string[] = []
  const label: Record<Factor, string> = {
    zone: 'misma zona', type: 'mismo tipo', bedrooms: 'dormitorios', covered: 'superficie cubierta',
    lot: 'lote', age: 'antigüedad', bathrooms: 'baños', garage: 'cochera', pool: 'pileta',
  }
  for (const k of Object.keys(WEIGHTS) as Factor[]) {
    total += WEIGHTS[k]
    const v = parts[k]
    if (v === null || v === undefined) continue
    evaluated += WEIGHTS[k]
    got += WEIGHTS[k] * v
    if (v >= 0.9) matches.push(label[k])
    else if (v <= 0.3) differences.push(label[k])
  }
  const coverage = total ? evaluated / total : 0
  let score = evaluated ? got / evaluated : 0
  if (coverage < 0.6) score *= 0.85
  return { score, coverage, matches, differences }
}

/** Ajusta el precio de un comparable al tamaño de la propiedad evaluada. */
export function adjustedPrice(s: ValuationSubject, c: ValuationComp): { price: number; adjusted: boolean } {
  if (has(s.coveredSurface) && has(c.coveredSurface)) {
    const r = s.coveredSurface / c.coveredSurface
    if (r >= 0.5 && r <= 2) return { price: c.price * Math.pow(r, SIZE_ELASTICITY), adjusted: true }
  }
  return { price: c.price, adjusted: false }
}

function weightedQuantile(values: { v: number; w: number }[], q: number): number {
  const sorted = [...values].sort((a, b) => a.v - b.v)
  const total = sorted.reduce((t, x) => t + x.w, 0)
  let acc = 0
  for (let i = 0; i < sorted.length; i++) {
    const mid = (acc + sorted[i].w / 2) / total
    if (mid >= q) {
      if (i === 0) return sorted[0].v
      const prevMid = (acc - sorted[i - 1].w / 2) / total
      return sorted[i - 1].v + ((q - prevMid) / (mid - prevMid)) * (sorted[i].v - sorted[i - 1].v)
    }
    acc += sorted[i].w
  }
  return sorted[sorted.length - 1].v
}

const roundTo = (n: number) => { const step = n >= 100000 ? 1000 : n >= 10000 ? 500 : 100; return Math.round(n / step) * step }

export type Confidence = 'ALTA' | 'MEDIA' | 'BAJA'
export type Verdict = 'DENTRO' | 'LEVE_ARRIBA' | 'ARRIBA' | 'LEVE_ABAJO' | 'OPORTUNIDAD_APARENTE'

export interface ScoredComp { comp: ValuationComp; sim: Similarity; adjusted: boolean; adjustedPrice: number; used: boolean }

export type Valuation =
  | { status: 'insufficient'; used: number; needed: number; comps: ScoredComp[]; ignoredOtherCurrency: number }
  | {
      status: 'ok'
      low: number; mid: number; high: number
      confidence: Confidence
      avgSimilarity: number
      verdict: Verdict
      /** % respecto del extremo del rango más cercano (0 si está dentro). */
      gapPct: number
      negotiation: { margin: 'BAJO' | 'MODERADO' | 'ALTO'; offerLow: number | null; offerHigh: number | null }
      pushUp: string[]
      pushDown: string[]
      comps: ScoredComp[]
      ignoredOtherCurrency: number
    }

function drivers(s: ValuationSubject, used: ScoredComp[]): { up: string[]; down: string[] } {
  const up: string[] = [], down: string[] = []
  const avg = (f: (c: ValuationComp) => number | undefined) => {
    const xs = used.map(u => f(u.comp)).filter(has)
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined
  }
  const share = (f: (c: ValuationComp) => boolean | undefined) => {
    const xs = used.map(u => f(u.comp)).filter((x): x is boolean => x !== undefined)
    return xs.length ? xs.filter(Boolean).length / xs.length : undefined
  }
  const aBeds = avg(c => c.bedrooms)
  if (has(s.bedrooms) && aBeds !== undefined) { if (s.bedrooms - aBeds >= 1) up.push('más dormitorios que los comparables'); else if (aBeds - s.bedrooms >= 1) down.push('menos dormitorios que los comparables') }
  const aCov = avg(c => c.coveredSurface)
  if (has(s.coveredSurface) && aCov !== undefined) { if (s.coveredSurface > aCov * 1.15) up.push('más superficie cubierta'); else if (s.coveredSurface < aCov * 0.85) down.push('menos superficie cubierta') }
  const aLot = avg(c => c.surface)
  if (has(s.surface) && aLot !== undefined) { if (s.surface > aLot * 1.25) up.push('lote más grande'); else if (s.surface < aLot * 0.75) down.push('lote más chico') }
  const aAge = avg(c => c.ageYears)
  if (s.ageYears !== undefined && aAge !== undefined) { if (aAge - s.ageYears >= 5) up.push('más nueva que los comparables'); else if (s.ageYears - aAge >= 5) down.push('más antigua que los comparables') }
  const pool = share(c => c.pool)
  if (s.pool !== undefined && pool !== undefined) { if (s.pool && pool < 0.5) up.push('tiene pileta y la mayoría no'); else if (!s.pool && pool >= 0.5) down.push('no tiene pileta y la mayoría sí') }
  const gar = share(c => c.garage)
  if (s.garage !== undefined && gar !== undefined) { if (s.garage && gar < 0.5) up.push('tiene cochera y la mayoría no'); else if (!s.garage && gar >= 0.5) down.push('no tiene cochera y la mayoría sí') }
  return { up, down }
}

export function estimateValue(subject: ValuationSubject, comps: ValuationComp[]): Valuation {
  const sameCurrency = comps.filter(c => c.currency === subject.currency && has(c.price))
  const ignoredOtherCurrency = comps.length - sameCurrency.length

  const scored: ScoredComp[] = sameCurrency
    .map(comp => {
      const sim = similarity(subject, comp)
      const adj = adjustedPrice(subject, comp)
      return { comp, sim, adjusted: adj.adjusted, adjustedPrice: adj.price, used: sim.score >= USED_THRESHOLD }
    })
    .sort((a, b) => b.sim.score - a.sim.score)

  const used = scored.filter(c => c.used)
  if (used.length < MIN_USED) {
    return { status: 'insufficient', used: used.length, needed: MIN_USED - used.length, comps: scored, ignoredOtherCurrency }
  }

  const pts = used.map(u => ({ v: u.adjustedPrice, w: u.sim.score ** 2 }))
  const low = roundTo(weightedQuantile(pts, 0.25))
  const mid = roundTo(weightedQuantile(pts, 0.5))
  const high = roundTo(weightedQuantile(pts, 0.75))
  const avgSimilarity = used.reduce((t, u) => t + u.sim.score, 0) / used.length
  const spread = mid ? (high - low) / mid : 1

  const confidence: Confidence =
    used.length >= 5 && avgSimilarity >= 0.8 && spread <= 0.15 ? 'ALTA'
    : used.length >= 3 && avgSimilarity >= 0.7 && spread <= 0.3 ? 'MEDIA' : 'BAJA'

  const p = subject.price
  let verdict: Verdict = 'DENTRO'
  let gapPct = 0
  if (p > high) { gapPct = ((p - high) / high) * 100; verdict = gapPct > 8 ? 'ARRIBA' : 'LEVE_ARRIBA' }
  else if (p < low) { gapPct = ((low - p) / low) * 100; verdict = gapPct > 8 ? 'OPORTUNIDAD_APARENTE' : 'LEVE_ABAJO' }

  const margin = verdict === 'ARRIBA' ? 'ALTO' : verdict === 'LEVE_ARRIBA' ? 'MODERADO' : 'BAJO'
  const offerHigh = p > mid ? Math.min(mid, p) : null
  const offerLow = offerHigh === null ? null : Math.min(low, offerHigh)
  const d = drivers(subject, used)

  return {
    status: 'ok', low, mid, high, confidence, avgSimilarity, verdict,
    gapPct: Math.round(gapPct * 10) / 10,
    negotiation: { margin, offerLow, offerHigh },
    pushUp: d.up, pushDown: d.down, comps: scored, ignoredOtherCurrency,
  }
}
