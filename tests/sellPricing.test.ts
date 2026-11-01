import { describe, it, expect } from 'vitest'
import { planPricing, readListing } from '@/lib/sellPricing'

describe('estrategia de precio de venta', () => {
  it('sin superficie válida no inventa nada', () => {
    expect(planPricing(0, 'CABA')).toBeNull()
    expect(planPricing(NaN, 'CABA')).toBeNull()
  })

  it('arma rango, punto de partida y revisión 5% abajo', () => {
    const p = planPricing(100, 'CABA')!
    expect(p.range).toEqual({ min: 180000, max: 260000 })
    expect(p.start).toBe(220000)
    expect(p.fallback).toBe(209000)
  })

  it('ubica el precio deseado respecto del rango', () => {
    expect(planPricing(100, 'CABA', 300000)!.desired!.position).toBe('ABOVE')
    expect(planPricing(100, 'CABA', 150000)!.desired!.position).toBe('BELOW')
    expect(planPricing(100, 'CABA', 220000)!.desired!.position).toBe('IN')
  })

  it('lee la publicación según días, consultas, visitas y ofertas', () => {
    expect(readListing({ daysListed: 5, inquiries: 0, visits: 0, offers: 0 }).tone).toBe('wait')
    expect(readListing({ daysListed: 30, inquiries: 0, visits: 0, offers: 0 }).tone).toBe('review')
    expect(readListing({ daysListed: 30, inquiries: 10, visits: 1, offers: 0 }).tone).toBe('review')
    expect(readListing({ daysListed: 30, inquiries: 10, visits: 5, offers: 0 }).tone).toBe('ok')
    expect(readListing({ daysListed: 2, inquiries: 1, visits: 1, offers: 1 }).tone).toBe('ok')
  })
})
