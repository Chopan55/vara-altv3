import { tryCreateClient } from './client'
import { log } from '@/lib/observability/logger'
import type { OperationRow } from './types'
import type { StoredOperation } from '@/lib/userOperations'

/** Operaciones contra Supabase. Solo se usa cuando hay sesión. */

/**
 * PostgREST responde PGRST204 cuando el cliente manda una columna que la tabla no tiene
 * (por ejemplo, si una migración no se aplicó todavía en esa base).
 */
export function isMissingColumnError(error: unknown, column: string): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: unknown; message?: unknown }
  return e.code === 'PGRST204' && typeof e.message === 'string' && e.message.includes(`'${column}'`)
}

export function rowToStored(r: OperationRow): StoredOperation {
  return {
    id: r.id,
    type: r.type === 'SELL_PROPERTY' ? 'SELL' : 'BUY',
    title: r.title || (r.type === 'SELL_PROPERTY' ? 'Mi venta' : 'Mi compra'),
    status: r.status,
    province: r.province,
    provinceCode: r.province_code,
    city: r.city ?? '',
    country: (r as Record<string, unknown>).country as StoredOperation['country'] ?? undefined,
    propertyId: r.property_id ?? undefined,
    progress: 0,
    createdAt: new Date(r.created_at).getTime(),
  }
}

export async function getOperationById(id: string): Promise<StoredOperation | null> {
  const supabase = tryCreateClient()
  if (!supabase) return null
  const { data, error } = await supabase
    .from('operations')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return null
  return rowToStored(data)
}

export async function fetchOperations(): Promise<StoredOperation[]> {
  const supabase = tryCreateClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('operations')
    .select('*')
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data.map(rowToStored)
}

export async function insertOperation(op: StoredOperation): Promise<string | null> {
  const supabase = tryCreateClient()
  if (!supabase) return null
  const { data: u } = await supabase.auth.getUser()
  const userId = u.user?.id
  if (!userId) return null

  const payload = {
    user_id: userId,
    type: (op.type === 'SELL' ? 'SELL_PROPERTY' : 'BUY_PROPERTY') as OperationRow['type'],
    status: op.status,
    title: op.title,
    province: op.province,
    province_code: op.provinceCode,
    city: op.city || null,
    property_id: op.propertyId ?? null,
  }
  let { data, error } = await supabase
    .from('operations')
    .insert({ ...payload, country: op.country ?? null })
    .select('id')
    .single()

  // Si esa base todavía no tiene la columna `country`, se guarda igual sin ella (el país queda en este navegador).
  if (error && isMissingColumnError(error, 'country')) {
    log.warn('operation.insert.country_column_missing', 'La tabla operations no tiene la columna country: se guarda sin ella. Aplicar la migración 20261012000000_operations_country_hotfix.sql.', { operationId: op.id })
    ;({ data, error } = await supabase.from('operations').insert(payload).select('id').single())
  }

  if (error || !data) {
    log.error('operation.insert.failed', error, { operationId: op.id })
    return null
  }
  return data.id
}

export async function removeOperationRemote(id: string): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const { error } = await supabase.from('operations').delete().eq('id', id)
  return !error
}

/** Nombre del perfil. Con sesión, esto manda sobre lo que haya en el navegador. */
export async function fetchProfileName(): Promise<string | null> {
  const supabase = tryCreateClient()
  if (!supabase) return null
  const { data: u } = await supabase.auth.getUser()
  if (!u.user) return null
  const { data } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', u.user.id)
    .maybeSingle()
  const name = data?.full_name?.trim()
  if (name) return name
  // Si el profile quedó vacío, caemos al metadata del signup.
  const meta = u.user.user_metadata?.full_name
  return typeof meta === 'string' && meta.trim() ? meta.trim() : null
}
