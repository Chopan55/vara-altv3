/**
 * Matching — TEST 3 (elegir partner), TEST 4 ("elegí por mí"),
 * TEST 7 (no hay partner disponible), TEST 15 (suspendido no recibe visitas).
 *
 * Lo que más importa acá no es que ordene bien, sino que NO deje pasar a
 * alguien que no debería estar. Los tests de exclusión son los que protegen
 * a la familia que abre la puerta.
 */

import { describe, it, expect } from 'vitest'
import {
  findMatches, autoMatch, excludeReason, zoneAffinity,
  isAvailableAt, coverageFor, scorePartner,
  type MatchCriteria,
} from '@/lib/varaVisit/matching'
import { partner, metrics } from './fixtures'

const criteria: MatchCriteria = {
  serviceType: 'SHOW_PROPERTY',
  zoneLabel: 'Pilar',
  date: '2026-10-15',   // jueves
  time: '10:00',
}

describe('filtros duros — quién NO puede recibir una visita', () => {
  it('TEST 15: un partner suspendido queda excluido', () => {
    const p = partner({ status: 'SUSPENDED' })
    expect(excludeReason(p, criteria)).toBe('NOT_ACTIVE')
    expect(findMatches([p], criteria).matches).toHaveLength(0)
  })

  it('un partner suspendido con rating perfecto sigue excluido', () => {
    // El filtro no es una penalización de score: es un portón.
    const p = partner({
      status: 'SUSPENDED',
      metrics: metrics({ averageRating: 5, completedVisits: 500, punctualityRate: 1 }),
    })
    expect(findMatches([p], criteria).matches).toHaveLength(0)
  })

  it('sin identidad verificada queda excluido', () => {
    expect(excludeReason(partner({ verifiedIdentity: false }), criteria))
      .toBe('IDENTITY_NOT_VERIFIED')
  })

  it('sin certificación de VARA queda excluido', () => {
    expect(excludeReason(partner({ certified: false }), criteria)).toBe('NOT_CERTIFIED')
  })

  it('haber subido documentos no alcanza: sin certificar no entra', () => {
    const p = partner({ verifiedIdentity: true, verifiedDocument: true, certified: false })
    expect(findMatches([p], criteria).matches).toHaveLength(0)
  })

  it('no ofrece el servicio pedido', () => {
    const p = partner({ serviceTypes: ['ACCOMPANY_VISIT'] })
    expect(excludeReason(p, criteria)).toBe('SERVICE_NOT_OFFERED')
  })

  it('no cubre la zona', () => {
    const p = partner({ homeZoneLabel: 'La Plata', coverageZones: ['La Plata'] })
    expect(excludeReason(p, criteria)).toBe('ZONE_NOT_COVERED')
  })

  it('por encima del precio máximo', () => {
    const p = partner({ ratePerVisit: 60 })
    expect(excludeReason(p, { ...criteria, maxPrice: 40 })).toBe('ABOVE_MAX_PRICE')
  })
})

describe('zoneAffinity', () => {
  it('1 cuando trabaja habitualmente en la zona', () => {
    expect(zoneAffinity(partner(), 'Pilar')).toBe(1)
  })

  it('0.7 cuando solo la declaró como cobertura', () => {
    expect(zoneAffinity(partner(), 'Del Viso')).toBe(0.7)
  })

  it('0 cuando no llega', () => {
    expect(zoneAffinity(partner(), 'Rosario')).toBe(0)
  })

  it('ignora acentos, mayúsculas y espacios', () => {
    const p = partner({ homeZoneLabel: 'Pilár , Buenos Aires' })
    expect(zoneAffinity(p, '  PILAR ')).toBe(1)
  })

  it('zona vacía no matchea con nadie', () => {
    expect(zoneAffinity(partner(), '')).toBe(0)
  })
})

describe('disponibilidad', () => {
  it('sin disponibilidad declarada asume que sí, y confirma al aceptar', () => {
    // Bloquear por un campo vacío dejaría el marketplace en cero todo el piloto.
    expect(isAvailableAt(undefined, '2026-10-15', '10:00')).toBe(true)
    expect(isAvailableAt({}, '2026-10-15', '10:00')).toBe(true)
  })

  it('respeta la franja declarada', () => {
    const av = { thu: ['09:00-13:00'] }
    expect(isAvailableAt(av, '2026-10-15', '10:00')).toBe(true)
    expect(isAvailableAt(av, '2026-10-15', '15:00')).toBe(false)
  })

  it('un día sin franjas no está disponible', () => {
    expect(isAvailableAt({ thu: [] }, '2026-10-15', '10:00')).toBe(false)
  })

  it('respeta el día de la semana', () => {
    const av = { mon: ['09:00-18:00'] }
    expect(isAvailableAt(av, '2026-10-15', '10:00')).toBe(false)  // jueves
    expect(isAvailableAt(av, '2026-10-12', '10:00')).toBe(true)   // lunes
  })
})

describe('ranking', () => {
  it('TEST 3: ordena de mejor a peor y expone el motivo', () => {
    const cerca = partner({ id: 'cerca', homeZoneLabel: 'Pilar' })
    const lejos = partner({ id: 'lejos', homeZoneLabel: 'Escobar', coverageZones: ['Pilar'] })

    const { matches } = findMatches([lejos, cerca], criteria)
    expect(matches.map(m => m.partner.id)).toEqual(['cerca', 'lejos'])
    expect(matches[0].reasons).toContain('Trabaja habitualmente en esta zona')
  })

  it('un partner nuevo no queda último solo por no tener historial', () => {
    // Sin esto, nadie nuevo conseguiría jamás su primera visita.
    const nuevo = partner({ id: 'nuevo', metrics: metrics() })
    const mediocre = partner({
      id: 'mediocre',
      metrics: metrics({ averageRating: 2.5, completedVisits: 40, punctualityRate: 0.5, completionRate: 0.5 }),
    })
    const { matches } = findMatches([mediocre, nuevo], criteria)
    expect(matches[0].partner.id).toBe('nuevo')
  })

  it('el score es interno: las razones son lo legible', () => {
    const p = partner({ metrics: metrics({ averageRating: 4.92, completedVisits: 86, punctualityRate: 0.98 }) })
    const r = scorePartner(p, criteria)
    expect(r.score).toBeGreaterThan(0)
    expect(r.score).toBeLessThanOrEqual(1)
    expect(r.reasons).toContain('4.92 de calificación promedio')
    expect(r.reasons).toContain('86 visitas completadas')
    expect(r.reasons).toContain('98% de puntualidad')
  })

  it('dice explícitamente cuando no hay calificaciones', () => {
    expect(scorePartner(partner(), criteria).reasons).toContain('Todavía sin calificaciones')
  })
})

describe('autoMatch — "elegí por mí"', () => {
  it('TEST 4: devuelve el mejor disponible', () => {
    const a = partner({ id: 'a', homeZoneLabel: 'Escobar', coverageZones: ['Pilar'] })
    const b = partner({ id: 'b', homeZoneLabel: 'Pilar' })
    expect(autoMatch([a, b], criteria)?.partner.id).toBe('b')
  })

  it('TEST 7: devuelve null si no hay nadie, nunca un perfil inventado', () => {
    expect(autoMatch([], criteria)).toBeNull()
    expect(autoMatch([partner({ status: 'SUSPENDED' })], criteria)).toBeNull()
  })
})

describe('cobertura de zona', () => {
  it('AVAILABLE con dos o más', () => {
    expect(coverageFor([partner({ id: 'a' }), partner({ id: 'b' })], criteria)).toBe('AVAILABLE')
  })

  it('LIMITED con uno solo', () => {
    expect(coverageFor([partner()], criteria)).toBe('LIMITED')
  })

  it('WAITLIST cuando no hay nadie en la zona', () => {
    expect(coverageFor([], criteria)).toBe('WAITLIST')
  })

  it('LIMITED cuando hay gente pero nadie libre ese día', () => {
    // No es lo mismo "zona vacía" que "todos ocupados el jueves".
    const p = partner({ id: 'ocupado' })
    const cov = coverageFor([p], criteria, { ocupado: { fri: ['09:00-18:00'] } })
    expect(cov).toBe('LIMITED')
  })
})
