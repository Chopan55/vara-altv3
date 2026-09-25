'use client'
import { useMemo, useState, useEffect, useCallback } from 'react'
import {
  mockUserOperations,
  OPERATION_STORE,
  mockOperationRelations,
} from '@/data/mock'
import type { UserOperationSummary, OperationRelation, Transaction } from '@/types'
import { useVaraState } from '@/hooks/useVaraState'
import { getOperations, getOperation, toSummary, loadOperations, deleteOperationAnywhere } from '@/lib/userOperations'
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
  deleteOperation: (id: string) => void
}

export function useOperations(): OperationsState {
  const vara = useVaraState()
  const [own, setOwn] = useState<UserOperationSummary[]>([])
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(() => {
    // Primero lo local para que la pantalla no parpadee, después lo de la base.
    setOwn(getOperations().map(toSummary))
    loadOperations().then(ops => setOwn(ops.map(toSummary))).catch(() => {})
  }, [])

  useEffect(() => { reload(); setLoaded(true) }, [reload])

  const deleteOperation = useCallback((id: string) => {
    clearTaskState(id)
    void deleteOperationAnywhere(id).finally(reload)
    setOwn(prev => prev.filter(o => o.id !== id))
  }, [reload])

  const state = useMemo(() => {
    // Una operación propia arma sus etapas con el motor regulatorio; las demo salen del store.
    const resolveTxn = (operationId: string): Transaction | null => {
      const ownOp = getOperation(operationId)
      if (ownOp) return buildTransaction(ownOp)
      return OPERATION_STORE[operationId] ?? null
    }

    // Solo operaciones del usuario. Las de ejemplo confundían más de lo que ayudaban:
    // parecían suyas y no se podían borrar.
    const usingDemo = false
    const operations = own
    const activeOperationId = vara.operationId ?? operations[0]?.id ?? null
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
  }, [vara.operationId, own])

  return { ...state, loaded, deleteOperation }
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
