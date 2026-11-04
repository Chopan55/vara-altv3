export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { isEnabled } from '@/lib/flags'
import { anonClient, apiKeyFrom, hashApiKey, isMissingRpc } from '@/lib/api/v1Auth'

/**
 * GET /api/v1/operations
 *
 * Devuelve las operaciones del usuario autenticado.
 * Autenticación: clave de API (Authorization: Bearer vara_live_…) o sesión de Supabase.
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

  // Con clave de API: la base valida la clave y devuelve solo lo del dueño.
  const apiKey = apiKeyFrom(req)
  if (apiKey) {
    const client = anonClient()
    if (!client) return NextResponse.json({ error: 'internal' }, { status: 500 })
    const { data, error } = await client.rpc('api_list_operations', { p_key_hash: hashApiKey(apiKey) })
    if (error) return NextResponse.json({ error: isMissingRpc(error) ? 'not_ready' : 'internal' }, { status: isMissingRpc(error) ? 503 : 500 })
    if (!data) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    return NextResponse.json({ data })
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
