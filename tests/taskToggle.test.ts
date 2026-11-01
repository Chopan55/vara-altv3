import { describe, it, expect, beforeEach } from 'vitest'
import { buildTransaction, setTaskState, clearTaskState } from '@/lib/operationFromChecklist'
import { primaryAction } from '@/lib/nba/engine'
import type { StoredOperation } from '@/lib/userOperations'

const store = new Map<string, string>()
;(globalThis as { localStorage?: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage

const op: StoredOperation = {
  id: 'op-toggle-1', type: 'BUY', title: 'Compra de prueba', status: 'ACTIVE',
  province: 'Ciudad de Buenos Aires', provinceCode: 'CABA', city: 'CABA', progress: 0, createdAt: 0,
}

describe('marcar tareas como hechas', () => {
  beforeEach(() => { store.clear(); clearTaskState(op.id) })

  it('arranca en 0% y hay una recomendación', () => {
    const txn = buildTransaction(op)
    expect(txn.progress).toBe(0)
    expect(primaryAction({ transaction: txn })).not.toBeNull()
  })

  it('al marcar una tarea sube el progreso', () => {
    const first = buildTransaction(op).stages[0].tasks[0]
    setTaskState(op.id, first.id, 'DONE')
    const after = buildTransaction(op)
    expect(after.progress).toBeGreaterThan(0)
    expect(after.stages[0].tasks[0].status).toBe('DONE')
  })

  it('al marcar las tareas que piden un documento, ese documento deja de ser lo primero que se recomienda', () => {
    const before = buildTransaction(op)
    const nbaBefore = primaryAction({ transaction: before })
    expect(nbaBefore?.id).toBe('critical_doc_escritura')

    before.stages.flatMap(s => s.tasks)
      .filter(t => t.documentsRequired.some(d => /escritura/i.test(d)))
      .forEach(t => setTaskState(op.id, t.id, 'DONE'))

    const after = buildTransaction(op)
    expect(after.documents.filter(d => /escritura/i.test(d.name)).every(d => d.status === 'RECEIVED')).toBe(true)
    expect(primaryAction({ transaction: after })?.id).not.toBe('critical_doc_escritura')
  })

  it('al completar una etapa entera, la siguiente pasa a ser la actual', () => {
    const before = buildTransaction(op)
    before.stages[0].tasks.forEach(t => setTaskState(op.id, t.id, 'DONE'))
    const after = buildTransaction(op)
    expect(after.stages[0].status).toBe('COMPLETED')
    expect(after.currentStageId).toBe(before.stages[1].id)
  })

  it('se puede volver a marcar como pendiente', () => {
    const first = buildTransaction(op).stages[0].tasks[0]
    setTaskState(op.id, first.id, 'DONE')
    setTaskState(op.id, first.id, 'TODO')
    expect(buildTransaction(op).progress).toBe(0)
  })
})
