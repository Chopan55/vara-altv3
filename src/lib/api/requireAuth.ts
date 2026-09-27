import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export interface AuthResult {
  userId: string
  error?: never
}

export interface AuthError {
  userId?: never
  error: NextResponse
}

/**
 * Verifica sesión en un Route Handler. Devuelve userId o una respuesta 401.
 * Usar antes de cualquier llamada a proveedores externos o acceso a datos.
 *
 * Uso:
 *   const auth = await requireAuth()
 *   if (auth.error) return auth.error
 *   const { userId } = auth
 */
export async function requireAuth(): Promise<AuthResult | AuthError> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !anonKey) {
    return {
      error: NextResponse.json({ error: 'Servicio no configurado.' }, { status: 503 }),
    }
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    },
  })

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      error: NextResponse.json({ error: 'No autorizado.' }, { status: 401 }),
    }
  }

  return { userId: user.id }
}
