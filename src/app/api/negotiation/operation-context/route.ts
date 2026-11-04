export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { log } from '@/lib/observability/logger'
import { buildOperationNegContext } from '@/lib/negotiation/operationContext'

/**
 * Contexto de una operación del usuario para precargar Negotiation Intelligence.
 * RLS limita todo a lo propio; el filtro por user_id en la operación es para
 * responder 404 en vez de un contexto vacío.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const operationId = searchParams.get('operationId')
  if (!operationId) return NextResponse.json({ error: 'missing_operation_id' }, { status: 400 })

  let supabase: Awaited<ReturnType<typeof createClient>>
  try { supabase = await createClient() } catch { return NextResponse.json({ error: 'not_configured' }, { status: 503 }) }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    const { data: op } = await supabase
      .from('operations')
      .select('id, type, title, province')
      .eq('id', operationId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!op) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    const [offers, tasks, docs] = await Promise.all([
      supabase.from('offers').select('amount, currency, party, status, created_at')
        .eq('operation_id', operationId).order('created_at', { ascending: false }).limit(6),
      supabase.from('operation_tasks').select('title, status, due_date')
        .eq('operation_id', operationId).order('due_date', { ascending: true, nullsFirst: false }).limit(20),
      supabase.from('operation_documents').select('name, status')
        .eq('operation_id', operationId).limit(50),
    ])

    const context = buildOperationNegContext(op, offers.data ?? [], tasks.data ?? [], docs.data ?? [])
    log.info('negotiation.operation_context.ok', { operationId })
    return NextResponse.json({ context })
  } catch (err) {
    log.error('negotiation.operation_context.failed', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
