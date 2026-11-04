import type { SellerTaskState } from '@/lib/supabase/sellerTasks'

export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFO'

export interface DocAlert {
  operationId: string
  operationTitle: string
  operationType: 'BUY' | 'SELL'
  taskKey: string
  taskTitle: string
  severity: AlertSeverity
  reason: 'OVERDUE' | 'DUE_SOON' | 'MISSING' | 'NO_DATE' | 'DOC_EXPIRED' | 'DOC_REJECTED' | 'DOC_PENDING'
  daysUntil?: number
  message: string
}

export type TrafficLight = 'GREEN' | 'YELLOW' | 'RED'

export interface OpDocStatus {
  operationId: string
  operationTitle: string
  operationType: 'BUY' | 'SELL'
  light: TrafficLight
  total: number
  done: number
  overdue: number
  dueSoon: number
  noDate: number
  /** Documentos vencidos o rechazados: hay que reemplazarlos. */
  docProblems: number
  alerts: DocAlert[]
}

/** Lo mínimo de un documento para alertar. */
export interface AlertDoc {
  id: string
  name: string
  status: 'PENDING' | 'RECEIVED' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED'
}

function daysFromToday(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dateStr + 'T00:00:00')
  return Math.round((due.getTime() - today.getTime()) / 86400000)
}

// Venta: docs, offer, escritura. Compra: financiamiento, docs, oferta, reserva, boleto, escritura.
const HIGH_PRIORITY_KEYS = new Set(['docs', 'offer', 'escritura', 'financiamiento', 'oferta', 'reserva', 'boleto'])

function docAlert(operationId: string, operationTitle: string, operationType: 'BUY' | 'SELL', doc: AlertDoc): DocAlert | null {
  const base = { operationId, operationTitle, operationType, taskKey: `doc:${doc.id}`, taskTitle: doc.name }
  if (doc.status === 'EXPIRED') return { ...base, severity: 'CRITICAL', reason: 'DOC_EXPIRED', message: 'Documento vencido: pedí uno actualizado' }
  if (doc.status === 'REJECTED') return { ...base, severity: 'HIGH', reason: 'DOC_REJECTED', message: 'Documento rechazado: hay que reemplazarlo' }
  if (doc.status === 'PENDING') return { ...base, severity: 'MEDIUM', reason: 'DOC_PENDING', message: 'Todavía no lo recibiste' }
  return null
}

function buildAlert(
  operationId: string,
  operationTitle: string,
  operationType: 'BUY' | 'SELL',
  task: SellerTaskState,
): DocAlert | null {
  if (task.done) return null

  if (task.dueDate) {
    const days = daysFromToday(task.dueDate)
    if (days < 0) {
      return {
        operationId,
        operationTitle,
        operationType,
        taskKey: task.key,
        taskTitle: task.title,
        severity: 'CRITICAL',
        reason: 'OVERDUE',
        daysUntil: days,
        message: `Vencida hace ${Math.abs(days)} día${Math.abs(days) !== 1 ? 's' : ''}`,
      }
    }
    if (days <= 3) {
      return {
        operationId,
        operationTitle,
        operationType,
        taskKey: task.key,
        taskTitle: task.title,
        severity: 'HIGH',
        reason: 'DUE_SOON',
        daysUntil: days,
        message: days === 0 ? 'Vence hoy' : days === 1 ? 'Vence mañana' : `Vence en ${days} días`,
      }
    }
    if (days <= 10) {
      return {
        operationId,
        operationTitle,
        operationType,
        taskKey: task.key,
        taskTitle: task.title,
        severity: 'MEDIUM',
        reason: 'DUE_SOON',
        daysUntil: days,
        message: `Vence en ${days} días`,
      }
    }
    return null
  }

  // Sin fecha: solo alerta si es tarea de alta prioridad
  if (HIGH_PRIORITY_KEYS.has(task.key)) {
    return {
      operationId,
      operationTitle,
      operationType,
      taskKey: task.key,
      taskTitle: task.title,
      severity: 'INFO',
      reason: 'NO_DATE',
      message: 'Sin fecha límite asignada',
    }
  }

  return null
}

function computeLight(alerts: DocAlert[]): TrafficLight {
  if (alerts.some(a => a.severity === 'CRITICAL')) return 'RED'
  if (alerts.some(a => a.severity === 'HIGH')) return 'YELLOW'
  return 'GREEN'
}

const SEVERITY_RANK: Record<AlertSeverity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, INFO: 3 }

export function buildOpDocStatus(
  operationId: string,
  operationTitle: string,
  operationType: 'BUY' | 'SELL',
  tasks: SellerTaskState[],
  docs: AlertDoc[] = [],
): OpDocStatus {
  const alerts: DocAlert[] = []
  let done = 0
  let overdue = 0
  let dueSoon = 0
  let noDate = 0
  let docProblems = 0

  for (const doc of docs) {
    const alert = docAlert(operationId, operationTitle, operationType, doc)
    if (!alert) continue
    alerts.push(alert)
    if (alert.reason === 'DOC_EXPIRED' || alert.reason === 'DOC_REJECTED') docProblems++
  }

  for (const task of tasks) {
    if (task.done) { done++; continue }
    const alert = buildAlert(operationId, operationTitle, operationType, task)
    if (alert) {
      alerts.push(alert)
      if (alert.reason === 'OVERDUE') overdue++
      else if (alert.reason === 'DUE_SOON') dueSoon++
      else if (alert.reason === 'NO_DATE') noDate++
    }
  }

  alerts.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])

  return {
    operationId,
    operationTitle,
    operationType,
    light: computeLight(alerts),
    total: tasks.length,
    done,
    overdue,
    dueSoon,
    noDate,
    docProblems,
    alerts,
  }
}

export function mergeAndRankAlerts(statuses: OpDocStatus[]): DocAlert[] {
  const all = statuses.flatMap(s => s.alerts)
  all.sort((a, b) => {
    const sr = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
    if (sr !== 0) return sr
    const da = a.daysUntil ?? 999
    const db = b.daysUntil ?? 999
    return da - db
  })
  return all
}
