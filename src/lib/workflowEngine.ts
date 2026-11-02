/**
 * VARA Workflow Engine — lf-015
 *
 * Motor de reglas basado en eventos para operaciones inmobiliarias.
 * Las reglas se evalúan del lado del cliente contra el estado actual de la operación.
 * En el futuro, las reglas se guardarán en Supabase y el engine se ejecutará en el servidor.
 */

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
  timestamp: Date
}

export interface WorkflowResult {
  ruleId: string
  ruleName: string
  action: WorkflowAction
  message: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
}

/** Reglas built-in de VARA para el mercado argentino */
export const BUILT_IN_RULES: WorkflowRule[] = [
  // ── DOCUMENTACIÓN ──
  {
    id: 'wr-001',
    name: 'Alerta de documentos vencidos',
    description: 'Cuando una tarea de documentación vence, VARA genera una alerta inmediata y sugiere el próximo paso.',
    trigger: 'TASK_OVERDUE',
    triggerConfig: { taskKeys: ['docs', 'escritura', 'offer'] },
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
    triggerConfig: { taskKeys: ['docs', 'offer', 'escritura'], daysThreshold: 3 },
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
    description: 'Cuando se sube un documento de inhibición, VARA crea automáticamente una tarea de revisión legal.',
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
    description: 'Cuando la tarea de oferta/reserva está completa, VARA crea automáticamente la lista de tareas de escrituración.',
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
    description: '3 días antes de la escritura, VARA genera un checklist de verificación final.',
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

    const { taskKeys } = rule.triggerConfig
    if (taskKeys && taskKeys.length > 0 && event.taskKey) {
      if (!taskKeys.includes(event.taskKey)) continue
    }

    results.push({
      ruleId: rule.id,
      ruleName: rule.name,
      action: rule.action,
      message: rule.actionConfig.message ?? rule.name,
      priority: rule.actionConfig.priority ?? 'MEDIUM',
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
