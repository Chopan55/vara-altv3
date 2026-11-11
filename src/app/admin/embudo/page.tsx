'use client'
import { useCallback, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Lock } from 'lucide-react'
import { useLoad } from '@/hooks/useLoad'
import { fetchFunnelSummary, type FunnelError } from '@/lib/supabase/funnel'
import { funnelRows, viral, weekReturn } from '@/lib/funnel/report'
import type { FunnelSummary } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'

/**
 * Embudo de producto, solo producción. La protección real está en la base:
 * `funnel_summary` rechaza a cualquiera que no sea ADMIN.
 */

const PERIODS = [7, 30, 90] as const

const ERROR_TEXT: Record<FunnelError, string> = {
  NO_SESSION: 'Iniciá sesión con una cuenta del equipo.',
  FORBIDDEN: 'Solo para el equipo de VARA.',
  NOT_READY: 'Falta correr la migración del embudo (20261108000000_funnel_events) en Supabase.',
  FAILED: 'No se pudieron leer los datos. Probá de nuevo.',
}

const fmtPct = (n: number | null) => (n === null ? '—' : `${n.toLocaleString('es-AR')}%`)

export default function AdminEmbudoPage() {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30)
  const [data, setData] = useState<FunnelSummary | null>(null)
  const [error, setError] = useState<FunnelError | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetchFunnelSummary(days)
    setData(r.data ?? null)
    setError(r.error ?? null)
    setLoading(false)
  }, [days])
  useLoad(load)

  if (loading && !data) {
    return <div role="status" className="flex min-h-[60vh] items-center justify-center"><Loader2 size={22} className="animate-spin text-slate-300" aria-label="Cargando" /></div>
  }
  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 text-center">
        <div><Lock size={26} className="mx-auto text-slate-300" aria-hidden="true" /><p className="mt-2 text-sm text-slate-600">{ERROR_TEXT[error]}</p></div>
      </div>
    )
  }
  if (!data) return null

  const rows = funnelRows(data)
  const ret = weekReturn(data)
  const v = viral(data)
  const max = Math.max(1, rows[0].count)

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <Link href="/admin/visitas" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={14} aria-hidden="true" /> Admin
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold text-slate-900">Embudo</h1>
      <p className="mt-1 text-sm text-slate-500">Solo producción. Personas = navegadores distintos (alguien con celular y compu cuenta dos veces).</p>

      <div className="mt-4 flex gap-2" role="group" aria-label="Período">
        {PERIODS.map(p => (
          <button key={p} type="button" onClick={() => setDays(p)} aria-pressed={days === p}
            className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold',
              days === p ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300')}>
            Últimos {p} días
          </button>
        ))}
      </div>

      <section className="mt-5 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card">
        <h2 className="text-sm font-bold text-slate-800">Del primer contacto a invitar</h2>
        <ol className="mt-4 space-y-4">
          {rows.map((r, i) => (
            <li key={r.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-slate-700">{i + 1}. {r.label}</span>
                <span className="font-bold tabular-nums text-slate-900">{r.count.toLocaleString('es-AR')}</span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-brand-600" style={{ width: `${Math.max(2, (r.count / max) * 100)}%` }} />
              </div>
              {i > 0 && (
                <p className="mt-1 text-[11px] text-slate-500">
                  {fmtPct(r.fromPrevious)} del paso anterior · {fmtPct(r.fromVisitors)} de las visitas
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card">
          <h2 className="text-sm font-bold text-slate-800">Volvieron en su primera semana</h2>
          <p className="mt-2 text-3xl font-extrabold tabular-nums text-slate-900">{fmtPct(ret.rate)}</p>
          <p className="mt-1 text-xs text-slate-500">
            {ret.returned} de {ret.cohort} que llegaron hace 7 días o más volvieron otro día dentro de su primera semana.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card">
          <h2 className="text-sm font-bold text-slate-800">Análisis compartidos</h2>
          <p className="mt-2 text-3xl font-extrabold tabular-nums text-slate-900">{v.shares}</p>
          <p className="mt-1 text-xs text-slate-500">
            Se abrieron {v.views} veces · {v.arrivals} personas llegaron por un link compartido
            {v.arrivalsPerShare !== null ? ` (${v.arrivalsPerShare.toLocaleString('es-AR')} por cada compartido)` : ''}.
          </p>
        </div>
      </section>

      <p className="mt-6 text-xs leading-relaxed text-slate-500">
        Qué se guarda: un identificador al azar por navegador, el paso y de dónde llegó (por ejemplo, un link compartido).
        Nada que identifique a una persona.
      </p>
    </main>
  )
}
