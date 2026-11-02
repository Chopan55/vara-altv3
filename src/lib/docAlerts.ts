import type { SellerTaskState } from '@/lib/supabase/sellerTasks'

export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFO'

export interface DocAlert {
  operationId: string
  operationTitle: string
  operationType: 'BUY' | 'SELL'
  taskKey: string
  taskTitle: string
  severity: AlertSeverity
  reason: 'OVERDUE' | 'DUE_SOON' | 'MISSING' | 'NO_DATE'
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
  alerts: DocAlert[]
}

function daysFromToday(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dateStr + 'T00:00:00')
  return Math.round((due.getTime() - today.getTime()) / 86400000)
}

const HIGH_PRIORITY_KEYS = new Set(['docs', 'offer', 'escritura'])

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
): OpDocStatus {
  const alerts: DocAlert[] = []
  let done = 0
  let overdue = 0
  let dueSoon = 0
  let noDate = 0

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
