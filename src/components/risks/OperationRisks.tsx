'use client'

/**
 * Los riesgos de la operación, con la evidencia a la vista.
 *
 * Antes la pantalla decía qué y por qué, pero no de dónde salía. "Riesgo
 * dominial alto" sin evidencia no se puede verificar ni discutir: solo
 * asusta. Acá cada riesgo muestra el hecho concreto que lo produjo.
 *
 * No hay botón de "aceptar riesgo" a propósito. Un riesgo que aceptás pero
 * que sigue siendo cierto, sigue siendo cierto — desaparece cuando arreglás
 * lo que lo causó, no cuando lo silenciás.
 */

import { useState, useEffect, useCallback } from 'react'
import { ShieldAlert, ShieldCheck, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import {
  computeRisks, groupByLevel,
  type DerivedRisk, type RiskLevel,
} from '@/lib/risks/engine'
import { hasDocumentSession, fetchDocuments } from '@/lib/supabase/documents'
import { fetchOffers } from '@/lib/supabase/offers'

const LEVEL_STYLE: Record<RiskLevel, { ring: string; chip: string; label: string }> = {
  HIGH: { ring: 'border-rose-200', chip: 'bg-rose-50 text-rose-700 border-rose-100', label: 'Alto' },
  MEDIUM: { ring: 'border-amber-200', chip: 'bg-amber-50 text-amber-700 border-amber-100', label: 'Medio' },
  LOW: { ring: 'border-slate-200/70', chip: 'bg-slate-50 text-slate-500 border-slate-200', label: 'Bajo' },
}

function RiskCard({ risk }: { risk: DerivedRisk }) {
  const [open, setOpen] = useState(risk.level === 'HIGH')
  const style = LEVEL_STYLE[risk.level]

  return (
    <div className={`bg-white rounded-xl border p-3.5 ${style.ring}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800 leading-tight">{risk.label}</p>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${style.chip}`}>
          {style.label}
        </span>
      </div>

      <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{risk.detail}</p>

      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-slate-600 mt-2 transition-colors">
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        En qué nos basamos
      </button>

      {open && (
        <ul className="mt-2 space-y-1 bg-slate-50 rounded-lg px-3 py-2">
          {risk.evidence.map(e => (
            <li key={e} className="text-[11px] text-slate-600 flex items-start gap-1.5">
              <span className="text-slate-300 mt-0.5">·</span> {e}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2.5 pt-2.5 border-t border-slate-50">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Qué hacer</p>
        <p className="text-xs text-slate-600 leading-relaxed">{risk.action}</p>
      </div>
    </div>
  )
}

export function OperationRisks({ operationId, propertyPrice, provinceName, dataConfidence }: {
  operationId: string
  propertyPrice?: number
  provinceName?: string
  dataConfidence?: 'VERIFIED' | 'PARTIAL' | 'ESTIMATED'
}) {
  const [risks, setRisks] = useState<DerivedRisk[]>([])
  const [loaded, setLoaded] = useState(false)
  const [session, setSession] = useState<boolean | null>(null)

  const load = useCallback(async () => {
    const [documents, offers] = await Promise.all([
      fetchDocuments(operationId),
      fetchOffers(operationId),
    ])
    setRisks(computeRisks({ documents, offers, propertyPrice, provinceName, dataConfidence }))
  }, [operationId, propertyPrice, provinceName, dataConfidence])

  useEffect(() => {
    let alive = true
    hasDocumentSession().then(async ok => {
      if (!alive) return
      setSession(ok)
      if (ok) await load()
      if (alive) setLoaded(true)
    })
    return () => { alive = false }
  }, [load])

  if (session === false) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-5">
        <p className="text-sm font-semibold text-slate-800 mb-1">Riesgos</p>
        <p className="text-xs text-slate-500 leading-relaxed">
          Los riesgos salen de tus documentos y ofertas. Iniciá sesión para verlos.
        </p>
      </div>
    )
  }

  if (!loaded) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-5 flex items-center gap-2">
        <Loader2 size={14} className="animate-spin text-slate-300" />
        <p className="text-xs text-slate-400">Revisando la operación…</p>
      </div>
    )
  }

  if (risks.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-5">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <ShieldCheck size={15} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Sin riesgos detectados</p>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              Con los datos que hay cargados hoy. A medida que sumes documentos y
              ofertas, esto se recalcula solo.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const grouped = groupByLevel(risks)

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4 space-y-3">
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center flex-shrink-0">
          <ShieldAlert size={15} className="text-rose-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">Riesgos</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {grouped.HIGH.length > 0
              ? `${grouped.HIGH.length} ${grouped.HIGH.length === 1 ? 'frena' : 'frenan'} la operación`
              : `${risks.length} para tener en cuenta`}
          </p>
        </div>
      </div>

      {[...grouped.HIGH, ...grouped.MEDIUM, ...grouped.LOW].map(r => (
        <RiskCard key={r.id} risk={r} />
      ))}

      <p className="text-[10px] text-slate-400 leading-relaxed pt-1">
        Se calculan a partir de tus documentos y ofertas. Cuando resolvés lo que
        los causa, desaparecen solos.
      </p>
    </div>
  )
}
