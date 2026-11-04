import { describe, it, expect } from 'vitest'
import { parseAmount, chainStats } from '@/lib/negotiation/chain'

describe('parseAmount', () => {
  it('entiende miles con punto (formato argentino)', () => {
    expect(parseAmount('USD 120.000')).toBe(120000)
    expect(parseAmount('1.250.000')).toBe(1250000)
  })
  it('entiende miles con coma y decimales en ambos formatos', () => {
    expect(parseAmount('120,000')).toBe(120000)
    expect(parseAmount('120.000,50')).toBe(120000.5)
    expect(parseAmount('120,000.50')).toBe(120000.5)
    expect(parseAmount('1500,5')).toBe(1500.5)
  })
  it('número plano y texto sin número', () => {
    expect(parseAmount('120000')).toBe(120000)
    expect(parseAmount('a convenir')).toBeNull()
  })
})

describe('chainStats', () => {
  it('compara cada parte consigo misma y mide la brecha actual', () => {
    const s = chainStats([
      { quien: 'vendedor', monto: 'USD 150.000' },
      { quien: 'comprador', monto: '120000' },
      { quien: 'vendedor', monto: '140.000' },
      { quien: 'comprador', monto: '126.000' },
    ])
    expect(s.lastAsk).toBe(140000)
    expect(s.lastBid).toBe(126000)
    expect(s.gapPct).toBeCloseTo(10)
    expect(s.sellerMovePct).toBeCloseTo(-6.667, 2)
    expect(s.buyerMovePct).toBeCloseTo(5)
  })
  it('la inmobiliaria cuenta del lado del vendedor', () => {
    const s = chainStats([{ quien: 'inmobiliaria', monto: '100000' }, { quien: 'comprador', monto: '90000' }])
    expect(s.lastAsk).toBe(100000)
    expect(s.gapPct).toBeCloseTo(10)
  })
  it('con una sola parte no inventa brecha ni movimiento', () => {
    const s = chainStats([{ quien: 'vendedor', monto: '100000' }])
    expect(s).toEqual({ lastAsk: 100000, lastBid: null, gapPct: null, sellerMovePct: null, buyerMovePct: null })
  })
})
