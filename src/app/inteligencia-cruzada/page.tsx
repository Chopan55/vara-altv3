'use client'
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Network, AlertTriangle, CheckCircle2,
  Loader2, Calendar, ChevronRight,
} from 'lucide-react'
import { useOperations } from '@/hooks/useOperations'
import { fetchOperationTasks, type SellerTaskState } from '@/lib/supabase/sellerTasks'
import { cn } from '@/lib/utils'

/**
 * Inteligencia Cruzada — detecta conflictos de fechas y dependencias
 * entre operaciones del mismo usuario.
 *
 * MVP: cruza las fechas de tareas vendedor de cada operación activa.
 * Si dos fechas clave de operaciones distintas caen a ≤ 7 días, es un conflicto.
 */

interface OpTask {
  operationId: string
  operationTitle: string
  operationType: string
  task: SellerTaskState
  daysUntil: number
}

function useCrossOpTasks(operations: { id: string; title: string; type: 'SELL' | 'BUY'; country?: string }[], loaded: boolean) {
  // El resultado recuerda para qué lista se calculó: "cargado" se deriva, no se prende a mano.
  const [result, setResult] = useState<{ ops: typeof operations; tasks: OpTask[] } | null>(null)

  useEffect(() => {
    if (!loaded || operations.length === 0) return
    let alive = true
    Promise.all(
      operations.map(op =>
        fetchOperationTasks(op.id, op.type, op.country).then(tasks => ({ op, tasks: tasks ?? [] })),
      ),
    )
      .then(results => {
        if (!alive) return
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const all: OpTask[] = []
        for (const { op, tasks } of results) {
          for (const t of tasks) {
            if (!t.dueDate || t.done) continue
            const due = new Date(t.dueDate + 'T00:00:00')
            const daysUntil = Math.round((due.getTime() - today.getTime()) / 86400000)
            all.push({
              operationId: op.id,
              operationTitle: op.title,
              operationType: op.type,
              task: t,
              daysUntil,
            })
          }
        }
        all.sort((a, b) => a.daysUntil - b.daysUntil)
        setResult({ ops: operations, tasks: all })
      })
      .catch(() => { if (alive) setResult({ ops: operations, tasks: [] }) })
    return () => {
      alive = false
    }
  }, [operations, loaded])

  const tasksLoaded = loaded && (operations.length === 0 || result?.ops === operations)
  const allTasks = operations.length > 0 ? (result?.tasks ?? []) : []
  return { allTasks, tasksLoaded }
}

interface Conflict {
  a: OpTask
  b: OpTask
  gap: number
}

function detectConflicts(tasks: OpTask[]): Conflict[] {
  const conflicts: Conflict[] = []
  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      const a = tasks[i]
      const b = tasks[j]
      if (a.operationId === b.operationId) continue
      const gap = Math.abs(a.daysUntil - b.daysUntil)
      if (gap <= 7) conflicts.push({ a, b, gap })
    }
  }
  return conflicts.slice(0, 6)
}

function daysLabel(d: number): string {
  if (d < 0) return `Hace ${Math.abs(d)} día${Math.abs(d) !== 1 ? 's' : ''}`
  if (d === 0) return 'Hoy'
  if (d === 1) return 'Mañana'
  return `En ${d} días`
}

export default function InteligenciaCruzadaPage() {
  const { operations: allOps, loaded } = useOperations()
  const operations = useMemo(
    () => allOps.map(o => ({ id: o.id, title: o.title, type: o.type, country: o.country })),
    [allOps],
  )
  const { allTasks, tasksLoaded } = useCrossOpTasks(operations, loaded)
  const conflicts = useMemo(() => detectConflicts(allTasks), [allTasks])

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard" aria-label="Volver" className="-m-2 p-2 text-slate-400 hover:text-slate-700 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-[var(--foreground)] leading-tight">
              Inteligencia cruzada
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Conflictos y dependencias entre tus operaciones
            </p>
          </div>
        </div>

        {!loaded && (
          <div className="flex items-center justify-center py-20 gap-2">
            <Loader2 size={16} className="animate-spin text-slate-300" />
            <p className="text-xs text-slate-400">Cargando operaciones…</p>
          </div>
        )}

        {loaded && operations.length < 2 && (
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-8 text-center">
            <div className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Network size={22} className="text-brand-500" />
            </div>
            <p className="text-sm font-semibold text-slate-800 mb-2">
              Necesitás al menos 2 operaciones activas
            </p>
            <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
              La inteligencia cruzada detecta conflictos entre tus operaciones: si vendés tu
              departamento para comprar una casa, VARA cruza las fechas y te avisa si hay un
              gap de financiamiento.
            </p>
            <Link
              href="/dashboard"
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
            >
              Ver mis operaciones <ChevronRight size={12} />
            </Link>
          </div>
        )}

        {loaded && operations.length >= 2 && (
          <div className="space-y-4">
            {/* Operaciones en juego */}
            <div className="grid grid-cols-2 gap-3">
              {operations.slice(0, 4).map(op => (
                <Link
                  key={op.id}
                  href={`/operacion/${op.id}`}
                  className="bg-white rounded-xl border border-slate-200/70 shadow-card p-3 hover:border-brand-200 transition-colors"
                >
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                    {op.type === 'BUY' ? 'Compra' : 'Venta'}
                  </p>
                  <p className="text-sm font-semibold text-slate-800 leading-tight truncate">
                    {op.title}
                  </p>
                </Link>
              ))}
            </div>

            {!tasksLoaded && (
              <div className="flex items-center gap-2 py-6 justify-center">
                <Loader2 size={14} className="animate-spin text-slate-300" />
                <p className="text-xs text-slate-400">Analizando fechas…</p>
              </div>
            )}

            {tasksLoaded && allTasks.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-6 text-center">
                <p className="text-sm font-semibold text-slate-700 mb-1">Sin fechas cargadas</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Cargá fechas en tus tareas para que VARA pueda detectar conflictos entre
                  operaciones.
                </p>
              </div>
            )}

            {tasksLoaded && allTasks.length > 0 && conflicts.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-6 text-center">
                <CheckCircle2 size={22} className="text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-800">Sin conflictos detectados</p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Las fechas clave de tus operaciones no se solapan en ventanas críticas.
                </p>
              </div>
            )}

            {tasksLoaded && conflicts.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                  Conflictos detectados
                </h2>
                <div className="space-y-3">
                  {conflicts.map(({ a, b, gap }, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'rounded-2xl border p-4',
                        gap <= 2
                          ? 'bg-red-50 border-red-200'
                          : gap <= 5
                          ? 'bg-amber-50 border-amber-200'
                          : 'bg-yellow-50 border-yellow-200',
                      )}
                    >
                      <div className="flex items-start gap-2 mb-3">
                        <AlertTriangle
                          size={14}
                          className={cn(
                            'flex-shrink-0 mt-0.5',
                            gap <= 2 ? 'text-red-600' : 'text-amber-600',
                          )}
                        />
                        <p
                          className={cn(
                            'text-sm font-semibold',
                            gap <= 2 ? 'text-red-900' : 'text-amber-900',
                          )}
                        >
                          {gap === 0
                            ? 'Dos fechas clave en el mismo día'
                            : `Solo ${gap} día${gap !== 1 ? 's' : ''} entre fechas críticas`}
                        </p>
                      </div>
                      {[a, b].map((item, i) => (
                        <div key={i} className="flex items-start gap-2 mb-1.5">
                          <div
                            className={cn(
                              'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                              i === 0 ? 'bg-brand-500' : 'bg-slate-400',
                            )}
                          />
                          <div>
                            <p className="text-xs font-semibold text-slate-800">{item.task.title}</p>
                            <p className="text-[10px] text-slate-500">
                              {item.operationTitle} · {daysLabel(item.daysUntil)}
                            </p>
                          </div>
                        </div>
                      ))}
                      {gap <= 3 && (
                        <p
                          className={cn(
                            'mt-3 text-xs rounded-lg p-2 leading-relaxed',
                            gap <= 2
                              ? 'text-red-800 bg-red-100'
                              : 'text-amber-800 bg-amber-100',
                          )}
                        >
                          <strong>Riesgo {gap <= 2 ? 'alto' : 'medio'}:</strong> Un retraso en
                          cualquiera de estas dos fechas puede afectar la otra operación.
                          Considerá negociar un puente financiero o ajustar los plazos.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {tasksLoaded && allTasks.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                  Línea de tiempo consolidada
                </h2>
                <div className="space-y-2">
                  {allTasks.slice(0, 12).map(({ task, operationTitle, daysUntil }, idx) => {
                    const isOverdue = daysUntil < 0
                    const isUrgent = daysUntil >= 0 && daysUntil <= 3
                    return (
                      <div
                        key={idx}
                        className={cn(
                          'flex items-start gap-3 rounded-xl border p-3',
                          isOverdue
                            ? 'bg-red-50 border-red-100'
                            : isUrgent
                            ? 'bg-amber-50 border-amber-100'
                            : 'bg-white border-slate-200/70',
                        )}
                      >
                        <Calendar
                          size={13}
                          className={cn(
                            'flex-shrink-0 mt-0.5',
                            isOverdue
                              ? 'text-red-500'
                              : isUrgent
                              ? 'text-amber-500'
                              : 'text-slate-400',
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">
                            {task.title}
                          </p>
                          <p className="text-[10px] text-slate-400">{operationTitle}</p>
                        </div>
                        <span
                          className={cn(
                            'text-[10px] font-bold flex-shrink-0',
                            isOverdue
                              ? 'text-red-600'
                              : isUrgent
                              ? 'text-amber-600'
                              : 'text-slate-400',
                          )}
                        >
                          {daysLabel(daysUntil)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
