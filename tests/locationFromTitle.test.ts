import { describe, it, expect } from 'vitest'
import { locationFromTitle, withLocationFromTitle, withSubjectLocation } from '@/lib/scrape/locationFromTitle'

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

describe('ubicación de un aviso pegado a partir de la propiedad analizada', () => {
  const subject = { neighborhood: 'Estancias Del Pilar', city: 'Pilar' }
  it('hereda barrio y ciudad solo si su propio texto nombra ese barrio', () => {
    const d = { title: 'Ruta 8 , Estancias del Pilar', description: 'Casa en una planta' }
    expect(withSubjectLocation(d, subject)).toMatchObject({ neighborhood: 'Estancias Del Pilar', city: 'Pilar', locationFromTitle: true })
  })
  it('acepta tildes y mayúsculas distintas', () => {
    const d: { title: string; neighborhood?: string } = { title: 'Casa en ÉSTANCIAS del pilar' }
    expect(withSubjectLocation(d, { neighborhood: 'Estáncias del Pilar', city: 'Pilar' }).neighborhood).toBe('Estáncias del Pilar')
  })
  it('si el texto no lo nombra, no inventa nada', () => {
    const d = { title: 'Casa en Barrio Santo Tomás', description: 'A 20 minutos de otro lado' }
    expect(withSubjectLocation(d, subject)).toEqual(d)
  })
  it('no pisa una ubicación que el aviso ya trae', () => {
    const d = { title: 'Estancias Del Pilar', city: 'Escobar' }
    expect(withSubjectLocation(d, subject)).toEqual(d)
  })
  it('ignora menciones que no están al comienzo del texto', () => {
    const d = { title: 'Casa en Escobar', description: 'x'.repeat(320) + ' Estancias Del Pilar' }
    expect(withSubjectLocation(d, subject)).toEqual(d)
  })
  it('sin barrio en la propiedad analizada, no hereda', () => {
    const d = { title: 'Casa en Pilar' }
    expect(withSubjectLocation(d, { city: 'Pilar' })).toEqual(d)
    expect(withSubjectLocation(d, undefined)).toEqual(d)
  })
})
