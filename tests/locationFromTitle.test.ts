import { describe, it, expect } from 'vitest'
import { locationFromTitle, withLocationFromTitle } from '@/lib/scrape/locationFromTitle'

describe('ubicación desde el título de MercadoLibre', () => {
  it('lee barrio y ciudad y descarta la región', () => {
    expect(locationFromTitle('Casa  En Venta Ubicado En Estancias Del Pilar, Pilar, G.b.a. Zona Norte'))
      .toEqual({ neighborhood: 'Estancias Del Pilar', city: 'Pilar' })
  })

  it('con un solo dato antes de la región no inventa; sin región lee los dos', () => {
    expect(locationFromTitle('Departamento en venta ubicado en Belgrano, Capital Federal')).toEqual({})
    expect(locationFromTitle('Casa en venta ubicada en San Isidro Labrador, San Isidro'))
      .toEqual({ neighborhood: 'San Isidro Labrador', city: 'San Isidro' })
  })

  it('si no hay patrón o solo hay un dato, no inventa nada', () => {
    expect(locationFromTitle('Hermosa casa con pileta')).toEqual({})
    expect(locationFromTitle('Casa ubicada en Pilar')).toEqual({})
    expect(locationFromTitle(undefined)).toEqual({})
  })

  it('no pisa lo que ya vino del aviso', () => {
    const d = { title: 'Casa ubicada en Barrio Uno, Ciudad Dos', neighborhood: 'Otro barrio' }
    expect(withLocationFromTitle(d)).toBe(d)
    const e = { title: 'Casa ubicada en Barrio Uno, Ciudad Dos', city: 'Otra ciudad' }
    expect(withLocationFromTitle(e)).toBe(e)
  })

  it('completa cuando faltan ambos', () => {
    expect(withLocationFromTitle({ title: 'Casa ubicada en Barrio Uno, Ciudad Dos, G.b.a. Norte' }))
      .toEqual({ title: 'Casa ubicada en Barrio Uno, Ciudad Dos, G.b.a. Norte', neighborhood: 'Barrio Uno', city: 'Ciudad Dos' })
  })
})
