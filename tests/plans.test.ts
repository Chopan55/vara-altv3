import { describe, expect, it } from 'vitest'
import { EXTRA_CREDITS, PLANS, RATE_NOTE, formatARS, formatMXN } from '@/lib/pricing/plans'

describe('planes', () => {
  it('tres planes mensuales con los precios definidos por Pancho', () => {
    expect(PLANS.map(p => p.priceARS)).toEqual([30000, 50000, 80000])
    expect(PLANS.map(p => p.aiCredits)).toEqual([100, 250, 500])
    expect(PLANS.map(p => p.name)).toEqual(['Essential', 'Plus', 'Premium'])
    expect(PLANS.map(p => p.priceMXN)).toEqual([364, 606, 970])
    expect(PLANS.every(p => p.priceMXN > 0)).toBe(true)
    expect(formatARS(80000)).toBe('$80.000')
  })
  it('las funciones con IA del plan Premium van marcadas como beta', () => {
    const premium = PLANS.find(p => p.id === 'premium')!
    expect(premium.beta?.length).toBeGreaterThan(0)
    expect(premium.includes.join(' ')).not.toMatch(/IA/)
  })
  it('mantiene el paquete extra y la referencia configurable documentados', () => {
    expect(EXTRA_CREDITS).toMatchObject({ credits: 100, priceARS: 5000 })
    expect(formatMXN(EXTRA_CREDITS.priceMXN)).toMatch(/^MXN /)
    expect(RATE_NOTE).toMatch(/a confirmar/i)
  })
})
