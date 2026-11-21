/**
 * «Plata para el cierre»: cuánto preparar en cada moneda. En Argentina el
 * precio se suele pagar en dólares y el escribano liquida los gastos en pesos
 * (ver nota en lib/regulations). La cotización la carga el comprador; VARA no
 * la inventa.
 */

import type { TransactionCost } from './types'

export function parseRate(raw: string): number | null {
  const n = Number(raw.replace(/\./g, '').replace(',', '.').trim())
  if (!raw.trim() || !isFinite(n) || n <= 0) return null
  return n
}

export interface ClosingCash {
  priceUSD: number
  feesUSD: { min: number; max: number }
  feesARS: { min: number; max: number } | null
}

export function closingCash(cost: TransactionCost, rate: number | null): ClosingCash | null {
  if (cost.jurisdiction !== 'AR' || !cost.totalRange || cost.totalRange.currency !== 'USD') return null
  const price = cost.lines.find(l => l.id === 'price')
  if (!price || price.min === null || price.currency !== 'USD') return null
  const fees = cost.lines.filter(l => l.kind === 'ESTIMATED')
  const min = fees.reduce((s, l) => s + (l.min ?? 0), 0)
  const max = fees.reduce((s, l) => s + (l.max ?? 0), 0)
  return {
    priceUSD: price.min,
    feesUSD: { min, max },
    feesARS: rate ? { min: Math.round(min * rate), max: Math.round(max * rate) } : null,
  }
}
