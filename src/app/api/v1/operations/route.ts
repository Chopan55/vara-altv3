export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { isEnabled } from '@/lib/flags'

/**
 * GET /api/v1/operations
 *
 * Devuelve las operaciones del usuario autenticado.
 * Requiere sesión Supabase (cookie o Authorization: Bearer <token>).
 *
 * Respuestas:
 *   200 { data: Operation[] }
 *   401 { error: 'unauthenticated' }
 *   403 { error: 'disabled' }          — flag publicApi apagado
 */
export async function GET(req: Request) {
  if (!isEnabled('publicApi')) {
    return NextResponse.json({ error: 'disabled' }, { status: 403 })
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  )

  // Soporte Bearer token además de cookie (para llamadas server-to-server)
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) {
    await supabase.auth.setSession({ access_token: auth.slice(7), refresh_token: '' })
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { data, error } = await supabase
    .from('operations')
    .select('id, title, type, status, province_code, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'internal' }, { status: 500 })

  return NextResponse.json({ data: data ?? [] })
}
