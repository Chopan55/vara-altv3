import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { isAiAllowed } from '@/lib/analysis/aiAccess'

/**
 * Quién está usando la IA, decidido SIEMPRE en el servidor: sesión real de Supabase
 * + email en AI_ALLOWED_EMAILS. Nunca se confía en lo que diga el cliente.
 * Lo comparten el chat (`/api/v3/explain`) y la voz (`/api/v3/speak`).
 */

async function sessionEmail(): Promise<{ id: string; email: string } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return null
  try {
    const store = await cookies()
    const supabase = createServerClient(url, key, { cookies: { getAll: () => store.getAll(), setAll: () => {} } })
    const { data: { user } } = await supabase.auth.getUser()
    return user?.email ? { id: user.id, email: user.email } : null
  } catch {
    return null
  }
}

export async function allowedUser(): Promise<{ id: string; email: string } | null> {
  if (!process.env.OPENAI_API_KEY) return null
  const user = await sessionEmail()
  return user && isAiAllowed(user.email, process.env.AI_ALLOWED_EMAILS) ? user : null
}
