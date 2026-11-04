import { tryCreateClient } from './client'
import type { IdentityVerificationRow, OperationTrustEntry } from './types'

/**
 * Verificación de identidad del Trust Passport (migración 20261105000000).
 *
 * Los archivos van al bucket privado `identity`, en la carpeta del usuario. Se
 * sirven solo con URL firmada de pocos minutos, y solo al dueño o a un admin.
 * Si la migración no corrió, todo devuelve NOT_READY y la pantalla lo explica.
 */

const BUCKET = 'identity'
const SIGNED_URL_TTL = 60 * 5
const MAX_BYTES = 8 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

export type IdentityError = 'NOT_READY' | 'NO_SESSION' | 'BAD_FILE' | 'FAILED'

function isMissingSchema(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  return ['42P01', '42883', 'PGRST202', 'PGRST205'].includes(err.code ?? '')
    || /does not exist|could not find|bucket not found/i.test(err.message ?? '')
}

/** El archivo tiene que ser una imagen o un PDF, de hasta 8 MB. */
export function checkIdentityFile(f: { type: string; size: number }): boolean {
  return ACCEPTED.includes(f.type) && f.size > 0 && f.size <= MAX_BYTES
}

export async function getMyIdentity(): Promise<{ data: IdentityVerificationRow | null; error?: IdentityError }> {
  const supabase = tryCreateClient()
  if (!supabase) return { data: null, error: 'NO_SESSION' }
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return { data: null, error: 'NO_SESSION' }
  const { data, error } = await supabase.from('identity_verifications').select('*').eq('user_id', auth.user.id).maybeSingle()
  if (error) return { data: null, error: isMissingSchema(error) ? 'NOT_READY' : 'FAILED' }
  return { data }
}

export async function submitIdentity(document: File, selfie: File): Promise<{ ok: boolean; error?: IdentityError }> {
  if (!checkIdentityFile(document) || !checkIdentityFile(selfie)) return { ok: false, error: 'BAD_FILE' }
  const supabase = tryCreateClient()
  if (!supabase) return { ok: false, error: 'NO_SESSION' }
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth.user?.id
  if (!uid) return { ok: false, error: 'NO_SESSION' }

  const stamp = Date.now()
  const ext = (f: File) => (f.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const docPath = `${uid}/dni-${stamp}.${ext(document)}`
  const selfiePath = `${uid}/selfie-${stamp}.${ext(selfie)}`

  for (const [path, file] of [[docPath, document], [selfiePath, selfie]] as const) {
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false })
    if (error) return { ok: false, error: isMissingSchema(error) ? 'NOT_READY' : 'FAILED' }
  }

  const existing = await getMyIdentity()
  if (existing.error) return { ok: false, error: existing.error }
  const { error } = existing.data
    ? await supabase.from('identity_verifications')
        .update({ status: 'SUBMITTED', document_path: docPath, selfie_path: selfiePath }).eq('user_id', uid)
    : await supabase.from('identity_verifications')
        .insert({ user_id: uid, status: 'SUBMITTED', document_path: docPath, selfie_path: selfiePath })
  if (error) return { ok: false, error: isMissingSchema(error) ? 'NOT_READY' : 'FAILED' }
  return { ok: true }
}

export async function getOperationTrust(operationId: string): Promise<OperationTrustEntry[]> {
  const supabase = tryCreateClient()
  if (!supabase) return []
  const { data, error } = await supabase.rpc('get_operation_trust', { p_operation_id: operationId })
  return error || !data ? [] : data
}

// ───────────────────────────── Admin ─────────────────────────────

export async function adminListIdentity(status: IdentityVerificationRow['status'] = 'SUBMITTED'): Promise<IdentityVerificationRow[]> {
  const supabase = tryCreateClient()
  if (!supabase) return []
  const { data } = await supabase.from('identity_verifications').select('*').eq('status', status).order('submitted_at')
  return data ?? []
}

export async function adminSignedUrls(row: IdentityVerificationRow): Promise<{ document: string | null; selfie: string | null }> {
  const supabase = tryCreateClient()
  if (!supabase) return { document: null, selfie: null }
  const sign = async (path: string) =>
    (await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL)).data?.signedUrl ?? null
  return { document: await sign(row.document_path), selfie: await sign(row.selfie_path) }
}

export async function adminReviewIdentity(userId: string, approve: boolean, reason?: string): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const { error } = await supabase.from('identity_verifications')
    .update(approve ? { status: 'VERIFIED', rejection_reason: null } : { status: 'REJECTED', rejection_reason: reason?.trim() || 'No pudimos validar los documentos.' })
    .eq('user_id', userId)
  return !error
}
