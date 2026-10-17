'use client'
import { useMemo, useState, useEffect, useCallback } from 'react'
import {
  OPERATION_STORE,
  mockOperationRelations,
} from '@/data/mock'
import type { UserOperationSummary, OperationRelation, Transaction } from '@/types'
import type { StoredOperation } from '@/lib/userOperations'
import { useVaraState } from '@/hooks/useVaraState'
import { resolveOperationContext, type Journey } from '@/lib/journey'
import { getOperations, toSummary, loadOperations, loadOperation, deleteOperationAnywhere } from '@/lib/userOperations'
import { buildTransaction, clearTaskState } from '@/lib/operationFromChecklist'

export interface OperationsState {
  operations: UserOperationSummary[]
  /** Recorrido actual (compra o venta): una sola regla para menú, guía y Dashboard. */
  journey: Journey
  activeOperationId: string | null
  activeOperation: UserOperationSummary | null
  activeTransactionData: Transaction | null
  buyOperations: UserOperationSummary[]
  sellOperations: UserOperationSummary[]
  relations: OperationRelation[]
  getRelatedOperations: (operationId: string) => UserOperationSummary[]
  getTransactionData: (operationId: string) => Transaction | null
  /** Operación completa (local o de la cuenta) por id: una sola fuente para toda la app. */
  getStoredOperation: (operationId: string) => StoredOperation | null
  /** true cuando no hay operaciones propias y se muestran las de demostración. */
  usingDemo: boolean
  loaded: boolean
  error: boolean
  deleteOperation: (id: string) => void
}

export function useOperations(): OperationsState {
  const vara = useVaraState()
  const [own, setOwn] = useState<UserOperationSummary[]>([])
  // ownRaw holds full StoredOperation objects (with provinceCode etc) for buildTransaction
  const [ownRaw, setOwnRaw] = useState<StoredOperation[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  const reload = useCallback(() => {
    // Primero lo local para que la pantalla no parpadee, después lo de la base.
    const local = getOperations()
    setOwn(local.map(toSummary))
    setOwnRaw(local)
    // Con tiempo máximo: si la base no responde, se sigue con lo que hay en este dispositivo en vez de cargar para siempre.
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
    Promise.race([loadOperations(), timeout])
      .then(ops => { setOwn(ops.map(toSummary)); setOwnRaw(ops) })
      .catch(() => { setError(true) })
      .finally(() => setLoaded(true))
  }, [])

  useEffect(() => { reload() }, [reload])

  const deleteOperation = useCallback((id: string) => {
    clearTaskState(id)
    void deleteOperationAnywhere(id).finally(reload)
    setOwn(prev => prev.filter(o => o.id !== id))
    setOwnRaw(prev => prev.filter(o => o.id !== id))
  }, [reload])

  const state = useMemo(() => {
    // Una operación propia arma sus etapas con el motor regulatorio; las demo salen del store.
    const resolveTxn = (operationId: string): Transaction | null => {
      // Usar ownRaw (datos completos con provinceCode) en vez de getOperation() que solo lee localStorage.
      const ownOp = ownRaw.find(op => op.id === operationId)
      if (ownOp) return buildTransaction(ownOp)
      return OPERATION_STORE[operationId] ?? null
    }

    const usingDemo = false
    const operations = own
    // Tratar string vacío igual que null/undefined (H14)
    const selectedId = vara.operationId || null
    // Una sola regla (lib/journey): la operación activa siempre existe en la lista y es del recorrido actual.
    const { journey, activeOperationId, activeOperation } = resolveOperationContext(operations, {
      journeyType: vara.journeyType, selectedId,
    })
    const activeTransactionData = activeOperationId ? resolveTxn(activeOperationId) : null

    const buyOperations = operations.filter(op => op.type === 'BUY')
    const sellOperations = operations.filter(op => op.type === 'SELL')

    const getRelatedOperations = (operationId: string): UserOperationSummary[] => {
      const relatedIds = mockOperationRelations
        .filter(r => r.fromOperationId === operationId || r.toOperationId === operationId)
        .map(r => r.fromOperationId === operationId ? r.toOperationId : r.fromOperationId)
      return operations.filter(op => relatedIds.includes(op.id))
    }

    const getTransactionData = resolveTxn
    const getStoredOperation = (id: string) => ownRaw.find(op => op.id === id) ?? null

    return {
      operations,
      journey,
      activeOperationId,
      activeOperation,
      activeTransactionData,
      buyOperations,
      sellOperations,
      relations: mockOperationRelations,
      getRelatedOperations,
      getTransactionData,
      getStoredOperation,
      usingDemo,
    }
  }, [vara.operationId, vara.journeyType, own, ownRaw])

  return { ...state, loaded, error, deleteOperation }
}

export function useGlobalNextBestAction() {
  const { operations, getTransactionData, journey } = useOperations()

  return useMemo(() => {
    const alerts: Array<{ operationId: string; title: string; label: string; severity: 'HIGH' | 'MEDIUM'; opType: 'BUY' | 'SELL' }> = []

    for (const op of operations) {
      if (op.status !== 'ACTIVE') continue
      const txn = getTransactionData(op.id)
      if (!txn) continue

      const blockedCount = txn.stages.flatMap(s => s.tasks).filter(t => t.status === 'BLOCKED').length
      const pendingHighDocs = txn.documents.filter(d => d.status === 'PENDING' && ['ESCRITURA', 'PLANOS'].includes(d.category)).length

      if (blockedCount > 0) {
        alerts.push({ operationId: op.id, title: op.title, label: `${blockedCount} tarea${blockedCount > 1 ? 's' : ''} bloqueada${blockedCount > 1 ? 's' : ''}`, severity: 'HIGH', opType: op.type })
      } else if (pendingHighDocs > 0) {
        // Falta de escritura o planos es lo normal al empezar una compra: es una
        // tarea pendiente, no una emergencia. El rojo se reserva para lo bloqueado.
        alerts.push({ operationId: op.id, title: op.title, label: 'Documentación crítica pendiente', severity: 'MEDIUM', opType: op.type })
      }
    }

    const rank = { HIGH: 0, MEDIUM: 1 } as const
    // En Comprando mandan las alertas de compra y en Vendiendo las de venta; las del otro recorrido solo si son urgentes.
    return alerts
      .filter(a => a.opType === journey || a.severity === 'HIGH')
      .sort((a, b) => (a.opType === journey ? 0 : 1) - (b.opType === journey ? 0 : 1) || rank[a.severity] - rank[b.severity])
  }, [operations, getTransactionData, journey])
}
