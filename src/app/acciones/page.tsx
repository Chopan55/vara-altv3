'use client'

/**
 * Centro de acciones — qué tengo que hacer ahora + próximas fechas, en todas
 * mis operaciones.
 *
 * Agrega el NBA de cada operación activa en una sola vista ordenada por
 * urgencia: lo que bloquea primero, luego por prioridad dentro de cada op.
 *
 * Sin operaciones muestra el estado vacío correcto; no inventa consejos.
 */

import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Zap, CheckCircle2, Loader2, ChevronRight, Calendar, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOperations } from '@/hooks/useOperations'
import { computeNextActions, CATEGORY_LABELS, type NextAction } from '@/lib/nba/engine'
import { fetchSellerTasks, type SellerTaskState } from '@/lib/supabase/sellerTasks'

interface ActionRow {
  action: NextAction
  operationId: string
  operationTitle: string
}

interface DateRow {
  task: SellerTaskState
  operationId: string
  operationTitle: string
  daysUntil: number
}

function useDateRows(
  operations: { id: string; title: string }[],
  loaded: boolean,
): { rows: DateRow[]; dateLoaded: boolean } {
  const [rows, setRows] = useState<DateRow[]>([])
  const [dateLoaded, setDateLoaded] = useState(false)

  useEffect(() => {
    if (!loaded || operations.length === 0) return
    let alive = true
    Promise.all(
      operations.map(op =>
        fetchSellerTasks(op.id).then(tasks => ({ op, tasks: tasks ?? [] }))
      )
    ).then(results => {
      if (!alive) return
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const all: DateRow[] = []
      for (const { op, tasks } of results) {
        for (const t of tasks) {
          if (!t.dueDate || t.done) continue
          const due = new Date(t.dueDate + 'T00:00:00')
          const daysUntil = Math.round((due.getTime() - today.getTime()) / 86400000)
          all.push({ task: t, operationId: op.id, operationTitle: op.title, daysUntil })
        }
      }
      all.sort((a, b) => a.daysUntil - b.daysUntil)
      setRows(all)
      setDateLoaded(true)
    }).catch(() => setDateLoaded(true))
    return () => { alive = false }
  }, [operations, loaded])

  return { rows, dateLoaded }
}

export default function AccionesPage() {
  const { operations, getTransactionData, loaded } = useOperations()
  const { rows: dateRows, dateLoaded } = useDateRows(operations, loaded)

  const rows = useMemo<ActionRow[]>(() => {
    const all: ActionRow[] = []
    for (const op of operations) {
      const txn = getTransactionData(op.id)
      const actions = computeNextActions({ transaction: txn ?? null }).filter(
        a => a.id !== 'all_clear' && a.id !== 'no_operation',
      )
      for (const action of actions) {
        all.push({ action, operationId: op.id, operationTitle: op.title })
      }
    }
    all.sort((a, b) => {
      if (a.action.blocking !== b.action.blocking) return a.action.blocking ? -1 : 1
      return a.action.priority - b.action.priority
    })
    return all
  }, [operations, getTransactionData])

  const blockingCount = rows.filter(r => r.action.blocking).length

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard" className="text-slate-400 hover:text-slate-700 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-[var(--foreground)] leading-tight">Centro de acciones</h1>
            {loaded && rows.length > 0 && (
              <p className="text-xs text-slate-400 mt-0.5">
                {blockingCount > 0
                  ? `${blockingCount} bloquea${blockingCount === 1 ? '' : 'n'} · ${rows.length} en total`
                  : `${rows.length} acción${rows.length === 1 ? '' : 'es'} pendiente${rows.length === 1 ? '' : 's'}`}
              </p>
            )}
          </div>
        </div>

        {!loaded && (
          <div className="flex items-center gap-2 py-10 justify-center">
            <Loader2 size={16} className="animate-spin text-slate-300" />
            <p className="text-xs text-slate-400">Cargando operaciones…</p>
          </div>
        )}

        {loaded && rows.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-8 text-center">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 size={22} className="text-emerald-500" />
            </div>
            <p className="text-sm font-semibold text-slate-800 mb-1">Todo al día</p>
            <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
              No hay acciones pendientes en este momento. Cuando haya algo urgente, aparece acá.
            </p>
            <Link href="/dashboard" className="mt-4 inline-block text-xs font-semibold text-brand-600 hover:underline">
              Volver al inicio →
            </Link>
          </div>
        )}

        {loaded && rows.length > 0 && (
          <div className="space-y-2">
            {rows.map(({ action, operationId, operationTitle }) => (
              <Link
                key={`${operationId}-${action.id}`}
                href={action.cta.href}
                className={cn(
                  'block rounded-2xl border p-4 hover:shadow-elevated transition-all',
                  action.blocking
                    ? 'bg-red-50 border-red-100'
                    : 'bg-white border-slate-200/70 shadow-card'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5',
                    action.blocking ? 'bg-red-100' : 'bg-brand-50'
                  )}>
                    <Zap size={15} className={action.blocking ? 'text-red-600' : 'text-brand-600'} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="mb-0.5">
                      <span className={cn(
                        'text-[10px] font-bold uppercase tracking-widest',
                        action.blocking ? 'text-red-500' : 'text-brand-600'
                      )}>
                        {action.blocking ? 'Bloquea operación' : CATEGORY_LABELS[action.category]}
                      </span>
                    </div>
                    <p className={cn(
                      'text-sm font-bold leading-tight',
                      action.blocking ? 'text-red-900' : 'text-slate-900'
                    )}>
                      {action.title}
                    </p>
                    <p className={cn(
                      'text-xs mt-0.5 leading-relaxed',
                      action.blocking ? 'text-red-700' : 'text-slate-500'
                    )}>
                      {action.why}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1.5 font-medium">
                      {operationTitle}
                    </p>
                  </div>

                  <ChevronRight size={14} className="text-slate-300 flex-shrink-0 mt-2" />
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Próximas fechas */}
        {dateLoaded && dateRows.length > 0 && (
          <div className="mt-6">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
              Próximas fechas
            </h2>
            <div className="space-y-2">
              {dateRows.map(({ task, operationId, operationTitle, daysUntil }) => {
                const isOverdue = daysUntil < 0
                const isUrgent = daysUntil >= 0 && daysUntil <= 3
                const dueLabel = isOverdue
                  ? `Venció hace ${Math.abs(daysUntil)} día${Math.abs(daysUntil) === 1 ? '' : 's'}`
                  : daysUntil === 0
                  ? 'Vence hoy'
                  : daysUntil === 1
                  ? 'Vence mañana'
                  : `En ${daysUntil} días`

                return (
                  <Link
                    key={`${operationId}-${task.key}`}
                    href={`/operacion/${operationId}?tab=tareas`}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl border p-4 hover:shadow-elevated transition-all',
                      isOverdue
                        ? 'bg-red-50 border-red-100'
                        : isUrgent
                        ? 'bg-amber-50 border-amber-100'
                        : 'bg-white border-slate-200/70 shadow-card'
                    )}
                  >
                    <div className={cn(
                      'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                      isOverdue ? 'bg-red-100' : isUrgent ? 'bg-amber-100' : 'bg-slate-50'
                    )}>
                      {isOverdue
                        ? <AlertCircle size={15} className="text-red-600" />
                        : <Calendar size={15} className={isUrgent ? 'text-amber-600' : 'text-slate-400'} />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm font-semibold leading-tight truncate',
                        isOverdue ? 'text-red-900' : 'text-slate-800'
                      )}>
                        {task.title}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{operationTitle}</p>
                    </div>
                    <span className={cn(
                      'text-xs font-bold flex-shrink-0',
                      isOverdue ? 'text-red-600' : isUrgent ? 'text-amber-600' : 'text-slate-400'
                    )}>
                      {dueLabel}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
