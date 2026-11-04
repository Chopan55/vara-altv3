export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { isEnabled } from '@/lib/flags'
import { API_OPERATION_COLUMNS, anonClient, apiKeyFrom, hashApiKey, isMissingRpc, sessionClient } from '@/lib/api/v1Auth'

/**
 * GET /api/v1/operations — operaciones del dueño de la clave o de la sesión.
 * Documentación: /vara-pro/api
 *
 *   200 { data: Operation[] }
 *   401 { error: 'unauthenticated' }
 *   403 { error: 'disabled' }    flag publicApi apagado
 *   503 { error: 'not_ready' }   falta la migración de la API pública
 */
export async function GET(req: Request) {
  if (!isEnabled('publicApi')) return NextResponse.json({ error: 'disabled' }, { status: 403 })

  const apiKey = apiKeyFrom(req)
  if (apiKey) {
    const client = anonClient()
    if (!client) return NextResponse.json({ error: 'internal' }, { status: 500 })
    const { data, error } = await client.rpc('api_list_operations', { p_key_hash: hashApiKey(apiKey) })
    if (error) return NextResponse.json({ error: isMissingRpc(error) ? 'not_ready' : 'internal' }, { status: isMissingRpc(error) ? 503 : 500 })
    if (!data) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    return NextResponse.json({ data })
  }

  const session = await sessionClient(req).catch(() => null)
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  const { data, error } = await session.client
    .from('operations')
    .select(API_OPERATION_COLUMNS)
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'internal' }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}
