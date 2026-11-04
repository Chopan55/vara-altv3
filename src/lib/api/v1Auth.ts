import { createHash } from 'node:crypto'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { isApiKey } from '@/lib/apiKeys'

/**
 * Autenticación de /api/v1 con clave de API (`Authorization: Bearer vara_live_…`).
 * La clave se hashea acá y la base devuelve solo los datos de su dueño
 * (RPC SECURITY DEFINER): el cliente anónimo no ve ninguna tabla.
 */

export function apiKeyFrom(req: Request): string | null {
  const auth = req.headers.get('authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null
  return token && isApiKey(token) ? token : null
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

export function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return null
  return createSupabaseClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** La RPC no existe todavía: la migración de la API pública no corrió. */
export function isMissingRpc(err: { code?: string; message?: string }): boolean {
  return err.code === 'PGRST202' || err.code === '42883' || /could not find the function/i.test(err.message ?? '')
}
