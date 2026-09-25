'use client'

/**
 * La negociación de una operación.
 *
 * Es el momento de verdad: acá alguien pone un número por escrito. Dos cosas
 * que este componente NO hace, a propósito:
 *
 * - No sugiere cuánto ofrecer. Sería una opinión disfrazada de dato sobre la
 *   plata de otra persona. Sí muestra la diferencia contra el precio pedido,
 *   que es un hecho verificable.
 * - No esconde las ofertas viejas. Una contraoferta se agrega a la cadena;
 *   lo que se ofreció antes queda a la vista.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Handshake, Loader2, AlertCircle, Check, X, Undo2, Plus, ArrowDown, ArrowUp,
  Clock,
} from 'lucide-react'
import {
  OFFER_STATUS_LABELS, checkOffer, offerGap, currentOffer, sortOffers,
  isExpired, offerNextStep, isOpen, expiringSoon, daysUntil,
  type Offer, type OfferStatus,
} from '@/lib/offers/model'
import {
  hasOfferSession, fetchOffers, createOffer, setOfferStatus, counterOffer,
} from '@/lib/supabase/offers'

const TONE: Record<OfferStatus, string> = {
  DRAFT: 'bg-slate-50 text-slate-500 border-slate-200',
  SENT: 'bg-sky-50 text-sky-600 border-sky-100',
  COUNTERED: 'bg-amber-50 text-amber-700 border-amber-100',
  ACCEPTED: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  REJECTED: 'bg-rose-50 text-rose-600 border-rose-100',
  WITHDRAWN: 'bg-slate-100 text-slate-400 border-slate-200',
  EXPIRED: 'bg-slate-100 text-slate-400 border-slate-200',
}

function money(n: number, currency: string) {
  return `${currency} ${n.toLocaleString('es-AR')}`
}

function GapLine({ amount, asking, currency }: {
  amount: number; asking?: number; currency: string
}) {
  const gap = offerGap(amount, asking)
  if (!gap) {
    return (
      <p className="text-[11px] text-slate-400">
        Sin precio publicado cargado, no podemos mostrar la diferencia.
      </p>
    )
  }
  const down = gap.difference < 0
  return (
    <p className={`text-[11px] flex items-center gap-1 ${down ? 'text-sky-600' : gap.difference > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
      {gap.difference !== 0 && (down ? <ArrowDown size={10} /> : <ArrowUp size={10} />)}
      {gap.label} · {money(Math.abs(gap.difference), currency)}
    </p>
  )
}

interface FormValues {
  amount: string
  validUntil: string
  conditions: string
  message: string
}

const EMPTY_FORM: FormValues = { amount: '', validUntil: '', conditions: '', message: '' }

function OfferForm({ title, currency, asking, submitLabel, onCancel, onSubmit, busy }: {
  title: string
  currency: 'USD' | 'ARS'
  asking?: number
  submitLabel: string
  onCancel: () => void
  onSubmit: (v: { amount: number; validUntil?: string; conditions: string[]; message?: string }) => void
  busy: boolean
}) {
  const [v, setV] = useState<FormValues>(EMPTY_FORM)

  const amount = Number(v.amount.replace(/[^\d]/g, ''))
  const conditions = v.conditions.split('\n').map(c => c.trim()).filter(c => c.length > 0)
  const check = checkOffer({
    amount,
    currency,
    conditions,
    validUntil: v.validUntil || undefined,
  }, { askingPrice: asking })

  return (
    <div className="border border-slate-200 rounded-xl p-4 space-y-3">
      <p className="text-sm font-bold text-slate-800">{title}</p>

      <div>
        <label htmlFor="of-amount" className="text-[11px] font-semibold text-slate-500 block mb-1">
          Cuánto ofrecés ({currency})
        </label>
        <input
          id="of-amount" inputMode="numeric" autoFocus
          value={v.amount}
          onChange={e => setV({ ...v, amount: e.target.value })}
          placeholder="185000"
          className="w-full border border-slate-200 focus:border-brand-400 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none tabular-nums placeholder:text-slate-300"
        />
        {amount > 0 && <div className="mt-1.5"><GapLine amount={amount} asking={asking} currency={currency} /></div>}
      </div>

      <div>
        <label htmlFor="of-until" className="text-[11px] font-semibold text-slate-500 block mb-1">
          Hasta cuándo vale
        </label>
        <input
          id="of-until" type="date"
          value={v.validUntil}
          onChange={e => setV({ ...v, validUntil: e.target.value })}
          className="w-full border border-slate-200 focus:border-brand-400 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none"
        />
      </div>

      <div>
        <label htmlFor="of-cond" className="text-[11px] font-semibold text-slate-500 block mb-1">
          Condiciones <span className="font-normal text-slate-400">— una por línea</span>
        </label>
        <textarea
          id="of-cond" rows={3}
          value={v.conditions}
          onChange={e => setV({ ...v, conditions: e.target.value })}
          placeholder={'Sujeto a informe de dominio sin inhibiciones\nEscrituración dentro de 60 días'}
          className="w-full border border-slate-200 focus:border-brand-400 rounded-lg px-3 py-2 text-xs text-slate-700 outline-none resize-none placeholder:text-slate-300"
        />
      </div>

      <div>
        <label htmlFor="of-msg" className="text-[11px] font-semibold text-slate-500 block mb-1">
          Mensaje <span className="font-normal text-slate-400">— opcional</span>
        </label>
        <textarea
          id="of-msg" rows={2}
          value={v.message}
          onChange={e => setV({ ...v, message: e.target.value })}
          className="w-full border border-slate-200 focus:border-brand-400 rounded-lg px-3 py-2 text-xs text-slate-700 outline-none resize-none"
        />
      </div>

      {check.errors.map(e => (
        <div key={e} className="flex items-start gap-2 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
          <AlertCircle size={11} className="text-rose-500 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-rose-700">{e}</p>
        </div>
      ))}
      {check.ok && check.warnings.map(w => (
        <div key={w} className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          <AlertCircle size={11} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-amber-700">{w}</p>
        </div>
      ))}

      <div className="flex items-center gap-2 pt-1">
        <button
          disabled={!check.ok || busy}
          onClick={() => onSubmit({
            amount,
            validUntil: v.validUntil || undefined,
            conditions,
            message: v.message.trim() || undefined,
          })}
          className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors">
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Handshake size={12} />} {submitLabel}
        </button>
        <button onClick={onCancel} className="text-xs text-slate-400 hover:text-slate-600 px-2">
          Cancelar
        </button>
      </div>
    </div>
  )
}

function OfferCard({ offer, asking, onRespond, onCounter, busy }: {
  offer: Offer
  asking?: number
  onRespond: (id: string, to: OfferStatus) => void
  onCounter: (o: Offer) => void
  busy: boolean
}) {
  const expired = isExpired(offer)
  const status: OfferStatus = expired ? 'EXPIRED' : offer.status

  return (
    <div className={`bg-white rounded-xl border border-slate-200/70 p-4 ${isOpen(offer) && !expired ? '' : 'opacity-75'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-extrabold text-slate-900 tabular-nums leading-tight">
            {money(offer.amount, offer.currency)}
          </p>
          <div className="mt-0.5">
            <GapLine amount={offer.amount} asking={asking} currency={offer.currency} />
          </div>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${TONE[status]}`}>
          {OFFER_STATUS_LABELS[status]}
        </span>
      </div>

      <p className="text-[11px] text-slate-400 mt-1.5">
        {offer.party === 'BUYER' ? 'Ofreciste vos' : 'Contraoferta del vendedor'}
        {offer.validUntil && ` · vale hasta ${offer.validUntil}`}
      </p>

      {offer.conditions.length > 0 && (
        <ul className="mt-2 space-y-1">
          {offer.conditions.map(c => (
            <li key={c} className="text-[11px] text-slate-600 flex items-start gap-1.5">
              <span className="text-slate-300 mt-0.5">·</span> {c}
            </li>
          ))}
        </ul>
      )}

      {offer.message && (
        <p className="text-[11px] text-slate-500 italic mt-2 leading-relaxed">“{offer.message}”</p>
      )}

      <div className="bg-slate-50 rounded-lg px-3 py-2 mt-3">
        <p className="text-[11px] text-slate-600">{offerNextStep(offer)}</p>
      </div>

      {isOpen(offer) && !expired && (
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-50">
          {offer.status === 'DRAFT' ? (
            <button onClick={() => onRespond(offer.id, 'SENT')} disabled={busy}
              className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-40">
              Enviar
            </button>
          ) : (
            <>
              <button onClick={() => onRespond(offer.id, 'ACCEPTED')} disabled={busy}
                className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-40">
                <Check size={11} /> La aceptaron
              </button>
              <button onClick={() => onCounter(offer)} disabled={busy}
                className="flex items-center gap-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-40">
                <Undo2 size={11} /> Contraofertaron
              </button>
              <button onClick={() => onRespond(offer.id, 'REJECTED')} disabled={busy}
                className="flex items-center gap-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-500 text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-40">
                <X size={11} /> La rechazaron
              </button>
            </>
          )}
          <button onClick={() => onRespond(offer.id, 'WITHDRAWN')} disabled={busy}
            className="text-xs text-slate-300 hover:text-rose-500 ml-auto">
            Retirar
          </button>
        </div>
      )}
    </div>
  )
}

export function OperationOffers({ operationId, propertyId, askingPrice, currency = 'USD' }: {
  operationId: string
  propertyId?: string
  askingPrice?: number
  currency?: 'USD' | 'ARS'
}) {
  const [offers, setOffers] = useState<Offer[]>([])
  const [session, setSession] = useState<boolean | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [counteringOf, setCounteringOf] = useState<Offer | null>(null)

  const refresh = useCallback(async () => {
    setOffers(sortOffers(await fetchOffers(operationId)))
  }, [operationId])

  useEffect(() => {
    let alive = true
    hasOfferSession().then(async ok => {
      if (!alive) return
      setSession(ok)
      if (ok) await refresh()
      if (alive) setLoaded(true)
    })
    return () => { alive = false }
  }, [refresh])

  const submitNew = async (v: { amount: number; validUntil?: string; conditions: string[]; message?: string }) => {
    setBusy(true); setError(null)
    const r = await createOffer({ operationId, propertyId, currency, send: true, ...v })
    if (!r.ok) setError(r.error ?? 'No pudimos guardar la oferta.')
    else setCreating(false)
    await refresh()
    setBusy(false)
  }

  const submitCounter = async (v: { amount: number; validUntil?: string; conditions: string[]; message?: string }) => {
    if (!counteringOf) return
    setBusy(true); setError(null)
    const r = await counterOffer({ parent: counteringOf, ...v })
    if (!r.ok) setError(r.error ?? 'No pudimos registrar la contraoferta.')
    else setCounteringOf(null)
    await refresh()
    setBusy(false)
  }

  const respond = async (id: string, to: OfferStatus) => {
    setBusy(true); setError(null)
    const r = await setOfferStatus(id, to)
    if (!r.ok) setError(r.error ?? 'No pudimos guardar el cambio.')
    await refresh()
    setBusy(false)
  }

  if (session === false) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-5">
        <p className="text-sm font-semibold text-slate-800 mb-1">Ofertas</p>
        <p className="text-xs text-slate-500 leading-relaxed">
          Para hacer una oferta necesitás iniciar sesión. Un número que se negocia con otra
          persona no puede quedar solo en este navegador.
        </p>
      </div>
    )
  }

  if (!loaded) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-5 flex items-center gap-2">
        <Loader2 size={14} className="animate-spin text-slate-300" />
        <p className="text-xs text-slate-400">Cargando la negociación…</p>
      </div>
    )
  }

  const current = currentOffer(offers)
  const soon = expiringSoon(offers)

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">Ofertas</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {offers.length === 0
                ? 'Todavía no hiciste ninguna oferta.'
                : current
                  ? offerNextStep(current)
                  : 'La negociación está cerrada. Podés hacer una oferta nueva.'}
            </p>
          </div>
          {!creating && !counteringOf && (
            <button onClick={() => setCreating(true)}
              className="flex-shrink-0 flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors">
              <Plus size={12} /> Hacer una oferta
            </button>
          )}
        </div>

        {askingPrice ? (
          <p className="text-[11px] text-slate-400">
            Precio pedido: <span className="tabular-nums font-semibold text-slate-600">{money(askingPrice, currency)}</span>
          </p>
        ) : (
          <p className="text-[11px] text-slate-400">
            No hay precio publicado cargado, así que no mostramos diferencias.
          </p>
        )}

        {error && (
          <div className="flex items-start gap-2 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
            <AlertCircle size={12} className="text-rose-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-rose-700">{error}</p>
          </div>
        )}

        {creating && (
          <OfferForm
            title="Nueva oferta" currency={currency} asking={askingPrice}
            submitLabel="Registrar oferta" busy={busy}
            onCancel={() => setCreating(false)} onSubmit={submitNew}
          />
        )}

        {counteringOf && (
          <OfferForm
            title={`Contraoferta a ${money(counteringOf.amount, counteringOf.currency)}`}
            currency={counteringOf.currency} asking={askingPrice}
            submitLabel="Registrar contraoferta" busy={busy}
            onCancel={() => setCounteringOf(null)} onSubmit={submitCounter}
          />
        )}
      </div>

      {soon.length > 0 && (() => {
        const d = daysUntil(soon[0].validUntil)
        return (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 flex items-start gap-2">
            <Clock size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-800">
              {d === 0
                ? `Tu oferta de ${money(soon[0].amount, soon[0].currency)} vence hoy.`
                : `Tu oferta de ${money(soon[0].amount, soon[0].currency)} vence en ${d} ${d === 1 ? 'día' : 'días'}.`}
            </p>
          </div>
        )
      })()}

      {offers.map(o => (
        <OfferCard
          key={o.id} offer={o} asking={askingPrice} busy={busy}
          onRespond={respond} onCounter={setCounteringOf}
        />
      ))}
    </div>
  )
}
