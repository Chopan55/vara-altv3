/**
 * Capa D — Inteligencia de precio.
 *
 * Interpreta el precio PEDIDO de la propiedad contra los precios PEDIDOS de los
 * avisos comparables. Nunca habla de "valor de mercado" ni de precio de venta:
 * un aviso publicado no es una operación cerrada.
 *
 * Método (documentado en `PRICE_METHOD`):
 *   1. Solo entran avisos fuertes, con precio pedido, en la misma moneda.
 *   2. Cada precio se lleva al tamaño de la propiedad analizada cuando ambas
 *      superficies cubiertas se conocen y son del mismo orden (±30 %).
 *   3. Se descartan atípicos extremos con MAD (solo si hay 5 o más).
 *   4. Se calcula mediana ponderada y banda entre los percentiles 25 y 75
 *      ponderados. Los pesos combinan similitud, frescura y completitud.
 *   5. La banda se redondea: sin falsa precisión.
 */

import type { PriceBand, PricePosition, ScoredComparable } from './types'

export const PRICE_METHOD =
  'Mediana ponderada y banda intercuartil (P25–P75) de precios publicados de avisos ' +
  'comparables. Ponderación: similitud × frescura. Atípicos extremos excluidos con MAD. ' +
  'Precios pedidos, no de cierre.'

/** Un precio solo es atípico si además se aleja más de este % de la mediana. */
export const OUTLIER_MIN_RELATIVE_DISTANCE = 0.25

export interface PriceInput {
  subjectPrice?: number
  subjectCurrency?: 'USD' | 'ARS'
  subjectCoveredArea?: number
  comparables: ScoredComparable[]
}

export interface PriceCalc {
  band: PriceBand | null
  position: PricePosition
  differencePct: number | null
  used: ScoredComparable[]
  excludedOutliers: string[]
  notes: string[]
}

interface Point { value: number; weight: number; comp: ScoredComparable }

export function weightedPercentile(points: { value: number; weight: number }[], p: number): number {
  const sorted = [...points].sort((a, b) => a.value - b.value)
  const total = sorted.reduce((s, x) => s + x.weight, 0)
  if (sorted.length === 0 || total <= 0) return NaN
  const target = total * p
  let acc = 0
  for (const x of sorted) {
    acc += x.weight
    if (acc >= target) return x.value
  }
  return sorted[sorted.length - 1].value
}

function medianOf(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Redondea a un paso acorde a la magnitud: USD 397.842 → 395.000. */
export function roundPrice(n: number): number {
  const step = n >= 500_000 ? 10_000 : n >= 100_000 ? 5_000 : n >= 20_000 ? 1_000 : n >= 1_000 ? 100 : 10
  return Math.round(n / step) * step
}

export function calculatePrice(input: PriceInput): PriceCalc {
  const notes: string[] = []
  const currency = input.subjectCurrency ?? 'USD'

  const eligible = input.comparables.filter(c =>
    c.similarityScore >= 60 &&
    c.listing.priceProvenance === 'ASKING_PRICE' &&
    c.listing.price && c.listing.price > 0 &&
    // Un aviso sin moneda declarada no entra: asumir USD sería inventar un dato.
    c.listing.currency === currency,
  )

  const points: Point[] = eligible.map(c => {
    let value = c.listing.price as number
    const ca = c.listing.coveredArea
    const sa = input.subjectCoveredArea
    if (ca && sa) {
      const ratio = Math.min(ca, sa) / Math.max(ca, sa)
      if (ratio >= 0.7) value = (value / ca) * sa
    }
    return { value, weight: Math.max(0.01, c.weight), comp: c }
  })

  const excludedOutliers: string[] = []
  let kept = points
  if (points.length >= 5) {
    const med = medianOf(points.map(p => p.value))
    const mad = medianOf(points.map(p => Math.abs(p.value - med)))
    if (mad > 0) {
      kept = points.filter(p => {
        // Con precios muy agrupados el MAD tiende a cero y todo parece atípico:
        // por eso además exigimos una distancia relativa mínima a la mediana.
        const out =
          Math.abs(p.value - med) / (1.4826 * mad) > 3.5 &&
          Math.abs(p.value - med) / med > OUTLIER_MIN_RELATIVE_DISTANCE
        if (out) excludedOutliers.push(p.comp.listing.id)
        return !out
      })
    }
  }
  if (excludedOutliers.length) notes.push(`Se dejaron fuera ${excludedOutliers.length} aviso(s) con precio atípico.`)

  if (kept.length === 0) {
    return { band: null, position: 'UNKNOWN', differencePct: null, used: [], excludedOutliers, notes }
  }

  const median = weightedPercentile(kept, 0.5)
  const band: PriceBand = {
    low: roundPrice(weightedPercentile(kept, 0.25)),
    high: roundPrice(weightedPercentile(kept, 0.75)),
    median: roundPrice(median),
    currency,
    basis: 'ASKING_PRICE',
    method: PRICE_METHOD,
    sampleSize: kept.length,
  }
  if (band.low === band.high) {
    // Con pocos avisos casi iguales la banda colapsa: se abre ±3 % para no aparentar exactitud.
    band.low = roundPrice(band.median * 0.97)
    band.high = roundPrice(band.median * 1.03)
  }

  const used = kept.map(k => k.comp)
  if (!input.subjectPrice || input.subjectPrice <= 0) {
    return { band, position: 'UNKNOWN', differencePct: null, used, excludedOutliers, notes }
  }
  if (!input.subjectCurrency) {
    notes.push('El aviso no aclara la moneda: no se compara su precio con el rango.')
    return { band, position: 'UNKNOWN', differencePct: null, used, excludedOutliers, notes }
  }

  const diff = ((input.subjectPrice - median) / median) * 100
  const differencePct = Math.round(diff * 10) / 10
  let position: PricePosition
  if (input.subjectPrice > band.high && diff > 3) position = 'ABOVE'
  else if (input.subjectPrice < band.low && diff < -3) position = 'BELOW'
  else position = 'WITHIN'

  return { band, position, differencePct, used, excludedOutliers, notes }
}

const fmt = (n: number, cur: string) => `${cur} ${n.toLocaleString('es-AR')}`
const shortK = (n: number, cur: string) =>
  n >= 1000 ? `${cur} ${Math.round(n / 1000).toLocaleString('es-AR')}k` : fmt(n, cur)

/** Texto para mostrar. Siempre habla de precios publicados. */
export function interpretPrice(
  calc: PriceCalc,
  subjectPrice: number | undefined,
  currency: 'USD' | 'ARS',
  confidenceInsufficient: boolean,
): string {
  if (confidenceInsufficient || !calc.band) {
    return 'No encontré suficientes propiedades realmente comparables para darte todavía una referencia confiable.'
  }
  const range = `${shortK(calc.band.low, currency)}–${shortK(calc.band.high, currency).replace(currency + ' ', '')}`
  if (!subjectPrice) {
    return `Los avisos más comparables piden entre ${range}. Falta el precio de esta propiedad para ubicarla.`
  }
  const pct = Math.abs(calc.differencePct ?? 0)
  const approx = pct < 6 ? 'algo' : pct < 15 ? '' : 'bastante'
  switch (calc.position) {
    case 'ABOVE':
      return `El precio publicado (${fmt(subjectPrice, currency)}) está ${approx} por encima de los avisos más comparables, que piden entre ${range}.`.replace('  ', ' ')
    case 'BELOW':
      return `El precio publicado (${fmt(subjectPrice, currency)}) está ${approx} por debajo de los avisos más comparables, que piden entre ${range}.`.replace('  ', ' ')
    default:
      return `El precio publicado (${fmt(subjectPrice, currency)}) está dentro del rango de los avisos más comparables, que piden entre ${range}.`
  }
}
