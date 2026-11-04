import { tryCreateClient } from './client'
import { isUuid } from '@/lib/operationIds'

/**
 * Checklist de visita guardado en la operación (`operations.stages_state.visitChecklist`).
 *
 * Usa una columna que ya existe y ya tiene RLS de dueño: no hace falta migración.
 * Sin sesión, o con una operación local de invitado, queda solo en el navegador.
 */

export interface SavedVisitChecklist {
  checked: string[]
  notes: Record<string, string>
  updatedAt: string
}

const KEY = 'visitChecklist'

function isSaved(v: unknown): v is SavedVisitChecklist {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return Array.isArray(o.checked) && typeof o.notes === 'object' && o.notes !== null && typeof o.updatedAt === 'string'
}

/** Gana la versión más reciente; sin fecha local, gana la de la cuenta (otro dispositivo). */
export function pickNewer(
  local: SavedVisitChecklist | null, remote: SavedVisitChecklist | null,
): SavedVisitChecklist | null {
  if (!remote) return local
  if (!local) return remote
  return remote.updatedAt > local.updatedAt ? remote : local
}

export async function fetchVisitChecklist(operationId: string): Promise<SavedVisitChecklist | null> {
  if (!isUuid(operationId)) return null
  const supabase = tryCreateClient()
  if (!supabase) return null
  const { data } = await supabase.from('operations').select('stages_state').eq('id', operationId).maybeSingle()
  const v = (data?.stages_state as Record<string, unknown> | undefined)?.[KEY]
  return isSaved(v) ? v : null
}

export async function saveVisitChecklist(operationId: string, value: SavedVisitChecklist): Promise<boolean> {
  if (!isUuid(operationId)) return false
  const supabase = tryCreateClient()
  if (!supabase) return false
  const { data, error } = await supabase.from('operations').select('stages_state').eq('id', operationId).maybeSingle()
  if (error || !data) return false
  const next = { ...(data.stages_state ?? {}), [KEY]: value }
  const { error: upErr } = await supabase.from('operations').update({ stages_state: next }).eq('id', operationId)
  return !upErr
}
