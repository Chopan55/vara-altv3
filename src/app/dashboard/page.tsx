'use client'
import { useEffect, useState } from 'react'
import { useVaraState } from '@/hooks/useVaraState'
import { useOperations } from '@/hooks/useOperations'
import { SaveOperationBanner } from '@/components/account/SaveOperationBanner'
import { NextStepAgent } from '@/components/operation/NextStepAgent'
import {
  AttentionCard, CostsCard, DashboardLoading, DocsRow, EmptyDashboard, NovedadesWidget, OperationHeader, OperationsPanel,
  PropertyCard, SellerChecklist, SellerReferences, UncertaintyNotice, UpNextList, estimatedDueDate,
} from '@/components/dashboard/DashboardParts'
import { loadUserProperties, loadUserPropertyById, type UserProperty } from '@/lib/userProperties'
import { buildFirstValue, pickDashboardProperty, shouldShowEmptyState, type OperationKind, type PlanStep } from '@/lib/dashboard/firstValue'
import { fetchSellerTasks, setSellerTaskDueDate, toggleSellerTask, type SellerTaskState } from '@/lib/supabase/sellerTasks'
import type { Transaction, UserOperationSummary } from '@/types'

/**
 * Dashboard — primer valor.
 *
 * En menos de 5 segundos: qué operación, en qué estado, qué hacer ahora, por qué y la acción concreta.
 * Una sola acción principal; después el detalle. Toda la lógica vive en `lib/dashboard/firstValue`
 * y no mira la sesión: invitado y cuenta ven lo mismo. Ver docs/DASHBOARD_FIRST_VALUE.md.
 */

/** Propiedad que corresponde a la operación: la vinculada, o la que el usuario viene mirando. */
function useDashboardProperty(op: UserOperationSummary, kind: OperationKind) {
  const [state, setState] = useState<{ ready: boolean; property: UserProperty | null }>({ ready: false, property: null })
  useEffect(() => {
    let alive = true
    ;(async () => {
      const linked = op.propertyId ? await loadUserPropertyById(op.propertyId) : null
      const all = linked ? [] : await loadUserProperties()
      if (alive) setState({ ready: true, property: pickDashboardProperty(kind, linked, all) })
    })().catch(() => { if (alive) setState({ ready: true, property: null }) })
    return () => { alive = false }
  }, [op.propertyId, kind])
  return state
}

/** Plan de venta: pasos de la cuenta si existen; si no, el dashboard usa las tareas del motor regulatorio. */
function useSellerPlan(operationId: string, enabled: boolean) {
  const [tasks, setTasks] = useState<SellerTaskState[]>([])
  const [loaded, setLoaded] = useState(!enabled)

  useEffect(() => {
    if (!enabled) return
    let alive = true
    fetchSellerTasks(operationId)
      .then(result => { if (alive && result) setTasks(result) })
      .catch(() => {})
      .finally(() => { if (alive) setLoaded(true) })
    return () => { alive = false }
  }, [operationId, enabled])

  const toggle = async (key: string) => {
    const task = tasks.find(t => t.key === key)
    if (!task) return
    const next = !task.done
    setTasks(prev => prev.map(t => (t.key === key ? { ...t, done: next } : t)))
    await toggleSellerTask(operationId, key, next)
  }
  const setDate = async (key: string, date: string) => {
    setTasks(prev => prev.map(t => (t.key === key ? { ...t, dueDate: date || undefined } : t)))
    await setSellerTaskDueDate(operationId, key, date || null)
  }
  const estimate = async () => {
    const updated = tasks.map(t => ({ ...t, dueDate: t.done ? t.dueDate : estimatedDueDate(t.key) }))
    setTasks(updated)
    await Promise.all(updated.filter(t => !t.done && t.dueDate).map(t => setSellerTaskDueDate(operationId, t.key, t.dueDate!)))
  }
  const steps: PlanStep[] | undefined = tasks.length > 0 ? tasks.map(t => ({ key: t.key, title: t.title, description: t.description, done: t.done })) : undefined
  return { loaded, tasks, steps, toggle, setDate, estimate }
}

function OperationView({ op, operations, onSelect, onDelete, getTransactionData }: {
  op: UserOperationSummary
  operations: UserOperationSummary[]
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  getTransactionData: (id: string) => Transaction | null
}) {
  const kind: OperationKind = op.type === 'SELL' ? 'SELL' : 'BUY'
  const { ready, property } = useDashboardProperty(op, kind)
  const seller = useSellerPlan(op.id, kind === 'SELL')

  // Hasta saber qué propiedad corresponde no se decide nada: evita mostrar "cargá la propiedad" y corregirlo un segundo después.
  if (!ready || !seller.loaded) return <DashboardLoading />

  const fv = buildFirstValue({ kind, operationId: op.id, transaction: getTransactionData(op.id), property, steps: seller.steps })
  const refs = operations.map(o => ({ id: o.id, title: o.title, type: o.type, progress: o.progress }))
  const place = [op.city, op.province].filter(Boolean).join(', ')

  return (
    <>
      <OperationHeader fv={fv} title={op.title} place={place} operations={refs} activeId={op.id} onSelect={onSelect} />

      {/* La única acción principal. */}
      <NextStepAgent key={`${op.id}-${fv.primary.id}`} action={fv.primary} operationId={op.id} kind={kind} province={op.province} />

      <UncertaintyNotice items={fv.uncertainties} />
      <UpNextList actions={fv.upNext} />
      <AttentionCard items={fv.attention} />

      {kind === 'BUY' ? (
        <>
          {property && <PropertyCard property={property} label="La propiedad que estás mirando" />}
          <CostsCard costs={fv.costs} />
          <DocsRow pending={fv.pendingDocs} operationId={op.id} />
        </>
      ) : (
        <>
          <SellerChecklist tasks={seller.tasks} onToggle={seller.toggle} onDate={seller.setDate} onEstimate={seller.estimate} />
          {property && <PropertyCard property={property} label="Tu propiedad" />}
          <SellerReferences province={op.province} />
        </>
      )}

      <NovedadesWidget operationId={op.id} />
      <OperationsPanel operations={refs} activeId={op.id} onSelect={onSelect} onDelete={onDelete} />
    </>
  )
}

function DashboardContent() {
  const vara = useVaraState()
  const { operations, activeOperation, getTransactionData, deleteOperation, loaded } = useOperations()

  // El estado vacío depende solo de que no haya operaciones: con cuenta o sin cuenta, en este dispositivo o en otro.
  if (shouldShowEmptyState({ loaded, operationCount: operations.length })) return <EmptyDashboard />
  const op = activeOperation ?? operations[0]
  if (!op) return <DashboardLoading />

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-5 pb-12">
      <OperationView
        key={op.id}
        op={op}
        operations={operations}
        onSelect={vara.setOperationId}
        onDelete={deleteOperation}
        getTransactionData={getTransactionData}
      />
    </main>
  )
}

/** El dashboard funciona como invitado; la franja invita a guardar la operación sin interrumpir. */
export default function Dashboard() {
  return (
    <>
      <SaveOperationBanner />
      <DashboardContent />
    </>
  )
}
