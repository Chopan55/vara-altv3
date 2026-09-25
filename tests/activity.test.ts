/**
 * Historial de la operación.
 *
 * Lo que se protege acá: que el tiempo no se adelante y que "nada nuevo" no
 * se confunda con "nunca entraste". Un historial que dice "hace 3 horas"
 * cuando fueron 2 y media erosiona la confianza en todo lo demás que muestra
 * la pantalla.
 */

import { describe, it, expect } from 'vitest'
import {
  groupByDay, dayLabel, relativeTime, newSince, familyOf, isMilestone,
  type ActivityEvent, type ActivityKind,
} from '@/lib/activity/model'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

/** 2026-03-20T12:00:00Z */
const NOW = Date.parse('2026-03-20T12:00:00.000Z')
const TODAY = '2026-03-20'

function ev(over: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id: 'e-1', operationId: 'op-1', kind: 'OFFER_SENT',
    summary: 'Ofertaste USD 185.000', metadata: {},
    createdAt: NOW,
    ...over,
  }
}

describe('tiempo relativo', () => {
  it('lo de recién no dice un número', () => {
    expect(relativeTime(NOW - 30_000, NOW)).toBe('recién')
  })

  it('redondea hacia abajo, nunca hacia arriba', () => {
    // 2h50 es "hace 2 horas". Adelantar el tiempo se siente mal.
    expect(relativeTime(NOW - (2 * HOUR + 50 * MIN), NOW)).toBe('hace 2 horas')
  })

  it('singular y plural', () => {
    expect(relativeTime(NOW - HOUR, NOW)).toBe('hace 1 hora')
    expect(relativeTime(NOW - 3 * HOUR, NOW)).toBe('hace 3 horas')
    expect(relativeTime(NOW - DAY, NOW)).toBe('hace 1 día')
    expect(relativeTime(NOW - 5 * DAY, NOW)).toBe('hace 5 días')
  })

  it('escala a meses y años', () => {
    expect(relativeTime(NOW - 60 * DAY, NOW)).toBe('hace 2 meses')
    expect(relativeTime(NOW - 400 * DAY, NOW)).toBe('hace 1 año')
  })

  it('un evento del futuro no dice "hace -5 min"', () => {
    // Pasa con relojes desincronizados. Mejor "recién" que un número absurdo.
    expect(relativeTime(NOW + 10 * MIN, NOW)).toBe('recién')
  })

  it('minutos por debajo de la hora', () => {
    expect(relativeTime(NOW - 45 * MIN, NOW)).toBe('hace 45 min')
  })
})

describe('nombre del día', () => {
  it('hoy y ayer se dicen con palabras', () => {
    expect(dayLabel(TODAY, TODAY)).toBe('Hoy')
    expect(dayLabel('2026-03-19', TODAY)).toBe('Ayer')
  })

  it('un día de este año no repite el año', () => {
    expect(dayLabel('2026-01-15', TODAY)).not.toMatch(/2026/)
  })

  it('un día de otro año sí lo dice', () => {
    expect(dayLabel('2025-11-03', TODAY)).toMatch(/2025/)
  })
})

describe('agrupado por día', () => {
  it('el día más reciente va primero', () => {
    const days = groupByDay([
      ev({ id: 'viejo', createdAt: Date.parse('2026-03-18T10:00:00.000Z') }),
      ev({ id: 'nuevo', createdAt: Date.parse('2026-03-20T10:00:00.000Z') }),
    ], TODAY)
    expect(days.map(d => d.date)).toEqual(['2026-03-20', '2026-03-18'])
  })

  it('dentro del día, lo último arriba', () => {
    const days = groupByDay([
      ev({ id: 'manana', createdAt: Date.parse('2026-03-20T09:00:00.000Z') }),
      ev({ id: 'tarde', createdAt: Date.parse('2026-03-20T18:00:00.000Z') }),
    ], TODAY)
    expect(days[0].events.map(e => e.id)).toEqual(['tarde', 'manana'])
  })

  it('junta los del mismo día en un solo grupo', () => {
    const days = groupByDay([
      ev({ id: 'a', createdAt: Date.parse('2026-03-20T09:00:00.000Z') }),
      ev({ id: 'b', createdAt: Date.parse('2026-03-20T18:00:00.000Z') }),
    ], TODAY)
    expect(days).toHaveLength(1)
    expect(days[0].events).toHaveLength(2)
  })

  it('sin eventos, sin grupos', () => {
    expect(groupByDay([], TODAY)).toEqual([])
  })

  it('cada grupo trae su etiqueta legible', () => {
    const days = groupByDay([ev({ createdAt: Date.parse('2026-03-20T09:00:00.000Z') })], TODAY)
    expect(days[0].label).toBe('Hoy')
  })

  it('no muta la lista original', () => {
    const list = [
      ev({ id: 'a', createdAt: Date.parse('2026-03-20T09:00:00.000Z') }),
      ev({ id: 'b', createdAt: Date.parse('2026-03-20T18:00:00.000Z') }),
    ]
    groupByDay(list, TODAY)
    expect(list.map(e => e.id)).toEqual(['a', 'b'])
  })
})

describe('qué pasó desde la última vez', () => {
  it('sin última visita registrada NO dice "no hay nada nuevo"', () => {
    // Es distinto de "cero eventos": nunca entró, no le debemos un resumen.
    expect(newSince([ev()], null)).toBeNull()
  })

  it('devuelve solo lo posterior a la última visita', () => {
    const list = [
      ev({ id: 'antes', createdAt: NOW - 2 * DAY }),
      ev({ id: 'despues', createdAt: NOW }),
    ]
    expect(newSince(list, NOW - DAY)?.map(e => e.id)).toEqual(['despues'])
  })

  it('si no hay nada nuevo, null y no una lista vacía', () => {
    // La pantalla no debería decir "0 novedades", sino no decir nada.
    expect(newSince([ev({ createdAt: NOW - 2 * DAY })], NOW)).toBeNull()
  })
})

describe('clasificación', () => {
  it('cada tipo cae en su familia', () => {
    expect(familyOf('DOCUMENT_UPLOADED')).toBe('DOCUMENT')
    expect(familyOf('OFFER_SENT')).toBe('OFFER')
    expect(familyOf('PROPERTY_PROMOTED')).toBe('PROPERTY')
    expect(familyOf('OPERATION_CREATED')).toBe('OPERATION')
  })

  it('un cambio de estado de documento no es un hito', () => {
    // Es ruido al lado de una oferta aceptada.
    expect(isMilestone(ev({ kind: 'DOCUMENT_STATUS_CHANGED' }))).toBe(false)
    expect(isMilestone(ev({ kind: 'OFFER_STATUS_CHANGED' }))).toBe(true)
  })

  it('todos los tipos tienen familia', () => {
    const kinds: ActivityKind[] = [
      'OPERATION_CREATED', 'DOCUMENT_REQUESTED', 'DOCUMENT_UPLOADED',
      'DOCUMENT_STATUS_CHANGED', 'DOCUMENT_REMOVED', 'OFFER_CREATED',
      'OFFER_SENT', 'OFFER_STATUS_CHANGED', 'PROPERTY_PROMOTED', 'NOTE_ADDED',
    ]
    for (const k of kinds) expect(familyOf(k)).toBeTruthy()
  })
})
