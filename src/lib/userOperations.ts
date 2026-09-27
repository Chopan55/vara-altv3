import type { UserOperationSummary, CountryCode } from '@/types'
import { log } from '@/lib/observability/logger'

/**
 * Operaciones REALES del usuario.
 * Antes el dashboard mostraba `mockUserOperations`: tres operaciones escritas en el código,
 * iguales para todos y — por eso — imposibles de borrar.
 *
 * Con sesión los datos van a Supabase; sin sesión quedan en este navegador.
 */

export const OPERATIONS_KEY = 'vara_operations'

/** Las operaciones de demostración viven aparte y se marcan como tales. */
export const DEMO_OPERATION_IDS = ['txn-001', 'txn-002', 'txn-003']

export interface StoredOperation {
  id: string
  type: 'BUY' | 'SELL'
  title: string
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'DRAFT'
  province: string
  provinceCode: string
  city: string
  country?: CountryCode
  propertyId?: string
  progress: number
  createdAt: number
}

export function isDemoOperation(id: string): boolean {
  return DEMO_OPERATION_IDS.includes(id)
}

function read(): StoredOperation[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(OPERATIONS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

function write(ops: StoredOperation[]): void {
  try { localStorage.setItem(OPERATIONS_KEY, JSON.stringify(ops)) } catch {}
}

export function toSummary(op: StoredOperation): UserOperationSummary {
  return {
    id: op.id,
    type: op.type,
    title: op.title,
    status: op.status,
    progress: op.progress,
    province: op.province,
    city: op.city,
    propertyId: op.propertyId,
    createdAt: new Date(op.createdAt).toISOString(),
  }
}

export interface NewOperationInput {
  type: 'BUY' | 'SELL'
  province: string
  provinceCode: string
  city?: string
  title?: string
  propertyId?: string
  country?: CountryCode
}

export function createOperation(input: NewOperationInput): StoredOperation {
  const op: StoredOperation = {
    id: `op-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: input.type,
    title: input.title || (input.type === 'BUY' ? 'Mi compra' : 'Mi venta'),
    status: 'ACTIVE',
    province: input.province,
    provinceCode: input.provinceCode,
    city: input.city ?? '',
    country: input.country,
    propertyId: input.propertyId,
    progress: 0,
    createdAt: Date.now(),
  }
  write([...read(), op])
  return op
}

export function getOperations(): StoredOperation[] {
  return read().sort((a, b) => b.createdAt - a.createdAt)
}

export function getOperation(id: string): StoredOperation | null {
  return read().find(o => o.id === id) ?? null
}

export function updateOperation(id: string, patch: Partial<StoredOperation>): void {
  write(read().map(o => (o.id === id ? { ...o, ...patch, id: o.id } : o)))
}

/** Borra la operación. Si era la activa, limpia la selección. */
export function deleteOperation(id: string): void {
  write(read().filter(o => o.id !== id))
  try {
    if (localStorage.getItem('vara_operation_id') === id) {
      localStorage.removeItem('vara_operation_id')
    }
  } catch {}
}

export function hasRealOperations(): boolean {
  return read().length > 0
}


/* ─────────── Con sesión: Supabase. Sin sesión: este navegador. ─────────── */

const OPS_MIGRATED_KEY = 'vara_ops_migrated'

async function hasSession(): Promise<boolean> {
  try {
    const { hasSession: hs } = await import('@/lib/supabase/properties')
    return await hs()
  } catch { return false }
}

/** Sube a la base las operaciones que ya estaban en este navegador. Una sola vez. */
export async function migrateOperationsToSupabase(): Promise<number> {
  const local = read()
  if (local.length === 0) return 0
  try { if (localStorage.getItem(OPS_MIGRATED_KEY)) return 0 } catch { return 0 }

  const { fetchOperations, insertOperation } = await import('@/lib/supabase/operations')
  const remote = await fetchOperations()
  if (remote.length > 0) {
    try { localStorage.setItem(OPS_MIGRATED_KEY, '1') } catch {}
    return 0
  }

  let n = 0
  for (const op of local) {
    const newId = await insertOperation(op)
    if (!newId) continue
    n++
    // El id cambia al pasar a la base: llevamos con él el estado de sus tareas.
    try {
      const tasks = localStorage.getItem('vara_op_tasks_' + op.id)
      if (tasks) localStorage.setItem('vara_op_tasks_' + newId, tasks)
      if (localStorage.getItem('vara_operation_id') === op.id) {
        localStorage.setItem('vara_operation_id', newId)
      }
    } catch {}
  }
  // Solo marcar migrado si al menos una operación fue subida exitosamente,
  // o si no había nada que migrar. Nunca marcar si hubo intentos fallidos.
  if (n > 0 || local.length === 0) {
    try { localStorage.setItem(OPS_MIGRATED_KEY, '1') } catch {}
  }
  return n
}

/** Fuente única de operaciones. */
export async function loadOperations(): Promise<StoredOperation[]> {
  if (await hasSession()) {
    try {
      await migrateOperationsToSupabase()
      const { fetchOperations } = await import('@/lib/supabase/operations')
      return await fetchOperations()
    } catch (err) { log.error('operations.load.supabase.failed', err) }
  }
  return getOperations()
}

export async function createOperationAnywhere(input: NewOperationInput): Promise<StoredOperation> {
  const local = createOperation(input)
  if (await hasSession()) {
    try {
      const { insertOperation } = await import('@/lib/supabase/operations')
      const id = await insertOperation(local)
      if (id) {
        // Queda solo en la base: evitamos que aparezca duplicada.
        write(read().filter(o => o.id !== local.id))
        return { ...local, id }
      }
    } catch (err) { log.error('operations.create.supabase.failed', err) }
  }
  return local
}

/**
 * Carga una operación por ID. Busca primero en local; si no la encuentra y
 * hay sesión activa, la busca en Supabase. Así las operaciones remotas
 * (guardadas en la base pero no en este navegador) pueden abrirse normalmente.
 */
export async function loadOperation(id: string): Promise<StoredOperation | null> {
  const local = getOperation(id)
  if (local) return local
  if (await hasSession()) {
    try {
      const { getOperationById } = await import('@/lib/supabase/operations')
      return await getOperationById(id)
    } catch (err) { log.error('operations.loadById.supabase.failed', err) }
  }
  return null
}

export async function deleteOperationAnywhere(id: string): Promise<void> {
  deleteOperation(id)
  if (await hasSession()) {
    try {
      const { removeOperationRemote } = await import('@/lib/supabase/operations')
      await removeOperationRemote(id)
    } catch (err) { log.error('operations.delete.supabase.failed', err) }
  }
}
