export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { log } from '@/lib/observability/logger'

export interface OperationNegContext {
  operationId: string
  operationTitle: string
  journeyType: string
  province: string
  offerSummary: string
  offerHistory: string
  pendingDocsSummary: string
  pendingTasksSummary: string
  closingDate: string | null
  rawForPrompt: string
}

function formatOffer(o: {
  amount?: number | null
  currency?: string | null
  proposed_by?: string | null
  status?: string | null
  created_at?: string
}) {
  const who = o.proposed_by === 'buyer' ? 'Comprador' : o.proposed_by === 'seller' ? 'Vendedor' : 'Parte'
  const amt = o.amount ? `${o.currency ?? 'USD'} ${o.amount.toLocaleString('es-AR')}` : 'sin monto'
  const date = o.created_at
    ? new Date(o.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
    : ''
  return `${who}: ${amt}${date ? ` (${date})` : ''}${o.status ? ` [${o.status}]` : ''}`
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const operationId = searchParams.get('operationId')
  if (!operationId) return NextResponse.json({ error: 'missing_operation_id' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    const { data: op } = await supabase
      .from('operations')
      .select('*')
      .eq('id', operationId)
      .eq('user_id', user.id)
      .single()

    if (!op) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    const { data: offers } = await supabase
      .from('operation_offers')
      .select('*')
      .eq('operation_id', operationId)
      .order('created_at', { ascending: false })
      .limit(6)

    const { data: tasks } = await supabase
      .from('operation_tasks')
      .select('title, status, due_date')
      .eq('operation_id', operationId)
      .neq('status', 'done')
      .order('due_date', { ascending: true })
      .limit(8)

    const { data: docs } = await supabase
      .from('operation_documents')
      .select('name, status')
      .eq('operation_id', operationId)
      .limit(20)

    const journeyLabel = op.journey_type === 'BUY_PROPERTY' ? 'Comprador' : 'Vendedor'

    const offerList = [...(offers ?? [])].reverse()
    const offerHistory = offerList.length
      ? offerList.map(formatOffer).join(' → ')
      : 'Sin ofertas registradas'

    const lastOffer = (offers ?? [])[0]
    const offerSummary = lastOffer ? `Última: ${formatOffer(lastOffer)}` : 'Sin ofertas registradas'

    const missingDocs = (docs ?? []).filter((d: { status: string }) => d.status !== 'uploaded' && d.status !== 'approved')
    const pendingDocsSummary = missingDocs.length
      ? missingDocs.map((d: { name: string }) => d.name).join(', ')
      : 'Documentación completa'

    const pendingTasks = (tasks ?? [])
    const pendingTasksSummary = pendingTasks.length
      ? pendingTasks.slice(0, 4).map((t: { title: string }) => t.title).join(', ')
      : 'Sin tareas pendientes'

    const closingDate = op.closing_date ?? op.desired_closing_date ?? null

    const operationTitle = op.property_address
      ? `${journeyLabel} · ${op.property_address}`
      : `Operación ${journeyLabel}`

    const rawForPrompt = [
      `CONTEXTO DE LA OPERACIÓN VARA:`,
      `Rol: ${journeyLabel}`,
      `Provincia: ${op.province ?? 'no especificada'}`,
      op.property_address ? `Propiedad: ${op.property_address}` : null,
      `Historial de ofertas: ${offerHistory}`,
      `Última oferta: ${offerSummary}`,
      closingDate ? `Fecha de cierre deseada: ${closingDate}` : null,
      missingDocs.length ? `Documentos pendientes: ${pendingDocsSummary}` : null,
      pendingTasks.length ? `Tareas pendientes: ${pendingTasksSummary}` : null,
    ].filter(Boolean).join('\n')

    const result: OperationNegContext = {
      operationId,
      operationTitle,
      journeyType: journeyLabel,
      province: op.province ?? '',
      offerSummary,
      offerHistory,
      pendingDocsSummary,
      pendingTasksSummary,
      closingDate,
      rawForPrompt,
    }

    log.info('negotiation.operation_context.ok', { operationId })
    return NextResponse.json({ context: result })
  } catch (err) {
    log.error('negotiation.operation_context.failed', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
