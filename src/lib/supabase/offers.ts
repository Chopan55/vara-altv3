import { tryCreateClient } from './client'
import { log } from '@/lib/observability/logger'
import type { OfferRow } from './types'
import { canTransitionOffer, type Offer, type OfferStatus, type OfferParty } from '@/lib/offers/model'

/**
 * Ofertas contra Supabase.
 *
 * Una oferta revela cuánto está dispuesto a pagar alguien: es de lo más
 * sensible que guarda el producto. RLS la ata a su dueño y acá no hay ningún
 * camino que la lea sin sesión.
 *
 * No hay fallback a localStorage a propósito. Un número que se negocia con
 * otra persona no puede vivir solo en un navegador que se limpia.
 */

function rowToOffer(r: OfferRow): Offer {
  return {
    id: r.id,
    operationId: r.operation_id,
    propertyId: r.property_id ?? undefined,
    parentOfferId: r.parent_offer_id ?? undefined,
    party: r.party,
    status: r.status,
    amount: Number(r.amount),
    currency: r.currency === 'ARS' ? 'ARS' : 'USD',
    conditions: r.conditions ?? [],
    validUntil: r.valid_until ?? undefined,
    message: r.message ?? undefined,
    responseNote: r.response_note ?? undefined,
    respondedAt: r.responded_at ? Date.parse(r.responded_at) : undefined,
    createdAt: Date.parse(r.created_at),
  }
}

export async function hasOfferSession(): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const { data } = await supabase.auth.getUser()
  return Boolean(data.user)
}

export async function fetchOffers(operationId: string): Promise<Offer[]> {
  const supabase = tryCreateClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .eq('operation_id', operationId)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data.map(rowToOffer)
}

/**
 * Todas las ofertas del usuario, de cualquier operación.
 *
 * No filtra por operación a propósito: RLS ya limita las filas a su dueño, y
 * la pantalla de ofertas necesita ver la negociación completa aunque haya
 * varias operaciones abiertas.
 */
export async function fetchAllOffers(): Promise<Offer[]> {
  const supabase = tryCreateClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data.map(rowToOffer)
}

export interface OfferResult {
  ok: boolean
  /** Mensaje listo para mostrar. */
  error?: string
  offer?: Offer
}

export async function createOffer(input: {
  operationId: string
  propertyId?: string
  parentOfferId?: string
  party?: OfferParty
  amount: number
  currency: 'USD' | 'ARS'
  conditions: string[]
  validUntil?: string
  message?: string
  /** true la manda de una; false la deja como borrador. */
  send: boolean
}): Promise<OfferResult> {
  const supabase = tryCreateClient()
  if (!supabase) return { ok: false, error: 'No hay conexión con la base.' }
  const { data: u } = await supabase.auth.getUser()
  const userId = u.user?.id
  if (!userId) return { ok: false, error: 'Necesitás iniciar sesión para hacer una oferta.' }

  const { data, error } = await supabase
    .from('offers')
    .insert({
      user_id: userId,
      operation_id: input.operationId,
      property_id: input.propertyId ?? null,
      parent_offer_id: input.parentOfferId ?? null,
      party: input.party ?? 'BUYER',
      status: input.send ? 'SENT' : 'DRAFT',
      amount: input.amount,
      currency: input.currency,
      conditions: input.conditions,
      valid_until: input.validUntil ?? null,
      message: input.message ?? null,
    })
    .select('*')
    .maybeSingle()

  if (error || !data) {
    if (error) log.error('offer.create.failed', error, { operationId: input.operationId })
    return { ok: false, error: 'No pudimos guardar la oferta. Probá de nuevo.' }
  }
  return { ok: true, offer: rowToOffer(data) }
}

/**
 * Cambia el estado de una oferta.
 *
 * Valida la transición contra la oferta que está en la base, no contra la que
 * tiene la pantalla: entre que se dibujó la tarjeta y se apretó el botón
 * pueden haber pasado minutos.
 */
export async function setOfferStatus(
  offerId: string,
  to: OfferStatus,
  responseNote?: string,
): Promise<OfferResult> {
  const supabase = tryCreateClient()
  if (!supabase) return { ok: false, error: 'No hay conexión con la base.' }

  const { data: current } = await supabase
    .from('offers').select('*').eq('id', offerId).maybeSingle()
  if (!current) return { ok: false, error: 'No encontramos esa oferta.' }

  const offer = rowToOffer(current)
  if (!canTransitionOffer(offer.status, to)) {
    return {
      ok: false,
      error: offer.status === to
        ? 'La oferta ya está en ese estado.'
        : `Una oferta ${offer.status === 'ACCEPTED' ? 'aceptada' : 'cerrada'} no se puede cambiar. Hacé una oferta nueva.`,
    }
  }

  const patch: Partial<OfferRow> = { status: to, responded_at: new Date().toISOString() }
  if (responseNote !== undefined) patch.response_note = responseNote || null

  const { data, error } = await supabase
    .from('offers').update(patch).eq('id', offerId).select('*').maybeSingle()
  if (error || !data) return { ok: false, error: 'No pudimos guardar el cambio.' }
  return { ok: true, offer: rowToOffer(data) }
}

/**
 * Registra una contraoferta: marca la original como COUNTERED y crea la nueva
 * apuntando a ella. Si la original no admite contraoferta, no se crea nada.
 */
export async function counterOffer(input: {
  parent: Offer
  amount: number
  conditions: string[]
  validUntil?: string
  message?: string
}): Promise<OfferResult> {
  if (!canTransitionOffer(input.parent.status, 'COUNTERED')) {
    return { ok: false, error: 'Esa oferta ya no admite una contraoferta.' }
  }

  const supabase = tryCreateClient()
  if (!supabase) return { ok: false, error: 'No hay conexión con la base.' }

  const { error: upErr } = await supabase
    .from('offers')
    .update({ status: 'COUNTERED', responded_at: new Date().toISOString() })
    .eq('id', input.parent.id)
  if (upErr) return { ok: false, error: 'No pudimos registrar la respuesta.' }

  return createOffer({
    operationId: input.parent.operationId,
    propertyId: input.parent.propertyId,
    parentOfferId: input.parent.id,
    // La contraoferta viene de la otra parte.
    party: input.parent.party === 'BUYER' ? 'SELLER' : 'BUYER',
    amount: input.amount,
    currency: input.parent.currency,
    conditions: input.conditions,
    validUntil: input.validUntil,
    message: input.message,
    send: true,
  })
}

/** Solo se borra un borrador. Una oferta enviada se retira, no se borra. */
export async function deleteDraftOffer(offerId: string): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const { error } = await supabase
    .from('offers').delete().eq('id', offerId).eq('status', 'DRAFT')
  return !error
}
