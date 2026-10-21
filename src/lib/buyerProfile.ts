/**
 * Perfil de búsqueda del comprador. Se guarda en el navegador; sirve para ordenar
 * qué busca y qué pesa más. No dispara búsquedas ni inventa resultados.
 */
export const IMPORTANCE = [
  { id: 'MUST', label: 'Imprescindible' },
  { id: 'IMPORTANT', label: 'Importante' },
  { id: 'NICE', label: 'Suma' },
  { id: 'IRRELEVANT', label: 'No me importa' },
  { id: 'DEALBREAKER', label: 'Descarta' },
] as const
export type Importance = (typeof IMPORTANCE)[number]['id']

export const CRITERIA = [
  { id: 'garden', label: 'Jardín' },
  { id: 'pool', label: 'Pileta' },
  { id: 'garage', label: 'Cochera' },
  { id: 'security', label: 'Seguridad' },
  { id: 'schools', label: 'Colegios cerca' },
  { id: 'commute', label: 'Cerca del trabajo' },
  { id: 'quiet', label: 'Zona tranquila' },
  { id: 'condition', label: 'Buen estado' },
] as const

export interface BuyerProfile {
  type: string
  zone: string
  budget: string
  currency: 'USD' | 'ARS' | 'MXN'
  bedrooms: string
  surface: string
  financing: 'NONE' | 'MORTGAGE' | 'UNKNOWN'
  importance: Partial<Record<string, Importance>>
}

export const EMPTY_PROFILE: BuyerProfile = {
  type: '', zone: '', budget: '', currency: 'USD', bedrooms: '', surface: '', financing: 'UNKNOWN', importance: {},
}

const KEY = 'vara_buyer_profile'

export function loadProfile(): BuyerProfile {
  try { return { ...EMPTY_PROFILE, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<BuyerProfile>) } } catch { return EMPTY_PROFILE }
}

export function saveProfile(p: BuyerProfile): void {
  try { localStorage.setItem(KEY, JSON.stringify(p)) } catch {}
}

/** Resumen de lo que el usuario dijo; vacío si no cargó nada. */
export function summarize(p: BuyerProfile): string[] {
  const out: string[] = []
  if (p.type || p.zone) out.push([p.type, p.zone && `en ${p.zone}`].filter(Boolean).join(' '))
  if (p.budget) out.push(`hasta ${p.currency} ${p.budget}`)
  if (p.bedrooms) out.push(`${p.bedrooms}+ dormitorios`)
  if (p.surface) out.push(`${p.surface}+ m²`)
  for (const c of CRITERIA) {
    const v = p.importance[c.id]
    if (v === 'MUST') out.push(`${c.label} imprescindible`)
    if (v === 'DEALBREAKER') out.push(`sin ${c.label.toLowerCase()}: descarta`)
  }
  return out
}

const LEVEL: Record<Importance, 0 | 1 | 2 | 3 | 4 | 5> = { MUST: 5, DEALBREAKER: 5, IMPORTANT: 4, NICE: 2, IRRELEVANT: 0 }

/**
 * Traduce el perfil a la escala 0-5 del comparador, solo para criterios que el
 * comparador mide de verdad. Lo que no mide (jardín, pileta, colegios, ruido…) no
 * se traduce: sería aparentar un dato que no hay. Devuelve vacío si no hay señal.
 */
export function profileToImportance(p: BuyerProfile): Partial<Record<string, 0 | 1 | 2 | 3 | 4 | 5>> {
  const out: Partial<Record<string, 0 | 1 | 2 | 3 | 4 | 5>> = {}
  if (p.budget) out.price = 4
  if (p.bedrooms) out.bedrooms = 4
  if (p.surface) out.surface = 4
  const map: [string, string][] = [['garage', 'garage'], ['condition', 'condition']]
  for (const [crit, key] of map) {
    const v = p.importance[crit]
    if (v) out[key] = LEVEL[v]
  }
  const amen = ['garden', 'pool', 'security'].map(k => p.importance[k]).filter((v): v is Importance => !!v)
  if (amen.length) out.amenities = Math.max(...amen.map(v => LEVEL[v])) as 0 | 1 | 2 | 3 | 4 | 5
  return out
}
