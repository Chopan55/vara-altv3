import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { isEnabled } from '@/lib/flags'

/**
 * GET /api/v1/operations/:id
 *
 * Devuelve el detalle de una operación. Solo accesible por el dueño.
 *
 * Respuestas:
 *   200 { data: Operation }
 *   401 { error: 'unauthenticated' }
 *   403 { error: 'disabled' | 'forbidden' }
 *   404 { error: 'not_found' }
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isEnabled('publicApi')) {
    return NextResponse.json({ error: 'disabled' }, { status: 403 })
  }

  const { id } = await params

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  )

  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) {
    await supabase.auth.setSession({ access_token: auth.slice(7), refresh_token: '' })
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { data, error } = await supabase
    .from('operations')
    .select('id, title, type, status, province_code, property_value_usd, created_at, updated_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'internal' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  return NextResponse.json({ data })
}
