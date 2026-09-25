/**
 * Sesión de visita — TEST 8 (check-in correcto), TEST 9 (PIN incorrecto),
 * TEST 10 (visita completada).
 *
 * Estos tests son la trazabilidad. Si alguno falla, VARA no puede decir quién
 * estuvo dónde, y el producto entero deja de tener sentido.
 */

import { describe, it, expect } from 'vitest'
import {
  generatePin, verifyPin, canCheckIn, canStartVisit, canCheckOut,
  durationMinutes, wasOnTime, checklistProgress, PUNCTUALITY_GRACE_MINUTES,
} from '@/lib/varaVisit/session'
import { MAX_PIN_ATTEMPTS, PIN_LENGTH } from '@/types/varaVisit'
import type { VisitSession } from '@/types/varaVisit'

function session(over: Partial<VisitSession> = {}): VisitSession {
  return {
    id: 's-1',
    bookingId: 'b-1',
    partnerId: 'p-a',
    checkInAt: null,
    checkInLocation: null,
    checkOutAt: null,
    checkOutLocation: null,
    confirmationPinStatus: 'PENDING',
    pinAttempts: 0,
    status: 'NOT_STARTED',
    durationMinutes: null,
    checklistState: {},
    ...over,
  }
}

describe('generatePin', () => {
  it('siempre devuelve 4 dígitos, incluso con ceros a la izquierda', () => {
    for (let i = 0; i < 300; i++) {
      const pin = generatePin()
      expect(pin).toHaveLength(PIN_LENGTH)
      expect(/^\d+$/.test(pin)).toBe(true)
    }
  })

  it('no devuelve siempre el mismo', () => {
    const pins = new Set(Array.from({ length: 50 }, generatePin))
    expect(pins.size).toBeGreaterThan(1)
  })
})

describe('verifyPin — TEST 9', () => {
  it('acepta el PIN correcto', () => {
    expect(verifyPin('4821', '4821', 0)).toEqual({ ok: true })
  })

  it('tolera espacios alrededor', () => {
    expect(verifyPin('4821', ' 4821 ', 0)).toEqual({ ok: true })
  })

  it('rechaza el PIN incorrecto y descuenta un intento', () => {
    const r = verifyPin('4821', '1234', 0)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reason).toBe('WRONG_PIN')
      expect(r.attemptsLeft).toBe(MAX_PIN_ATTEMPTS - 1)
    }
  })

  it('un PIN mal escrito NO consume intento', () => {
    // Castigar un error de tipeo con un bloqueo es ensañarse con alguien
    // que está parado en la puerta de una casa ajena.
    const r = verifyPin('4821', '48a1', 0)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reason).toBe('MALFORMED')
      expect(r.attemptsLeft).toBe(MAX_PIN_ATTEMPTS)
    }
  })

  it('un PIN de largo incorrecto tampoco consume intento', () => {
    const r = verifyPin('4821', '482', 0)
    if (!r.ok) expect(r.reason).toBe('MALFORMED')
  })

  it('bloquea al agotar los intentos', () => {
    const r = verifyPin('4821', '4821', MAX_PIN_ATTEMPTS)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reason).toBe('TOO_MANY_ATTEMPTS')
      expect(r.attemptsLeft).toBe(0)
    }
  })

  it('sin PIN esperado, nada valida', () => {
    expect(verifyPin(null, '4821', 0).ok).toBe(false)
  })
})

describe('check-in — TEST 8', () => {
  it('se puede hacer una vez', () => {
    expect(canCheckIn(session())).toBeNull()
  })

  it('no se repite', () => {
    expect(canCheckIn(session({ status: 'CHECKED_IN' }))).toBe('ALREADY_CHECKED_IN')
  })

  it('no se puede sobre una visita cerrada', () => {
    expect(canCheckIn(session({ status: 'CHECKED_OUT' }))).toBe('SESSION_CLOSED')
  })
})

describe('inicio de visita — el PIN es obligatorio', () => {
  it('no arranca sin check-in', () => {
    expect(canStartVisit(session())).toBe('NOT_CHECKED_IN')
  })

  it('NO arranca con check-in pero sin PIN confirmado', () => {
    // La regla central de seguridad del producto.
    const s = session({ status: 'CHECKED_IN', confirmationPinStatus: 'PENDING' })
    expect(canStartVisit(s)).toBe('PIN_NOT_CONFIRMED')
  })

  it('no arranca con PIN fallado', () => {
    const s = session({ status: 'CHECKED_IN', confirmationPinStatus: 'FAILED' })
    expect(canStartVisit(s)).toBe('PIN_NOT_CONFIRMED')
  })

  it('arranca con check-in y PIN confirmado', () => {
    const s = session({ status: 'CHECKED_IN', confirmationPinStatus: 'CONFIRMED' })
    expect(canStartVisit(s)).toBeNull()
  })
})

describe('check-out — TEST 10', () => {
  const doneAll = {
    identity: true, access: true, rooms: true, observations: true, closed: true,
  }

  it('no se puede si la visita no está en curso', () => {
    expect(canCheckOut(session({ status: 'CHECKED_IN' }), 'SHOW_PROPERTY')?.reason)
      .toBe('NOT_IN_PROGRESS')
  })

  it('bloquea si falta un ítem obligatorio y dice cuál', () => {
    const s = session({
      status: 'IN_PROGRESS',
      checklistState: { ...doneAll, closed: false },
    })
    const block = canCheckOut(s, 'SHOW_PROPERTY')
    expect(block?.reason).toBe('REQUIRED_CHECKLIST_INCOMPLETE')
    expect(block?.missing.map(m => m.id)).toEqual(['closed'])
  })

  it('un ítem opcional sin marcar no bloquea', () => {
    const s = session({ status: 'IN_PROGRESS', checklistState: doneAll }) // sin 'questions'
    expect(canCheckOut(s, 'SHOW_PROPERTY')).toBeNull()
  })

  it('el acompañamiento no exige los ítems que son solo de mostrar', () => {
    // "Identidad del visitante" y "propiedad cerrada" no aplican si el
    // partner acompaña al comprador: no es su casa ni sus llaves.
    const s = session({
      status: 'IN_PROGRESS',
      checklistState: { access: true, rooms: true, observations: true },
    })
    expect(canCheckOut(s, 'ACCOMPANY_VISIT')).toBeNull()
  })
})

describe('duración', () => {
  it('calcula minutos entre check-in y check-out', () => {
    expect(durationMinutes('2026-10-15T10:00:00Z', '2026-10-15T10:45:00Z')).toBe(45)
  })

  it('redondea hacia arriba: 31 segundos es un minuto', () => {
    expect(durationMinutes('2026-10-15T10:00:00Z', '2026-10-15T10:00:31Z')).toBe(1)
  })

  it('nunca es negativa', () => {
    expect(durationMinutes('2026-10-15T11:00:00Z', '2026-10-15T10:00:00Z')).toBe(0)
  })

  it('devuelve 0 con fechas inválidas en vez de NaN', () => {
    expect(durationMinutes('no-es-fecha', '2026-10-15T10:00:00Z')).toBe(0)
  })
})

describe('puntualidad', () => {
  it('llegar antes es puntual', () => {
    expect(wasOnTime('2026-10-15', '10:00', '2026-10-15T09:50:00')).toBe(true)
  })

  it('llegar en el límite de tolerancia sigue siendo puntual', () => {
    const t = `2026-10-15T10:${String(PUNCTUALITY_GRACE_MINUTES).padStart(2, '0')}:00`
    expect(wasOnTime('2026-10-15', '10:00', t)).toBe(true)
  })

  it('pasada la tolerancia no es puntual', () => {
    expect(wasOnTime('2026-10-15', '10:00', '2026-10-15T10:25:00')).toBe(false)
  })

  it('acepta el HH:MM:SS que devuelve Postgres', () => {
    expect(wasOnTime('2026-10-15', '10:00:00', '2026-10-15T09:55:00')).toBe(true)
  })

  it('ante datos inválidos no castiga al partner', () => {
    expect(wasOnTime('', '', 'nada')).toBe(true)
  })
})

describe('progreso del checklist', () => {
  it('cuenta solo los ítems del servicio', () => {
    const s = session({ checklistState: { access: true } })
    const show = checklistProgress(s, 'SHOW_PROPERTY')
    const accompany = checklistProgress(s, 'ACCOMPANY_VISIT')
    expect(show.total).toBe(6)
    expect(accompany.total).toBe(4)
    expect(accompany.percent).toBe(25)
  })

  it('arranca en cero', () => {
    expect(checklistProgress(session(), 'SHOW_PROPERTY').percent).toBe(0)
  })
})
