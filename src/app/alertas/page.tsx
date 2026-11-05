'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Bell, CheckCircle2, AlertTriangle, AlertCircle,
  Clock, Loader2, ChevronRight, Info,
} from 'lucide-react'
import { useOperations } from '@/hooks/useOperations'
import { fetchOperationTasks } from '@/lib/supabase/sellerTasks'
import { fetchDocuments } from '@/lib/supabase/documents'
import { buildOpDocStatus, mergeAndRankAlerts, type OpDocStatus, type DocAlert } from '@/lib/docAlerts'
import { cn } from '@/lib/utils'

function TrafficDot({ light }: { light: OpDocStatus['light'] }) {
  return (
    <div
      className={cn(
        'w-3 h-3 rounded-full flex-shrink-0',
        light === 'GREEN' ? 'bg-emerald-500' : light === 'YELLOW' ? 'bg-amber-400' : 'bg-red-500',
      )}
    />
  )
}

function AlertIcon({ severity }: { severity: DocAlert['severity'] }) {
  if (severity === 'CRITICAL') return <AlertCircle size={13} className="text-red-500 flex-shrink-0 mt-0.5" />
  if (severity === 'HIGH') return <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
  if (severity === 'MEDIUM') return <Clock size={13} className="text-brand-500 flex-shrink-0 mt-0.5" />
  return <Info size={13} className="text-slate-400 flex-shrink-0 mt-0.5" />
}

function alertRowClasses(severity: DocAlert['severity']) {
  if (severity === 'CRITICAL') return 'bg-red-50 border-red-200'
  if (severity === 'HIGH') return 'bg-amber-50 border-amber-200'
  if (severity === 'MEDIUM') return 'bg-brand-50 border-brand-100'
  return 'bg-slate-50 border-slate-200'
}

function alertTextClasses(severity: DocAlert['severity']) {
  if (severity === 'CRITICAL') return { title: 'text-red-900', sub: 'text-red-600', badge: 'bg-red-100 text-red-700' }
  if (severity === 'HIGH') return { title: 'text-amber-900', sub: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' }
  if (severity === 'MEDIUM') return { title: 'text-brand-900', sub: 'text-brand-700', badge: 'bg-brand-100 text-brand-700' }
  return { title: 'text-slate-700', sub: 'text-slate-500', badge: 'bg-slate-100 text-slate-500' }
}

function useDocStatuses(
  operations: { id: string; title: string; type: string; country?: string }[],
  loaded: boolean,
) {
  // El resultado recuerda para qué lista de operaciones se calculó: así "cargando"
  // se deriva (lista nueva sin resultado) en vez de prenderse y apagarse a mano.
  const [result, setResult] = useState<{ ops: typeof operations; statuses: OpDocStatus[] } | null>(null)

  useEffect(() => {
    if (!loaded || operations.length === 0) return
    let alive = true
    Promise.all(
      operations.map(op =>
        Promise.all([fetchOperationTasks(op.id, op.type as 'SELL' | 'BUY', op.country), fetchDocuments(op.id)])
          .then(([tasks, docs]) => ({ op, tasks: tasks ?? [], docs })),
      ),
    )
      .then(results => {
        if (!alive) return
        const built = results.map(({ op, tasks, docs }) =>
          buildOpDocStatus(op.id, op.title, op.type as 'BUY' | 'SELL', tasks, docs),
        )
        setResult({ ops: operations, statuses: built })
      })
      .catch(() => { if (alive) setResult({ ops: operations, statuses: [] }) })
    return () => { alive = false }
  }, [operations, loaded])

  const loading = loaded && operations.length > 0 && result?.ops !== operations
  const statuses = operations.length > 0 ? (result?.statuses ?? []) : []
  return { statuses, loading }
}

export default function AlertasPage() {
  const { operations: allOps, loaded } = useOperations()
  const activeOps = useMemo(
    () => allOps.filter(o => o.status === 'ACTIVE').map(o => ({ id: o.id, title: o.title, type: o.type, country: o.country })),
    [allOps],
  )
  const { statuses, loading } = useDocStatuses(activeOps, loaded)
  const allAlerts = useMemo(() => mergeAndRankAlerts(statuses), [statuses])

  const redCount = statuses.filter(s => s.light === 'RED').length
  const yellowCount = statuses.filter(s => s.light === 'YELLOW').length
  const greenCount = statuses.filter(s => s.light === 'GREEN').length

  const isLoading = !loaded || loading

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard" aria-label="Volver" className="-m-2 p-2 text-slate-400 hover:text-slate-700 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-[var(--foreground)] leading-tight flex items-center gap-2">
              Alertas de documentación
              {allAlerts.length > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black">
                  {allAlerts.length > 9 ? '9+' : allAlerts.length}
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Documentos pendientes y vencimientos</p>
          </div>
          <Link href="/configuracion" className="flex-shrink-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-brand-200 hover:text-brand-700">
            Recibir por email
          </Link>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20 gap-2">
            <Loader2 size={16} className="animate-spin text-slate-300" />
            <p className="text-xs text-slate-400">Revisando documentación…</p>
          </div>
        )}

        {!isLoading && activeOps.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-8 text-center">
            <div className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Bell size={22} className="text-brand-500" />
            </div>
            <p className="text-sm font-semibold text-slate-800 mb-2">Sin operaciones activas</p>
            <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
              Cuando tengas una operación activa, VARA monitoreará los documentos pendientes y
              te avisará antes de que venzan.
            </p>
            <Link
              href="/dashboard"
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
            >
              Ir al dashboard <ChevronRight size={12} />
            </Link>
          </div>
        )}

        {!isLoading && activeOps.length > 0 && (
          <div className="space-y-5">

            {/* Resumen semáforo */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4 text-center">
                <div className="w-4 h-4 rounded-full bg-red-500 mx-auto mb-2" />
                <p className="text-2xl font-black text-red-600">{redCount}</p>
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mt-0.5">Crítico</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4 text-center">
                <div className="w-4 h-4 rounded-full bg-amber-400 mx-auto mb-2" />
                <p className="text-2xl font-black text-amber-600">{yellowCount}</p>
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mt-0.5">Atención</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4 text-center">
                <div className="w-4 h-4 rounded-full bg-emerald-500 mx-auto mb-2" />
                <p className="text-2xl font-black text-emerald-600">{greenCount}</p>
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mt-0.5">Al día</p>
              </div>
            </div>

            {/* Sin alertas */}
            {allAlerts.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-6 text-center">
                <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-800">Documentación al día</p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-xs mx-auto">
                  No hay documentos vencidos ni con vencimiento próximo en tus operaciones activas.
                </p>
              </div>
            )}

            {/* Lista de alertas */}
            {allAlerts.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                  Alertas activas
                </h2>
                <div className="space-y-2">
                  {allAlerts.map((alert, idx) => {
                    const cls = alertTextClasses(alert.severity)
                    return (
                      <div
                        key={`${alert.operationId}-${alert.taskKey}-${idx}`}
                        className={cn('rounded-xl border p-3 flex items-start gap-3', alertRowClasses(alert.severity))}
                      >
                        <AlertIcon severity={alert.severity} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={cn('text-xs font-semibold leading-tight', cls.title)}>
                              {alert.taskTitle}
                            </p>
                            <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap', cls.badge)}>
                              {alert.message}
                            </span>
                          </div>
                          <p className={cn('text-[10px] mt-0.5', cls.sub)}>
                            {alert.operationTitle} · {alert.operationType === 'SELL' ? 'Venta' : 'Compra'}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Semáforo por operación */}
            <section>
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                Estado por operación
              </h2>
              <div className="space-y-3">
                {statuses.map(status => (
                  <Link
                    key={status.operationId}
                    href={`/operacion/${status.operationId}`}
                    className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4 flex items-center gap-3 hover:border-brand-200 transition-colors block"
                  >
                    <TrafficDot light={status.light} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{status.operationTitle}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] text-slate-400">
                          {status.operationType === 'SELL' ? 'Venta' : 'Compra'}
                        </span>
                        <span className="text-[10px] text-emerald-600 font-semibold">
                          {status.done}/{status.total} completadas
                        </span>
                        {status.overdue > 0 && (
                          <span className="text-[10px] text-red-600 font-semibold">
                            {status.overdue} vencida{status.overdue !== 1 ? 's' : ''}
                          </span>
                        )}
                        {status.dueSoon > 0 && status.overdue === 0 && (
                          <span className="text-[10px] text-amber-600 font-semibold">
                            {status.dueSoon} por vencer
                          </span>
                        )}
                        {status.docProblems > 0 && (
                          <span className="text-[10px] text-red-600 font-semibold">
                            {status.docProblems} doc. para reemplazar
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-slate-300 flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </section>

            {/* Tip */}
            <div className="bg-brand-50 rounded-2xl border border-brand-100 p-4">
              <div className="flex items-start gap-2">
                <Info size={14} className="text-brand-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-brand-700 mb-1">Cómo funciona</p>
                  <p className="text-xs text-brand-600 leading-relaxed">
                    VARA monitorea las fechas límite de tus tareas. Para activar las alertas,
                    asignale una fecha a cada tarea desde el detalle de tu operación.
                    El semáforo se actualiza automáticamente.
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
