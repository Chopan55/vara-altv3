import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

/**
 * Cliente de Supabase para server components y route handlers.
 * Lee y refresca la sesión desde las cookies.
 */

/** Supabase renombró la clave pública a PUBLISHABLE_KEY; aceptamos ambos nombres. */
function publicKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
}

export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && publicKey()
)

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = publicKey()
  if (!url || !anonKey) {
    throw new Error('Supabase no está configurado en el servidor.')
  }

  const cookieStore = await cookies()

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(toSet) {
        try {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Los server components no pueden escribir cookies; el middleware refresca la sesión.
        }
      },
    },
  })
}

/** El usuario autenticado, o null. En el servidor usar siempre getUser(), nunca getSession(). */
export async function getCurrentUser() {
  if (!isSupabaseConfigured) return null
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getUser()
    return error ? null : data.user
  } catch {
    return null
  }
}
