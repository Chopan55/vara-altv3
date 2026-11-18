import { describe, it, expect } from 'vitest'
import { parseListingText, findSurfaces } from '@/lib/scrape/parseText'
import { reviewSurfaces, lotFromDescription } from '@/lib/scrape/surfaces'

// Texto copiado de la página de un aviso real de MercadoLibre (MLA-3917651842), sin datos de contacto.
const AVISO = `Casa en Venta | Publicado hace 2 meses
Casa En Venta Ubicado En Estancias Del Pilar, Pilar, G.b.a. Zona Norte
Estancias del pilar, Pilar
US$
298.000
3 dorm.
2 baños
108 ha totales
Características del inmueble

Jardín: Sí
Cocheras: 1

Principales
Superficie total
108 ha
Superficie cubierta
1.080.000 m²
Dormitorios
3
Baños
2
Cocheras
1
Antigüedad
0 años
Ambientes
4
Descripción

Venta casa en Estancias del Pilar, el Recuerdo. Construída sobre un lote interno de 1066mts.
Desarrollada en una planta.
Cuenta con tres habitaciones, la principal en suite.`

describe('aviso de MercadoLibre pegado desde la página', () => {
  it('lee el precio aunque la moneda y el monto estén en líneas separadas', () => {
    expect(parseListingText(AVISO)).toMatchObject({ price: 298000, currency: 'USD' })
  })

  it('el título es el del aviso, no la línea de "Publicado hace…"', () => {
    expect(parseListingText(AVISO).title).toBe('Casa En Venta Ubicado En Estancias Del Pilar, Pilar, G.b.a. Zona Norte')
  })

  it('lee ambientes, dormitorios y baños de la ficha', () => {
    expect(parseListingText(AVISO)).toMatchObject({ rooms: 4, bedrooms: 3, bathrooms: 2 })
  })

  it('convierte hectáreas a m² y no descarta las superficies raras', () => {
    const d = parseListingText(AVISO)
    expect(d.totalM2).toBe(1_080_000)
    expect(d.coveredM2).toBe(1_080_000)
  })

  it('apartó la superficie absurda y ofrece el lote de la descripción', () => {
    const { data, warnings } = reviewSurfaces(parseListingText(AVISO))
    expect(data.totalM2).toBeUndefined()
    expect(data.coveredM2).toBeUndefined()
    expect(data.price).toBe(298000)
    expect(warnings.map(w => w.field).sort()).toEqual(['coveredM2', 'totalM2'])
    expect(warnings[0].suggestedLotM2).toBe(1066)
    expect(warnings[0].message).toContain('1.080.000 m²')
    expect(warnings[0].message).toContain('108 ha')
    expect(warnings[0].message).toContain('1.066 m²')
  })
})

describe('superficies', () => {
  it('hectáreas y m² en línea', () => {
    expect(findSurfaces('108 ha totales').map(s => s.m2)).toEqual([1_080_000])
    expect(findSurfaces('250 m² totales · 180 m² cubiertos').map(s => [s.kind, s.m2])).toEqual([['total', 250], ['covered', 180]])
  })

  it('una vivienda normal no genera avisos', () => {
    const { data, warnings } = reviewSurfaces({ title: 'Casa en Pilar', totalM2: 600, coveredM2: 220, price: 250000 })
    expect(warnings).toEqual([])
    expect(data).toMatchObject({ totalM2: 600, coveredM2: 220 })
  })

  it('un campo o lote grande es válido', () => {
    expect(reviewSurfaces({ title: 'Campo en venta 108 hectáreas', totalM2: 1_080_000 }).warnings).toEqual([])
    expect(reviewSurfaces({ title: 'Lote en Pilar', totalM2: 30_000 }).warnings).toEqual([])
  })

  it('cubierta mucho mayor que la total es un error aunque sea chica en términos absolutos', () => {
    const { warnings } = reviewSurfaces({ title: 'Departamento', totalM2: 50, coveredM2: 4_000 })
    expect(warnings).toHaveLength(1)
    expect(warnings[0].field).toBe('coveredM2')
  })

  it('sin sugerencia si la descripción no menciona un lote', () => {
    const { warnings } = reviewSurfaces({ title: 'Casa', totalM2: 900_000, description: 'Linda casa con pileta' })
    expect(warnings[0].suggestedLotM2).toBeUndefined()
  })

  it('lee el lote de la descripción en distintos formatos', () => {
    expect(lotFromDescription('lote interno de 1066mts')).toBe(1066)
    expect(lotFromDescription('Terreno de 1.200 m2 con parque')).toBe(1200)
    expect(lotFromDescription('sin datos')).toBeUndefined()
  })
})
