'use client'
import { useMemo, useState, useEffect, useCallback } from 'react'
import {
  OPERATION_STORE,
  mockOperationRelations,
} from '@/data/mock'
import type { UserOperationSummary, OperationRelation, Transaction } from '@/types'
import type { StoredOperation } from '@/lib/userOperations'
import { useVaraState } from '@/hooks/useVaraState'
import { getOperations, toSummary, loadOperations, loadOperation, deleteOperationAnywhere } from '@/lib/userOperations'
import { buildTransaction, clearTaskState } from '@/lib/operationFromChecklist'

export interface OperationsState {
  operations: UserOperationSummary[]
  activeOperationId: string | null
  activeOperation: UserOperationSummary | null
  activeTransactionData: Transaction | null
  buyOperations: UserOperationSummary[]
  sellOperations: UserOperationSummary[]
  relations: OperationRelation[]
  getRelatedOperations: (operationId: string) => UserOperationSummary[]
  getTransactionData: (operationId: string) => Transaction | null
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
    loadOperations()
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
    const activeOperationId = selectedId && operations.some(op => op.id === selectedId)
      ? selectedId
      : operations[0]?.id ?? null
    const activeOperation = operations.find(op => op.id === activeOperationId) ?? null
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

    return {
      operations,
      activeOperationId,
      activeOperation,
      activeTransactionData,
      buyOperations,
      sellOperations,
      relations: mockOperationRelations,
      getRelatedOperations,
      getTransactionData,
      usingDemo,
    }
  }, [vara.operationId, own, ownRaw])

  return { ...state, loaded, error, deleteOperation }
}

export function useGlobalNextBestAction() {
  const { operations, getTransactionData } = useOperations()

  return useMemo(() => {
    const alerts: Array<{ operationId: string; title: string; label: string; severity: 'HIGH' | 'MEDIUM' }> = []

    for (const op of operations) {
      if (op.status !== 'ACTIVE') continue
      const txn = getTransactionData(op.id)
      if (!txn) continue

      const blockedCount = txn.stages.flatMap(s => s.tasks).filter(t => t.status === 'BLOCKED').length
      const pendingHighDocs = txn.documents.filter(d => d.status === 'PENDING' && ['ESCRITURA', 'PLANOS'].includes(d.category)).length

      if (blockedCount > 0) {
        alerts.push({ operationId: op.id, title: op.title, label: `${blockedCount} tarea${blockedCount > 1 ? 's' : ''} bloqueada${blockedCount > 1 ? 's' : ''}`, severity: 'HIGH' })
      } else if (pendingHighDocs > 0) {
        alerts.push({ operationId: op.id, title: op.title, label: 'Documentación crítica pendiente', severity: 'HIGH' })
      }
    }

    return alerts.sort((a, b) => (a.severity === 'HIGH' ? -1 : 1) - (b.severity === 'HIGH' ? -1 : 1))
  }, [operations, getTransactionData])
}
