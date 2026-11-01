import type { Confidence, FreshnessInfo, PropertyCondition, PropertyKind, SearchScope, Verdict, PricePosition } from '@/lib/analysis/types'

export const money = (n: number, cur: 'USD' | 'ARS'): string => `${cur} ${n.toLocaleString('es-AR')}`

export const moneyK = (n: number, cur: 'USD' | 'ARS'): string =>
  n >= 1000 ? `${cur} ${Math.round(n / 1000).toLocaleString('es-AR')}k` : money(n, cur)

export const SCOPE_TEXT: Record<SearchScope, string> = {
  SAME_COMMUNITY: 'la misma comunidad',
  SAME_MICROZONE: 'la misma microzona',
  NEIGHBORHOOD: 'el mismo barrio',
  CITY: 'la misma ciudad',
  EQUIVALENT_ZONE: 'zonas equivalentes',
}

export const CONFIDENCE_TEXT: Record<Confidence, string> = {
  HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja', INSUFFICIENT: 'Insuficiente',
}

export const POSITION_TEXT: Record<PricePosition, string> = {
  ABOVE: 'Por encima', WITHIN: 'En línea', BELOW: 'Por debajo', UNKNOWN: 'Sin referencia',
}

export const CONFIDENCE_DOTS: Record<Confidence, number> = { HIGH: 3, MEDIUM: 2, LOW: 1, INSUFFICIENT: 0 }

export const VERDICT_STYLE: Record<Verdict, { bar: string; text: string; label: string }> = {
  PROMISING: { bar: 'bg-emerald-500', text: 'text-emerald-700', label: 'Buena candidata' },
  CAUTION: { bar: 'bg-amber-500', text: 'text-amber-700', label: 'Con cuidado' },
  WEAK: { bar: 'bg-rose-500', text: 'text-rose-700', label: 'Poco recomendable' },
  UNDETERMINED: { bar: 'bg-slate-400', text: 'text-slate-600', label: 'Todavía sin señal clara' },
}

export const CONDITION_TEXT: Record<PropertyCondition, string> = {
  new: 'A estrenar', excellent: 'Excelente', good: 'Bueno', to_refresh: 'A actualizar', to_renovate: 'A refaccionar',
}

export const KIND_TEXT: Record<PropertyKind, string> = {
  house: 'Casa', apartment: 'Departamento', ph: 'PH', lot: 'Lote', other: 'Propiedad',
}

export function freshnessText(f: FreshnessInfo): string {
  if (f.ageDays === null) return 'Sin fecha de publicación'
  if (f.basis === 'OBSERVED') return 'Sin fecha de publicación'
  const label = f.basis === 'PRICE_CHANGE' ? 'Precio actualizado' : f.basis === 'LAST_UPDATE' ? 'Actualizado' : 'Publicado'
  if (f.ageDays < 2) return `${label} hoy o ayer`
  if (f.ageDays < 60) return `${label} hace ${f.ageDays} días`
  return `${label} hace ${Math.round(f.ageDays / 30)} meses`
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch { return false }
  }
}
