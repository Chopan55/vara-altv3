import type { OfferRow, OperationRow, OperationTaskRow, OperationDocumentRow } from '@/lib/supabase/types'

/**
 * Contexto de una operación para Negotiation Intelligence.
 * Se arma solo con datos reales de la operación: ofertas, tareas y documentos.
 * Nunca incluye el precio de retiro (walk-away): ese dato no vive en la operación.
 */
export interface OperationNegContext {
  operationId: string
  operationTitle: string
  journeyType: string
  province: string
  offerSummary: string
  offerHistory: string
  pendingDocsSummary: string
  pendingTasksSummary: string
  /** La operación no guarda fecha de cierre: siempre null hasta que exista ese dato. */
  closingDate: string | null
  rawForPrompt: string
}

export type ContextOffer = Pick<OfferRow, 'amount' | 'currency' | 'party' | 'status' | 'created_at'>
export type ContextTask = Pick<OperationTaskRow, 'title' | 'status' | 'due_date'>
export type ContextDoc = Pick<OperationDocumentRow, 'name' | 'status'>
export type ContextOperation = Pick<OperationRow, 'id' | 'type' | 'title' | 'province'>

export const NO_OFFERS = 'Sin ofertas registradas'

/** Documentos que todavía faltan: ni recibidos, ni en revisión, ni aprobados. */
const MISSING_DOC: ReadonlySet<ContextDoc['status']> = new Set(['PENDING', 'REJECTED', 'EXPIRED'])
const OPEN_TASK: ReadonlySet<ContextTask['status']> = new Set(['TODO', 'IN_PROGRESS', 'BLOCKED'])

const OFFER_STATUS: Record<ContextOffer['status'], string> = {
  DRAFT: 'borrador', SENT: 'enviada', COUNTERED: 'contraofertada', ACCEPTED: 'aceptada',
  REJECTED: 'rechazada', WITHDRAWN: 'retirada', EXPIRED: 'vencida',
}

export function formatOffer(o: ContextOffer): string {
  const who = o.party === 'BUYER' ? 'Comprador' : 'Vendedor'
  const amt = o.amount > 0 ? `${o.currency || 'USD'} ${o.amount.toLocaleString('es-AR')}` : 'sin monto'
  const date = new Date(o.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', timeZone: 'UTC' })
  return `${who}: ${amt} (${date}) [${OFFER_STATUS[o.status]}]`
}

/**
 * Arma el contexto. `offers` llega de la más nueva a la más vieja; el historial
 * se muestra en orden cronológico.
 */
export function buildOperationNegContext(
  op: ContextOperation,
  offers: ContextOffer[],
  tasks: ContextTask[],
  docs: ContextDoc[],
): OperationNegContext {
  const journeyLabel = op.type === 'SELL_PROPERTY' ? 'Vendedor' : 'Comprador'

  const offerHistory = offers.length ? [...offers].reverse().map(formatOffer).join(' → ') : NO_OFFERS
  const offerSummary = offers.length ? `Última: ${formatOffer(offers[0])}` : NO_OFFERS

  const missingDocs = docs.filter(d => MISSING_DOC.has(d.status))
  const pendingDocsSummary = missingDocs.length ? missingDocs.map(d => d.name).join(', ') : 'Documentación completa'

  const pendingTasks = tasks.filter(t => OPEN_TASK.has(t.status))
  const pendingTasksSummary = pendingTasks.length
    ? pendingTasks.slice(0, 4).map(t => t.title).join(', ')
    : 'Sin tareas pendientes'

  const operationTitle = `${journeyLabel} · ${op.title}`

  const rawForPrompt = [
    'CONTEXTO DE LA OPERACIÓN VARA:',
    `Rol: ${journeyLabel}`,
    `Provincia: ${op.province || 'no especificada'}`,
    `Operación: ${op.title}`,
    `Historial de ofertas: ${offerHistory}`,
    `Última oferta: ${offerSummary}`,
    missingDocs.length ? `Documentos pendientes: ${pendingDocsSummary}` : null,
    pendingTasks.length ? `Tareas pendientes: ${pendingTasksSummary}` : null,
  ].filter(Boolean).join('\n')

  return {
    operationId: op.id,
    operationTitle,
    journeyType: journeyLabel,
    province: op.province ?? '',
    offerSummary,
    offerHistory,
    pendingDocsSummary,
    pendingTasksSummary,
    closingDate: null,
    rawForPrompt,
  }
}
