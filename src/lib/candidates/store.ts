/**
 * Persistencia de candidatos.
 *
 * Hasta acá el navegador guardaba **una sola** propiedad importada
 * (`vara_imported_property`, una clave, no una lista). Eso no es un detalle
 * de implementación: es la razón estructural por la que no existía un lugar
 * donde comparar tres casas. Acá esa clave se convierte en el primer elemento
 * de una lista y deja de usarse.
 *
 * Con sesión manda Supabase; sin sesión, el navegador. Igual que el resto de
 * la app, si Supabase falla no dejamos a la persona sin sus datos.
 */

import type { CandidateStatus, PropertyCandidate } from './model'
import { canTransitionCandidate } from './model'
import { log } from '@/lib/observability/logger'
import {
  IMPORTED_KEY,
  getUserProperties,
  type UserProperty,
} from '@/lib/userProperties'

const LIST_KEY = 'vara_candidates'
/** Marca de que la propiedad única vieja ya pasó a la lista. */
const ADOPTED_KEY = 'vara_candidates_adopted'

function readList(): PropertyCandidate[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(LIST_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed) ? (parsed as PropertyCandidate[]) : []
  } catch { return [] }
}

function writeList(list: PropertyCandidate[]): void {
  try { localStorage.setItem(LIST_KEY, JSON.stringify(list)) } catch {}
}

/** Un id estable para lo que el navegador guarda sin base de datos. */
function localId(): string {
  return `cand_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function toCandidate(
  p: UserProperty,
  over: Partial<PropertyCandidate> = {},
): PropertyCandidate {
  return {
    ...p,
    status: 'ANALYZING',
    addedAt: Date.now(),
    ...over,
  }
}

/**
 * Trae lo que ya existía a la lista nueva, una sola vez por navegador.
 * No borra `vara_imported_property`: si algo sale mal, el dato sigue ahí.
 */
function adoptLegacyProperty(): PropertyCandidate[] {
  const list = readList()
  try {
    if (localStorage.getItem(ADOPTED_KEY)) return list
  } catch { return list }

  const legacy = getUserProperties()
  if (legacy.length === 0) return list

  let imported: number | undefined
  try {
    const raw = localStorage.getItem(IMPORTED_KEY)
    const parsed = raw ? (JSON.parse(raw) as { importedAt?: number }) : null
    imported = typeof parsed?.importedAt === 'number' ? parsed.importedAt : undefined
  } catch {}

  const adopted = legacy.map(p =>
    toCandidate(p, { id: localId(), addedAt: imported ?? Date.now() }),
  )
  const merged = [...list, ...adopted]
  writeList(merged)
  try { localStorage.setItem(ADOPTED_KEY, '1') } catch {}
  return merged
}

// ───────────────────────── Lectura ─────────────────────────

export async function loadCandidates(): Promise<PropertyCandidate[]> {
  try {
    const { hasSession, fetchCandidates } = await import('@/lib/supabase/candidates')
    if (await hasSession()) return await fetchCandidates()
  } catch {
    // Sin base, seguimos con lo local en vez de mostrar una lista vacía.
  }
  return adoptLegacyProperty()
}

export async function loadCandidateById(id: string): Promise<PropertyCandidate | null> {
  return (await loadCandidates()).find(c => c.id === id) ?? null
}

// ───────────────────────── Escritura ─────────────────────────

export async function addCandidate(p: UserProperty): Promise<PropertyCandidate | null> {
  try {
    const { hasSession, insertCandidate } = await import('@/lib/supabase/candidates')
    if (await hasSession()) return await insertCandidate(p)
  } catch (err) { log.error('candidate.add.supabase.failed', err) }

  const c = toCandidate(p, { id: localId() })
  writeList([...adoptLegacyProperty(), c])
  return c
}

/**
 * Resultado de un cambio de estado. `ok: false` cuando la transición no está
 * permitida — por ejemplo despromover algo que ya tiene una operación.
 */
export interface StatusChangeResult {
  ok: boolean
  reason?: string
  candidate?: PropertyCandidate
}

export async function setCandidateStatus(
  id: string,
  to: CandidateStatus,
  extra: { discardReason?: string } = {},
): Promise<StatusChangeResult> {
  const current = await loadCandidateById(id)
  if (!current) return { ok: false, reason: 'No encontramos esa propiedad.' }
  if (current.status === to) return { ok: true, candidate: current }
  if (!canTransitionCandidate(current.status, to)) {
    return {
      ok: false,
      reason:
        current.status === 'PROMOTED'
          ? 'Ya avanzaste con esta propiedad: tiene una operación abierta.'
          : 'Ese cambio de estado no está permitido.',
    }
  }

  const patch: Partial<PropertyCandidate> = { status: to }
  if (to === 'DISCARDED') patch.discardReason = extra.discardReason
  // Recuperarla limpia el motivo: ya no está descartada.
  if (current.status === 'DISCARDED') patch.discardReason = undefined

  const updated = await patchCandidate(id, patch)
  return updated
    ? { ok: true, candidate: updated }
    : { ok: false, reason: 'No pudimos guardar el cambio.' }
}

export async function setCandidateNotes(
  id: string,
  notes: string,
): Promise<PropertyCandidate | null> {
  return patchCandidate(id, { userNotes: notes })
}

export async function patchCandidate(
  id: string,
  patch: Partial<PropertyCandidate>,
): Promise<PropertyCandidate | null> {
  try {
    const { hasSession, updateCandidate } = await import('@/lib/supabase/candidates')
    if (await hasSession()) return await updateCandidate(id, patch)
  } catch (err) { log.error('candidate.patch.supabase.failed', err) }

  const list = adoptLegacyProperty()
  let updated: PropertyCandidate | null = null
  const next = list.map(c => {
    if (c.id !== id) return c
    updated = { ...c, ...patch }
    return updated
  })
  if (updated) writeList(next)
  return updated
}

export async function removeCandidate(id: string): Promise<boolean> {
  try {
    const { hasSession, deleteCandidate } = await import('@/lib/supabase/candidates')
    if (await hasSession()) return await deleteCandidate(id)
  } catch (err) { log.error('candidate.remove.supabase.failed', err) }

  const list = adoptLegacyProperty()
  const next = list.filter(c => c.id !== id)
  if (next.length === list.length) return false
  writeList(next)
  return true
}

/**
 * Avanzar con una propiedad: crea la operación y la ata al candidato.
 *
 * Es el único punto donde un candidato se convierte en compromiso. Primero
 * nace la operación y recién después se marca el candidato: si algo falla en
 * el medio, queda una operación huérfana (recuperable) y no un candidato que
 * dice tener una operación que no existe.
 */
export async function promoteCandidate(id: string): Promise<StatusChangeResult> {
  const c = await loadCandidateById(id)
  if (!c) return { ok: false, reason: 'No encontramos esa propiedad.' }
  if (c.status === 'PROMOTED') {
    return { ok: false, reason: 'Esta propiedad ya tiene una operación abierta.' }
  }
  if (!canTransitionCandidate(c.status, 'PROMOTED')) {
    return { ok: false, reason: 'Está descartada: recuperala antes de avanzar con ella.' }
  }

  const { createOperationAnywhere } = await import('@/lib/userOperations')
  const { resolveProvinceCode } = await import('@/lib/regulations')

  const op = await createOperationAnywhere({
    type: 'BUY',
    province: c.province,
    provinceCode: resolveProvinceCode(c.province),
    city: c.city,
    title: c.title || 'Mi compra',
    propertyId: c.id,
  })

  // Marcar el candidato atómicamente: si falla, revertir la operación creada (H21)
  const result = await markPromoted(id, op.id)
  if (!result.ok) {
    try {
      const { deleteOperationAnywhere } = await import('@/lib/userOperations')
      await deleteOperationAnywhere(op.id)
    } catch (rollbackErr) {
      log.error('candidate.promote.rollback.failed', rollbackErr, { operationId: op.id })
    }
    return { ok: false, reason: result.reason ?? 'No pudimos completar la promoción.' }
  }
  return result
}

/**
 * Marca el candidato como promovido y lo ata a su operación.
 *
 * El contexto previo NO se pierde: las notas, el estado por el que pasó y la
 * fecha en que se agregó siguen ahí. Alguien que promueve una propiedad
 * después de tres semanas de análisis no quiere empezar de cero.
 */
export async function markPromoted(
  id: string,
  operationId: string,
): Promise<StatusChangeResult> {
  const current = await loadCandidateById(id)
  if (!current) return { ok: false, reason: 'No encontramos esa propiedad.' }
  if (current.status === 'PROMOTED') {
    return { ok: false, reason: 'Esta propiedad ya tiene una operación abierta.' }
  }
  if (!canTransitionCandidate(current.status, 'PROMOTED')) {
    return {
      ok: false,
      reason: 'Está descartada: recuperala antes de avanzar con ella.',
    }
  }

  const updated = await patchCandidate(id, {
    status: 'PROMOTED',
    promotedOperationId: operationId,
    promotedAt: Date.now(),
  })
  return updated
    ? { ok: true, candidate: updated }
    : { ok: false, reason: 'No pudimos guardar el cambio.' }
}
