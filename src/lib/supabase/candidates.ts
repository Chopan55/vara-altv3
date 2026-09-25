/**
 * Candidatos contra Supabase.
 *
 * Un candidato es una fila de `properties` — no una tabla nueva. La decisión
 * de comprar pasa por la misma propiedad que después se convierte en
 * operación, así que separarlas en dos tablas habría obligado a copiar datos
 * en el momento de promover, que es justo cuando hay que perder menos.
 */

import { tryCreateClient } from './client'
import type { PropertyRow } from './types'
import { rowToUserProperty, hasSession } from './properties'
import type { PropertyCandidate } from '@/lib/candidates/model'
import type { UserProperty } from '@/lib/userProperties'

export { hasSession }

function rowToCandidate(r: PropertyRow): PropertyCandidate {
  return {
    ...rowToUserProperty(r),
    status: r.candidate_status,
    userNotes: r.user_notes ?? undefined,
    discardReason: r.discard_reason ?? undefined,
    promotedOperationId: r.promoted_operation_id ?? undefined,
    promotedAt: r.promoted_at ? Date.parse(r.promoted_at) : undefined,
    addedAt: Date.parse(r.created_at),
  }
}

export async function fetchCandidates(): Promise<PropertyCandidate[]> {
  const supabase = tryCreateClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data.map(rowToCandidate)
}

export async function insertCandidate(p: UserProperty): Promise<PropertyCandidate | null> {
  const { insertProperty } = await import('./properties')
  const id = await insertProperty({
    source: p.source === 'imported' ? 'IMPORTED' : 'MANUAL',
    sourceUrl: p.sourceUrl ?? null,
    portal: p.portal ?? null,
    title: p.title,
    type: p.type,
    price: p.price || undefined,
    currency: p.currency,
    address: p.address || undefined,
    neighborhood: p.neighborhood || undefined,
    city: p.city || undefined,
    province: p.province || undefined,
    surfaceTotal: p.surface || undefined,
    surfaceCovered: p.coveredSurface,
    rooms: p.rooms || undefined,
    bedrooms: p.bedrooms || undefined,
    bathrooms: p.bathrooms || undefined,
    garage: p.garage,
    description: p.description || undefined,
    features: p.features,
    expenses: p.expenses,
    remoteImages: p.images,
  })
  if (!id) return null

  const supabase = tryCreateClient()
  if (!supabase) return null
  const { data } = await supabase.from('properties').select('*').eq('id', id).maybeSingle()
  return data ? rowToCandidate(data) : null
}

export async function updateCandidate(
  id: string,
  patch: Partial<PropertyCandidate>,
): Promise<PropertyCandidate | null> {
  const supabase = tryCreateClient()
  if (!supabase) return null

  // Tipado como la fila (y no como un objeto suelto) para que una columna mal
  // escrita falle al compilar en vez de perderse silenciosamente.
  const row: Partial<PropertyRow> = {}
  if (patch.status !== undefined) row.candidate_status = patch.status
  if ('userNotes' in patch) row.user_notes = patch.userNotes ?? null
  if ('discardReason' in patch) row.discard_reason = patch.discardReason ?? null
  if ('promotedOperationId' in patch) {
    row.promoted_operation_id = patch.promotedOperationId ?? null
  }
  if ('promotedAt' in patch) {
    row.promoted_at = patch.promotedAt ? new Date(patch.promotedAt).toISOString() : null
  }
  if (Object.keys(row).length === 0) return null

  const { data, error } = await supabase
    .from('properties')
    .update(row)
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error || !data) return null
  return rowToCandidate(data)
}

export async function deleteCandidate(id: string): Promise<boolean> {
  const { deleteProperty } = await import('./properties')
  return deleteProperty(id)
}
