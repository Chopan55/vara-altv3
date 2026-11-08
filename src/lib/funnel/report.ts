/**
 * Lectura del embudo para el panel: pasos, conversión y vuelta a la semana.
 * Funciones puras sobre los totales de `funnel_summary`.
 */

import type { FunnelSummary } from '@/lib/supabase/types'

export interface FunnelRow {
  key: 'visitors' | 'analyzed' | 'operations' | 'invited'
  label: string
  count: number
  /** % sobre el paso anterior; null en el primero o si el anterior es 0. */
  fromPrevious: number | null
  /** % sobre las visitas; null si no hubo visitas. */
  fromVisitors: number | null
}

export function pct(part: number, total: number): number | null {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : null
}

const STEPS: { key: FunnelRow['key']; label: string }[] = [
  { key: 'visitors', label: 'Visitaron VARA' },
  { key: 'analyzed', label: 'Analizaron un aviso' },
  { key: 'operations', label: 'Crearon una operación' },
  { key: 'invited', label: 'Invitaron a alguien a su operación' },
]

export function funnelRows(s: FunnelSummary): FunnelRow[] {
  return STEPS.map((step, i) => {
    const count = s[step.key]
    const prev = i > 0 ? s[STEPS[i - 1].key] : null
    return {
      key: step.key,
      label: step.label,
      count,
      fromPrevious: prev === null ? null : pct(count, prev),
      fromVisitors: i === 0 ? null : pct(count, s.visitors),
    }
  })
}

export interface ReturnRate {
  returned: number
  cohort: number
  rate: number | null
}

export function weekReturn(s: FunnelSummary): ReturnRate {
  return { returned: s.returned_7d, cohort: s.cohort_7d, rate: pct(s.returned_7d, s.cohort_7d) }
}

/** Cuántas visitas nuevas trae cada análisis compartido. */
export function viral(s: FunnelSummary): { shares: number; views: number; arrivals: number; arrivalsPerShare: number | null } {
  return {
    shares: s.shares,
    views: s.shared_views,
    arrivals: s.from_share,
    arrivalsPerShare: s.shares > 0 ? Math.round((s.from_share / s.shares) * 100) / 100 : null,
  }
}
