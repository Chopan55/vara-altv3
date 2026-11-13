'use client'

import { BarChart3 } from 'lucide-react'
import { analyzeNegotiation } from '@/lib/offers/negotiation'
import type { Offer } from '@/lib/offers/model'

/**
 * Negotiation Intelligence: lectura de la cadena de ofertas.
 *
 * Conclusión → evidencia → incertidumbre → opciones. Los hechos y las lecturas van separados y nunca se
 * sugiere un monto: la decisión (y el número) son de la persona.
 */

const HEADLINE: Record<'OPEN' | 'ACCEPTED' | 'CLOSED', string> = {
  OPEN: 'La negociación sigue abierta',
  ACCEPTED: 'La negociación terminó en un acuerdo',
  CLOSED: 'La negociación está cerrada',
}

export function NegotiationInsightCard({ offers, askingPrice }: { offers: Offer[]; askingPrice?: number }) {
  const insight = analyzeNegotiation(offers, { askingPrice, viewer: 'BUYER' })
  if (!insight) return null

  const facts = insight.observations.filter(o => o.certainty === 'FACT')
  const readings = insight.observations.filter(o => o.certainty === 'INFERENCE')

  return (
    <section aria-label="Lectura de la negociación" className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
          <BarChart3 size={15} className="text-brand-600" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">{HEADLINE[insight.state]}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Posición {insight.round}
            {insight.waitingOn ? ` · le toca ${insight.waitingOn === 'SELLER' ? 'al vendedor' : 'a vos'}` : ''}
          </p>
        </div>
      </div>

      {facts.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Lo que sabemos</p>
          <ul className="mt-1 space-y-1">
            {facts.map(o => <li key={o.text} className="text-xs text-slate-700">{o.text}</li>)}
          </ul>
        </div>
      )}

      {readings.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Lectura de VARA (no es un hecho)</p>
          <ul className="mt-1 space-y-1">
            {readings.map(o => <li key={o.text} className="text-xs text-slate-600 italic">{o.text}</li>)}
          </ul>
        </div>
      )}

      {insight.unknowns.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Lo que no sabemos</p>
          <ul className="mt-1 space-y-1">
            {insight.unknowns.map(u => <li key={u} className="text-xs text-slate-500">{u}</li>)}
          </ul>
        </div>
      )}

      {insight.options.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Opciones</p>
          <ul className="mt-1 space-y-1.5">
            {insight.options.map(o => (
              <li key={o.id} className="text-xs text-slate-700"><span className="font-semibold">{o.label}.</span> {o.why}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[10px] text-slate-400">VARA no sugiere cuánto ofrecer: el monto lo decidís vos.</p>
    </section>
  )
}
