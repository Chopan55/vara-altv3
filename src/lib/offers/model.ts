/**
 * Ofertas.
 *
 * El momento de verdad del producto. Todo lo demás —comparar, juntar papeles,
 * calcular costos— existe para llegar acá: alguien pone un número por escrito.
 *
 * Dos decisiones que atraviesan el módulo:
 *
 * 1. **VARA no sugiere cuánto ofrecer.** Podríamos calcular un número a
 *    partir del precio publicado y quedaría muy bien en pantalla, pero sería
 *    una opinión disfrazada de dato sobre la plata de otra persona. Lo que sí
 *    hacemos es mostrar la diferencia contra el precio pedido, que es un
 *    hecho verificable.
 * 2. **Una contraoferta no pisa a la anterior.** Es una oferta nueva que
 *    apunta a la vieja. La negociación es una cadena y queda entera.
 *
 * Todo lo de acá es puro. La persistencia vive en `src/lib/supabase/offers.ts`.
 */

export type OfferStatus =
  | 'DRAFT'
  | 'SENT'
  | 'COUNTERED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'EXPIRED'

export type OfferParty = 'BUYER' | 'SELLER'

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  DRAFT: 'Borrador',
  SENT: 'Enviada',
  COUNTERED: 'Contraofertada',
  ACCEPTED: 'Aceptada',
  REJECTED: 'Rechazada',
  WITHDRAWN: 'Retirada',
  EXPIRED: 'Vencida',
}

export interface Offer {
  id: string
  operationId: string
  propertyId?: string
  /** La oferta a la que responde, si es contraoferta. */
  parentOfferId?: string
  party: OfferParty
  status: OfferStatus
  amount: number
  currency: 'USD' | 'ARS'
  conditions: string[]
  /** ISO corta: "2026-04-10". Sin esto la oferta queda abierta para siempre. */
  validUntil?: string
  message?: string
  responseNote?: string
  respondedAt?: number
  createdAt: number
}

/**
 * Transiciones permitidas.
 *
 * Un borrador se puede tocar libremente; una oferta enviada ya no, porque del
 * otro lado hay alguien que la leyó. Todo lo cerrado —aceptada, rechazada,
 * retirada— es terminal: para seguir negociando se emite una oferta nueva,
 * que es exactamente lo que pasa en la vida real.
 */
export const ALLOWED_OFFER_TRANSITIONS: Record<OfferStatus, OfferStatus[]> = {
  DRAFT: ['SENT', 'WITHDRAWN'],
  SENT: ['ACCEPTED', 'REJECTED', 'COUNTERED', 'WITHDRAWN', 'EXPIRED'],
  COUNTERED: ['ACCEPTED', 'REJECTED', 'WITHDRAWN'],
  ACCEPTED: [],
  REJECTED: [],
  WITHDRAWN: [],
  EXPIRED: [],
}

export function canTransitionOffer(from: OfferStatus, to: OfferStatus): boolean {
  return ALLOWED_OFFER_TRANSITIONS[from].includes(to)
}

/** Sigue en juego: todavía puede terminar en un acuerdo. */
export function isOpen(o: Offer): boolean {
  return o.status === 'DRAFT' || o.status === 'SENT' || o.status === 'COUNTERED'
}

export function isClosed(o: Offer): boolean {
  return !isOpen(o)
}

// ───────────────────────── Validación ─────────────────────────

export interface OfferDraft {
  amount: number
  currency: 'USD' | 'ARS'
  conditions: string[]
  validUntil?: string
  message?: string
}

export interface OfferCheck {
  ok: boolean
  /** Errores que impiden enviar. Se muestran tal cual. */
  errors: string[]
  /** Avisos que NO impiden enviar. La decisión sigue siendo de la persona. */
  warnings: string[]
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * ¿Se puede enviar esta oferta?
 *
 * La diferencia entre `errors` y `warnings` es deliberada: bloqueamos lo que
 * es imposible (un monto de cero, una fecha ya pasada) y solo avisamos sobre
 * lo que es raro pero legítimo. Ofrecer la mitad del precio pedido es una
 * estrategia, no un error, y VARA no está para desalentarla.
 */
export function checkOffer(
  draft: OfferDraft,
  context: { askingPrice?: number; today?: string } = {},
): OfferCheck {
  const errors: string[] = []
  const warnings: string[] = []

  if (!isFinite(draft.amount) || draft.amount <= 0) {
    errors.push('Poné cuánto ofrecés.')
  }

  if (draft.validUntil !== undefined) {
    if (!ISO_DATE.test(draft.validUntil)) {
      errors.push('La fecha de validez no es válida.')
    } else {
      const today = context.today ?? new Date().toISOString().slice(0, 10)
      if (draft.validUntil < today) {
        errors.push('La fecha de validez ya pasó.')
      } else if (draft.validUntil === today) {
        warnings.push('La oferta vence hoy: puede que no lleguen a contestarte.')
      }
    }
  } else {
    warnings.push('Sin fecha de validez, la oferta queda abierta sin plazo.')
  }

  const asking = context.askingPrice
  if (asking !== undefined && asking > 0 && draft.amount > 0 && draft.amount > asking) {
    warnings.push('Estás ofreciendo más que el precio pedido.')
  }

  if (draft.conditions.some(c => c.trim().length === 0)) {
    errors.push('Hay una condición vacía: escribila o sacala.')
  }

  return { ok: errors.length === 0, errors, warnings }
}

// ───────────────────── Comparación contra el precio ─────────────────────

export interface OfferGap {
  /** Diferencia absoluta. Negativa si la oferta está por debajo del pedido. */
  difference: number
  /** Porcentaje respecto del precio pedido, redondeado a un decimal. */
  percent: number
  label: string
}

/**
 * Cuánto se aparta la oferta del precio pedido.
 *
 * Es un hecho, no un consejo: no decimos si conviene, decimos cuánto es.
 * Devuelve `null` cuando no hay precio publicado — sin referencia no hay
 * diferencia que calcular, y un 0% ahí sería mentira.
 */
export function offerGap(amount: number, askingPrice: number | undefined): OfferGap | null {
  if (!askingPrice || askingPrice <= 0 || !amount || amount <= 0) return null

  const difference = amount - askingPrice
  const percent = Math.round((difference / askingPrice) * 1000) / 10

  const label =
    difference === 0 ? 'Igual al precio pedido'
    : difference < 0 ? `${Math.abs(percent)}% por debajo del precio pedido`
    : `${percent}% por encima del precio pedido`

  return { difference, percent, label }
}

// ───────────────────────── La negociación ─────────────────────────

/**
 * Las ofertas más nuevas primero. Es el orden en que se lee una negociación:
 * lo último que pasó es lo que importa.
 */
export function sortOffers(list: Offer[]): Offer[] {
  return [...list].sort((a, b) => b.createdAt - a.createdAt)
}

/**
 * La oferta que define dónde está parada la negociación hoy.
 * Si hay una aceptada, esa manda: ya no hay negociación que seguir.
 */
export function currentOffer(list: Offer[]): Offer | null {
  const accepted = list.find(o => o.status === 'ACCEPTED')
  if (accepted) return accepted
  const open = sortOffers(list.filter(isOpen))
  return open[0] ?? null
}

/**
 * La cadena completa de una negociación, de la más vieja a la más nueva.
 * Sigue `parentOfferId` hacia atrás desde la oferta dada.
 */
export function offerChain(list: Offer[], offerId: string): Offer[] {
  const byId = new Map(list.map(o => [o.id, o]))
  const chain: Offer[] = []
  const seen = new Set<string>()

  let cur = byId.get(offerId)
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    chain.unshift(cur)
    cur = cur.parentOfferId ? byId.get(cur.parentOfferId) : undefined
  }
  return chain
}

/** ¿Venció? Se calcula, no se guarda: una fecha pasada es pasada. */
export function isExpired(o: Offer, today?: string): boolean {
  if (!o.validUntil) return false
  if (o.status !== 'SENT' && o.status !== 'DRAFT') return false
  return o.validUntil < (today ?? new Date().toISOString().slice(0, 10))
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Cuántos días faltan para una fecha. Negativo si ya pasó.
 * Devuelve `null` si no hay fecha: sin plazo no hay cuenta regresiva.
 */
export function daysUntil(date: string | undefined, today?: string): number | null {
  if (!date) return null
  const t = today ?? new Date().toISOString().slice(0, 10)
  const a = Date.parse(`${date}T00:00:00.000Z`)
  const b = Date.parse(`${t}T00:00:00.000Z`)
  if (!isFinite(a) || !isFinite(b)) return null
  return Math.round((a - b) / DAY_MS)
}

/**
 * Las ofertas abiertas que están por vencerse.
 *
 * Es el único vencimiento real que maneja el producto hoy: las tareas del
 * checklist no traen fecha, y ponerles una inventada sería peor que no
 * mostrar nada. La más urgente primero.
 */
export function expiringSoon(list: Offer[], withinDays = 7, today?: string): Offer[] {
  return list
    .filter(o => isOpen(o) && !isExpired(o, today))
    .map(o => ({ o, d: daysUntil(o.validUntil, today) }))
    .filter((x): x is { o: Offer; d: number } => x.d !== null && x.d >= 0 && x.d <= withinDays)
    .sort((a, b) => a.d - b.d)
    .map(x => x.o)
}

/** Qué está esperando esta oferta. Es lo que la tarjeta muestra como estado. */
export function offerNextStep(o: Offer, today?: string): string {
  if (isExpired(o, today)) return 'Se venció el plazo que pusiste. Podés hacer una oferta nueva.'
  switch (o.status) {
    case 'DRAFT': return 'Todavía no la enviaste.'
    case 'SENT': return 'Enviada: esperás respuesta.'
    case 'COUNTERED': return 'Te contraofertaron. Respondé o hacé una oferta nueva.'
    case 'ACCEPTED': return 'Aceptada. El siguiente paso es la reserva y el boleto.'
    case 'REJECTED': return 'Rechazada. Podés hacer otra oferta si querés seguir.'
    case 'WITHDRAWN': return 'La retiraste.'
    case 'EXPIRED': return 'Vencida.'
  }
}
