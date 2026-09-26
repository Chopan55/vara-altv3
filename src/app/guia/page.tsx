'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search, ChevronDown, ChevronUp, AlertTriangle, MessageSquare, BookOpen } from 'lucide-react'
import { useVaraState } from '@/hooks/useVaraState'
import { KNOWLEDGE, type KnowledgeEntry, type Audience } from '@/data/knowledge'

/** Orden real del proceso. Las entradas sin etapa van al final, como conceptos generales. */
const STAGE_ORDER = [
  'Reserva',
  'Documentación del vendedor',
  'Documentación del comprador',
  'Estudio de títulos y certificaciones',
  'Boleto de compraventa',
  'Escrituración',
] as const

function EntryCard({ entry, open, onToggle }: {
  entry: KnowledgeEntry
  open: boolean
  onToggle: () => void
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card overflow-hidden">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900 text-sm">{entry.title}</p>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{entry.summary}</p>
        </div>
        {open
          ? <ChevronUp size={16} className="text-slate-400 flex-shrink-0 mt-0.5" />
          : <ChevronDown size={16} className="text-slate-400 flex-shrink-0 mt-0.5" />}
      </button>

      {open && (
        <div className="px-4 pb-4 -mt-1">
          <div className="border-t border-slate-50 pt-3 space-y-3">
            {entry.body.split('\n\n').map((p, i) => (
              <p key={i} className="text-sm text-slate-600 leading-relaxed">{p}</p>
            ))}

            {entry.watchOut && entry.watchOut.length > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <AlertTriangle size={12} className="text-amber-500" />
                  <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wide">
                    Señales de alerta
                  </p>
                </div>
                <ul className="space-y-1.5">
                  {entry.watchOut.map((w, i) => (
                    <li key={i} className="text-xs text-amber-800 flex gap-1.5 leading-relaxed">
                      <span className="text-amber-500 flex-shrink-0">•</span>{w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function GuiaPage() {
  const vara = useVaraState()
  const audience: Audience = vara.journeyType === 'SELL_PROPERTY' ? 'SELL' : 'BUY'

  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    return KNOWLEDGE.filter(e => {
      if (!showAll && e.audience !== 'BOTH' && e.audience !== audience) return false
      if (!q) return true
      const hay = `${e.title} ${e.summary} ${e.terms.join(' ')}`
        .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      return hay.includes(q)
    })
  }, [query, audience, showAll])

  const byStage = STAGE_ORDER
    .map(stage => ({ stage, items: entries.filter(e => e.stage === stage) }))
    .filter(g => g.items.length > 0)
  const general = entries.filter(e => !e.stage)

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="px-4 lg:px-6 pt-8 pb-3">
        <div className="max-w-4xl mx-auto">
                      <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm mb-4 transition-colors">
              <ArrowLeft size={14} /> Volver al inicio
            </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Guía</h1>
          <p className="text-sm text-slate-500 mt-1">
            Qué significa cada paso de {audience === 'SELL' ? 'la venta' : 'la compra'}, en castellano
          </p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-5 space-y-4 pb-10">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscá: seña, boleto, inhibición, expensas…"
            aria-label="Buscar en la guía"
            className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-slate-100 focus:border-brand-400 outline-none text-sm text-slate-700 placeholder:text-slate-300 transition-colors"
          />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">
            {entries.length} {entries.length === 1 ? 'tema' : 'temas'}
          </p>
          <button
            onClick={() => setShowAll(v => !v)}
            className="text-xs font-semibold text-brand-600 hover:underline"
          >
            {showAll
              ? `Ver solo lo de ${audience === 'SELL' ? 'vender' : 'comprar'}`
              : 'Ver todo, incluida la otra punta'}
          </button>
        </div>

        {entries.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-8 text-center">
            <BookOpen size={26} className="text-slate-300 mx-auto mb-3" />
            <p className="font-bold text-slate-900 mb-1">No encontramos ese tema</p>
            <p className="text-sm text-slate-400 mb-4">
              Preguntale al asistente: responde con este mismo material.
            </p>
            <Link href="/asistente"
              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors">
              <MessageSquare size={14} /> Preguntar
            </Link>
          </div>
        )}

        {byStage.map(({ stage, items }, gi) => (
          <div key={stage} className="space-y-2">
            <div className="flex items-center gap-2 pt-1">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 bg-brand-100 text-brand-700">
                {gi + 1}
              </span>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{stage}</p>
            </div>
            {items.map(e => (
              <EntryCard
                key={e.id}
                entry={e}
                open={openId === e.id}
                onToggle={() => setOpenId(openId === e.id ? null : e.id)}
              />
            ))}
          </div>
        ))}

        {general.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide pt-1">
              Conceptos generales
            </p>
            {general.map(e => (
              <EntryCard
                key={e.id}
                entry={e}
                open={openId === e.id}
                onToggle={() => setOpenId(openId === e.id ? null : e.id)}
              />
            ))}
          </div>
        )}

        <Link href="/asistente"
          className="flex items-center justify-between bg-slate-900 rounded-2xl p-5 hover:bg-slate-800 transition-colors">
          <div>
            <p className="font-bold text-white text-sm mb-0.5">¿Te quedó una duda puntual?</p>
            <p className="text-xs text-slate-400">El asistente responde con este mismo material.</p>
          </div>
          <MessageSquare size={18} className="text-brand-400 flex-shrink-0" />
        </Link>

        <p className="text-[11px] text-slate-400 text-center leading-relaxed px-4">
          Esta guía explica el proceso general. Cada operación tiene particularidades:
          confirmá tu caso con un escribano matriculado.
        </p>
      </div>
    </div>
  )
}
