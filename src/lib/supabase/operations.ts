import { tryCreateClient } from './client'
import { log } from '@/lib/observability/logger'
import type { OperationRow } from './types'
import type { StoredOperation } from '@/lib/userOperations'

/** Operaciones contra Supabase. Solo se usa cuando hay sesión. */

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

  const { data, error } = await supabase
    .from('operations')
    .insert({
      user_id: userId,
      type: op.type === 'SELL' ? 'SELL_PROPERTY' : 'BUY_PROPERTY',
      status: op.status,
      title: op.title,
      province: op.province,
      province_code: op.provinceCode,
      city: op.city || null,
      property_id: op.propertyId ?? null,
      country: op.country ?? null,
    })
    .select('id')
    .single()

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
