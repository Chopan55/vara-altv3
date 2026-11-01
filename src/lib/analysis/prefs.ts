/**
 * Preferencias de la persona — perfilado progresivo.
 *
 * Nada de formulario largo ni obligatorio. Se piden cuatro cosas, después de
 * haber mostrado valor, y cada respuesta se traduce a reglas con importancia.
 * Viven solo en este navegador y nunca se incluyen en lo que se comparte.
 */

import type { PreferenceRule, UserPreferences } from './types'

const KEY = 'vara_v3_prefs'

export type MustHave = 'pool' | 'garden' | 'parking' | 'study'

export interface ProfileAnswers {
  budget?: number
  budgetCurrency?: 'USD' | 'ARS'
  location?: string
  bedrooms?: number
  mustHaves?: MustHave[]
}

export function buildPreferences(a: ProfileAnswers): UserPreferences | null {
  const rules: PreferenceRule[] = []
  if (a.budget && a.budget > 0) rules.push({ key: 'budget', importance: 'MUST_HAVE', target: a.budget })
  if (a.location?.trim()) rules.push({ key: 'location', importance: 'MUST_HAVE', target: a.location.trim() })
  if (a.bedrooms && a.bedrooms > 0) rules.push({ key: 'bedrooms', importance: 'MUST_HAVE', target: a.bedrooms })
  for (const m of a.mustHaves ?? []) rules.push({ key: m, importance: 'MUST_HAVE', target: true })
  if (rules.length === 0) return null
  return { rules, budgetCurrency: a.budgetCurrency ?? 'USD' }
}

export function readPreferences(): UserPreferences | null {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as UserPreferences) : null
    return parsed && Array.isArray(parsed.rules) && parsed.rules.length ? parsed : null
  } catch { return null }
}

export function writePreferences(p: UserPreferences | null): void {
  try {
    if (p) localStorage.setItem(KEY, JSON.stringify(p))
    else localStorage.removeItem(KEY)
  } catch { /* sin almacenamiento, la sesión sigue funcionando */ }
}
