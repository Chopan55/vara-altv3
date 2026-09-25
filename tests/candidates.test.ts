/**
 * Decision Center — candidatos y comparación.
 *
 * Lo que se protege acá: que VARA **no invente un ganador**. Comparar tres
 * casas es la decisión más importante del comprador, y la tentación de
 * resolverla con un puntaje es grande. Estos tests fijan lo contrario: si no
 * hay dato, no hay comparación; si hay empate, no hay ganador.
 */

import { describe, it, expect } from 'vitest'
import {
  canTransitionCandidate, activeCandidates, sortCandidates,
  buildComparison, missingForDecision,
  type PropertyCandidate, type CandidateStatus,
} from '@/lib/candidates/model'

function cand(over: Partial<PropertyCandidate> = {}): PropertyCandidate {
  return {
    id: 'p-a', type: 'APARTMENT', operationType: 'sale',
    price: 100_000, currency: 'USD', title: 'Depto A', address: 'Calle 1',
    neighborhood: 'Centro', city: 'Pilar', province: 'Buenos Aires',
    surface: 50, rooms: 3, bedrooms: 2, bathrooms: 1, garage: false,
    description: '', images: [], features: [],
    status: 'ANALYZING', incompleteFields: [], source: 'imported',
    addedAt: 1_700_000_000_000,
    ...over,
  }
}

describe('transiciones de estado', () => {
  it('desde análisis se puede ir a cualquier lado', () => {
    for (const to of ['FAVORITE', 'VISITED', 'DISCARDED', 'PROMOTED'] as CandidateStatus[]) {
      expect(canTransitionCandidate('ANALYZING', to)).toBe(true)
    }
  })

  it('una descartada se puede recuperar', () => {
    // La gente cambia de opinión. Perder el análisis por un clic sería cruel.
    expect(canTransitionCandidate('DISCARDED', 'FAVORITE')).toBe(true)
    expect(canTransitionCandidate('DISCARDED', 'ANALYZING')).toBe(true)
  })

  it('una promovida no vuelve atrás', () => {
    // Ya existe una operación con tareas y documentos: despromover la dejaría huérfana.
    for (const to of ['ANALYZING', 'FAVORITE', 'VISITED', 'DISCARDED'] as CandidateStatus[]) {
      expect(canTransitionCandidate('PROMOTED', to)).toBe(false)
    }
  })

  it('no se puede promover una descartada sin recuperarla primero', () => {
    expect(canTransitionCandidate('DISCARDED', 'PROMOTED')).toBe(false)
  })
})

describe('listas', () => {
  it('las activas excluyen descartadas y promovidas', () => {
    const list = [
      cand({ id: '1', status: 'ANALYZING' }),
      cand({ id: '2', status: 'DISCARDED' }),
      cand({ id: '3', status: 'PROMOTED' }),
      cand({ id: '4', status: 'FAVORITE' }),
    ]
    expect(activeCandidates(list).map(c => c.id)).toEqual(['1', '4'])
  })

  it('ordena por relevancia para decidir, no por fecha', () => {
    const list = [
      cand({ id: 'desc', status: 'DISCARDED' }),
      cand({ id: 'anal', status: 'ANALYZING' }),
      cand({ id: 'fav', status: 'FAVORITE' }),
    ]
    expect(sortCandidates(list).map(c => c.id)).toEqual(['fav', 'anal', 'desc'])
  })

  it('a igual estado, la más reciente primero', () => {
    const list = [
      cand({ id: 'vieja', addedAt: 1000 }),
      cand({ id: 'nueva', addedAt: 2000 }),
    ]
    expect(sortCandidates(list).map(c => c.id)).toEqual(['nueva', 'vieja'])
  })

  it('no muta la lista original', () => {
    const list = [cand({ id: 'a', status: 'DISCARDED' }), cand({ id: 'b', status: 'FAVORITE' })]
    sortCandidates(list)
    expect(list.map(c => c.id)).toEqual(['a', 'b'])
  })
})

describe('comparación', () => {
  it('con menos de dos candidatos no hay nada que comparar', () => {
    expect(buildComparison([])).toEqual([])
    expect(buildComparison([cand()])).toEqual([])
  })

  it('marca el más barato y el más grande', () => {
    const rows = buildComparison([
      cand({ id: 'a', price: 100_000, surface: 50 }),
      cand({ id: 'b', price: 120_000, surface: 80 }),
    ])
    expect(rows.find(r => r.key === 'price')?.bestIndexes).toEqual([0])
    expect(rows.find(r => r.key === 'surface')?.bestIndexes).toEqual([1])
  })

  it('el precio por m² es lo que de verdad compara tamaños distintos', () => {
    // A: 2000/m². B: 1500/m². B gana aunque sea más cara en total.
    const rows = buildComparison([
      cand({ id: 'a', price: 100_000, surface: 50 }),
      cand({ id: 'b', price: 120_000, surface: 80 }),
    ])
    expect(rows.find(r => r.key === 'price_m2')?.bestIndexes).toEqual([1])
  })

  it('un empate NO tiene ganador', () => {
    const rows = buildComparison([
      cand({ id: 'a', price: 100_000 }),
      cand({ id: 'b', price: 100_000 }),
    ])
    expect(rows.find(r => r.key === 'price')?.bestIndexes).toEqual([])
  })

  it('con un solo dato conocido no se declara ganador', () => {
    // Ganar por ser el único que cargó el dato no es ganar.
    const rows = buildComparison([
      cand({ id: 'a', expenses: 50_000 }),
      cand({ id: 'b', expenses: undefined }),
    ])
    expect(rows.find(r => r.key === 'expenses')?.bestIndexes).toEqual([])
  })

  it('los datos faltantes se muestran como null, no como cero', () => {
    const rows = buildComparison([
      cand({ id: 'a', price: 100_000 }),
      cand({ id: 'b', price: 0 }),
    ])
    expect(rows.find(r => r.key === 'price')?.values[1]).toBeNull()
  })

  it('una fila sin ningún dato no se muestra', () => {
    const rows = buildComparison([
      cand({ id: 'a', expenses: undefined, ageYears: undefined }),
      cand({ id: 'b', expenses: undefined, ageYears: undefined }),
    ])
    expect(rows.map(r => r.key)).not.toContain('expenses')
    expect(rows.map(r => r.key)).not.toContain('age')
  })

  it('compara más de dos', () => {
    const rows = buildComparison([
      cand({ id: 'a', price: 300_000 }),
      cand({ id: 'b', price: 100_000 }),
      cand({ id: 'c', price: 200_000 }),
    ])
    expect(rows.find(r => r.key === 'price')?.values).toHaveLength(3)
    expect(rows.find(r => r.key === 'price')?.bestIndexes).toEqual([1])
  })

  it('"a estrenar" se dice con palabras, no con un 0', () => {
    const rows = buildComparison([
      cand({ id: 'a', ageYears: 0 }),
      cand({ id: 'b', ageYears: 30 }),
    ])
    expect(rows.find(r => r.key === 'age')?.values[0]).toBe('A estrenar')
  })
})

describe('qué falta para decidir', () => {
  it('sin precio no se puede decidir', () => {
    expect(missingForDecision(cand({ price: 0 }))).toContain('precio')
  })

  it('sin superficie tampoco', () => {
    expect(missingForDecision(cand({ surface: 0 }))).toContain('superficie')
  })

  it('con barrio alcanza aunque no haya ciudad', () => {
    const m = missingForDecision(cand({ city: '', neighborhood: 'Palermo' }))
    expect(m).not.toContain('ubicación')
  })

  it('un candidato completo no tiene faltantes', () => {
    expect(missingForDecision(cand())).toEqual([])
  })
})
