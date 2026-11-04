export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { isEnabled } from '@/lib/flags'
import { API_OPERATION_COLUMNS, anonClient, apiKeyFrom, hashApiKey, isMissingRpc, isUuid, sessionClient } from '@/lib/api/v1Auth'

/**
 * GET /api/v1/operations/:id — una operación, solo para su dueño.
 * Documentación: /vara-pro/api
 *
 *   200 { data: Operation }
 *   401 { error: 'unauthenticated' }
 *   403 { error: 'disabled' }
 *   404 { error: 'not_found' }   no existe o no es tuya (no se distingue)
 *   503 { error: 'not_ready' }
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isEnabled('publicApi')) return NextResponse.json({ error: 'disabled' }, { status: 403 })
  const { id } = await params

  const apiKey = apiKeyFrom(req)
  if (apiKey) {
    const client = anonClient()
    if (!client) return NextResponse.json({ error: 'internal' }, { status: 500 })
    // Aun con un id inválido se valida la clave primero: una clave mala siempre es 401.
    const { data, error } = await client.rpc('api_get_operation', {
      p_key_hash: hashApiKey(apiKey),
      p_operation_id: isUuid(id) ? id : '00000000-0000-0000-0000-000000000000',
    })
    if (error) return NextResponse.json({ error: isMissingRpc(error) ? 'not_ready' : 'internal' }, { status: isMissingRpc(error) ? 503 : 500 })
    if (data && 'error' in data) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json({ data })
  }

  const session = await sessionClient(req).catch(() => null)
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  if (!isUuid(id)) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const { data, error } = await session.client
    .from('operations')
    .select(API_OPERATION_COLUMNS)
    .eq('id', id)
    .eq('user_id', session.user.id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'internal' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ data })
}
