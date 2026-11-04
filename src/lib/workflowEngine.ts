/**
 * VARA Workflow Engine — lf-015
 *
 * Motor de reglas basado en eventos para operaciones inmobiliarias.
 *
 * `deriveEvents` lee el estado real de una operación (tareas, documentos, ofertas,
 * última actividad) y `runWorkflows` evalúa las reglas activas contra esos eventos.
 * Se ejecuta cuando el usuario abre VARA: las acciones son avisos y sugerencias en
 * la app. No manda mails ni crea tareas solo: eso necesitaría un servidor programado.
 */

import type { AlertDoc } from '@/lib/docAlerts'

export type WorkflowTrigger =
  | 'TASK_OVERDUE'
  | 'TASK_DUE_SOON'
  | 'TASK_COMPLETED'
  | 'DOCUMENT_UPLOADED'
  | 'ALL_DOCS_COMPLETE'
  | 'OFFER_RECEIVED'
  | 'OPERATION_STALLED'

export type WorkflowAction =
  | 'CREATE_FOLLOW_UP_TASK'
  | 'SEND_ALERT'
  | 'SUGGEST_NEXT_STEP'
  | 'NOTIFY_PARTY'
  | 'ESCALATE'

export type OperationType = 'SELL' | 'BUY' | 'BOTH'

export interface WorkflowRule {
  id: string
  name: string
  description: string
  trigger: WorkflowTrigger
  triggerConfig: {
    taskKeys?: string[]      // tareas específicas a monitorear
    daysThreshold?: number   // para DUE_SOON
    stallDays?: number       // días sin actividad para STALLED
  }
  action: WorkflowAction
  actionConfig: {
    message?: string
    nextTaskKey?: string
    priority?: 'HIGH' | 'MEDIUM' | 'LOW'
  }
  operationType: OperationType
  category: 'documentacion' | 'negociacion' | 'escritura' | 'general'
  enabled: boolean
}

export interface WorkflowEvent {
  type: WorkflowTrigger
  operationId: string
  taskKey?: string
  documentCategory?: string
  /** TASK_DUE_SOON: días que faltan. Se compara con `daysThreshold` de la regla. */
  daysUntil?: number
  /** OPERATION_STALLED: días sin actividad. Se compara con `stallDays`. */
  idleDays?: number
  timestamp: Date
}

export interface WorkflowResult {
  ruleId: string
  ruleName: string
  action: WorkflowAction
  message: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  operationId?: string
  taskKey?: string
}

/** Reglas built-in de VARA para el mercado argentino */
export const BUILT_IN_RULES: WorkflowRule[] = [
  // ── DOCUMENTACIÓN ──
  {
    id: 'wr-001',
    name: 'Alerta de documentos vencidos',
    description: 'Cuando una tarea de documentación vence, VARA genera una alerta inmediata y sugiere el próximo paso.',
    trigger: 'TASK_OVERDUE',
    triggerConfig: { taskKeys: ['docs', 'escritura', 'offer', 'financiamiento', 'oferta', 'reserva', 'boleto'] },
    action: 'SEND_ALERT',
    actionConfig: { message: 'Revisá esta tarea urgente', priority: 'HIGH' },
    operationType: 'BOTH',
    category: 'documentacion',
    enabled: true,
  },
  {
    id: 'wr-002',
    name: 'Recordatorio 3 días antes',
    description: 'VARA te avisa 3 días antes de que venza cualquier tarea crítica (docs, oferta, escritura).',
    trigger: 'TASK_DUE_SOON',
    triggerConfig: { taskKeys: ['docs', 'offer', 'escritura', 'financiamiento', 'oferta', 'reserva', 'boleto'], daysThreshold: 3 },
    action: 'SEND_ALERT',
    actionConfig: { message: 'Tarea próxima a vencer', priority: 'MEDIUM' },
    operationType: 'BOTH',
    category: 'documentacion',
    enabled: true,
  },
  {
    id: 'wr-003',
    name: 'Documentación completa → Siguiente fase',
    description: 'Cuando todos los documentos de la operación están completos, VARA sugiere avanzar a la etapa de oferta.',
    trigger: 'ALL_DOCS_COMPLETE',
    triggerConfig: {},
    action: 'SUGGEST_NEXT_STEP',
    actionConfig: { nextTaskKey: 'offer', message: 'Documentación completa. ¡Hora de publicar!', priority: 'HIGH' },
    operationType: 'SELL',
    category: 'documentacion',
    enabled: true,
  },
  {
    id: 'wr-004',
    name: 'Inhibición cargada → Tarea de revisión legal',
    description: 'Cuando se sube un documento de inhibición, VARA te sugiere revisarlo con un profesional.',
    trigger: 'DOCUMENT_UPLOADED',
    triggerConfig: {},
    action: 'CREATE_FOLLOW_UP_TASK',
    actionConfig: { nextTaskKey: 'docs', message: 'Revisá la inhibición con un profesional', priority: 'HIGH' },
    operationType: 'BOTH',
    category: 'documentacion',
    enabled: false,
  },

  // ── NEGOCIACIÓN ──
  {
    id: 'wr-005',
    name: 'Oferta recibida → Coach activado',
    description: 'Al recibir una oferta, VARA te muestra el coach de negociación con el análisis inmediato.',
    trigger: 'OFFER_RECEIVED',
    triggerConfig: {},
    action: 'SUGGEST_NEXT_STEP',
    actionConfig: { message: 'Oferta recibida. Analizá la estrategia antes de responder.', priority: 'HIGH' },
    operationType: 'SELL',
    category: 'negociacion',
    enabled: true,
  },
  {
    id: 'wr-006',
    name: 'Operación sin actividad → Recordatorio',
    description: 'Si no hay actividad en 7 días, VARA te pregunta si la operación sigue activa.',
    trigger: 'OPERATION_STALLED',
    triggerConfig: { stallDays: 7 },
    action: 'SEND_ALERT',
    actionConfig: { message: '¿Qué pasó con esta operación? Sin actividad en 7 días.', priority: 'MEDIUM' },
    operationType: 'BOTH',
    category: 'general',
    enabled: true,
  },

  // ── ESCRITURACIÓN ──
  {
    id: 'wr-007',
    name: 'Reserva aceptada → Lista escritura',
    description: 'Cuando la tarea de oferta/reserva está completa, VARA te sugiere arrancar con la escrituración.',
    trigger: 'TASK_COMPLETED',
    triggerConfig: { taskKeys: ['offer'] },
    action: 'CREATE_FOLLOW_UP_TASK',
    actionConfig: { nextTaskKey: 'escritura', message: 'Reserva aceptada. Iniciá el proceso de escrituración.', priority: 'HIGH' },
    operationType: 'SELL',
    category: 'escritura',
    enabled: true,
  },
  {
    id: 'wr-008',
    name: 'Escritura próxima → Checklist final',
    description: '3 días antes de la escritura, VARA te recuerda revisar el checklist final.',
    trigger: 'TASK_DUE_SOON',
    triggerConfig: { taskKeys: ['escritura'], daysThreshold: 3 },
    action: 'SUGGEST_NEXT_STEP',
    actionConfig: { message: 'Faltan 3 días para la escritura. Revisá el checklist final.', priority: 'HIGH' },
    operationType: 'BOTH',
    category: 'escritura',
    enabled: true,
  },
]

/** Evalúa un evento contra las reglas activas y retorna las acciones a ejecutar */
export function evaluateEvent(
  event: WorkflowEvent,
  rules: WorkflowRule[],
  operationType: 'BUY' | 'SELL',
): WorkflowResult[] {
  const results: WorkflowResult[] = []

  for (const rule of rules) {
    if (!rule.enabled) continue
    if (rule.operationType !== 'BOTH' && rule.operationType !== operationType) continue
    if (rule.trigger !== event.type) continue

    const { taskKeys, daysThreshold, stallDays } = rule.triggerConfig
    if (taskKeys && taskKeys.length > 0 && event.taskKey) {
      if (!taskKeys.includes(event.taskKey)) continue
    }
    if (daysThreshold !== undefined && event.daysUntil !== undefined && event.daysUntil > daysThreshold) continue
    if (stallDays !== undefined && (event.idleDays ?? 0) < stallDays) continue

    results.push({
      ruleId: rule.id,
      ruleName: rule.name,
      action: rule.action,
      message: rule.actionConfig.message ?? rule.name,
      priority: rule.actionConfig.priority ?? 'MEDIUM',
      operationId: event.operationId,
      taskKey: event.taskKey,
    })
  }

  return results
}

/** Categorías para agrupar en la UI */
export const CATEGORY_LABELS: Record<WorkflowRule['category'], string> = {
  documentacion: 'Documentación',
  negociacion: 'Negociación',
  escritura: 'Escrituración',
  general: 'General',
}

export const TRIGGER_LABELS: Record<WorkflowTrigger, string> = {
  TASK_OVERDUE: 'Tarea vencida',
  TASK_DUE_SOON: 'Tarea por vencer',
  TASK_COMPLETED: 'Tarea completada',
  DOCUMENT_UPLOADED: 'Documento subido',
  ALL_DOCS_COMPLETE: 'Documentación completa',
  OFFER_RECEIVED: 'Oferta recibida',
  OPERATION_STALLED: 'Operación sin actividad',
}

export const ACTION_LABELS: Record<WorkflowAction, string> = {
  CREATE_FOLLOW_UP_TASK: 'Crear tarea de seguimiento',
  SEND_ALERT: 'Enviar alerta',
  SUGGEST_NEXT_STEP: 'Sugerir próximo paso',
  NOTIFY_PARTY: 'Notificar a la contraparte',
  ESCALATE: 'Escalar',
}

// ─────────────────────── Ejecución contra el estado real ───────────────────────

export interface WorkflowSnapshot {
  operationId: string
  type: 'BUY' | 'SELL'
  tasks: { key: string; done: boolean; dueDate?: string }[]
  docs: AlertDoc[]
  offers: { party: 'BUYER' | 'SELLER'; status: string }[]
  /** Última actividad registrada (ms). Sin dato no se considera estancada. */
  lastActivityAt?: number
}

const DAY = 86_400_000

function daysBetween(from: number, isoDay: string): number {
  const today = new Date(from)
  today.setHours(0, 0, 0, 0)
  return Math.round((new Date(isoDay + 'T00:00:00').getTime() - today.getTime()) / DAY)
}

/** Traduce el estado de una operación a los eventos que las reglas entienden. */
export function deriveEvents(s: WorkflowSnapshot, now: number = Date.now()): WorkflowEvent[] {
  const ts = new Date(now)
  const ev: WorkflowEvent[] = []
  for (const t of s.tasks) {
    if (t.done) {
      ev.push({ type: 'TASK_COMPLETED', operationId: s.operationId, taskKey: t.key, timestamp: ts })
    } else if (t.dueDate) {
      const days = daysBetween(now, t.dueDate)
      ev.push(days < 0
        ? { type: 'TASK_OVERDUE', operationId: s.operationId, taskKey: t.key, timestamp: ts }
        : { type: 'TASK_DUE_SOON', operationId: s.operationId, taskKey: t.key, daysUntil: days, timestamp: ts })
    }
  }
  if (s.docs.length > 0 && s.docs.every(d => d.status === 'RECEIVED' || d.status === 'APPROVED')) {
    ev.push({ type: 'ALL_DOCS_COMPLETE', operationId: s.operationId, timestamp: ts })
  }
  // Oferta de la contraparte esperando respuesta.
  const counterparty = s.type === 'SELL' ? 'BUYER' : 'SELLER'
  if (s.offers.some(o => o.party === counterparty && (o.status === 'SENT' || o.status === 'COUNTERED'))) {
    ev.push({ type: 'OFFER_RECEIVED', operationId: s.operationId, timestamp: ts })
  }
  if (s.lastActivityAt !== undefined) {
    ev.push({ type: 'OPERATION_STALLED', operationId: s.operationId, idleDays: Math.floor((now - s.lastActivityAt) / DAY), timestamp: ts })
  }
  return ev
}

/**
 * Corre las reglas activas contra una operación. Una sugerencia cuyo próximo paso
 * ya está hecho no se muestra: "iniciá la escrituración" no sirve si ya se escrituró.
 */
export function runWorkflows(s: WorkflowSnapshot, rules: WorkflowRule[], now: number = Date.now()): WorkflowResult[] {
  const done = new Set(s.tasks.filter(t => t.done).map(t => t.key))
  const seen = new Set<string>()
  const out: WorkflowResult[] = []
  for (const event of deriveEvents(s, now)) {
    for (const r of evaluateEvent(event, rules, s.type)) {
      const rule = rules.find(x => x.id === r.ruleId)
      const next = rule?.actionConfig.nextTaskKey
      if (next && done.has(next)) continue
      // TASK_COMPLETED sin tareas configuradas no aplica: dispararía por cada tarea hecha.
      if (event.type === 'TASK_COMPLETED' && !rule?.triggerConfig.taskKeys?.length) continue
      const key = `${r.ruleId}:${r.taskKey ?? ''}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(r)
    }
  }
  const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 }
  return out.sort((a, b) => rank[a.priority] - rank[b.priority])
}
