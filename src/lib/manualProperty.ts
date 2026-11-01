import type { ScrapedData, ScrapeResult } from '@/app/api/scrape-property/route'

/**
 * Carga manual de una propiedad, para cuando no hay link o el portal bloquea la
 * lectura. Produce el mismo resultado que la importación, así se guarda y se
 * compara igual que cualquier otra. Solo se informa lo que la persona escribió.
 */
export interface ManualForm {
  title: string
  price: string
  currency: 'USD' | 'ARS'
  address: string
  neighborhood: string
  city: string
  totalM2: string
  rooms: string
  bedrooms: string
  bathrooms: string
}

export const EMPTY_MANUAL: ManualForm = {
  title: '', price: '', currency: 'USD', address: '', neighborhood: '', city: '', totalM2: '', rooms: '', bedrooms: '', bathrooms: '',
}

const num = (v: string): number | undefined => {
  // Se quitan unidades ("400 m2") antes de leer el número; el punto es separador de miles, no decimal.
  const n = Number(v.toLowerCase().replace(/m\s*[²2]|mts?|metros?/g, '').replace(/\D/g, ''))
  return Number.isFinite(n) && n > 0 ? n : undefined
}
const txt = (v: string): string | undefined => v.trim() || undefined

export function buildManualData(f: ManualForm): ScrapedData {
  const d: ScrapedData = {
    title: txt(f.title), price: num(f.price), currency: f.currency, address: txt(f.address),
    neighborhood: txt(f.neighborhood), city: txt(f.city), totalM2: num(f.totalM2),
    rooms: num(f.rooms), bedrooms: num(f.bedrooms), bathrooms: num(f.bathrooms),
  }
  return Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined)) as ScrapedData
}

/** Qué datos clave todavía no están, en palabras de la persona. */
export function missingManual(d: ScrapedData): string[] {
  const out: string[] = []
  if (!d.price) out.push('precio')
  if (!d.totalM2) out.push('superficie')
  if (!d.address && !d.neighborhood && !d.city) out.push('ubicación')
  if (!d.rooms && !d.bedrooms) out.push('ambientes')
  return out
}

/** Con precio o ubicación alcanza para empezar; el resto se completa después. */
export function canSubmitManual(d: ScrapedData): boolean {
  return Boolean(d.price || d.address || d.neighborhood || d.city || d.title)
}

export function manualToResult(f: ManualForm): ScrapeResult {
  const data = buildManualData(f)
  return { status: 'success', url: '', portal: null, method: 'paste', data, photos: [], missingFields: missingManual(data) }
}
