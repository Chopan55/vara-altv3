/**
 * Encaje con la persona (user-fit).
 *
 * No es valor de mercado: una casa puede ser un buen precio y no servirte, o
 * servirte y ser cara. Se calcula aparte y nunca se mezcla con el precio.
 *
 * Reglas:
 *  - Solo hay MISMATCH cuando el aviso dice lo contrario. Que no mencione la
 *    pileta es UNKNOWN, no "sin pileta".
 *  - El puntaje usa solo lo verificable, ponderado por importancia, y se
 *    explica. Los desconocidos no suman ni restan: se informan aparte.
 *  - Un DEAL_BREAKER incumplido anula un puntaje alto.
 */

import type {
  CriterionKey, FitItem, FitStatus, Importance, ListingFacts, PreferenceRule,
  UserFit, UserPreferences,
} from './types'
import { norm } from './normalize'

const IMPORTANCE_WEIGHT: Record<Importance, number> = {
  MUST_HAVE: 3, IMPORTANT: 2, NICE_TO_HAVE: 1, NOT_IMPORTANT: 0, DEAL_BREAKER: 3,
}

const LABEL: Record<CriterionKey, string> = {
  budget: 'Presupuesto', location: 'Ubicación', bedrooms: 'Dormitorios', bathrooms: 'Baños',
  coveredArea: 'Superficie cubierta', landArea: 'Terreno', parking: 'Cochera', pool: 'Pileta',
  garden: 'Jardín', study: 'Escritorio', maxAge: 'Antigüedad', kind: 'Tipo de propiedad',
}

interface Eval { status: FitStatus; detail: string }
const unknown = (detail: string): Eval => ({ status: 'UNKNOWN', detail })

function num(t: PreferenceRule['target']): number | undefined {
  return typeof t === 'number' && isFinite(t) ? t : undefined
}

function atLeast(actual: number | undefined, wanted: number | undefined, noun: string): Eval {
  if (wanted === undefined) return unknown('Sin valor pedido')
  if (actual === undefined) return unknown(`${noun} sin confirmar`)
  return actual >= wanted
    ? { status: 'MATCH', detail: `${actual} ${noun} (pediste ${wanted} o más)` }
    : { status: 'MISMATCH', detail: `${actual} ${noun} (pediste ${wanted} o más)` }
}

function amenity(l: ListingFacts, name: string, label: string): Eval {
  if (l.amenities?.includes(name)) return { status: 'MATCH', detail: `${label}: lo menciona el aviso` }
  return unknown(`${label} sin confirmar`)
}

function evaluate(l: ListingFacts, rule: PreferenceRule, currency?: 'USD' | 'ARS'): Eval {
  switch (rule.key) {
    case 'budget': {
      const max = num(rule.target)
      if (max === undefined) return unknown('Sin presupuesto cargado')
      if (!l.price) return unknown('El aviso no informa precio')
      if (currency && l.currency && currency !== l.currency) return unknown('El presupuesto y el precio están en monedas distintas')
      const cur = l.currency ?? currency ?? 'USD'
      return l.price <= max
        ? { status: 'MATCH', detail: `${cur} ${l.price.toLocaleString('es-AR')} entra en tu presupuesto` }
        : { status: 'MISMATCH', detail: `Pide ${cur} ${l.price.toLocaleString('es-AR')}, por encima de tu tope de ${cur} ${max.toLocaleString('es-AR')}` }
    }
    case 'location': {
      const want = typeof rule.target === 'string' ? norm(rule.target) : ''
      if (!want) return unknown('Sin zona cargada')
      const haystack = norm([l.community, l.microzone, l.neighborhood, l.city, l.address].filter(Boolean).join(' '))
      if (!haystack) return unknown('El aviso no informa ubicación')
      return haystack.includes(want)
        ? { status: 'MATCH', detail: `Está en la zona que buscás (${rule.target})` }
        : { status: 'MISMATCH', detail: `No figura en ${rule.target}` }
    }
    case 'bedrooms': return atLeast(l.bedrooms, num(rule.target), 'dormitorios')
    case 'bathrooms': return atLeast(l.bathrooms, num(rule.target), 'baños')
    case 'coveredArea': return atLeast(l.coveredArea, num(rule.target), 'm² cubiertos')
    case 'landArea': return atLeast(l.landArea, num(rule.target), 'm² de terreno')
    case 'parking': {
      const wanted = num(rule.target) ?? 1
      if (l.parking !== undefined) return atLeast(l.parking, wanted, 'cocheras')
      return amenity(l, 'cochera', 'Cochera')
    }
    case 'pool':
      if (rule.target === false) return unknown('Sin preferencia')
      if (l.pool === true) return { status: 'MATCH', detail: 'Tiene pileta' }
      if (l.pool === false) return { status: 'MISMATCH', detail: 'No tiene pileta' }
      return unknown('Pileta sin confirmar')
    case 'garden': return amenity(l, 'jardín', 'Jardín')
    case 'study': return amenity(l, 'escritorio', 'Escritorio')
    case 'maxAge': {
      const max = num(rule.target)
      if (max === undefined) return unknown('Sin antigüedad máxima')
      if (l.ageYears === undefined) return unknown('Antigüedad sin confirmar')
      return l.ageYears <= max
        ? { status: 'MATCH', detail: `${l.ageYears} años (máximo ${max})` }
        : { status: 'MISMATCH', detail: `${l.ageYears} años (máximo ${max})` }
    }
    case 'kind': {
      if (!l.kind) return unknown('Tipo de propiedad sin confirmar')
      return l.kind === rule.target
        ? { status: 'MATCH', detail: 'Es el tipo de propiedad que buscás' }
        : { status: 'MISMATCH', detail: 'No es el tipo de propiedad que buscás' }
    }
  }
}

export function evaluateFit(listing: ListingFacts, prefs: UserPreferences | null | undefined): UserFit {
  const rules = (prefs?.rules ?? []).filter(r => r.importance !== 'NOT_IMPORTANT')
  if (!prefs || rules.length === 0) {
    return {
      state: 'NO_PROFILE', items: [], score: null, dealBreakerHit: false, dealBreakers: [],
      scoreExplanation: 'Todavía no sé qué buscás, así que no puedo decirte cuánto encaja con vos.',
    }
  }

  const items: FitItem[] = rules.map(r => {
    const e = evaluate(listing, r, prefs.budgetCurrency)
    return { key: r.key, label: LABEL[r.key], importance: r.importance, status: e.status, detail: e.detail }
  })

  const known = items.filter(i => i.status !== 'UNKNOWN')
  const earned = known.filter(i => i.status === 'MATCH').reduce((s, i) => s + IMPORTANCE_WEIGHT[i.importance], 0)
  const possible = known.reduce((s, i) => s + IMPORTANCE_WEIGHT[i.importance], 0)
  const unknownCount = items.length - known.length

  const dealBreakers = items.filter(i => i.importance === 'DEAL_BREAKER' && i.status === 'MISMATCH').map(i => i.detail)
  const dealBreakerHit = dealBreakers.length > 0

  let score: number | null = possible > 0 ? Math.round((earned / possible) * 100) : null
  const matches = known.filter(i => i.status === 'MATCH').length

  let explanation: string
  if (score === null) {
    explanation = 'Todavía no hay datos del aviso para verificar lo que pediste.'
  } else {
    explanation =
      `Cumple ${matches} de ${known.length} criterios que se pueden verificar, ` +
      'contando más los imprescindibles que los deseables.' +
      (unknownCount ? ` Quedan ${unknownCount} sin confirmar.` : '')
  }
  if (dealBreakerHit && score !== null) {
    score = Math.min(score, 25)
    explanation += ' Incumple algo que marcaste como no negociable, por eso el puntaje se limita.'
  }

  return { state: 'EVALUATED', items, score, scoreExplanation: explanation, dealBreakerHit, dealBreakers }
}
