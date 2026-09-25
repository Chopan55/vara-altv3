import { tryCreateClient } from './client'
import type { ActivityEventRow } from './types'
import type { ActivityEvent } from '@/lib/activity/model'

/**
 * Historial contra Supabase.
 *
 * Solo hay lectura, y no es una omisión: los eventos los escriben triggers en
 * la base. Si esta capa pudiera insertar, el historial dependería de que cada
 * pantalla se acuerde de registrar — y un historial con agujeros es peor que
 * no tenerlo, porque da confianza falsa.
 */

/** Cuántos eventos traemos por defecto. Alcanza para varias semanas de uso. */
const PAGE_SIZE = 100

function rowToEvent(r: ActivityEventRow): ActivityEvent {
  return {
    id: r.id,
    operationId: r.operation_id,
    kind: r.kind,
    summary: r.summary,
    detail: r.detail ?? undefined,
    metadata: r.metadata ?? {},
    createdAt: Date.parse(r.created_at),
  }
}

export async function hasActivitySession(): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const { data } = await supabase.auth.getUser()
  return Boolean(data.user)
}

export async function fetchActivity(
  operationId: string,
  limit = PAGE_SIZE,
): Promise<ActivityEvent[]> {
  const supabase = tryCreateClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('activity_events')
    .select('*')
    .eq('operation_id', operationId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return data.map(rowToEvent)
}

/* ───────── Última vez que miró el historial ─────────
 *
 * Vive en el navegador a propósito: es una preferencia de lectura, no un
 * hecho de la operación. Si se pierde al cambiar de dispositivo, lo peor que
 * pasa es que no mostramos el resumen de novedades una vez.
 */

function seenKey(operationId: string): string {
  return `vara_activity_seen_${operationId}`
}

export function getLastSeen(operationId: string): number | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(seenKey(operationId))
    const n = raw ? Number(raw) : NaN
    return Number.isFinite(n) ? n : null
  } catch { return null }
}

export function markSeen(operationId: string, at = Date.now()): void {
  try { localStorage.setItem(seenKey(operationId), String(at)) } catch {}
}
