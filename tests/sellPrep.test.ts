import { describe, it, expect, beforeEach } from 'vitest'
import { sellDocuments, sellReadiness, toggleHave, readHave } from '@/lib/sellPrep'
import type { StoredOperation } from '@/lib/userOperations'

const store = new Map<string, string>()
;(globalThis as { localStorage?: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(), key: () => null, length: 0,
} as Storage

const op: StoredOperation = {
  id: 'op-sell-1', type: 'SELL', title: 'Mi venta', status: 'ACTIVE',
  province: 'CABA', provinceCode: 'CABA', city: 'CABA', progress: 0, createdAt: 0,
}

describe('preparar venta', () => {
  beforeEach(() => store.clear())

  it('lista documentos reales y arranca en 0%', () => {
    const r = sellReadiness(sellDocuments(op, readHave(op.id)))
    expect(r.total).toBeGreaterThan(0)
    expect(r.percent).toBe(0)
  })

  it('marcar un documento sube el porcentaje y se puede desmarcar', () => {
    const first = sellDocuments(op, [])[0].name
    const after = sellDocuments(op, toggleHave(op.id, first))
    expect(after[0].have).toBe(true)
    expect(sellReadiness(after).percent).toBeGreaterThan(0)
    expect(sellReadiness(sellDocuments(op, toggleHave(op.id, first))).percent).toBe(0)
  })
})
