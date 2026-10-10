import { buildTransaction } from '@/lib/operationFromChecklist'
import type { StoredOperation } from '@/lib/userOperations'

/**
 * Preparación de venta: qué papeles pide el motor regulatorio para vender en la
 * provincia de la operación y cuáles ya tiene el vendedor. Nada inventado:
 * la lista sale de las tareas de la operación; el "lo tengo" es del usuario.
 */
const KEY = 'vara_sellprep_'

export interface SellDoc { name: string; category: string; have: boolean }

export function readHave(opId: string): string[] {
  try { return JSON.parse(localStorage.getItem(KEY + opId) ?? '[]') as string[] } catch { return [] }
}

export function toggleHave(opId: string, name: string): string[] {
  const cur = new Set(readHave(opId))
  if (cur.has(name)) cur.delete(name); else cur.add(name)
  const next = [...cur]
  try { localStorage.setItem(KEY + opId, JSON.stringify(next)) } catch {}
  return next
}

export function sellDocuments(op: StoredOperation, have: string[]): SellDoc[] {
  const owned = new Set(have)
  return buildTransaction(op).documents.map(d => ({ name: d.name, category: d.category, have: owned.has(d.name) }))
}

export function sellReadiness(docs: SellDoc[]): { have: number; total: number; percent: number } {
  const have = docs.filter(d => d.have).length
  return { have, total: docs.length, percent: docs.length ? Math.round((have / docs.length) * 100) : 0 }
}
