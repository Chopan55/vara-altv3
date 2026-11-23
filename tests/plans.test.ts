import { describe, expect, it } from 'vitest'
import { PLANS, formatARS } from '@/lib/pricing/plans'

describe('planes', () => {
  it('tres planes mensuales con los precios definidos por Pancho', () => {
    expect(PLANS.map(p => p.priceARS)).toEqual([30000, 80000, 100000])
    expect(PLANS.every(p => p.priceMXN > 0)).toBe(true)
    expect(formatARS(80000)).toBe('$80.000')
  })
  it('las funciones con IA del plan Full van marcadas como beta', () => {
    const full = PLANS.find(p => p.id === 'full')!
    expect(full.beta?.length).toBeGreaterThan(0)
    expect(full.includes.join(' ')).not.toMatch(/IA/)
  })
})
