/**
 * Señales de producto.
 *
 * Los eventos describen qué hizo la persona y cuánto tardó VARA, sin datos
 * personales: ids de sesión anónimos y números. El destino es un `sink`
 * intercambiable; por defecto va al logger de observabilidad.
 *
 * Métrica crítica: `secondPropertyRate`. Si alguien analiza otra propiedad por
 * su cuenta, es la mejor evidencia de que VARA aportó valor.
 */

import { clientAppEnv, type AppEnv } from '@/lib/config/env'
import { log } from '@/lib/observability/logger'

export type EventName =
  | 'listing_submitted' | 'property_extracted' | 'first_insight_shown'
  | 'comparables_found' | 'comparable_opened' | 'analysis_completed'
  | 'missing_data_action' | 'nba_clicked' | 'property_saved' | 'property_discarded'
  | 'second_property_added' | 'analysis_shared' | 'visit_started'

export interface AnalyticsEvent {
  name: EventName
  sessionId: string
  /** Entorno donde ocurrió. Las métricas para inversores salen solo de 'production'. */
  env?: AppEnv
  at: string
  props?: Record<string, string | number | boolean | null>
}

export type AnalyticsSink = (e: AnalyticsEvent) => void

const logSink: AnalyticsSink = e => { log.info(`event.${e.name}`, { sessionId: e.sessionId, ...e.props }) }

let sink: AnalyticsSink = logSink

export function setAnalyticsSink(fn: AnalyticsSink | null): void {
  sink = fn ?? logSink
}

export function track(
  name: EventName,
  sessionId: string,
  props?: AnalyticsEvent['props'],
  now: Date = new Date(),
): AnalyticsEvent {
  const event: AnalyticsEvent = { name, sessionId, env: clientAppEnv(), at: now.toISOString(), props }
  try { sink(event) } catch { /* la analítica nunca rompe el producto */ }
  return event
}

// ───────────────────────── Funnel y métricas ─────────────────────────

/**
 * Tracción real: solo eventos de producción. Los de desarrollo, staging, demos
 * y los que no se pudo ubicar (`unknown` o sin etiqueta) quedan afuera, para
 * que ninguna prueba se cuente como un usuario.
 */
export function productionOnly(events: AnalyticsEvent[]): AnalyticsEvent[] {
  return events.filter(e => e.env === 'production')
}

export const FUNNEL_STEPS: EventName[] = [
  'listing_submitted', 'first_insight_shown', 'analysis_completed',
  'comparable_opened', 'nba_clicked', 'second_property_added',
]

export function funnel(events: AnalyticsEvent[]): { step: EventName; sessions: number }[] {
  return FUNNEL_STEPS.map(step => ({
    step,
    sessions: new Set(events.filter(e => e.name === step).map(e => e.sessionId)).size,
  }))
}

/** Sesiones con 2+ propiedades distintas analizadas / sesiones con 1+ análisis completo. */
export function secondPropertyRate(events: AnalyticsEvent[]): number | null {
  const completed = new Set(events.filter(e => e.name === 'analysis_completed').map(e => e.sessionId))
  if (completed.size === 0) return null
  const perSession = new Map<string, Set<string>>()
  for (const e of events) {
    if (e.name !== 'listing_submitted' && e.name !== 'second_property_added') continue
    const key = typeof e.props?.listingKey === 'string' ? e.props.listingKey : e.at
    perSession.set(e.sessionId, (perSession.get(e.sessionId) ?? new Set()).add(key))
  }
  let second = 0
  for (const s of completed) if ((perSession.get(s)?.size ?? 0) >= 2) second++
  return Math.round((second / completed.size) * 1000) / 1000
}

/** Activación: análisis completo + una acción significativa. */
export function activationRate(events: AnalyticsEvent[]): number | null {
  const completed = new Set(events.filter(e => e.name === 'analysis_completed').map(e => e.sessionId))
  if (completed.size === 0) return null
  const meaningful: EventName[] = [
    'nba_clicked', 'property_saved', 'missing_data_action', 'analysis_shared', 'visit_started', 'comparable_opened',
  ]
  const acted = new Set(events.filter(e => meaningful.includes(e.name)).map(e => e.sessionId))
  let n = 0
  for (const s of completed) if (acted.has(s)) n++
  return Math.round((n / completed.size) * 1000) / 1000
}
