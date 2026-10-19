import type { Property, PropertyType } from '@/types'
import type { ScrapedData } from '@/app/api/scrape-property/route'
import { applyOverrides } from '@/lib/propertyOverrides'
import type { PropertyCandidate } from '@/lib/candidates/model'
import { lazyModule, singleFlight, withGuestMigrationLock } from '@/lib/guestLock'
import { log } from '@/lib/observability/logger'
import { isUuid } from '@/lib/operationIds'
import type { NewPropertyInput } from './supabase/properties'

/**
 * Propiedades REALES del usuario. Nunca devuelve mocks.
 * Fuentes: el aviso importado en onboarding y el borrador de publicación.
 */

export const IMPORTED_KEY = 'vara_imported_property'
export const IMPORTED_LIST_KEY = 'vara_imported_properties'
export const DRAFT_KEY = 'vara_publish_draft'

export interface ImportedProperty {
  url: string
  portal: string | null
  data: ScrapedData
  photos: string[]
  importedAt: number
}

export interface UserProperty extends Property {
  source: 'imported' | 'draft'
  sourceUrl?: string
  portal?: string | null
  incompleteFields: string[]
}

function readJson<T>(key: string): T | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch { return null }
}

function guessType(raw?: string): PropertyType {
  const v = (raw ?? '').toLowerCase()
  if (v.includes('ph')) return 'PH'
  if (v.includes('departamento') || v.includes('depto')) return 'APARTMENT'
  if (v.includes('terreno') || v.includes('lote')) return 'LAND'
  if (v.includes('cochera') || v.includes('garage')) return 'GARAGE'
  if (v.includes('oficina')) return 'OFFICE'
  if (v.includes('local')) return 'LOCAL'
  if (v.includes('campo') || v.includes('quinta')) return 'FIELD'
  return 'HOUSE'
}

const n = (v: unknown): number => (typeof v === 'number' && isFinite(v) ? v : 0)
const s = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** Campos que faltan para que la ficha sea confiable. Se muestran en la UI, no se inventan. */
function missingOf(p: Partial<Property>): string[] {
  const out: string[] = []
  if (!p.price) out.push('precio')
  if (!p.surface) out.push('superficie')
  if (!p.address && !p.neighborhood) out.push('dirección')
  if (!p.rooms) out.push('ambientes')
  if (!p.bedrooms) out.push('dormitorios')
  return out
}

/** "Antigüedad: 15 años" (de la ficha del portal) → 15. */
function ageFromFeatures(features: unknown): number | undefined {
  if (!Array.isArray(features)) return undefined
  for (const f of features) {
    const m = typeof f === 'string' ? f.match(/antig[uü]edad:?\s*(\d+)/i) : null
    if (m) return Number(m[1])
  }
  return undefined
}

function fromImported(imp: ImportedProperty & { id?: string }): UserProperty {
  const d = imp.data ?? {}
  const base: Property = {
    id: imp.id ?? `imported-${imp.importedAt ?? Date.now()}`,
    type: guessType(d.propertyType ?? d.title),
    operationType: 'sale',
    price: n(d.price),
    currency: d.currency === 'ARS' ? 'ARS' : 'USD',
    title: s(d.title) || 'Propiedad importada',
    address: s(d.address),
    neighborhood: s(d.neighborhood),
    city: s(d.city),
    province: s(d.province),
    surface: n(d.totalM2) || n(d.coveredM2),
    coveredSurface: n(d.coveredM2) || undefined,
    rooms: n(d.rooms),
    bedrooms: n(d.bedrooms),
    bathrooms: n(d.bathrooms),
    garage: (Array.isArray(d.features) ? d.features : []).some(f => /cochera|garage/i.test(f)),
    ageYears: ageFromFeatures(d.features),
    description: s(d.description),
    images: Array.isArray(imp.photos) ? imp.photos : [],
    features: Array.isArray(d.features) ? d.features : [],
    expenses: n(d.expenses) || undefined,
  }
  return {
    ...base,
    source: 'imported',
    sourceUrl: imp.url,
    portal: imp.portal,
    incompleteFields: missingOf(base),
  }
}

interface DraftShape {
  title?: string; type?: string; price?: string; currency?: string
  surface?: string; coveredSurface?: string; rooms?: string; bedrooms?: string; bathrooms?: string
  address?: string; neighborhood?: string; city?: string; description?: string
  features?: string[]
}

function fromDraft(draft: DraftShape): UserProperty | null {
  if (!draft.title && !draft.price && !draft.address) return null

  const num = (v?: string) => {
    const x = parseFloat((v ?? '').replace(/[^\d.]/g, ''))
    return isFinite(x) ? x : 0
  }

  const base: Property = {
    id: 'draft',
    type: guessType(draft.type),
    operationType: 'sale',
    price: num(draft.price),
    currency: draft.currency === 'ARS' ? 'ARS' : 'USD',
    title: s(draft.title) || 'Mi propiedad',
    address: s(draft.address),
    neighborhood: s(draft.neighborhood),
    city: s(draft.city),
    province: '',
    surface: num(draft.surface) || num(draft.coveredSurface),
    coveredSurface: num(draft.coveredSurface) || undefined,
    rooms: num(draft.rooms),
    bedrooms: num(draft.bedrooms),
    bathrooms: num(draft.bathrooms),
    garage: (draft.features ?? []).some(f => /cochera|garage/i.test(f)),
    description: s(draft.description),
    images: [],
    features: Array.isArray(draft.features) ? draft.features : [],
  }
  return { ...base, source: 'draft', incompleteFields: missingOf(base) }
}

export function getImportedProperty(): ImportedProperty | null {
  const imp = readJson<ImportedProperty>(IMPORTED_KEY)
  return imp && imp.data ? imp : null
}

export function getImportedProperties(): (ImportedProperty & { id: string })[] {
  const list = readJson<ImportedProperty[]>(IMPORTED_LIST_KEY)
  if (Array.isArray(list) && list.length > 0) {
    return list
      .filter(x => x && x.data)
      .map(x => ({ ...x, id: `imported-${x.importedAt ?? 0}` }))
  }
  // Migración desde clave legacy.
  const legacy = getImportedProperty()
  if (legacy) return [{ ...legacy, id: `imported-${legacy.importedAt ?? 0}` }]
  return []
}

/** Todas las propiedades reales del usuario. Array vacío si todavía no cargó ninguna. */
export function getUserProperties(): UserProperty[] {
  const out: UserProperty[] = []

  const draft = readJson<DraftShape>(DRAFT_KEY)
  if (draft) {
    const p = fromDraft(draft)
    if (p) out.push(p)
  }

  for (const imp of getImportedProperties()) {
    out.push(fromImported(imp))
  }

  return out.map(applyOverrides)
}

export function getUserPropertyById(id: string): UserProperty | null {
  const legacy = getUserProperties().find(p => p.id === id)
  if (legacy) return legacy // getUserProperties ya aplica las correcciones
  // También buscar en el store de candidatos (IDs con formato cand_xxx) (H06)
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem('vara_candidates')
    if (!raw) return null
    const list = JSON.parse(raw) as Array<Record<string, unknown>>
    const candidate = list.find(c => c.id === id)
    if (!candidate) return null
    const base: Property = {
      id: String(candidate.id ?? id),
      type: guessType(String(candidate.propertyType ?? candidate.title ?? '')),
      operationType: 'sale',
      price: n(candidate.price),
      currency: candidate.currency === 'ARS' ? 'ARS' : 'USD',
      title: s(candidate.title) || 'Candidato',
      address: s(candidate.address),
      neighborhood: s(candidate.neighborhood),
      city: s(candidate.city),
      province: s(candidate.province),
      surface: n(candidate.surface) || n(candidate.totalM2),
      rooms: n(candidate.rooms),
      bedrooms: n(candidate.bedrooms),
      bathrooms: n(candidate.bathrooms),
      garage: false,
      description: s(candidate.description),
      images: Array.isArray(candidate.images) ? candidate.images as string[] : [],
      features: [],
    }
    return applyOverrides({ ...base, source: 'imported' as const, incompleteFields: missingOf(base) })
  } catch { return null }
}

export function clearImportedProperty(): void {
  try {
    localStorage.removeItem(IMPORTED_KEY)
    localStorage.removeItem(IMPORTED_LIST_KEY)
  } catch {}
}

/* ─────────── Con sesión: Supabase. Sin sesión: el navegador. ─────────── */

const CANDIDATES_KEY = 'vara_candidates'
/** Id local → id en la cuenta. Permite reescribir el vínculo operación ↔ propiedad aun cuando la propiedad ya salió del navegador. */
const PROPS_IDMAP_KEY = 'vara_props_idmap'
/** Id de la propiedad en la cuenta → id local de la operación con la que estaba vinculada; se enlaza cuando la operación ya existe allá. */
const PROMO_LINKS_KEY = 'vara_props_promo_links'

const remoteProperties = lazyModule(() => import('./supabase/properties'))
const remoteCandidates = lazyModule(() => import('./supabase/candidates'))

function readMap(key: string): Record<string, string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch { return {} }
}

function writeMap(key: string, map: Record<string, string>): void {
  try { localStorage.setItem(key, JSON.stringify(map)) } catch {}
}

/** Una propiedad (o candidato) que el invitado tiene en este navegador y todavía no está en una cuenta. */
export interface GuestProperty {
  localId: string
  prop: UserProperty
  candidate: PropertyCandidate | null
}

/**
 * Lo que el invitado cargó: candidatos y propiedades importadas. Un importado y su copia como candidato son la misma
 * propiedad (misma URL): cuenta una sola vez, con el estado del candidato. El borrador de publicación no entra:
 * es un formulario en curso, sin identidad estable (migrarlo duplicaría la propiedad en cada edición).
 */
export function collectGuestProperties(): GuestProperty[] {
  const out: GuestProperty[] = []
  const seenUrls = new Set<string>()
  const list = readJson<PropertyCandidate[]>(CANDIDATES_KEY)
  for (const c of Array.isArray(list) ? list : []) {
    if (!c || typeof c.id !== 'string' || c.source === 'draft') continue
    if (c.sourceUrl) seenUrls.add(c.sourceUrl)
    out.push({ localId: c.id, prop: c as unknown as UserProperty, candidate: c })
  }
  for (const imp of getImportedProperties()) {
    if (imp.url && seenUrls.has(imp.url)) continue
    out.push({ localId: imp.id, prop: fromImported(imp), candidate: null })
  }
  return out
}

/** Id con el que una propiedad vive hoy en la cuenta (el mismo si no cambió). Sirve para no romper el vínculo operación ↔ propiedad. */
export function mapPropertyId(id: string | undefined): string | undefined {
  if (!id) return id
  return readMap(PROPS_IDMAP_KEY)[id] ?? id
}

/** true si esa propiedad sigue solo en este navegador: la operación que la usa debe esperar para no subir sin su vínculo. */
export function isPendingGuestProperty(id: string | undefined): boolean {
  return !!id && collectGuestProperties().some(g => g.localId === id)
}

function propertyToInput(p: UserProperty, id?: string): NewPropertyInput {
  return {
    id,
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
  }
}

/** Saca de este navegador todas las representaciones locales de esa propiedad (candidato e importado comparten URL). */
function removeGuestProperty(g: GuestProperty): void {
  const url = g.prop.sourceUrl
  try {
    const cands = readJson<PropertyCandidate[]>(CANDIDATES_KEY)
    if (Array.isArray(cands)) {
      localStorage.setItem(CANDIDATES_KEY, JSON.stringify(cands.filter(c => c && c.id !== g.localId && !(url && c.sourceUrl === url))))
    }
    const imported = readJson<ImportedProperty[]>(IMPORTED_LIST_KEY)
    if (Array.isArray(imported)) {
      const kept = imported.filter(x => x && !(url && x.url === url) && `imported-${x.importedAt ?? 0}` !== g.localId)
      if (kept.length > 0) localStorage.setItem(IMPORTED_LIST_KEY, JSON.stringify(kept))
      else localStorage.removeItem(IMPORTED_LIST_KEY)
    }
    const legacy = readJson<ImportedProperty>(IMPORTED_KEY)
    if (legacy && ((url && legacy.url === url) || `imported-${legacy.importedAt ?? 0}` === g.localId)) {
      localStorage.removeItem(IMPORTED_KEY)
    }
  } catch {}
}

const hasCandidateState = (c: PropertyCandidate) =>
  c.status !== 'ANALYZING' || Boolean(c.userNotes) || Boolean(c.discardReason) || Boolean(c.promotedAt)

/**
 * Sube a la cuenta lo que el invitado cargó, SIN bandera global: cada propiedad se resuelve por sí misma.
 * - Mismo id (UUID) cuando se puede; los ids viejos (`cand_…`, `imported-…`) reciben uno nuevo y quedan en el mapa.
 * - Si la cuenta ya tiene esa propiedad (misma URL) se reutiliza: no se duplica ni se pisa lo que tenía.
 * - Una propiedad se saca del navegador recién cuando ya está en la cuenta; si la subida falla, se conserva y se reintenta.
 * Sin lock: lo llaman migratePropertiesToSupabase (con lock) y la migración de operaciones (que ya lo tiene).
 */
export async function runPropertyMigration(): Promise<number> {
  const guests = collectGuestProperties()
  if (guests.length === 0) return 0

  const { insertProperty, fetchUserProperties } = await remoteProperties()
  const { updateCandidate } = await remoteCandidates()
  const idMap = readMap(PROPS_IDMAP_KEY)
  const links = readMap(PROMO_LINKS_KEY)

  const byUrl = new Map<string, string>()
  for (const r of await fetchUserProperties()) if (r.sourceUrl) byUrl.set(r.sourceUrl, r.id)

  let uploaded = 0
  for (const g of guests) {
    let remoteId: string | null = idMap[g.localId] ?? (g.prop.sourceUrl ? byUrl.get(g.prop.sourceUrl) ?? null : null)
    if (!remoteId) {
      remoteId = await insertProperty(propertyToInput(g.prop, isUuid(g.localId) ? g.localId : undefined))
      if (!remoteId) continue // no se pudo (corte, sin sesión): sigue en este navegador y se reintenta en la próxima carga
      uploaded++
      if (g.prop.sourceUrl) byUrl.set(g.prop.sourceUrl, remoteId)
      // El estado del candidato (en análisis, favorito, notas…) viaja con la propiedad. Dos intentos: es lo único que no se puede reconstruir.
      if (g.candidate && hasCandidateState(g.candidate)) {
        const { status, userNotes, discardReason, promotedAt } = g.candidate
        for (let attempt = 0; attempt < 2; attempt++) {
          if (await updateCandidate(remoteId, { status, userNotes, discardReason, promotedAt }).catch(() => null)) break
          if (attempt === 1) log.warn('property.migrate.candidate_state_failed', 'No se pudo copiar el estado del candidato a la cuenta.', { propertyId: remoteId })
        }
      }
    }
    idMap[g.localId] = remoteId
    writeMap(PROPS_IDMAP_KEY, idMap) // antes de sacarla del navegador: si algo se corta acá, el reintento no la vuelve a subir
    if (g.candidate?.promotedOperationId) {
      links[remoteId] = g.candidate.promotedOperationId
      writeMap(PROMO_LINKS_KEY, links)
    }
    removeGuestProperty(g)
  }
  return uploaded
}

/** Un solo migrador a la vez y las llamadas simultáneas comparten la misma ejecución. */
export const migratePropertiesToSupabase = singleFlight(() => withGuestMigrationLock(runPropertyMigration))

/**
 * Una operación ya está en la cuenta: enlaza con ella al candidato que la había promovido (promoted_operation_id).
 * Si el enlace falla queda pendiente y se reintenta.
 */
export async function linkPromotedProperties(opLocalId: string, opRemoteId: string): Promise<void> {
  const links = readMap(PROMO_LINKS_KEY)
  const pending = Object.entries(links).filter(([, local]) => local === opLocalId)
  if (pending.length === 0) return
  const { updateCandidate } = await remoteCandidates()
  for (const [propRemoteId] of pending) {
    if (await updateCandidate(propRemoteId, { promotedOperationId: opRemoteId }).catch(() => null)) delete links[propRemoteId]
  }
  writeMap(PROMO_LINKS_KEY, links)
}

/** Enlaces que quedaron pendientes cuya operación ya está en la cuenta con el mismo id (UUID conservado). */
export async function sweepPromotedLinks(remoteOperationIds: Set<string>): Promise<void> {
  const links = readMap(PROMO_LINKS_KEY)
  for (const [, opLocalId] of Object.entries(links)) {
    if (isUuid(opLocalId) && remoteOperationIds.has(opLocalId)) await linkPromotedProperties(opLocalId, opLocalId)
  }
}

export function hasPendingPromotedLinks(): boolean {
  return Object.keys(readMap(PROMO_LINKS_KEY)).length > 0
}

/** Fuente única de propiedades: la cuenta si hay sesión (con lo que todavía no se pudo subir), el navegador si no. */
export async function loadUserProperties(): Promise<UserProperty[]> {
  try {
    const { hasSession, fetchUserProperties } = await remoteProperties()
    if (await hasSession()) {
      await migratePropertiesToSupabase()
      const remote = (await fetchUserProperties()).map(applyOverrides)
      // Lo que no se pudo subir sigue siendo del usuario: no debe desaparecer.
      const pending = collectGuestProperties()
        .map(g => applyOverrides(g.prop))
        .filter(p => !remote.some(r => r.id === p.id || (p.sourceUrl && r.sourceUrl === p.sourceUrl)))
      return [...remote, ...pending]
    }
  } catch {
    // Si Supabase falla, no dejamos al usuario sin sus datos.
  }
  return getUserProperties()
}

export async function loadUserPropertyById(id: string): Promise<UserProperty | null> {
  try {
    const { hasSession, fetchUserPropertyById } = await remoteProperties()
    if (await hasSession()) {
      // Un link viejo (`imported-…`, `cand_…`) sigue funcionando: se traduce al id que tiene hoy en la cuenta.
      const remote = await fetchUserPropertyById(mapPropertyId(id) ?? id)
      if (remote) return applyOverrides(remote)
    }
  } catch {}
  return getUserPropertyById(id)
}
