'use client'

/**
 * Centro de acciones — qué tengo que hacer ahora, en todas mis operaciones.
 *
 * Agrega el NBA de cada operación activa en una sola vista ordenada por
 * urgencia: lo que bloquea primero, luego por prioridad dentro de cada op.
 *
 * Sin operaciones muestra el estado vacío correcto; no inventa consejos.
 */

import { useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, Zap, CheckCircle2, Loader2, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOperations } from '@/hooks/useOperations'
import { computeNextActions, CATEGORY_LABELS, type NextAction } from '@/lib/nba/engine'

interface ActionRow {
  action: NextAction
  operationId: string
  operationTitle: string
}

export default function AccionesPage() {
  const { operations, getTransactionData, loaded } = useOperations()

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
      </div>
    </div>
  )
}
