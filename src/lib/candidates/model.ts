/**
 * Property Candidate — el modelo que faltaba.
 *
 * Una persona mira varias propiedades. Eso no significa que cada una sea una
 * operación. VARA pedía el compromiso (crear una operación) antes que la
 * decisión (elegir cuál), y por eso el journey del comprador se cortaba justo
 * en el medio: quien encontró tres casas no tenía dónde ponerlas.
 *
 * Un candidato es una propiedad **en evaluación**. Se vuelve operación cuando
 * la persona decide avanzar, y al promover se conserva todo el contexto
 * previo: notas, estado, visita.
 *
 * Todo lo de acá es puro y testeable. La persistencia vive en
 * `src/lib/candidates/store.ts`.
 */

import type { Property } from '@/types'

export type CandidateStatus =
  | 'ANALYZING'
  | 'FAVORITE'
  | 'VISITED'
  | 'DISCARDED'
  | 'PROMOTED'

export const CANDIDATE_STATUS_LABELS: Record<CandidateStatus, string> = {
  ANALYZING: 'En análisis',
  FAVORITE: 'Me interesa',
  VISITED: 'Visitada',
  DISCARDED: 'Descartada',
  PROMOTED: 'Con operación',
}

/** Orden en que se muestran. Lo descartado va último: es ruido para decidir. */
export const CANDIDATE_STATUS_ORDER: CandidateStatus[] = [
  'FAVORITE', 'VISITED', 'ANALYZING', 'PROMOTED', 'DISCARDED',
]

export interface PropertyCandidate extends Property {
  status: CandidateStatus
  /** Notas de la persona mientras decide. */
  userNotes?: string
  discardReason?: string
  /** Operación creada a partir de este candidato, si se promovió. */
  promotedOperationId?: string
  promotedAt?: number
  /** Campos que el importador no pudo completar. Se piden solo estos. */
  incompleteFields: string[]
  source: 'imported' | 'draft' | 'manual'
  sourceUrl?: string
  portal?: string | null
  addedAt: number
}

/**
 * Transiciones permitidas.
 *
 * Una propiedad descartada se puede recuperar: la gente cambia de opinión, y
 * perder el análisis por un clic sería cruel. Lo que NO se puede es volver
 * atrás desde PROMOTED — ahí ya existe una operación con tareas y documentos,
 * y "despromover" la dejaría huérfana.
 */
export const ALLOWED_CANDIDATE_TRANSITIONS: Record<CandidateStatus, CandidateStatus[]> = {
  ANALYZING: ['FAVORITE', 'VISITED', 'DISCARDED', 'PROMOTED'],
  FAVORITE: ['ANALYZING', 'VISITED', 'DISCARDED', 'PROMOTED'],
  VISITED: ['ANALYZING', 'FAVORITE', 'DISCARDED', 'PROMOTED'],
  DISCARDED: ['ANALYZING', 'FAVORITE'],
  PROMOTED: [],
}

export function canTransitionCandidate(from: CandidateStatus, to: CandidateStatus): boolean {
  return ALLOWED_CANDIDATE_TRANSITIONS[from].includes(to)
}

/** Los que siguen en juego. Es la lista que importa para decidir. */
export function activeCandidates(list: PropertyCandidate[]): PropertyCandidate[] {
  return list.filter(c => c.status !== 'DISCARDED' && c.status !== 'PROMOTED')
}

export function sortCandidates(list: PropertyCandidate[]): PropertyCandidate[] {
  return [...list].sort((a, b) => {
    const byStatus =
      CANDIDATE_STATUS_ORDER.indexOf(a.status) - CANDIDATE_STATUS_ORDER.indexOf(b.status)
    if (byStatus !== 0) return byStatus
    return b.addedAt - a.addedAt
  })
}

// ───────────────────────── Comparación ─────────────────────────

/**
 * Lo que de verdad sirve para comparar dos propiedades.
 *
 * NO hay un puntaje. Un número de 0 a 100 que combina precio, superficie y
 * ambientes no significa nada: cada persona pondera distinto. Lo que hacemos
 * es poner los datos uno al lado del otro y marcar cuál gana en cada
 * dimensión, que es lo que alguien haría en un papel.
 */
export interface ComparisonRow {
  key: string
  label: string
  /** Valor formateado por candidato, en el mismo orden en que se pasó la lista. */
  values: (string | null)[]
  /** Índices de los candidatos que ganan en esta fila. Vacío = empate o sin dato. */
  bestIndexes: number[]
  note?: string
}

function fmtMoney(n: number | undefined, currency = 'USD'): string | null {
  if (typeof n !== 'number' || n <= 0) return null
  return `${currency} ${n.toLocaleString('es-AR')}`
}

function bestBy(values: (number | null)[], direction: 'lower' | 'higher'): number[] {
  const known = values.filter((v): v is number => v !== null)
  if (known.length < 2) return []           // con un solo dato no hay comparación
  const target = direction === 'lower' ? Math.min(...known) : Math.max(...known)
  // Si todos valen lo mismo es empate: no destacamos nada.
  if (known.every(v => v === target)) return []
  return values.flatMap((v, i) => (v === target ? [i] : []))
}

export function buildComparison(candidates: PropertyCandidate[]): ComparisonRow[] {
  if (candidates.length < 2) return []

  const prices = candidates.map(c => (c.price > 0 ? c.price : null))
  const surfaces = candidates.map(c => (c.surface > 0 ? c.surface : null))
  const pricePerM2 = candidates.map(c =>
    c.price > 0 && c.surface > 0 ? Math.round(c.price / c.surface) : null,
  )
  const rooms = candidates.map(c => (c.rooms > 0 ? c.rooms : null))
  const bedrooms = candidates.map(c => (c.bedrooms > 0 ? c.bedrooms : null))
  const expenses = candidates.map(c => (c.expenses && c.expenses > 0 ? c.expenses : null))
  const age = candidates.map(c => (typeof c.ageYears === 'number' ? c.ageYears : null))

  const rows: ComparisonRow[] = [
    {
      key: 'price',
      label: 'Precio',
      values: prices.map((p, i) => fmtMoney(p ?? undefined, candidates[i].currency)),
      bestIndexes: bestBy(prices, 'lower'),
    },
    {
      key: 'surface',
      label: 'Superficie',
      values: surfaces.map(s => (s === null ? null : `${s} m²`)),
      bestIndexes: bestBy(surfaces, 'higher'),
    },
    {
      key: 'price_m2',
      label: 'Precio por m²',
      values: pricePerM2.map((p, i) => fmtMoney(p ?? undefined, candidates[i].currency)),
      bestIndexes: bestBy(pricePerM2, 'lower'),
      note: 'Es la comparación más directa entre propiedades de distinto tamaño.',
    },
    {
      key: 'rooms',
      label: 'Ambientes',
      values: rooms.map(r => (r === null ? null : String(r))),
      bestIndexes: bestBy(rooms, 'higher'),
    },
    {
      key: 'bedrooms',
      label: 'Dormitorios',
      values: bedrooms.map(b => (b === null ? null : String(b))),
      bestIndexes: bestBy(bedrooms, 'higher'),
    },
    {
      key: 'expenses',
      label: 'Expensas',
      values: expenses.map(e => (e === null ? null : fmtMoney(e, 'ARS'))),
      bestIndexes: bestBy(expenses, 'lower'),
    },
    {
      key: 'age',
      label: 'Antigüedad',
      values: age.map(a => (a === null ? null : a === 0 ? 'A estrenar' : `${a} años`)),
      bestIndexes: bestBy(age, 'lower'),
    },
  ]

  // Una fila sin ningún dato no aporta: se saca en vez de mostrar guiones.
  return rows.filter(r => r.values.some(v => v !== null))
}

// ───────────────────────── Scoring ponderado ─────────────────────────

export type ScoringCriterion = 'price_m2' | 'price' | 'surface' | 'rooms' | 'bedrooms' | 'expenses' | 'age'

export const SCORING_CRITERION_LABELS: Record<ScoringCriterion, string> = {
  price_m2: 'Precio/m²',
  price: 'Precio total',
  surface: 'Superficie',
  rooms: 'Ambientes',
  bedrooms: 'Dormitorios',
  expenses: 'Expensas',
  age: 'Antigüedad',
}

export interface ScoringWeight {
  criterion: ScoringCriterion
  enabled: boolean
  /** 0–100, se normaliza entre los activos */
  weight: number
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeight[] = [
  { criterion: 'price_m2', enabled: true,  weight: 35 },
  { criterion: 'price',    enabled: true,  weight: 25 },
  { criterion: 'surface',  enabled: true,  weight: 20 },
  { criterion: 'rooms',    enabled: true,  weight: 10 },
  { criterion: 'bedrooms', enabled: false, weight: 5  },
  { criterion: 'expenses', enabled: false, weight: 3  },
  { criterion: 'age',      enabled: false, weight: 2  },
]

function rawValue(c: PropertyCandidate, criterion: ScoringCriterion): number | null {
  switch (criterion) {
    case 'price_m2': return c.price > 0 && c.surface > 0 ? c.price / c.surface : null
    case 'price':    return c.price > 0 ? c.price : null
    case 'surface':  return c.surface > 0 ? c.surface : null
    case 'rooms':    return c.rooms > 0 ? c.rooms : null
    case 'bedrooms': return c.bedrooms > 0 ? c.bedrooms : null
    case 'expenses': return c.expenses && c.expenses > 0 ? c.expenses : null
    case 'age':      return typeof (c as unknown as Record<string, unknown>).ageYears === 'number' ? (c as unknown as Record<string, unknown>).ageYears as number : null
  }
}

const LOWER_IS_BETTER: ScoringCriterion[] = ['price_m2', 'price', 'expenses', 'age']

export interface CandidateScore {
  candidateId: string
  score: number
  breakdown: Partial<Record<ScoringCriterion, number>>
}

/**
 * Scoring ponderado: normaliza cada criterio (min-max) y combina con los pesos.
 * Si una propiedad no tiene el dato, recibe 0 en esa dimensión.
 */
export function scoreCandidates(
  candidates: PropertyCandidate[],
  weights: ScoringWeight[],
): CandidateScore[] {
  const active = weights.filter(w => w.enabled && w.weight > 0)
  const totalWeight = active.reduce((s, w) => s + w.weight, 0)

  const scores: CandidateScore[] = candidates.map(c => ({
    candidateId: c.id,
    score: 0,
    breakdown: {},
  }))

  if (active.length === 0 || totalWeight === 0) return scores

  for (const { criterion, weight } of active) {
    const values = candidates.map(c => rawValue(c, criterion))
    const known = values.filter((v): v is number => v !== null)
    if (known.length < 1) continue

    const min = Math.min(...known)
    const max = Math.max(...known)
    const range = max - min

    values.forEach((v, i) => {
      let normalized: number
      if (v === null) {
        normalized = 0
      } else if (range === 0) {
        normalized = 100
      } else {
        const ratio = (v - min) / range
        normalized = LOWER_IS_BETTER.includes(criterion) ? (1 - ratio) * 100 : ratio * 100
      }
      const points = normalized * (weight / totalWeight)
      scores[i].breakdown[criterion] = Math.round(points * 10) / 10
      scores[i].score += points
    })
  }

  scores.forEach(s => { s.score = Math.round(s.score) })
  return scores
}

/**
 * Qué le falta a un candidato para poder decidir sobre él.
 * Es lo que la tarjeta muestra como "qué falta".
 */
export function missingForDecision(c: PropertyCandidate): string[] {
  const missing: string[] = []
  if (!(c.price > 0)) missing.push('precio')
  if (!(c.surface > 0)) missing.push('superficie')
  if (!c.city && !c.neighborhood) missing.push('ubicación')
  return missing
}
