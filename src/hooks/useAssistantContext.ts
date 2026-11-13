'use client'

import { useEffect, useMemo, useState } from 'react'
import { useOperations } from '@/hooks/useOperations'
import { loadUserProperties, loadUserPropertyById, type UserProperty } from '@/lib/userProperties'
import { fetchSellerTasks } from '@/lib/supabase/sellerTasks'
import { buildFirstValue, pickDashboardProperty, type OperationKind, type PlanStep } from '@/lib/dashboard/firstValue'
import { NO_OPERATION_CONTEXT, buildAssistantContext, renderContext, type ActionContext } from '@/lib/assistant/context'

/**
 * Contexto real de la operación activa para el asistente (texto y voz).
 *
 * Carga lo mismo que el dashboard (propiedad vinculada o la que se viene mirando, plan de venta) y deja que
 * `buildFirstValue` —el motor del dashboard y de la próxima acción— decida; acá no se calcula nada.
 * `text` está vacío hasta que se terminó de cargar: no se manda un contexto a medias.
 */
export function useAssistantContext(): { ready: boolean; text: string; actionContext: ActionContext } {
  const { activeOperation: op, getTransactionData, loaded } = useOperations()
  const kind: OperationKind = op?.type === 'SELL' ? 'SELL' : 'BUY'
  const opId = op?.id ?? null
  const propertyId = op?.propertyId ?? null

  const [property, setProperty] = useState<{ key: string; value: UserProperty | null } | null>(null)
  const [steps, setSteps] = useState<{ key: string; value: PlanStep[] | undefined } | null>(null)
  const propKey = `${opId}|${propertyId}|${kind}`
  const stepsKey = `${opId}|${kind}`

  useEffect(() => {
    if (!opId) return
    let alive = true
    ;(async () => {
      const linked = propertyId ? await loadUserPropertyById(propertyId) : null
      const all = linked ? [] : await loadUserProperties()
      if (alive) setProperty({ key: propKey, value: pickDashboardProperty(kind, linked, all) })
    })().catch(() => { if (alive) setProperty({ key: propKey, value: null }) })
    return () => { alive = false }
  }, [opId, propertyId, kind, propKey])

  useEffect(() => {
    if (!opId || kind !== 'SELL') return
    let alive = true
    fetchSellerTasks(opId)
      .then(tasks => {
        if (!alive) return
        const list = tasks && tasks.length > 0 ? tasks.map(t => ({ key: t.key, title: t.title, description: t.description, done: t.done })) : undefined
        setSteps({ key: stepsKey, value: list })
      })
      .catch(() => { if (alive) setSteps({ key: stepsKey, value: undefined }) })
    return () => { alive = false }
  }, [opId, kind, stepsKey])

  const propertyReady = property?.key === propKey
  const stepsReady = kind !== 'SELL' || steps?.key === stepsKey
  const progress = op?.progress

  return useMemo(() => {
    if (!loaded) return { ready: false, text: '', actionContext: NO_OPERATION_CONTEXT.actionContext }
    if (!op) return { ready: true, text: renderContext(NO_OPERATION_CONTEXT), actionContext: NO_OPERATION_CONTEXT.actionContext }
    if (!propertyReady || !stepsReady) return { ready: false, text: '', actionContext: NO_OPERATION_CONTEXT.actionContext }
    const transaction = getTransactionData(op.id)
    const prop = property?.value ?? null
    const fv = buildFirstValue({ kind, operationId: op.id, transaction, property: prop, steps: kind === 'SELL' ? steps?.value : undefined })
    const ctx = buildAssistantContext({ op, fv, property: prop, transaction })
    return { ready: true, text: renderContext(ctx), actionContext: ctx.actionContext }
    // getTransactionData cambia de identidad con cada carga: el progreso avisa que la operación se movió.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, op, progress, kind, property, steps, propertyReady, stepsReady])
}
