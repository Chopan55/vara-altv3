import type { UserOperationSummary, CountryCode } from '@/types'
import { log } from '@/lib/observability/logger'
import { lazyModule, singleFlight, withGuestMigrationLock } from '@/lib/guestLock'
import { newOperationId } from '@/lib/operationIds'
import {
  hasPendingPromotedLinks, isPendingGuestProperty, linkPromotedProperties, mapPropertyId, runPropertyMigration, sweepPromotedLinks,
} from '@/lib/userProperties'

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
    // UUID: al crear la cuenta se sube con este mismo id, así que la operación no cambia de identidad.
    id: newOperationId(),
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

/** Id local → id en la base, para las operaciones viejas (ids no UUID) que ya se subieron pero siguen en este navegador. */
const IDMAP_KEY = 'vara_ops_idmap'

// Imports perezosos y compartidos: las llamadas simultáneas esperan UNA sola carga del módulo.
const sessionModule = lazyModule(() => import('@/lib/supabase/properties'))
const remoteOperations = lazyModule(() => import('@/lib/supabase/operations'))

async function hasSession(): Promise<boolean> {
  try {
    const { hasSession: hs } = await sessionModule()
    return await hs()
  } catch { return false }
}

function readIdMap(): Record<string, string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(IDMAP_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch { return {} }
}

function writeIdMap(map: Record<string, string>): void {
  try { localStorage.setItem(IDMAP_KEY, JSON.stringify(map)) } catch {}
}

/** Si el id cambió al pasar a la base, lleva con él el estado de las tareas y la operación elegida. */
function carryOperationState(oldId: string, newId: string): void {
  if (oldId === newId) return
  try {
    const tasks = localStorage.getItem('vara_op_tasks_' + oldId)
    if (tasks && !localStorage.getItem('vara_op_tasks_' + newId)) localStorage.setItem('vara_op_tasks_' + newId, tasks)
    localStorage.removeItem('vara_op_tasks_' + oldId)
    if (localStorage.getItem('vara_operation_id') === oldId) localStorage.setItem('vara_operation_id', newId)
  } catch {}
}

async function runMigration(): Promise<number> {
  // Primero las propiedades: así las operaciones se suben ya con el id real de su propiedad y no pierden el vínculo.
  await runPropertyMigration()
  if (read().length === 0) {
    await finishPromotedLinks()
    return 0
  }
  const { insertOperation } = await remoteOperations()
  const idMap = readIdMap()
  let uploaded = 0
  // Se relee dentro del lock: otra pestaña pudo haber subido algunas mientras esperábamos.
  for (const original of read()) {
    if (isDemoOperation(original.id)) continue
    let op = original
    if (op.propertyId) {
      const mapped = mapPropertyId(op.propertyId)
      if (mapped !== op.propertyId) {
        // La propiedad ya está en la cuenta con otro id: la operación apunta al nuevo (también la copia local, por si esta subida falla).
        op = { ...op, propertyId: mapped }
        write(read().map(o => (o.id === op.id ? op : o)))
      } else if (isPendingGuestProperty(op.propertyId)) {
        // Su propiedad todavía no se pudo subir: esperar. Subir la operación ahora la dejaría sin vínculo para siempre.
        continue
      }
    }
    let remoteId: string | null = idMap[op.id] ?? null
    if (!remoteId) {
      remoteId = await insertOperation(op)
      if (!remoteId) continue // no se pudo (corte, sin sesión): sigue en este navegador y se reintenta en la próxima carga
      idMap[op.id] = remoteId
      writeIdMap(idMap) // antes de tocar nada más: si algo se corta acá, el reintento no vuelve a insertarla
      uploaded++
    }
    carryOperationState(op.id, remoteId)
    await linkPromotedProperties(op.id, remoteId) // el candidato que la promovió vuelve a apuntar a ella
    // Ya vive en la cuenta: sale de este navegador. Es lo que hace que la migración ocurra una sola vez y sin duplicados.
    write(read().filter(o => o.id !== op.id))
    delete idMap[op.id]
    writeIdMap(idMap)
  }
  await finishPromotedLinks()
  return uploaded
}

/** Enlaces candidato ↔ operación que quedaron pendientes y cuya operación ya está en la cuenta con el mismo id. */
async function finishPromotedLinks(): Promise<void> {
  if (!hasPendingPromotedLinks()) return
  try {
    const { fetchOperations } = await remoteOperations()
    await sweepPromotedLinks(new Set((await fetchOperations()).map(o => o.id)))
  } catch (err) { log.error('operations.migrate.links.failed', err) }
}

/**
 * Sube a la cuenta las operaciones que el usuario creó como invitado en este navegador.
 * - Conserva el id (UUID): no cambian ni la selección ni el estado de las tareas.
 * - Una sola vez por operación: al subirla se borra de acá; un reintento tras un corte no la duplica.
 * - Corre también al entrar a una cuenta que ya tenía operaciones: lo que hizo el invitado no se pierde.
 * Devuelve cuántas se subieron en esta pasada.
 */
export const migrateOperationsToSupabase = singleFlight(() => withGuestMigrationLock(runMigration))

/** Fuente única de operaciones. */
export async function loadOperations(): Promise<StoredOperation[]> {
  if (await hasSession()) {
    try {
      await migrateOperationsToSupabase()
      const { fetchOperations } = await remoteOperations()
      const remote = await fetchOperations()
      // Operaciones que todavía no se pudieron subir a la base siguen siendo del usuario: no deben desaparecer.
      const pending = getOperations().filter(l => !remote.some(r => r.id === l.id))
      return [...remote, ...pending]
    } catch (err) { log.error('operations.load.supabase.failed', err) }
  }
  return getOperations()
}

export async function createOperationAnywhere(input: NewOperationInput): Promise<StoredOperation> {
  const local = createOperation(input)
  if (await hasSession()) {
    try {
      const { insertOperation } = await remoteOperations()
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
      const { getOperationById } = await remoteOperations()
      return await getOperationById(id)
    } catch (err) { log.error('operations.loadById.supabase.failed', err) }
  }
  return null
}

export async function deleteOperationAnywhere(id: string): Promise<void> {
  deleteOperation(id)
  if (await hasSession()) {
    try {
      const { removeOperationRemote } = await remoteOperations()
      await removeOperationRemote(id)
    } catch (err) { log.error('operations.delete.supabase.failed', err) }
  }
}
