import { generateChecklist } from '@/lib/regulations'
import type { ProvinceCode } from '@/data/regulations/types'
import type {
  Transaction, TransactionStage, Task, TaskStatus, OperationType, Document,
} from '@/types'
import type { StoredOperation } from '@/lib/userOperations'

/**
 * Convierte una operación real del usuario en la estructura que ya sabe dibujar la app.
 * Las etapas y tareas salen del motor regulatorio — los pasos lógicos de una compraventa
 * argentina — así que una operación nueva nace con su guía completa en vez de vacía.
 */

const TASK_STATE_PREFIX = 'vara_op_tasks_'

type TaskStateMap = Record<string, TaskStatus>

export function readTaskState(operationId: string): TaskStateMap {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(TASK_STATE_PREFIX + operationId)
    return raw ? (JSON.parse(raw) as TaskStateMap) : {}
  } catch { return {} }
}

export function setTaskState(operationId: string, taskId: string, status: TaskStatus): void {
  try {
    const cur = readTaskState(operationId)
    cur[taskId] = status
    localStorage.setItem(TASK_STATE_PREFIX + operationId, JSON.stringify(cur))
  } catch {}
}

export function clearTaskState(operationId: string): void {
  try { localStorage.removeItem(TASK_STATE_PREFIX + operationId) } catch {}
}

export function buildTransaction(op: StoredOperation, propertyPrice = 0): Transaction {
  const opType: OperationType = op.type === 'SELL' ? 'SELL_PROPERTY' : 'BUY_PROPERTY'
  const checklist = generateChecklist(op.provinceCode as ProvinceCode, opType, propertyPrice)
  const state = readTaskState(op.id)

  const stages: TransactionStage[] = checklist.stages.map((st, i) => {
    const stageId = `stage-${st.order}`
    const tasks: Task[] = st.tasks.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      why: t.description,
      status: state[t.id] ?? 'TODO',
      priority: 'MEDIUM',
      responsibleRole: t.responsibleParty,
      documentsRequired: t.documents ?? [],
      warnings: t.warnings,
      stageId,
    }))

    const done = tasks.filter(t => t.status === 'DONE').length
    const status: TransactionStage['status'] =
      done === tasks.length && tasks.length > 0 ? 'COMPLETED'
      : done > 0 ? 'CURRENT'
      : i === 0 ? 'CURRENT' : 'UPCOMING'

    return {
      id: stageId,
      key: `s${st.order}`,
      label: st.name,
      description: st.durationDays ? `Duración típica: ${st.durationDays}` : '',
      order: st.order,
      status,
      tasks,
    }
  })

  const allTasks = stages.flatMap(s => s.tasks)
  const doneCount = allTasks.filter(t => t.status === 'DONE').length
  const progress = allTasks.length ? Math.round((doneCount / allTasks.length) * 100) : 0
  const current = stages.find(s => s.status === 'CURRENT') ?? stages[0]

  // Los documentos salen de lo que piden las tareas: nada inventado.
  const seen = new Set<string>()
  const documents: Document[] = allTasks
    .flatMap(t => t.documentsRequired)
    .filter(name => (seen.has(name) ? false : (seen.add(name), true)))
    .map((name, i) => ({
      id: `doc-${i}`,
      name,
      category: 'OTROS' as const,
      status: 'PENDING' as const,
      transactionId: op.id,
      version: 1,
    }))

  return {
    id: op.id,
    type: opType,
    title: op.title,
    subtitle: [op.city, op.province].filter(Boolean).join(', '),
    userId: 'local',
    propertyId: op.propertyId,
    stages,
    currentStageId: current?.id ?? '',
    progress,
    province: op.province,
    provinceCode: op.provinceCode,
    city: op.city,
    participants: [],
    documents,
    costs: [],
    timeline: [],
    risks: [],
    createdAt: new Date(op.createdAt).toISOString(),
    updatedAt: new Date().toISOString(),
  }
}
