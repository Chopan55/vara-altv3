import { createHash } from 'node:crypto'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { createClient as createCookieClient } from '@/lib/supabase/server'
import { isApiKey } from '@/lib/apiKeys'

/**
 * Autenticación de /api/v1.
 *
 * 1. Clave de API (`Authorization: Bearer vara_live_…`): se hashea acá y la base
 *    devuelve solo los datos de su dueño (RPC SECURITY DEFINER). El cliente
 *    anónimo no ve ninguna tabla.
 * 2. Token de sesión de Supabase (`Authorization: Bearer <jwt>`), para llamadas
 *    de servidor a servidor: las consultas corren con ese token y RLS.
 * 3. Cookie de sesión, para el navegador.
 */

function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  return url && key ? { url, key } : null
}

function bearer(req: Request): string | null {
  const auth = req.headers.get('authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  return token || null
}

export function apiKeyFrom(req: Request): string | null {
  const token = bearer(req)
  return token && isApiKey(token) ? token : null
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

export function anonClient() {
  const env = supabaseEnv()
  if (!env) return null
  return createSupabaseClient<Database>(env.url, env.key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/**
 * Cliente con la identidad del usuario (token de sesión o cookie) y el usuario
 * validado contra Supabase. null si no hay sesión válida.
 */
export async function sessionClient(req: Request) {
  const env = supabaseEnv()
  if (!env) return null
  const token = bearer(req)
  if (token && !isApiKey(token)) {
    const client = createSupabaseClient<Database>(env.url, env.key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data: { user } } = await client.auth.getUser(token)
    return user ? { client, user } : null
  }
  const client = await createCookieClient()
  const { data: { user } } = await client.auth.getUser()
  return user ? { client, user } : null
}

/** La RPC no existe todavía: la migración de la API pública no corrió. */
export function isMissingRpc(err: { code?: string; message?: string }): boolean {
  return err.code === 'PGRST202' || err.code === '42883' || /could not find the function/i.test(err.message ?? '')
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Un id que no es UUID no puede existir: 404 directo, sin consultar la base. */
export function isUuid(id: string): boolean {
  return UUID.test(id)
}

/** Columnas públicas de una operación: las mismas que devuelven las RPC de clave. */
export const API_OPERATION_COLUMNS = 'id, title, type, status, province_code, created_at, updated_at'
