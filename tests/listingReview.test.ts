import { describe, it, expect } from 'vitest'
import { reviewListing } from '@/lib/listingReview'

const long = Array.from({ length: 70 }, () => 'palabra').join(' ')

describe('revisión de aviso publicado', () => {
  it('un aviso vacío marca todo como faltante y puntaje 0', () => {
    const r = reviewListing({ data: {}, photoCount: 0 })
    expect(r.score).toBe(0)
    expect(r.items.every(i => i.status === 'missing')).toBe(true)
    expect(r.items.find(i => i.id === 'priceFit')).toBeUndefined()
  })

  it('un aviso completo puntúa alto', () => {
    const r = reviewListing({
      data: { title: 'Casa de 4 dormitorios con jardín en Pilar', price: 250000, currency: 'USD', totalM2: 200, rooms: 6, bedrooms: 4, bathrooms: 3, expenses: 50, description: long, features: ['Jardín', 'Pileta', 'Cochera'], province: 'Buenos Aires' },
      photoCount: 12,
    })
    expect(r.items.find(i => i.id === 'photos')!.status).toBe('ok')
    expect(r.score).toBeGreaterThanOrEqual(85)
  })

  it('pocas fotos y descripción corta quedan como a reforzar', () => {
    const r = reviewListing({ data: { description: 'corta', title: 'Casa' }, photoCount: 5 })
    expect(r.items.find(i => i.id === 'photos')!.status).toBe('weak')
    expect(r.items.find(i => i.id === 'description')!.status).toBe('weak')
    expect(r.items.find(i => i.id === 'title')!.status).toBe('weak')
  })

  it('compara el precio por m² con la referencia solo si hay datos en dólares', () => {
    const caro = reviewListing({ data: { price: 600000, currency: 'USD', totalM2: 100, province: 'CABA' }, photoCount: 0 })
    expect(caro.items.find(i => i.id === 'priceFit')!.status).toBe('weak')
    const pesos = reviewListing({ data: { price: 600000, currency: 'ARS', totalM2: 100, province: 'CABA' }, photoCount: 0 })
    expect(pesos.items.find(i => i.id === 'priceFit')).toBeUndefined()
  })
})
