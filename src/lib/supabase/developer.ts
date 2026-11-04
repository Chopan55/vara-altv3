import { tryCreateClient } from './client'
import { generateApiKey, randomToken, sha256Hex } from '@/lib/apiKeys'
import type { ApiKeyRow, WebhookEndpointRow } from './types'

/**
 * Claves de API y webhooks del usuario (migración 20261105000002_public_api).
 * Si la migración no corrió, devuelve NOT_READY y el panel lo explica.
 */

export type DevError = 'NOT_READY' | 'NO_SESSION' | 'INVALID' | 'FAILED'

export const WEBHOOK_EVENTS: { value: string; label: string }[] = [
  { value: 'DOCUMENT_UPLOADED', label: 'Documento subido' },
  { value: 'DOCUMENT_STATUS_CHANGED', label: 'Cambio de estado de un documento' },
  { value: 'OFFER_CREATED', label: 'Oferta creada' },
  { value: 'OFFER_STATUS_CHANGED', label: 'Cambio de estado de una oferta' },
  { value: 'OPERATION_CREATED', label: 'Operación creada' },
]

function isMissingSchema(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  return ['42P01', '42883', 'PGRST202', 'PGRST205'].includes(err.code ?? '') || /does not exist|could not find/i.test(err.message ?? '')
}

async function uid(): Promise<string | null> {
  const supabase = tryCreateClient()
  if (!supabase) return null
  return (await supabase.auth.getUser()).data.user?.id ?? null
}

export async function listApiKeys(): Promise<{ data: ApiKeyRow[]; error?: DevError }> {
  const supabase = tryCreateClient()
  if (!supabase || !(await uid())) return { data: [], error: 'NO_SESSION' }
  const { data, error } = await supabase.from('api_keys').select('*').is('revoked_at', null).order('created_at')
  if (error) return { data: [], error: isMissingSchema(error) ? 'NOT_READY' : 'FAILED' }
  return { data: data ?? [] }
}

/** Crea la clave y devuelve el texto plano UNA vez. En la base queda solo el hash. */
export async function createApiKey(name: string): Promise<{ key?: string; error?: DevError }> {
  const supabase = tryCreateClient()
  const user = await uid()
  if (!supabase || !user) return { error: 'NO_SESSION' }
  if (!name.trim()) return { error: 'INVALID' }
  const key = generateApiKey()
  const { error } = await supabase.from('api_keys').insert({
    user_id: user, name: name.trim().slice(0, 60), prefix: key.slice(0, 14), key_hash: await sha256Hex(key),
  })
  if (error) return { error: isMissingSchema(error) ? 'NOT_READY' : 'FAILED' }
  return { key }
}

export async function revokeApiKey(id: string): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const { error } = await supabase.from('api_keys').update({ revoked_at: new Date().toISOString() }).eq('id', id)
  return !error
}

export async function listWebhooks(): Promise<{ data: WebhookEndpointRow[]; error?: DevError }> {
  const supabase = tryCreateClient()
  if (!supabase || !(await uid())) return { data: [], error: 'NO_SESSION' }
  const { data, error } = await supabase.from('webhook_endpoints').select('*').is('revoked_at', null).order('created_at')
  if (error) return { data: [], error: isMissingSchema(error) ? 'NOT_READY' : 'FAILED' }
  return { data: data ?? [] }
}

export function isHttpsUrl(url: string): boolean {
  try { return new URL(url).protocol === 'https:' } catch { return false }
}

export async function createWebhook(url: string, events: string[]): Promise<{ data?: WebhookEndpointRow; error?: DevError }> {
  const supabase = tryCreateClient()
  const user = await uid()
  if (!supabase || !user) return { error: 'NO_SESSION' }
  if (!isHttpsUrl(url.trim())) return { error: 'INVALID' }
  const { data, error } = await supabase.from('webhook_endpoints')
    .insert({ user_id: user, url: url.trim(), secret: 'whsec_' + randomToken(40), events })
    .select('*').single()
  if (error) return { error: isMissingSchema(error) ? 'NOT_READY' : error.code === '23514' ? 'INVALID' : 'FAILED' }
  return { data }
}

export async function revokeWebhook(id: string): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const { error } = await supabase.from('webhook_endpoints').update({ revoked_at: new Date().toISOString() }).eq('id', id)
  return !error
}
