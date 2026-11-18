import { describe, it, expect } from 'vitest'
import { locationFromTitle, withLocationFromTitle } from '@/lib/scrape/locationFromTitle'

describe('ubicación desde el título de MercadoLibre', () => {
  it('lee barrio y ciudad y descarta la región', () => {
    expect(locationFromTitle('Casa  En Venta Ubicado En Estancias Del Pilar, Pilar, G.b.a. Zona Norte'))
      .toEqual({ neighborhood: 'Estancias Del Pilar', city: 'Pilar' })
  })

  it('la región es obligatoria y debe quedar exactamente barrio + ciudad', () => {
    expect(locationFromTitle('Casa ubicada en Barrio Uno, Ciudad Dos')).toEqual({}) // sin región: ambiguo
    expect(locationFromTitle('Departamento en venta ubicado en Belgrano, Capital Federal')).toEqual({}) // un solo nombre
    expect(locationFromTitle('Casa ubicada en Pilar')).toEqual({})
    expect(locationFromTitle('Casa ubicada en A, B, C, G.b.a. Norte')).toEqual({}) // tres nombres: ambiguo
  })

  it('rechaza formas rotas o con sufijos desconocidos', () => {
    expect(locationFromTitle('Casa ubicada en Pilar, , GBA, Argentina')).toEqual({})
    expect(locationFromTitle('Casa ubicada en Pilar, GBA, Argentina')).toEqual({})
    expect(locationFromTitle('Casa ubicada en <script>, Pilar, G.b.a. Norte')).toEqual({})
  })

  it('sin patrón no inventa nada', () => {
    expect(locationFromTitle('Hermosa casa con pileta')).toEqual({})
    expect(locationFromTitle(undefined)).toEqual({})
  })

  it('no pisa lo que ya vino del aviso', () => {
    const d = { title: 'Casa ubicada en Barrio Uno, Ciudad Dos, G.b.a. Norte', neighborhood: 'Otro barrio' }
    expect(withLocationFromTitle(d)).toBe(d)
    const e = { title: 'Casa ubicada en Barrio Uno, Ciudad Dos, G.b.a. Norte', city: 'Otra ciudad' }
    expect(withLocationFromTitle(e)).toBe(e)
  })

  it('cuando completa, lo deja marcado como inferido', () => {
    expect(withLocationFromTitle({ title: 'Casa ubicada en Barrio Uno, Ciudad Dos, G.b.a. Norte' }))
      .toEqual({ title: 'Casa ubicada en Barrio Uno, Ciudad Dos, G.b.a. Norte', neighborhood: 'Barrio Uno', city: 'Ciudad Dos', locationFromTitle: true })
  })
})
