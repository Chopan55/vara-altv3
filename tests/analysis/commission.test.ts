import { describe, expect, it } from 'vitest'
import { parseCommissionPct, withCommission } from '@/lib/analysis/commission'
import type { TransactionCost } from '@/lib/analysis/types'

const cost: TransactionCost = {
  jurisdiction: 'AR', notIncluded: [], assumptions: [],
  lines: [{ id: 'price', label: 'Precio publicado', kind: 'KNOWN', min: 200000, max: 200000, currency: 'USD', basis: 'Aviso' }],
  totalRange: { min: 206000, max: 208000, currency: 'USD' },
}

describe('comisión', () => {
  it('interpreta el porcentaje con coma o punto y rechaza valores absurdos', () => {
    expect(parseCommissionPct('3')).toBe(3)
    expect(parseCommissionPct('2,5')).toBe(2.5)
    expect(parseCommissionPct('')).toBeNull()
    expect(parseCommissionPct('0')).toBeNull()
    expect(parseCommissionPct('25')).toBeNull()
    expect(parseCommissionPct('abc')).toBeNull()
  })
  it('suma la comisión al total', () => {
    const r = withCommission(cost, 3)
    expect(r.line?.min).toBe(6000)
    expect(r.totalRange).toEqual({ min: 212000, max: 214000, currency: 'USD' })
  })
  it('sin comisión no cambia nada', () => {
    expect(withCommission(cost, null)).toEqual({ line: null, totalRange: cost.totalRange })
  })
})

describe('comisión sin total estimable', () => {
  it('igual muestra el rubro si hay precio', () => {
    const ars = { ...cost, lines: [{ ...cost.lines[0], currency: 'ARS' as const }], totalRange: null }
    const r = withCommission(ars, 3)
    expect(r.line?.min).toBe(6000)
    expect(r.totalRange).toBeNull()
  })
})
