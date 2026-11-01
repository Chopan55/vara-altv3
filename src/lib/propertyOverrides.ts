import type { Property } from '@/types'

/**
 * Correcciones que la persona hace a mano sobre una propiedad (cuando el aviso no trajo el dato o lo trajo mal).
 * Se aplican en UN solo lugar —al cargar las propiedades— para que ficha, comparador y análisis vean lo mismo.
 * Viven en este navegador; sincronizarlas con la cuenta requiere una columna en la base (queda anotado).
 */
export const OVERRIDES_KEY = 'vara_property_overrides'

export type PropertyEdits = Partial<Pick<Property, 'bedrooms' | 'bathrooms' | 'rooms' | 'surface' | 'coveredSurface' | 'garage' | 'ageYears' | 'expenses'>>

type Store = Record<string, PropertyEdits>

function read(): Store {
  if (typeof localStorage === 'undefined') return {}
  try {
    const parsed = JSON.parse(localStorage.getItem(OVERRIDES_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Store) : {}
  } catch { return {} }
}

export function saveOverride(propertyId: string, patch: PropertyEdits): void {
  try {
    const all = read()
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify({ ...all, [propertyId]: { ...all[propertyId], ...patch } }))
  } catch { /* sin acceso al almacenamiento: no se guarda */ }
}

/** Lo que la persona escribió manda sobre lo que trajo el aviso. */
export function applyOverrides<T extends Property>(p: T): T {
  const patch = read()[p.id]
  if (!patch) return p
  const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as PropertyEdits
  return { ...p, ...clean }
}

/** "3" → 3 · "" → undefined · "abc" → undefined · negativos no valen. */
export function parseCount(raw: string): number | undefined {
  const t = raw.trim()
  if (!t) return undefined
  const cleaned = t.replace(',', '.').replace(/[^\d.]/g, '')
  if (!cleaned) return undefined
  const n = Number(cleaned)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}
