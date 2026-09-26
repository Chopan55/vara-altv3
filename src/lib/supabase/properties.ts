import { tryCreateClient } from './client'
import { log } from '@/lib/observability/logger'
import type { PropertyRow, PropertyTypeDb, CurrencyDb } from './types'
import type { UserProperty } from '@/lib/userProperties'
import type { Property } from '@/types'

/**
 * Propiedades contra Supabase. Se usa solo cuando hay sesión;
 * sin sesión la app sigue funcionando con localStorage.
 */

const n = (v: number | null): number => (typeof v === 'number' && isFinite(v) ? v : 0)
const s = (v: string | null): string => v ?? ''

function missingOf(p: Partial<Property>): string[] {
  const out: string[] = []
  if (!p.price) out.push('precio')
  if (!p.surface) out.push('superficie')
  if (!p.address && !p.neighborhood) out.push('dirección')
  if (!p.rooms) out.push('ambientes')
  if (!p.bedrooms) out.push('dormitorios')
  return out
}

export function rowToUserProperty(r: PropertyRow): UserProperty {
  const base: Property = {
    id: r.id,
    type: r.type,
    operationType: 'sale',
    price: n(r.price),
    currency: r.currency,
    title: r.title || 'Propiedad sin título',
    address: s(r.address),
    neighborhood: s(r.neighborhood),
    city: s(r.city),
    province: s(r.province),
    surface: n(r.surface_total) || n(r.surface_covered),
    coveredSurface: n(r.surface_covered) || undefined,
    rooms: n(r.rooms),
    bedrooms: n(r.bedrooms),
    bathrooms: n(r.bathrooms),
    garage: r.garage,
    description: s(r.description),
    images: r.remote_images ?? [],
    features: r.features ?? [],
    expenses: n(r.expenses) || undefined,
    ageYears: r.age_years ?? undefined,
  }
  return {
    ...base,
    source: r.source === 'IMPORTED' ? 'imported' : 'draft',
    sourceUrl: r.source_url ?? undefined,
    portal: r.portal,
    incompleteFields: missingOf(base),
  }
}

/** true si hay sesión activa. */
export async function hasSession(): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const { data } = await supabase.auth.getUser()
  return Boolean(data.user)
}

export async function fetchUserProperties(): Promise<UserProperty[]> {
  const supabase = tryCreateClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data.map(rowToUserProperty)
}

export async function fetchUserPropertyById(id: string): Promise<UserProperty | null> {
  const supabase = tryCreateClient()
  if (!supabase) return null
  const { data, error } = await supabase.from('properties').select('*').eq('id', id).maybeSingle()
  if (error || !data) return null
  return rowToUserProperty(data)
}

export interface NewPropertyInput {
  source: 'IMPORTED' | 'MANUAL'
  sourceUrl?: string | null
  portal?: string | null
  title?: string
  type?: PropertyTypeDb
  price?: number
  currency?: CurrencyDb
  address?: string
  neighborhood?: string
  city?: string
  province?: string
  surfaceTotal?: number
  surfaceCovered?: number
  rooms?: number
  bedrooms?: number
  bathrooms?: number
  garage?: boolean
  description?: string
  features?: string[]
  expenses?: number
  remoteImages?: string[]
}

export async function insertProperty(input: NewPropertyInput): Promise<string | null> {
  const supabase = tryCreateClient()
  if (!supabase) return null

  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return null

  const { data, error } = await supabase
    .from('properties')
    .insert({
      user_id: userId,
      source: input.source,
      source_url: input.sourceUrl ?? null,
      portal: input.portal ?? null,
      title: input.title ?? '',
      type: input.type ?? 'HOUSE',
      price: input.price ?? null,
      currency: input.currency ?? 'USD',
      address: input.address ?? null,
      neighborhood: input.neighborhood ?? null,
      city: input.city ?? null,
      province: input.province ?? null,
      surface_total: input.surfaceTotal ?? null,
      surface_covered: input.surfaceCovered ?? null,
      rooms: input.rooms ?? null,
      bedrooms: input.bedrooms ?? null,
      bathrooms: input.bathrooms ?? null,
      garage: input.garage ?? false,
      description: input.description ?? null,
      features: input.features ?? [],
      expenses: input.expenses ?? null,
      remote_images: input.remoteImages ?? [],
    })
    .select('id')
    .single()

  if (error || !data) {
    log.error('property.insert.failed', error)
    return null
  }
  return data.id
}

export async function deleteProperty(id: string): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const { error } = await supabase.from('properties').delete().eq('id', id)
  return !error
}
