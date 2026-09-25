/**
 * Historial de una operación.
 *
 * Para qué existe: alguien vuelve después de dos semanas y necesita saber qué
 * pasó mientras no estaba. Un estado no cuenta una historia.
 *
 * Los eventos los escriben triggers en la base, así que acá no hay nada que
 * genere texto: solo lo agrupamos para que se lea. El `summary` viene armado
 * desde el trigger a propósito — dice lo mismo hoy que dentro de un año,
 * aunque la pantalla cambie.
 */

export type ActivityKind =
  | 'OPERATION_CREATED'
  | 'DOCUMENT_REQUESTED'
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_STATUS_CHANGED'
  | 'DOCUMENT_REMOVED'
  | 'OFFER_CREATED'
  | 'OFFER_SENT'
  | 'OFFER_STATUS_CHANGED'
  | 'PROPERTY_PROMOTED'
  | 'NOTE_ADDED'

export interface ActivityEvent {
  id: string
  operationId: string
  kind: ActivityKind
  /** Una línea lista para mostrar, armada por el trigger. */
  summary: string
  detail?: string
  metadata: Record<string, unknown>
  createdAt: number
}

/** Familia del evento. Define el color, no el significado. */
export type ActivityFamily = 'DOCUMENT' | 'OFFER' | 'PROPERTY' | 'OPERATION'

export function familyOf(kind: ActivityKind): ActivityFamily {
  if (kind.startsWith('DOCUMENT')) return 'DOCUMENT'
  if (kind.startsWith('OFFER')) return 'OFFER'
  if (kind === 'PROPERTY_PROMOTED') return 'PROPERTY'
  return 'OPERATION'
}

/**
 * Los eventos que movieron la aguja, para el resumen de "qué pasó desde la
 * última vez". Un cambio de estado de un documento es ruido al lado de una
 * oferta aceptada.
 */
const MILESTONES: ActivityKind[] = [
  'OFFER_SENT', 'OFFER_STATUS_CHANGED', 'PROPERTY_PROMOTED', 'DOCUMENT_UPLOADED',
]

export function isMilestone(e: ActivityEvent): boolean {
  return MILESTONES.includes(e.kind)
}

// ───────────────────────── Agrupado por día ─────────────────────────

export interface ActivityDay {
  /** ISO corta del día: "2026-03-20". */
  date: string
  label: string
  events: ActivityEvent[]
}

const DAY_MS = 24 * 60 * 60 * 1000

function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/**
 * Cómo se llama ese día para una persona.
 * "Hoy" y "Ayer" se leen; "2026-03-20" hay que decodificarlo.
 */
export function dayLabel(date: string, today = isoDay(Date.now())): string {
  if (date === today) return 'Hoy'
  const yesterday = isoDay(Date.parse(`${today}T00:00:00.000Z`) - DAY_MS)
  if (date === yesterday) return 'Ayer'

  const d = new Date(`${date}T00:00:00.000Z`)
  const fmt = d.toLocaleDateString('es-AR', {
    day: 'numeric', month: 'long', timeZone: 'UTC',
  })
  // El año solo cuando no es el corriente: repetirlo en cada fila es ruido.
  return date.slice(0, 4) === today.slice(0, 4)
    ? fmt
    : `${fmt} de ${date.slice(0, 4)}`
}

/**
 * Agrupa por día, del más reciente al más viejo, y dentro de cada día del
 * evento más nuevo al más viejo. Es el orden en que se lee un historial.
 */
export function groupByDay(events: ActivityEvent[], today?: string): ActivityDay[] {
  const byDate = new Map<string, ActivityEvent[]>()

  for (const e of events) {
    const d = isoDay(e.createdAt)
    const bucket = byDate.get(d)
    if (bucket) bucket.push(e)
    else byDate.set(d, [e])
  }

  return [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, list]) => ({
      date,
      label: dayLabel(date, today),
      events: [...list].sort((a, b) => b.createdAt - a.createdAt),
    }))
}

/**
 * Hace cuánto pasó, en palabras.
 *
 * Redondea hacia abajo a propósito: "hace 2 horas" para algo de hace 2 horas
 * y 50 minutos es más honesto que "hace 3 horas", porque nadie espera
 * precisión de reloj y adelantar el tiempo se siente mal.
 */
export function relativeTime(ms: number, now = Date.now()): string {
  const diff = now - ms
  if (diff < 0) return 'recién'

  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'recién'
  if (min < 60) return `hace ${min} min`

  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} ${h === 1 ? 'hora' : 'horas'}`

  const d = Math.floor(h / 24)
  if (d < 30) return `hace ${d} ${d === 1 ? 'día' : 'días'}`

  const mo = Math.floor(d / 30)
  if (mo < 12) return `hace ${mo} ${mo === 1 ? 'mes' : 'meses'}`

  const y = Math.floor(mo / 12)
  return `hace ${y} ${y === 1 ? 'año' : 'años'}`
}

/**
 * Qué pasó desde la última vez que entró.
 *
 * Devuelve `null` cuando no hay nada nuevo: es distinto de "cero eventos", y
 * la pantalla no debería decir "0 novedades" sino no decir nada.
 */
export function newSince(events: ActivityEvent[], lastSeen: number | null): ActivityEvent[] | null {
  if (lastSeen === null) return null
  const fresh = events.filter(e => e.createdAt > lastSeen)
  return fresh.length > 0 ? fresh : null
}
