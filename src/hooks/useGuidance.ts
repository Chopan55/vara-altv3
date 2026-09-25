'use client'
import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { useVaraState } from '@/hooks/useVaraState'
import { useOperations } from '@/hooks/useOperations'
import type { Transaction } from '@/types'
import {
  buildGuidanceContext,
  getNextGuidanceStep,
  getAllGuidanceSteps,
  buildGuidanceSummary,
  type GuidanceContext,
  type GuidanceStep,
  type GuidanceSummary,
} from '@/lib/guidanceEngine'

/**
 * Motor de guía: qué le sugerimos al usuario en cada pantalla.
 *
 * Antes leía `mockTransaction` — una casa inventada en Pilar de USD 185.000 —
 * y como este hook alimenta al banner y al botón "Guiame" (montados en el
 * AppShell), VARA le daba a cada persona un consejo calculado sobre una
 * operación que no era la suya. Ese era el P0-1 de VARA_ALT_MASTER_AUDIT.md.
 *
 * Ahora lee la operación activa real. Si no hay ninguna, no inventa una:
 * pasa `undefined` y `buildGuidanceContext` degrada a ceros, con lo cual el
 * motor recomienda lo que corresponde a alguien que todavía no empezó.
 *
 * Un consejo genérico es honesto. Un consejo específico sobre datos ajenos no.
 */

interface TxnSnapshot {
  currentStageId: string
  pendingDocCategories: string[]
  blockedTaskCount: number
  highRiskCount: number
  completedTaskCount: number
  totalTaskCount: number
}

function snapshotOf(txn: Transaction): TxnSnapshot {
  const allTasks = txn.stages.flatMap(s => s.tasks ?? [])
  return {
    currentStageId: txn.currentStageId ?? '',
    pendingDocCategories: (txn.documents ?? [])
      .filter(d => d.status !== 'APPROVED')
      .map(d => d.category as string),
    blockedTaskCount: allTasks.filter(t => t.status === 'BLOCKED').length,
    highRiskCount: (txn.risks ?? []).filter(r => r.severity === 'HIGH').length,
    completedTaskCount: allTasks.filter(t => t.status === 'DONE').length,
    totalTaskCount: allTasks.length,
  }
}

export interface UseGuidanceReturn {
  ctx: GuidanceContext
  nextStep: GuidanceStep | null
  allSteps: GuidanceStep[]
  summary: GuidanceSummary
  dismiss: (id: string) => void
  resetAll: () => void
  /** false mientras no hay operación real: la guía es genérica, no personalizada. */
  hasOperationContext: boolean
}

export function useGuidance(): UseGuidanceReturn {
  const vara = useVaraState()
  const pathname = usePathname()
  const { activeTransactionData } = useOperations()

  const txnData = useMemo(
    () => (activeTransactionData ? snapshotOf(activeTransactionData) : undefined),
    [activeTransactionData],
  )

  const ctx = useMemo(
    () => buildGuidanceContext(vara, pathname, txnData),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      vara.journeyType, vara.propertyUrl, vara.province, vara.onboardingDone,
      vara.operationId, vara.dismissedGuidanceIds, pathname, txnData,
    ],
  )

  const nextStep = useMemo(() => getNextGuidanceStep(ctx), [ctx])
  const allSteps = useMemo(() => getAllGuidanceSteps(ctx), [ctx])
  const summary = useMemo(() => buildGuidanceSummary(ctx), [ctx])

  return {
    ctx,
    nextStep,
    allSteps,
    summary,
    dismiss: vara.dismissGuidance,
    resetAll: vara.resetGuidance,
    hasOperationContext: activeTransactionData !== null,
  }
}
