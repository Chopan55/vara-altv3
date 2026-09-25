'use client'

/**
 * Las ofertas de verdad, en la pantalla de ofertas.
 *
 * Construimos la entidad `Offer` pero esta ruta seguía mostrando solo el
 * ejemplo: alguien con una negociación real abierta entraba a "Ofertas" y
 * veía compradores inventados con un cartel de "ejemplo". Honesto, pero
 * inútil.
 *
 * Esto es un resumen transversal —todas las operaciones juntas— y no
 * reemplaza la negociación completa, que vive dentro de cada operación.
 * Desde acá se entra ahí.
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Handshake, ArrowRight, Loader2 } from 'lucide-react'
import {
  OFFER_STATUS_LABELS, sortOffers, isExpired, isOpen,
  type Offer, type OfferStatus,
} from '@/lib/offers/model'
import { hasOfferSession, fetchAllOffers } from '@/lib/supabase/offers'

const TONE: Record<OfferStatus, string> = {
  DRAFT: 'bg-slate-50 text-slate-500 border-slate-200',
  SENT: 'bg-sky-50 text-sky-600 border-sky-100',
  COUNTERED: 'bg-amber-50 text-amber-700 border-amber-100',
  ACCEPTED: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  REJECTED: 'bg-rose-50 text-rose-600 border-rose-100',
  WITHDRAWN: 'bg-slate-100 text-slate-400 border-slate-200',
  EXPIRED: 'bg-slate-100 text-slate-400 border-slate-200',
}

/**
 * Avisa si hay ofertas reales, para que la pantalla no ofrezca el ejemplo
 * cuando ya hay algo verdadero que mirar.
 */
export function RealOffersPanel({ onHasOffers }: { onHasOffers?: (has: boolean) => void }) {
  const [offers, setOffers] = useState<Offer[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    hasOfferSession().then(async ok => {
      const list = ok ? sortOffers(await fetchAllOffers()) : []
      if (!alive) return
      setOffers(list)
      setLoaded(true)
      onHasOffers?.(list.length > 0)
    })
    return () => { alive = false }
  }, [onHasOffers])

  if (!loaded) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-5 mb-5 flex items-center gap-2">
        <Loader2 size={14} className="animate-spin text-slate-300" />
        <p className="text-xs text-slate-400">Buscando tus ofertas…</p>
      </div>
    )
  }

  // Sin ofertas reales no mostramos nada: la pantalla ya tiene su estado vacío.
  if (offers.length === 0) return null

  const open = offers.filter(o => isOpen(o) && !isExpired(o)).length

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4 mb-5 space-y-3">
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
          <Handshake size={14} className="text-emerald-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">Tus ofertas</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {open === 0
              ? `${offers.length} registrada${offers.length > 1 ? 's' : ''}, ninguna abierta`
              : `${open} abierta${open > 1 ? 's' : ''} de ${offers.length}`}
          </p>
        </div>
      </div>

      {offers.slice(0, 5).map(o => {
        const status: OfferStatus = isExpired(o) ? 'EXPIRED' : o.status
        return (
          <Link key={o.id} href={`/operacion/${o.operationId}?tab=ofertas`}
            className="flex items-center gap-3 py-2 border-t border-slate-50 hover:bg-slate-50/60 transition-colors">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 tabular-nums">
                {o.currency} {o.amount.toLocaleString('es-AR')}
              </p>
              <p className="text-[11px] text-slate-400">
                {o.party === 'BUYER' ? 'Ofreciste vos' : 'Contraoferta del vendedor'}
                {o.validUntil && ` · vale hasta ${o.validUntil}`}
              </p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${TONE[status]}`}>
              {OFFER_STATUS_LABELS[status]}
            </span>
            <ArrowRight size={13} className="text-slate-300 flex-shrink-0" />
          </Link>
        )
      })}

      {offers.length > 5 && (
        <p className="text-[11px] text-slate-400 pt-1">
          Y {offers.length - 5} más. La negociación completa está dentro de cada operación.
        </p>
      )}
    </div>
  )
}
