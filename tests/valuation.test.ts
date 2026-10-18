import { describe, it, expect } from 'vitest'
import { estimateValue, similarity, adjustedPrice, type ValuationComp, type ValuationSubject } from '@/lib/valuation/model'

const subject: ValuationSubject = {
  price: 410000, currency: 'USD', type: 'house', neighborhood: 'Estancias del Pilar', city: 'Pilar',
  bedrooms: 4, bathrooms: 3, coveredSurface: 240, surface: 850, ageYears: 11, garage: true, pool: true,
}

const comp = (id: string, price: number, over: Partial<ValuationComp> = {}): ValuationComp => ({
  id, title: `Casa ${id}`, price, currency: 'USD', type: 'house', neighborhood: 'Estancias del Pilar', city: 'Pilar',
  bedrooms: 4, bathrooms: 3, coveredSurface: 240, surface: 850, ageYears: 10, garage: true, pool: true, ...over,
})

const NEAR = [
  comp('a', 385000), comp('b', 392000), comp('c', 398000), comp('d', 401000), comp('e', 405000), comp('f', 395000), comp('g', 390000),
]

describe('similitud', () => {
  it('una propiedad idéntica puntúa casi 1', () => {
    expect(similarity(subject, comp('x', 400000)).score).toBeGreaterThan(0.95)
  })

  it('un departamento de otra zona puntúa bajo y lo dice', () => {
    const s = similarity(subject, comp('x', 150000, { type: 'apartment', neighborhood: 'Palermo', city: 'CABA', bedrooms: 2, coveredSurface: 70, surface: 80 }))
    expect(s.score).toBeLessThan(0.3)
    expect(s.differences).toContain('mismo tipo')
  })

  it('con pocos datos del comparable el puntaje se penaliza', () => {
    const full = similarity(subject, comp('x', 400000)).score
    const poor = similarity(subject, { id: 'p', title: 'p', price: 400000, currency: 'USD', type: 'house' }).score
    expect(poor).toBeLessThan(full)
  })
})

describe('valor de referencia', () => {
  it('estima un RANGO (no un número exacto) con confianza y lectura del precio', () => {
    const v = estimateValue(subject, NEAR)
    if (v.status !== 'ok') throw new Error('debería estimar')
    expect(v.low).toBeLessThan(v.mid)
    expect(v.mid).toBeLessThan(v.high)
    expect(v.low).toBeGreaterThanOrEqual(385000)
    expect(v.high).toBeLessThanOrEqual(405000)
    expect(['ALTA', 'MEDIA']).toContain(v.confidence)
    expect(['LEVE_ARRIBA', 'ARRIBA']).toContain(v.verdict)
    expect(v.comps.filter(c => c.used)).toHaveLength(7)
  })

  it('con menos de 3 comparables parecidos no estima y dice cuántos faltan', () => {
    const v = estimateValue(subject, NEAR.slice(0, 2))
    expect(v.status).toBe('insufficient')
    if (v.status === 'insufficient') expect(v.needed).toBe(1)
  })

  it('los comparables poco parecidos no entran al rango', () => {
    const far = comp('lejos', 90000, { type: 'apartment', neighborhood: 'Palermo', city: 'CABA', bedrooms: 1, coveredSurface: 40, surface: 45, ageYears: 40, garage: false, pool: false })
    const v = estimateValue(subject, [...NEAR, far])
    if (v.status !== 'ok') throw new Error('debería estimar')
    expect(v.comps.find(c => c.comp.id === 'lejos')?.used).toBe(false)
    expect(v.low).toBeGreaterThan(300000)
  })

  it('ignora comparables en otra moneda y lo informa', () => {
    const v = estimateValue(subject, [...NEAR, comp('ars', 400000000, { currency: 'ARS' })])
    expect(v.ignoredOtherCurrency).toBe(1)
  })

  it('un precio muy por debajo del rango es "oportunidad aparente" y no propone ofertar menos', () => {
    const v = estimateValue({ ...subject, price: 330000 }, NEAR)
    if (v.status !== 'ok') throw new Error('debería estimar')
    expect(v.verdict).toBe('OPORTUNIDAD_APARENTE')
    expect(v.negotiation.offerLow).toBeNull()
  })

  it('un precio dentro del rango se lee como dentro', () => {
    const v = estimateValue({ ...subject, price: 396000 }, NEAR)
    if (v.status !== 'ok') throw new Error('debería estimar')
    expect(v.verdict).toBe('DENTRO')
    expect(v.gapPct).toBe(0)
  })

  it('un precio arriba sugiere una oferta inicial dentro del rango y nunca por encima de lo publicado', () => {
    const v = estimateValue({ ...subject, price: 460000 }, NEAR)
    if (v.status !== 'ok') throw new Error('debería estimar')
    expect(v.verdict).toBe('ARRIBA')
    expect(v.negotiation.margin).toBe('ALTO')
    expect(v.negotiation.offerHigh!).toBeLessThanOrEqual(460000)
    expect(v.negotiation.offerLow!).toBeLessThanOrEqual(v.negotiation.offerHigh!)
  })

  it('explica qué empuja el valor: pileta que casi nadie tiene', () => {
    const noPool = NEAR.map(c => ({ ...c, pool: false }))
    const v = estimateValue(subject, noPool)
    if (v.status !== 'ok') throw new Error('debería estimar')
    expect(v.pushUp.join(' ')).toMatch(/pileta/)
  })
})

describe('ajuste por tamaño', () => {
  it('escala el precio de un comparable más grande hacia abajo, menos que proporcional', () => {
    const big = comp('big', 500000, { coveredSurface: 360 })
    const adj = adjustedPrice(subject, big)
    expect(adj.adjusted).toBe(true)
    expect(adj.price).toBeLessThan(500000)
    expect(adj.price).toBeGreaterThan(500000 * (240 / 360))
  })

  it('no ajusta cuando la diferencia de tamaño es desproporcionada', () => {
    expect(adjustedPrice(subject, comp('x', 500000, { coveredSurface: 900 })).adjusted).toBe(false)
  })
})
