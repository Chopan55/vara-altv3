'use client'
import { useState, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, BarChart3, Plus, Trash2, Loader2,
  TrendingUp, TrendingDown, Minus, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Negotiation Intelligence Avanzada — análisis de la cadena de ofertas.
 *
 * El usuario carga las rondas de su negociación (quién ofreció, cuánto, cuándo)
 * y VARA analiza el momentum, el ajuste acumulado y el próximo movimiento óptimo.
 *
 * Llama al mismo endpoint /api/negotiation con mode='strategy' e inyecta el
 * historial como texto estructurado en el campo negotiationHistory.
 */

interface OfferRound {
  id: string
  ronda: number
  quien: 'comprador' | 'vendedor' | 'inmobiliaria'
  monto: string
  fecha: string
  nota?: string
}

function buildHistoryText(rounds: OfferRound[]): string {
  return rounds
    .map(
      r =>
        `Ronda ${r.ronda} — ${r.quien}: ${r.monto}${r.fecha ? ` (${r.fecha})` : ''}${r.nota ? ` · ${r.nota}` : ''}`,
    )
    .join('\n')
}

interface ChainAnalysis {
  nextAction: string
  strategy?: string
  analysis?: string
  confidenceLevel: 'alta' | 'media' | 'baja'
  urgencyLevel: 'alta' | 'media' | 'baja'
}

function newRound(n: number): OfferRound {
  return {
    id: Math.random().toString(36).slice(2),
    ronda: n,
    quien: n % 2 === 1 ? 'vendedor' : 'comprador',
    monto: '',
    fecha: '',
  }
}

const QUIEN_LABELS: Record<OfferRound['quien'], string> = {
  comprador: 'Comprador',
  vendedor: 'Vendedor',
  inmobiliaria: 'Inmobiliaria',
}

function momentumLabel(rounds: OfferRound[]): { label: string; icon: React.ElementType; color: string } | null {
  if (rounds.length < 2) return null
  const parsedAmounts = rounds
    .map(r => parseFloat(r.monto.replace(/[^0-9.-]/g, '')))
    .filter(n => !isNaN(n))
  if (parsedAmounts.length < 2) return null
  const first = parsedAmounts[0]
  const last = parsedAmounts[parsedAmounts.length - 1]
  const delta = ((last - first) / first) * 100
  if (delta < -1) return { label: `Ajuste acumulado: ${delta.toFixed(1)}%`, icon: TrendingDown, color: 'text-emerald-600' }
  if (delta > 1) return { label: `Ajuste acumulado: +${delta.toFixed(1)}%`, icon: TrendingUp, color: 'text-red-500' }
  return { label: 'Precio prácticamente sin cambio', icon: Minus, color: 'text-slate-500' }
}

export default function CadenaNegociacionPage() {
  const [rounds, setRounds] = useState<OfferRound[]>([newRound(1)])
  const [objetivo, setObjetivo] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ChainAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)

  const addRound = useCallback(() => {
    setRounds(prev => [...prev, newRound(prev.length + 1)])
  }, [])

  const removeRound = useCallback((id: string) => {
    setRounds(prev => {
      const next = prev.filter(r => r.id !== id)
      return next.map((r, i) => ({ ...r, ronda: i + 1 }))
    })
  }, [])

  const updateRound = useCallback((id: string, patch: Partial<OfferRound>) => {
    setRounds(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)))
  }, [])

  const analyze = useCallback(async () => {
    if (rounds.every(r => !r.monto.trim())) {
      setError('Cargá al menos una oferta con un monto.')
      return
    }
    setError(null)
    setLoading(true)
    setResult(null)
    try {
      const history = buildHistoryText(rounds)
      const body = {
        mode: 'strategy',
        context: {
          objetivo: objetivo || undefined,
          negotiationHistory: history,
          otherContext: `Analizar la cadena completa de ${rounds.length} ronda${rounds.length !== 1 ? 's' : ''} de negociación. ¿En qué ronda estamos? ¿Qué margen queda? ¿Cuál es el próximo movimiento óptimo?`,
        },
      }
      const res = await fetch('/api/negotiation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const data = await res.json()
      setResult({
        nextAction: data.nextAction,
        strategy: data.strategy,
        analysis: data.analysis,
        confidenceLevel: data.confidenceLevel ?? 'media',
        urgencyLevel: data.urgencyLevel ?? 'media',
      })
    } catch {
      setError('No pudimos analizar la cadena. Verificá que estés conectado e intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [rounds, objetivo])

  const momentum = momentumLabel(rounds)

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/negociacion" className="text-slate-400 hover:text-slate-700 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-[var(--foreground)] leading-tight">
              Cadena de ofertas
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Analizá el historial completo de la negociación
            </p>
          </div>
        </div>

        {/* Objetivo */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4 mb-4">
          <label className="text-xs font-semibold text-slate-600 block mb-2">
            Objetivo (opcional)
          </label>
          <input
            value={objetivo}
            onChange={e => setObjetivo(e.target.value)}
            placeholder="Ej: Comprar el departamento a USD 120.000"
            className="w-full text-sm text-slate-800 placeholder-slate-300 bg-slate-50 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-200"
          />
        </div>

        {/* Rondas */}
        <div className="space-y-3 mb-4">
          {rounds.map((r, idx) => (
            <div
              key={r.id}
              className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center">
                    <span className="text-[10px] font-black text-brand-700">{r.ronda}</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-700">Ronda {r.ronda}</span>
                </div>
                {rounds.length > 1 && (
                  <button
                    onClick={() => removeRound(r.id)}
                    className="text-slate-300 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 mb-2">
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">
                    Quién
                  </label>
                  <select
                    value={r.quien}
                    onChange={e => updateRound(r.id, { quien: e.target.value as OfferRound['quien'] })}
                    className="w-full text-sm text-slate-800 bg-slate-50 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-brand-200"
                  >
                    {Object.entries(QUIEN_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">
                    Monto
                  </label>
                  <input
                    value={r.monto}
                    onChange={e => updateRound(r.id, { monto: e.target.value })}
                    placeholder="USD 120.000"
                    className="w-full text-sm text-slate-800 placeholder-slate-300 bg-slate-50 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-brand-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">
                    Fecha (opcional)
                  </label>
                  <input
                    type="date"
                    value={r.fecha}
                    onChange={e => updateRound(r.id, { fecha: e.target.value })}
                    className="w-full text-sm text-slate-800 bg-slate-50 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-brand-200"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">
                    Nota (opcional)
                  </label>
                  <input
                    value={r.nota ?? ''}
                    onChange={e => updateRound(r.id, { nota: e.target.value })}
                    placeholder="Incluye cochera"
                    className="w-full text-sm text-slate-800 placeholder-slate-300 bg-slate-50 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-brand-200"
                  />
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={addRound}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-3 text-sm text-slate-500 hover:border-brand-300 hover:text-brand-600 transition-colors"
          >
            <Plus size={14} /> Agregar ronda
          </button>
        </div>

        {/* Momentum preview */}
        {momentum && (
          <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 mb-4">
            <momentum.icon size={13} className={momentum.color} />
            <span className={cn('text-xs font-semibold', momentum.color)}>{momentum.label}</span>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2 mb-3">{error}</p>
        )}

        <button
          onClick={analyze}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-bold py-3.5 rounded-xl transition-colors mb-6"
        >
          {loading ? (
            <>
              <Loader2 size={15} className="animate-spin" /> Analizando cadena…
            </>
          ) : (
            <>
              <BarChart3 size={15} /> Analizar cadena de negociación
            </>
          )}
        </button>

        {result && (
          <div className="space-y-3">
            {result.strategy && (
              <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-600 mb-2">
                  Estrategia recomendada
                </p>
                <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                  {result.strategy}
                </p>
              </div>
            )}
            {result.analysis && (
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Análisis
                </p>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                  {result.analysis}
                </p>
              </div>
            )}
            <div className="bg-brand-50 rounded-2xl border border-brand-100 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-600 mb-1">
                Próxima jugada
              </p>
              <p className="text-sm text-brand-800 font-semibold">{result.nextAction}</p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/negociacion"
                className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold text-brand-600 border border-brand-200 rounded-xl py-2.5 hover:bg-brand-50 transition-colors"
              >
                Volver a negociación <ChevronRight size={12} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
