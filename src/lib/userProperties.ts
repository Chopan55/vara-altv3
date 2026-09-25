import type { Property, PropertyType } from '@/types'
import type { ScrapedData } from '@/app/api/scrape-property/route'

/**
 * Propiedades REALES del usuario. Nunca devuelve mocks.
 * Fuentes: el aviso importado en onboarding y el borrador de publicación.
 */

export const IMPORTED_KEY = 'vara_imported_property'
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

function fromImported(imp: ImportedProperty): UserProperty {
  const d = imp.data ?? {}
  const base: Property = {
    id: 'imported',
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
    garage: false,
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

/** Todas las propiedades reales del usuario. Array vacío si todavía no cargó ninguna. */
export function getUserProperties(): UserProperty[] {
  const out: UserProperty[] = []

  const draft = readJson<DraftShape>(DRAFT_KEY)
  if (draft) {
    const p = fromDraft(draft)
    if (p) out.push(p)
  }

  const imp = getImportedProperty()
  if (imp) out.push(fromImported(imp))

  return out
}

export function getUserPropertyById(id: string): UserProperty | null {
  return getUserProperties().find(p => p.id === id) ?? null
}

export function clearImportedProperty(): void {
  try { localStorage.removeItem(IMPORTED_KEY) } catch {}
}

/* ─────────── Con sesión: Supabase. Sin sesión: el navegador. ─────────── */

const MIGRATED_KEY = 'vara_migrated_to_supabase'

/**
 * Sube a la base lo que el usuario ya tenía cargado en el navegador.
 * Corre una sola vez por navegador; lo local queda intacto por si algo falla.
 */
export async function migrateLocalToSupabase(): Promise<number> {
  const local = getUserProperties()
  if (local.length === 0) return 0

  try {
    if (localStorage.getItem(MIGRATED_KEY)) return 0
  } catch { return 0 }

  const { insertProperty, fetchUserProperties } = await import('./supabase/properties')

  // Si ya hay propiedades en la base, no duplicamos.
  const remote = await fetchUserProperties()
  if (remote.length > 0) {
    try { localStorage.setItem(MIGRATED_KEY, '1') } catch {}
    return 0
  }

  let migrated = 0
  for (const p of local) {
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
    if (id) migrated++
  }

  try { localStorage.setItem(MIGRATED_KEY, '1') } catch {}
  return migrated
}

/** Fuente única de propiedades: base si hay sesión, navegador si no. */
export async function loadUserProperties(): Promise<UserProperty[]> {
  try {
    const { hasSession, fetchUserProperties } = await import('./supabase/properties')
    if (await hasSession()) {
      await migrateLocalToSupabase()
      return await fetchUserProperties()
    }
  } catch {
    // Si Supabase falla, no dejamos al usuario sin sus datos.
  }
  return getUserProperties()
}

export async function loadUserPropertyById(id: string): Promise<UserProperty | null> {
  try {
    const { hasSession, fetchUserPropertyById } = await import('./supabase/properties')
    if (await hasSession()) return await fetchUserPropertyById(id)
  } catch {}
  return getUserPropertyById(id)
}
