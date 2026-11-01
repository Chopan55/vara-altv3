import { describe, it, expect } from 'vitest'
import {
  scoreCandidates, explainWinner, mergeScoringWeights, countAmenities, parseAgeFromFeatures,
  weightsWithData, dataCoverage,
  DEFAULT_SCORING_WEIGHTS, type ScoringWeight, type ScoringCriterion, type ManualAttrs,
} from '@/lib/candidates/model'
import type { Property } from '@/types'

function prop(over: Partial<Property> & { id: string }): Property {
  return {
    type: 'HOUSE', operationType: 'sale', price: 0, currency: 'USD', title: over.id,
    address: '', neighborhood: '', city: '', province: '', surface: 0, rooms: 0,
    bedrooms: 0, bathrooms: 0, garage: false, description: '', images: [], features: [],
    ...over,
  }
}

/** Solo estos criterios activos, con el mismo peso. */
function only(...criteria: ScoringCriterion[]): ScoringWeight[] {
  return DEFAULT_SCORING_WEIGHTS.map(w => ({ ...w, enabled: criteria.includes(w.criterion), weight: 10 }))
}

const scoreOf = (scores: { candidateId: string; score: number }[], id: string) =>
  scores.find(s => s.candidateId === id)!.score

describe('countAmenities', () => {
  it('cuenta los amenities declarados y no los marcados "No"', () => {
    expect(countAmenities(['Jardín: Sí', 'Pileta: Sí', 'Antigüedad: 10 años'])).toBe(2)
    expect(countAmenities(['Pileta: No', 'Parrilla'])).toBe(1)
  })
  it('sin datos devuelve null, no 0: no es lo mismo "ninguno" que "no sabemos"', () => {
    expect(countAmenities([])).toBeNull()
  })
})

describe('parseAgeFromFeatures', () => {
  it('lee la antigüedad que mandan los portales como texto', () => {
    expect(parseAgeFromFeatures(['Jardín: Sí', 'Antigüedad: 10 años'])).toBe(10)
    expect(parseAgeFromFeatures(['Antigüedad 3'])).toBe(3)
  })
  it('"a estrenar" es antigüedad 0', () => {
    expect(parseAgeFromFeatures(['A estrenar'])).toBe(0)
  })
  it('sin dato devuelve null', () => {
    expect(parseAgeFromFeatures([])).toBeNull()
    expect(parseAgeFromFeatures(['Pileta: Sí'])).toBeNull()
  })
})

describe('scoreCandidates con los criterios nuevos', () => {
  it('acepta una Property común, no solo un candidato', () => {
    const scores = scoreCandidates(
      [prop({ id: 'a', price: 100 }), prop({ id: 'b', price: 200 })], only('price'),
    )
    expect(scoreOf(scores, 'a')).toBeGreaterThan(scoreOf(scores, 'b'))
  })

  it('baños: más baños gana', () => {
    const scores = scoreCandidates(
      [prop({ id: 'a', bathrooms: 1 }), prop({ id: 'b', bathrooms: 3 })], only('bathrooms'),
    )
    expect(scoreOf(scores, 'b')).toBeGreaterThan(scoreOf(scores, 'a'))
  })

  it('antigüedad: menos años gana, aunque venga como texto de portal', () => {
    const scores = scoreCandidates(
      [prop({ id: 'vieja', features: ['Antigüedad: 40 años'] }), prop({ id: 'nueva', ageYears: 2 })],
      only('age'),
    )
    expect(scoreOf(scores, 'nueva')).toBeGreaterThan(scoreOf(scores, 'vieja'))
  })

  it('cochera: se detecta en lo que declara el aviso, porque el importador no la completa', () => {
    const scores = scoreCandidates(
      [prop({ id: 'con', features: ['Cochera: 2'] }), prop({ id: 'sin', features: ['Jardín: Sí'] })],
      only('garage'),
    )
    expect(scoreOf(scores, 'con')).toBeGreaterThan(scoreOf(scores, 'sin'))
  })

  it('amenities: gana la que declara más', () => {
    const scores = scoreCandidates(
      [prop({ id: 'a', features: ['Pileta: Sí', 'Jardín: Sí'] }), prop({ id: 'b', features: ['Jardín: Sí'] })],
      only('amenities'),
    )
    expect(scoreOf(scores, 'a')).toBeGreaterThan(scoreOf(scores, 'b'))
  })

  it('luz y estado vienen de lo que cargó la persona', () => {
    const manual: Record<string, ManualAttrs> = {
      a: { light: 3, condition: 4 },
      b: { light: 1, condition: 1 },
    }
    const props = [prop({ id: 'a' }), prop({ id: 'b' })]
    const scores = scoreCandidates(props, only('light', 'condition'), manual)
    expect(scoreOf(scores, 'a')).toBeGreaterThan(scoreOf(scores, 'b'))
  })

  it('sin datos manuales, luz y estado no mueven el orden (no se inventan)', () => {
    const props = [prop({ id: 'a', price: 100 }), prop({ id: 'b', price: 200 })]
    const withUnknown = scoreCandidates(props, only('price', 'light', 'condition'))
    expect(scoreOf(withUnknown, 'a')).toBeGreaterThan(scoreOf(withUnknown, 'b'))
  })

  it('un criterio desactivado no cuenta', () => {
    const props = [prop({ id: 'a', bathrooms: 1 }), prop({ id: 'b', bathrooms: 9 })]
    const off = DEFAULT_SCORING_WEIGHTS.map(w => ({ ...w, enabled: false }))
    expect(scoreOf(scoreCandidates(props, off), 'b')).toBe(0)
  })

  it('cambiar el peso cambia el ganador', () => {
    const barata = prop({ id: 'barata', price: 100, surface: 50, bathrooms: 1 })
    const amplia = prop({ id: 'amplia', price: 300, surface: 200, bathrooms: 4 })
    const porPrecio = scoreCandidates([barata, amplia], only('price'))
    const porBanos = scoreCandidates([barata, amplia], only('bathrooms'))
    expect(scoreOf(porPrecio, 'barata')).toBeGreaterThan(scoreOf(porPrecio, 'amplia'))
    expect(scoreOf(porBanos, 'amplia')).toBeGreaterThan(scoreOf(porBanos, 'barata'))
  })
})

describe('mergeScoringWeights', () => {
  it('completa con los criterios nuevos sin perder lo que la persona ya configuró', () => {
    const antiguos: ScoringWeight[] = [
      { criterion: 'price', enabled: true, weight: 80 },
      { criterion: 'surface', enabled: false, weight: 7 },
    ]
    const merged = mergeScoringWeights(antiguos)
    expect(merged).toHaveLength(DEFAULT_SCORING_WEIGHTS.length)
    expect(merged.find(w => w.criterion === 'price')).toEqual({ criterion: 'price', enabled: true, weight: 80 })
    expect(merged.find(w => w.criterion === 'surface')?.enabled).toBe(false)
    expect(merged.find(w => w.criterion === 'light')).toBeDefined()
  })

  it('ante datos corruptos vuelve a los valores por defecto', () => {
    expect(mergeScoringWeights('basura')).toEqual(DEFAULT_SCORING_WEIGHTS)
    expect(mergeScoringWeights([{ criterion: 5 }, null])).toEqual(DEFAULT_SCORING_WEIGHTS)
  })

  it('no comparte referencias con los valores por defecto', () => {
    const merged = mergeScoringWeights(null)
    merged[0].weight = 1
    expect(DEFAULT_SCORING_WEIGHTS[0].weight).not.toBe(1)
  })
})

describe('weightsWithData', () => {
  it('descarta los criterios que ninguna propiedad tiene', () => {
    const props = [prop({ id: 'a', price: 100 }), prop({ id: 'b', price: 200 })]
    const used = weightsWithData(props, only('price', 'light')).map(w => w.criterion)
    expect(used).toEqual(['price'])
  })

  it('con un dato cargado a mano el criterio entra', () => {
    const props = [prop({ id: 'a' }), prop({ id: 'b' })]
    const used = weightsWithData(props, only('light'), { a: { light: 2 } }).map(w => w.criterion)
    expect(used).toEqual(['light'])
  })

  it('la mejor en todo llega a 100 cuando se ignoran los criterios sin datos', () => {
    const mejor = prop({ id: 'mejor', price: 100, surface: 200 })
    const peor = prop({ id: 'peor', price: 300, surface: 100 })
    const weights = weightsWithData([mejor, peor], only('price', 'surface', 'light', 'condition'))
    expect(scoreOf(scoreCandidates([mejor, peor], weights), 'mejor')).toBe(100)
  })
})

describe('dataCoverage', () => {
  it('es 1 cuando la propiedad tiene todos los datos que pesan', () => {
    const p = prop({ id: 'a', price: 100, surface: 50 })
    expect(dataCoverage(p, only('price', 'surface'))).toBe(1)
  })

  it('baja cuando faltan datos de criterios activos', () => {
    const p = prop({ id: 'a', price: 100, surface: 0 })
    expect(dataCoverage(p, only('price', 'surface'))).toBe(0.5)
  })

  it('un dato cargado a mano cuenta como cubierto', () => {
    const p = prop({ id: 'a' })
    expect(dataCoverage(p, only('light'), { light: 3 })).toBe(1)
    expect(dataCoverage(p, only('light'))).toBe(0)
  })

  it('no tener cochera no es un dato faltante', () => {
    expect(dataCoverage(prop({ id: 'a', garage: false }), only('garage'))).toBe(1)
  })
})

describe('explainWinner', () => {
  it('nombra los criterios en los que la ganadora se despega más', () => {
    const a = prop({ id: 'a', price: 100, bathrooms: 4 })
    const b = prop({ id: 'b', price: 300, bathrooms: 1 })
    const scores = scoreCandidates([a, b], only('price', 'bathrooms'))
    expect(explainWinner(scores)).toEqual(expect.arrayContaining(['price', 'bathrooms']))
  })

  it('con menos de dos propiedades no hay a quién ganarle', () => {
    expect(explainWinner(scoreCandidates([prop({ id: 'a', price: 1 })], only('price')))).toEqual([])
  })

  it('en un empate no inventa motivos', () => {
    const scores = scoreCandidates(
      [prop({ id: 'a', price: 100 }), prop({ id: 'b', price: 100 })], only('price'),
    )
    expect(explainWinner(scores)).toEqual([])
  })
})
