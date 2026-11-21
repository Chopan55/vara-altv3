/**
 * Comisión de la inmobiliaria como rubro opcional que carga el comprador.
 * VARA no supone un porcentaje: si hay comisión pactada, el comprador la
 * ingresa y se suma al total; si opera directo con el dueño, no se suma nada.
 */

import type { CostLine, TransactionCost } from './types'

/** Porcentaje válido entre 0 y 10 (con coma o punto), o null. */
export function parseCommissionPct(raw: string): number | null {
  const n = Number(raw.replace(',', '.').trim())
  if (!raw.trim() || !isFinite(n) || n <= 0 || n > 10) return null
  return n
}

export function withCommission(cost: TransactionCost, pct: number | null): { line: CostLine | null; totalRange: TransactionCost['totalRange'] } {
  const price = cost.lines.find(l => l.id === 'price')
  if (pct === null || !price || price.min === null) return { line: null, totalRange: cost.totalRange }
  const amount = Math.round(price.min * pct / 100)
  const line: CostLine = {
    id: 'commission', label: `${cost.jurisdiction === 'MX' ? 'Comisión del asesor inmobiliario' : 'Comisión de la inmobiliaria'} (${String(pct).replace('.', ',')}%)`, kind: 'KNOWN',
    min: amount, max: amount, currency: price.currency, basis: 'Dato que cargaste',
  }
  const t = cost.totalRange
  return { line, totalRange: t && t.currency === price.currency ? { ...t, min: t.min + amount, max: t.max + amount } : t }
}
