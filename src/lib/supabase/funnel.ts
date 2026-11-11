import { tryCreateClient } from './client'
import type { FunnelSummary } from './types'

export type FunnelError = 'NO_SESSION' | 'FORBIDDEN' | 'NOT_READY' | 'FAILED'

/** Totales del embudo. La base solo se los da a un ADMIN. */
export async function fetchFunnelSummary(days: number): Promise<{ data?: FunnelSummary; error?: FunnelError }> {
  const supabase = tryCreateClient()
  if (!supabase) return { error: 'NOT_READY' }
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return { error: 'NO_SESSION' }
  const { data, error } = await supabase.rpc('funnel_summary', { p_days: days })
  if (error) {
    if (error.code === '42501' || /forbidden/i.test(error.message)) return { error: 'FORBIDDEN' }
    if (error.code === 'PGRST202' || error.code === '42883') return { error: 'NOT_READY' }
    return { error: 'FAILED' }
  }
  return { data: data as FunnelSummary }
}
