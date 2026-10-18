import { describe, it, expect } from 'vitest'
import { fromPortalSpecs, specNumber } from '@/lib/scrape/portalSpecs'

// Fragmento real de la ficha técnica de un aviso de MercadoLibre (Casa en Estancias del Pilar).
const ML_FRAGMENT =
  '..."specs":[{"id":"Superficie total","text":"1.279 m²"},{"id":"Superficie cubierta","text":"460 m²"},' +
  '{"id":"Dormitorios","text":"6"},{"id":"Baños","text":"7"},{"id":"Cocheras","text":"3"},{"id":"Antigüedad","text":"15 años"}]...' +
  '"description":"Casa en venta Amplios ambientes, 5 dormitorios y excelente sector exterior"'

describe('ficha técnica de portales', () => {
  it('toma dormitorios, baños, cocheras, superficies y antigüedad del aviso', () => {
    expect(fromPortalSpecs(ML_FRAGMENT)).toEqual({
      totalM2: 1279, coveredM2: 460, bedrooms: 6, bathrooms: 7, garageSpots: 3, ageYears: 15,
    })
  })

  it('manda la ficha, no el texto libre de la descripción (que dice 5)', () => {
    expect(fromPortalSpecs(ML_FRAGMENT).bedrooms).toBe(6)
  })

  it('sin ficha no inventa nada', () => {
    expect(fromPortalSpecs('<html>sin datos</html>')).toEqual({})
  })

  it('interpreta miles y decimales', () => {
    expect(specNumber('1.279 m²')).toBe(1279)
    expect(specNumber('87,5 m²')).toBe(87.5)
    expect(specNumber('sin dato')).toBeUndefined()
  })
})
