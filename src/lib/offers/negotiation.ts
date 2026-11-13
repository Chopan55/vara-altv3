/**
 * Negotiation Intelligence: qué está pasando en la cadena de ofertas.
 *
 * Todo es puro y sale de las ofertas que ya guarda VARA (`lib/offers/model`). No hay segunda fuente.
 *
 * Respeta la regla del módulo de ofertas: **VARA no sugiere cuánto ofrecer.** Acá hay hechos medibles
 * (ronda, diferencia entre las últimas posiciones, cuánto se movió cada parte, plazo) y, aparte,
 * lecturas marcadas como INFERENCE ("la brecha se achica"). Los "próximos movimientos" son opciones
 * con su motivo, sin un monto: la decisión y el número son de la persona.
 */

import { currentOffer, daysUntil, isExpired, isOpen, offerChain, sortOffers, type Offer, type OfferParty } from '@/lib/offers/model'

export type Momentum = 'CONVERGING' | 'STALLED' | 'DIVERGING' | 'UNKNOWN'

export interface Observation {
  certainty: 'FACT' | 'INFERENCE'
  text: string
}

export interface MoveOption {
  id: 'accept' | 'counter' | 'wait' | 'new_offer' | 'review_conditions'
  label: string
  why: string
}

export interface NegotiationInsight {
  /** Cuántas posiciones tiene la cadena (oferta, contraoferta, …). */
  round: number
  currency: 'USD' | 'ARS'
  state: 'OPEN' | 'ACCEPTED' | 'CLOSED'
  /** De quién fue la última posición. */
  lastMover: OfferParty
  /** A quién le toca contestar (null si ya terminó). */
  waitingOn: OfferParty | null
  lastBuyer: number | null
  lastSeller: number | null
  /** Diferencia entre la última posición del comprador y la del vendedor (siempre positiva). Null si falta una de las dos. */
  gap: number | null
  /** La brecha respecto del precio pedido, en %. Null sin precio pedido: sin referencia no hay porcentaje. */
  gapPercentOfAsking: number | null
  /** Cuánto de la brecha inicial ya se cerró (0 a 100). Null si todavía no hay dos posiciones. */
  closedPercent: number | null
  momentum: Momentum
  /** Cuánto subió el comprador y cuánto bajó el vendedor desde su primera posición. */
  buyerMoved: number
  sellerMoved: number
  /** El último movimiento de cada parte fue menor que el anterior (concede cada vez menos). */
  slowing: { BUYER: boolean; SELLER: boolean }
  /** Días que faltan para el vencimiento de la posición vigente. Null sin fecha. */
  daysToExpiry: number | null
  /** Condiciones de la posición vigente que no estaban en la anterior. */
  newConditions: string[]
  /** Hechos y lecturas, separados. */
  observations: Observation[]
  /** Opciones, nunca un monto. */
  options: MoveOption[]
  /** Lo que VARA no puede decir y por qué. */
  unknowns: string[]
}

const norm = (c: string) => c.trim().toLowerCase()

function pct(n: number): number {
  return Math.round(n * 10) / 10
}

/** La cadena que importa: la de la oferta vigente o, si no hay ninguna abierta, la más reciente. */
function activeChain(list: Offer[]): Offer[] {
  const cur = currentOffer(list)
  const anchor = cur ?? sortOffers(list)[0]
  return anchor ? offerChain(list, anchor.id) : []
}

export function analyzeNegotiation(list: Offer[], opts: { askingPrice?: number; today?: string; /** Quién mira: define qué opciones se ofrecen. Por defecto, el comprador. */ viewer?: OfferParty } = {}): NegotiationInsight | null {
  // Un borrador todavía no es una posición: la otra parte no lo vio.
  const chain = activeChain(list.filter(o => o.status !== 'DRAFT'))
  if (chain.length === 0) return null

  const unknowns: string[] = []
  const last = chain[chain.length - 1]
  const currency = last.currency
  const mixed = chain.some(o => o.currency !== currency)
  const asking = !mixed && opts.askingPrice && opts.askingPrice > 0 ? opts.askingPrice : undefined

  const buyers = chain.filter(o => o.party === 'BUYER')
  const sellers = chain.filter(o => o.party === 'SELLER')
  const lastBuyer = buyers.length ? buyers[buyers.length - 1].amount : null
  const lastSeller = sellers.length ? sellers[sellers.length - 1].amount : null

  if (mixed) unknowns.push('Las posiciones están en monedas distintas: VARA no las compara porque no convierte.')
  const comparable = !mixed
  const gap = comparable && lastBuyer !== null && lastSeller !== null ? Math.abs(lastSeller - lastBuyer) : null

  // La brecha inicial: primera oferta del comprador contra la primera referencia del vendedor (su contraoferta o el precio pedido).
  const firstBuyer = buyers[0]?.amount ?? null
  const sellerRef = sellers[0]?.amount ?? asking ?? null
  const initialGap = comparable && firstBuyer !== null && sellerRef !== null ? Math.abs(sellerRef - firstBuyer) : null
  const closedPercent = gap !== null && initialGap !== null && initialGap > 0
    ? Math.max(0, Math.min(100, pct(((initialGap - gap) / initialGap) * 100)))
    : null

  // Movimientos de cada parte, de posición en posición.
  const movesOf = (party: OfferParty) => {
    const own = chain.filter(o => o.party === party)
    const out: number[] = []
    for (let i = 1; i < own.length; i++) out.push(Math.abs(own[i].amount - own[i - 1].amount))
    return out
  }
  const bMoves = comparable ? movesOf('BUYER') : []
  const sMoves = comparable ? movesOf('SELLER') : []
  const buyerMoved = comparable && buyers.length > 0 ? Math.max(0, buyers[buyers.length - 1].amount - buyers[0].amount) : 0
  // El vendedor se mide contra el precio pedido si lo hay; si no, contra su primera posición.
  const sellerStart = asking ?? sellers[0]?.amount ?? null
  const sellerMoved = comparable && sellers.length > 0 && sellerStart !== null ? Math.max(0, sellerStart - sellers[sellers.length - 1].amount) : 0
  const slowing = {
    BUYER: bMoves.length >= 2 && bMoves[bMoves.length - 1] < bMoves[bMoves.length - 2],
    SELLER: sMoves.length >= 2 && sMoves[sMoves.length - 1] < sMoves[sMoves.length - 2],
  }

  // Momentum: cómo cambió la brecha entre las dos últimas posiciones enfrentadas.
  let momentum: Momentum = 'UNKNOWN'
  if (comparable && chain.length >= 3) {
    const gapAt = (i: number) => {
      const upto = chain.slice(0, i + 1)
      const b = [...upto].reverse().find(o => o.party === 'BUYER')
      const s = [...upto].reverse().find(o => o.party === 'SELLER')
      return b && s ? Math.abs(s.amount - b.amount) : null
    }
    const now = gapAt(chain.length - 1)
    const before = gapAt(chain.length - 2)
    if (now !== null && before !== null) momentum = now < before ? 'CONVERGING' : now === before ? 'STALLED' : 'DIVERGING'
  } else if (chain.length < 3) {
    unknowns.push('Con menos de tres posiciones todavía no se puede leer hacia dónde va la negociación.')
  }

  const state: NegotiationInsight['state'] = last.status === 'ACCEPTED' ? 'ACCEPTED' : isOpen(last) && !isExpired(last, opts.today) ? 'OPEN' : 'CLOSED'
  const waitingOn: OfferParty | null = state === 'OPEN' ? (last.party === 'BUYER' ? 'SELLER' : 'BUYER') : null
  const daysToExpiry = state === 'OPEN' ? daysUntil(last.validUntil, opts.today) : null

  const prevConds = new Set((chain.length > 1 ? chain[chain.length - 2].conditions : []).map(norm))
  const newConditions = chain.length > 1 ? last.conditions.filter(c => c.trim() && !prevConds.has(norm(c))) : []

  if (!asking && !mixed) unknowns.push('No hay precio pedido cargado: VARA no puede decir cuánto se apartan las posiciones del precio publicado.')

  // ── Hechos ──
  const money = (n: number) => `${currency} ${Math.round(n).toLocaleString('es-AR')}`
  const observations: Observation[] = []
  observations.push({ certainty: 'FACT', text: `Vas por la posición ${chain.length} de la cadena. ${last.party === 'BUYER' ? 'La última la hizo el comprador' : 'La última la hizo el vendedor'}.` })
  if (gap !== null) {
    observations.push({ certainty: 'FACT', text: `Entre la última posición del comprador (${money(lastBuyer as number)}) y la del vendedor (${money(lastSeller as number)}) hay ${money(gap)}${asking ? `, un ${pct((gap / asking) * 100)}% del precio pedido` : ''}.` })
  }
  if (closedPercent !== null) observations.push({ certainty: 'FACT', text: `Desde el arranque se cerró el ${closedPercent}% de la diferencia inicial.` })
  if (buyerMoved > 0) observations.push({ certainty: 'FACT', text: `El comprador subió ${money(buyerMoved)} desde su primera oferta.` })
  if (sellerMoved > 0) observations.push({ certainty: 'FACT', text: `El vendedor bajó ${money(sellerMoved)} desde ${asking ? 'el precio pedido' : 'su primera posición'}.` })
  if (newConditions.length) observations.push({ certainty: 'FACT', text: `La última posición agregó condiciones: ${newConditions.join('; ')}.` })
  if (daysToExpiry !== null) {
    observations.push({ certainty: 'FACT', text: daysToExpiry < 0 ? 'La posición vigente ya venció.' : daysToExpiry === 0 ? 'La posición vigente vence hoy.' : `La posición vigente vence en ${daysToExpiry} día${daysToExpiry > 1 ? 's' : ''}.` })
  }
  // ── Lecturas (no son hechos) ──
  if (momentum === 'CONVERGING') observations.push({ certainty: 'INFERENCE', text: 'La brecha se está achicando: las posiciones se acercan.' })
  if (momentum === 'STALLED') observations.push({ certainty: 'INFERENCE', text: 'La brecha no cambió en el último movimiento: puede estar estancada.' })
  if (momentum === 'DIVERGING') observations.push({ certainty: 'INFERENCE', text: 'La brecha creció en el último movimiento: las posiciones se alejan.' })
  if (slowing.BUYER) observations.push({ certainty: 'INFERENCE', text: 'El comprador sube cada vez menos en cada ronda.' })
  if (slowing.SELLER) observations.push({ certainty: 'INFERENCE', text: 'El vendedor baja cada vez menos en cada ronda.' })

  // ── Opciones: sin montos ──
  const options: MoveOption[] = []
  const viewer: OfferParty = opts.viewer ?? 'BUYER'
  const otherName = viewer === 'BUYER' ? 'del vendedor' : 'del comprador'
  if (state === 'OPEN' && waitingOn !== null && waitingOn !== viewer) {
    options.push({ id: 'wait', label: 'Esperar la respuesta', why: daysToExpiry !== null && daysToExpiry >= 0 ? `Tu posición sigue vigente ${daysToExpiry === 0 ? 'hasta hoy' : `${daysToExpiry} día${daysToExpiry > 1 ? 's' : ''} más`}.` : `La pelota está del lado ${otherName}.` })
  } else if (state === 'OPEN' && waitingOn === viewer) {
    options.push({ id: 'accept', label: `Aceptar la posición ${otherName}`, why: gap !== null ? `Cierra la brecha de ${money(gap)}.` : 'Termina la negociación en esos términos.' })
    options.push({ id: 'counter', label: 'Hacer una contraoferta', why: momentum === 'CONVERGING' ? 'Las posiciones se están acercando: todavía hay recorrido.' : 'Mantiene abierta la negociación; el monto lo definís vos.' })
    if (newConditions.length) options.push({ id: 'review_conditions', label: 'Revisar las condiciones nuevas', why: `${viewer === 'BUYER' ? 'El vendedor' : 'El comprador'} agregó condiciones que no estaban antes.` })
  } else if (state === 'CLOSED') {
    options.push({ id: 'new_offer', label: 'Hacer una oferta nueva', why: 'La anterior terminó; una oferta nueva reabre la conversación.' })
  }

  return {
    round: chain.length, currency, state, lastMover: last.party, waitingOn,
    lastBuyer, lastSeller, gap,
    gapPercentOfAsking: gap !== null && asking ? pct((gap / asking) * 100) : null,
    closedPercent, momentum, buyerMoved, sellerMoved, slowing, daysToExpiry, newConditions,
    observations, options, unknowns,
  }
}
