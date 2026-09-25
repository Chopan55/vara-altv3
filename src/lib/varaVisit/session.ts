/**
 * Reglas de la sesión de visita: PIN, check-in, check-out.
 *
 * Todo lo de acá es lógica pura y determinista, sin I/O, para que se pueda
 * testear sin base y sin navegador. La persistencia vive en
 * `src/lib/supabase/visits.ts`.
 *
 * Criterio que gobierna el archivo: si una función puede decir "no se puede",
 * lo dice con un motivo legible, no devolviendo `false` a secas. El partner
 * está parado en la puerta de una casa: "no se puede" sin explicación es
 * inutilizable.
 */

import {
  MAX_PIN_ATTEMPTS,
  PIN_LENGTH,
  checklistFor,
  type GeoPoint,
  type VisitModeChecklistItem,
  type VisitServiceType,
  type VisitSession,
} from '@/types/varaVisit'

// ────────────────────────────── PIN ──────────────────────────────

/**
 * PIN de 4 dígitos.
 *
 * Usa `crypto.getRandomValues` cuando existe. El PIN no protege dinero: evita
 * que alguien inicie una visita sin que el cliente lo autorice en ese momento.
 * Aun así, un PIN predecible con `Math.random()` sembrado por el reloj sería
 * un detalle feo en un sistema que se vende como confiable.
 */
export function generatePin(): string {
  const max = 10 ** PIN_LENGTH
  let n: number
  const g = globalThis as { crypto?: { getRandomValues?: (a: Uint32Array) => Uint32Array } }
  if (g.crypto?.getRandomValues) {
    const buf = new Uint32Array(1)
    g.crypto.getRandomValues(buf)
    n = buf[0] % max
  } else {
    n = Math.floor(Math.random() * max)
  }
  return String(n).padStart(PIN_LENGTH, '0')
}

export type PinFailReason = 'WRONG_PIN' | 'TOO_MANY_ATTEMPTS' | 'MALFORMED'

export type PinCheckResult =
  | { ok: true }
  | { ok: false; reason: PinFailReason; attemptsLeft: number }

/**
 * Verifica el PIN.
 *
 * Un PIN mal escrito (letras, largo incorrecto) NO consume intento: castigar
 * un error de tipeo con un bloqueo es ensañarse con alguien que está de pie
 * en la puerta de una casa ajena.
 */
export function verifyPin(
  expected: string | null,
  entered: string,
  previousAttempts: number,
): PinCheckResult {
  const attemptsLeft = Math.max(0, MAX_PIN_ATTEMPTS - previousAttempts)

  if (previousAttempts >= MAX_PIN_ATTEMPTS) {
    return { ok: false, reason: 'TOO_MANY_ATTEMPTS', attemptsLeft: 0 }
  }
  const clean = entered.trim()
  if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(clean)) {
    return { ok: false, reason: 'MALFORMED', attemptsLeft }
  }
  if (!expected || clean !== expected) {
    return { ok: false, reason: 'WRONG_PIN', attemptsLeft: attemptsLeft - 1 }
  }
  return { ok: true }
}

export const PIN_ERROR_MESSAGES: Record<PinFailReason, string> = {
  MALFORMED: `El PIN son ${PIN_LENGTH} números.`,
  WRONG_PIN: 'El PIN no coincide. Pedíselo de nuevo al cliente.',
  TOO_MANY_ATTEMPTS: 'Demasiados intentos. Contactá a soporte de VARA para continuar.',
}

// ───────────────────────────── Check-in ─────────────────────────────

export type CheckInBlock = 'ALREADY_CHECKED_IN' | 'SESSION_CLOSED'

export const CHECK_IN_BLOCK_MESSAGES: Record<CheckInBlock, string> = {
  ALREADY_CHECKED_IN: 'Ya registraste tu llegada a esta visita.',
  SESSION_CLOSED: 'Esta visita ya está cerrada.',
}

export function canCheckIn(session: Pick<VisitSession, 'status'>): CheckInBlock | null {
  if (session.status === 'CHECKED_OUT' || session.status === 'ABORTED') return 'SESSION_CLOSED'
  if (session.status !== 'NOT_STARTED') return 'ALREADY_CHECKED_IN'
  return null
}

/**
 * Pide la ubicación al navegador.
 *
 * NUNCA bloquea: si el usuario la niega o el GPS falla, devuelve null y el
 * check-in sigue. Un partner honesto en un subsuelo sin señal no puede quedar
 * afuera de una visita real. El geofencing estricto queda para cuando haya
 * datos suficientes para saber qué margen de error es razonable.
 */
export function requestGeoPoint(timeoutMs = 8000): Promise<GeoPoint | null> {
  return new Promise(resolve => {
    const nav = globalThis as { navigator?: { geolocation?: Geolocation } }
    if (!nav.navigator?.geolocation) { resolve(null); return }

    let settled = false
    const done = (v: GeoPoint | null) => { if (!settled) { settled = true; resolve(v) } }

    const timer = setTimeout(() => done(null), timeoutMs)

    nav.navigator.geolocation.getCurrentPosition(
      pos => {
        clearTimeout(timer)
        done({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
          capturedAt: new Date().toISOString(),
        })
      },
      () => { clearTimeout(timer); done(null) },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    )
  })
}

// ──────────────────────── Inicio de la visita ────────────────────────

export type StartBlock = 'NOT_CHECKED_IN' | 'PIN_NOT_CONFIRMED' | 'ALREADY_STARTED'

export const START_BLOCK_MESSAGES: Record<StartBlock, string> = {
  NOT_CHECKED_IN: 'Primero registrá tu llegada.',
  PIN_NOT_CONFIRMED: 'Pedile el PIN al cliente para confirmar la identidad.',
  ALREADY_STARTED: 'La visita ya está en curso.',
}

/**
 * Sin PIN confirmado la visita no arranca. No es una recomendación.
 * Es la única prueba de que el cliente autorizó el ingreso en ese momento.
 */
export function canStartVisit(
  session: Pick<VisitSession, 'status' | 'confirmationPinStatus'>,
): StartBlock | null {
  if (session.status === 'IN_PROGRESS') return 'ALREADY_STARTED'
  if (session.status !== 'CHECKED_IN') return 'NOT_CHECKED_IN'
  if (session.confirmationPinStatus !== 'CONFIRMED') return 'PIN_NOT_CONFIRMED'
  return null
}

// ───────────────────────────── Check-out ─────────────────────────────

export interface CheckOutBlock {
  reason: 'NOT_IN_PROGRESS' | 'REQUIRED_CHECKLIST_INCOMPLETE'
  /** Ítems obligatorios sin marcar. Se muestran para que el partner sepa qué falta. */
  missing: VisitModeChecklistItem[]
}

/**
 * El partner no puede simplemente cerrar la app.
 * Los ítems obligatorios del checklist bloquean el cierre: son las cosas que,
 * si no pasaron, convierten la visita en un problema (propiedad sin cerrar,
 * identidad sin confirmar).
 */
export function canCheckOut(
  session: Pick<VisitSession, 'status' | 'checklistState'>,
  serviceType: VisitServiceType,
): CheckOutBlock | null {
  if (session.status !== 'IN_PROGRESS') {
    return { reason: 'NOT_IN_PROGRESS', missing: [] }
  }
  const missing = checklistFor(serviceType)
    .filter(i => i.required && !session.checklistState[i.id])
  if (missing.length > 0) {
    return { reason: 'REQUIRED_CHECKLIST_INCOMPLETE', missing }
  }
  return null
}

/** Duración real en minutos. Se redondea hacia arriba: 31 segundos es un minuto. */
export function durationMinutes(checkInAt: string, checkOutAt: string): number {
  const ms = new Date(checkOutAt).getTime() - new Date(checkInAt).getTime()
  if (!Number.isFinite(ms) || ms < 0) return 0
  return Math.ceil(ms / 60000)
}

// ───────────────────────────── Puntualidad ─────────────────────────────

/** Tolerancia para considerar puntual un check-in. El tránsito existe. */
export const PUNCTUALITY_GRACE_MINUTES = 10

/** Postgres devuelve `time` como HH:MM:SS; los formularios mandan HH:MM. */
function normalizeTime(t: string): string {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(t.trim())
  if (!m) return '00:00:00'
  const hh = m[1].padStart(2, '0')
  return `${hh}:${m[2]}:${m[3] ?? '00'}`
}

/**
 * ¿Llegó a horario?
 *
 * Llegar antes siempre es puntual. Llegar hasta 10 minutos tarde también:
 * penalizar un minuto de demora produce una métrica que nadie respeta y que
 * por lo tanto deja de significar algo.
 */
export function wasOnTime(
  scheduledDate: string,
  scheduledTime: string,
  checkInAt: string,
): boolean {
  const scheduled = new Date(`${scheduledDate}T${normalizeTime(scheduledTime)}`)
  const actual = new Date(checkInAt)
  if (Number.isNaN(scheduled.getTime()) || Number.isNaN(actual.getTime())) return true
  const lateMinutes = (actual.getTime() - scheduled.getTime()) / 60000
  return lateMinutes <= PUNCTUALITY_GRACE_MINUTES
}

// ───────────────────────── Progreso del checklist ─────────────────────────

export function checklistProgress(
  session: Pick<VisitSession, 'checklistState'>,
  serviceType: VisitServiceType,
): { done: number; total: number; percent: number } {
  const items = checklistFor(serviceType)
  const done = items.filter(i => session.checklistState[i.id]).length
  return {
    done,
    total: items.length,
    percent: items.length === 0 ? 0 : Math.round((done / items.length) * 100),
  }
}
