import { describe, it, expect } from 'vitest'
import { buildPack } from '@/lib/propertyPack'

describe('Property Pack', () => {
  it('sin datos queda vacío y no inventa nada', () => {
    const p = buildPack({}, [])
    expect(p.isEmpty).toBe(true)
    expect(p.facts).toEqual([])
    expect(p.priceLine).toBeNull()
    expect(p.location).toBeNull()
  })

  it('arma solo con lo cargado', () => {
    const p = buildPack({ title: 'Casa en Pilar', price: '250000', currency: 'USD', bedrooms: '3', surface: ' 400 ', city: 'Pilar', neighborhood: 'Estancias', features: ['Jardín'] }, ['Escritura'])
    expect(p.isEmpty).toBe(false)
    expect(p.priceLine).toContain('250')
    expect(p.location).toBe('Estancias, Pilar')
    expect(p.facts).toEqual([{ label: 'Superficie total', value: '400 m²' }, { label: 'Dormitorios', value: '3' }])
    expect(p.features).toEqual(['Jardín'])
    expect(p.documents).toEqual(['Escritura'])
  })
})
