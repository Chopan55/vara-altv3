import { tryCreateClient } from './client'
import type {
  AcceptInviteResult, OperationMemberRow, ParticipantRoleDb, SharedOperationSummary, SharedOperationView,
} from './types'

/**
 * Acceso compartido a una operación (migración 20261104000000_operation_sharing).
 *
 * Si la migración todavía no corrió en la base, las llamadas devuelven
 * `NOT_READY` en vez de romper: la pantalla lo explica y sigue andando.
 */

export type SharingError = 'NOT_READY' | 'NO_SESSION' | 'DUPLICATE' | 'FAILED'

/** Tabla o función inexistente: la migración no corrió. */
function isMissingSchema(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  return err.code === '42P01' || err.code === '42883' || err.code === 'PGRST202' || err.code === 'PGRST205'
    || /does not exist|could not find/i.test(err.message ?? '')
}


export function inviteUrl(token: string, origin: string): string {
  return `${origin}/invitacion/${token}`
}

export async function listInvites(operationId: string): Promise<{ data: OperationMemberRow[]; error?: SharingError }> {
  const supabase = tryCreateClient()
  if (!supabase) return { data: [], error: 'NO_SESSION' }
  const { data, error } = await supabase.from('operation_members').select('*')
    .eq('operation_id', operationId).is('revoked_at', null).order('created_at')
  if (error) return { data: [], error: isMissingSchema(error) ? 'NOT_READY' : 'FAILED' }
  return { data: data ?? [] }
}

export async function createInvite(
  operationId: string, email: string, role: ParticipantRoleDb,
): Promise<{ data?: OperationMemberRow; error?: SharingError }> {
  const supabase = tryCreateClient()
  if (!supabase) return { error: 'NO_SESSION' }
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return { error: 'NO_SESSION' }
  const { data, error } = await supabase.from('operation_members')
    .insert({ operation_id: operationId, owner_id: auth.user.id, invited_email: email.trim().toLowerCase(), role })
    .select('*').single()
  if (error) {
    if (isMissingSchema(error)) return { error: 'NOT_READY' }
    return { error: error.code === '23505' ? 'DUPLICATE' : 'FAILED' }
  }
  void import('@/lib/funnel/track').then(m => m.trackFunnel('invite_sent', { role }), () => undefined)
  return { data }
}

export async function revokeInvite(id: string): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const { error } = await supabase.from('operation_members').update({ revoked_at: new Date().toISOString() }).eq('id', id)
  return !error
}

export async function acceptInvite(token: string): Promise<AcceptInviteResult | { ok: false; reason: SharingError }> {
  const supabase = tryCreateClient()
  if (!supabase) return { ok: false, reason: 'NO_SESSION' }
  const { data, error } = await supabase.rpc('accept_operation_invite', { p_token: token })
  if (error || !data) return { ok: false, reason: isMissingSchema(error) ? 'NOT_READY' : 'FAILED' }
  return data
}

export async function getSharedOperation(operationId: string): Promise<{ data: SharedOperationView | null; error?: SharingError }> {
  const supabase = tryCreateClient()
  if (!supabase) return { data: null, error: 'NO_SESSION' }
  const { data, error } = await supabase.rpc('get_shared_operation', { p_operation_id: operationId })
  if (error) return { data: null, error: isMissingSchema(error) ? 'NOT_READY' : 'FAILED' }
  return { data: data ?? null }
}

export async function listSharedOperations(): Promise<SharedOperationSummary[]> {
  const supabase = tryCreateClient()
  if (!supabase) return []
  const { data, error } = await supabase.rpc('list_shared_operations', {})
  return error || !data ? [] : data
}
