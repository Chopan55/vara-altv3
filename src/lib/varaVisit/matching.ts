/**
 * Matching de Visit Partners.
 *
 * Dos reglas que no se negocian:
 *
 * 1. Los filtros duros van ANTES del ranking. Un partner suspendido o sin
 *    certificar no compite por un puesto bajo: directamente no está. Si el
 *    filtro fuera una penalización de score, un partner suspendido podría
 *    ganar por tener mejor rating que el resto.
 *
 * 2. El score es para ORDENAR, no para mostrar. Al cliente se le muestran
 *    las métricas crudas (4.92 ★, 86 visitas, 98% puntualidad). Un número
 *    inventado de 0 a 100 no significa nada para quien tiene que decidir
 *    si deja entrar a alguien a su casa.
 *
 * Sin geocoding todavía: la distancia se aproxima por superposición de zonas
 * declaradas. Cuando haya coordenadas, se reemplaza `zoneAffinity` y el resto
 * del archivo queda igual.
 */

import type {
  PartnerPublicProfile,
  VisitServiceType,
} from '@/types/varaVisit'
import { canReceiveVisits } from '@/types/varaVisit'

export interface MatchCriteria {
  serviceType: VisitServiceType
  /** Zona donde ocurre la visita. Ej: "Pilar". */
  zoneLabel: string
  /** YYYY-MM-DD */
  date: string
  /** HH:MM */
  time: string
  /** Si el cliente puso un techo. */
  maxPrice?: number
}

export interface MatchResult {
  partner: PartnerPublicProfile
  /** 0–1. Interno: ordena la lista, no se muestra. */
  score: number
  /** Por qué quedó donde quedó. Se usa en admin, y hace auditable el ranking. */
  reasons: string[]
}

export type ExclusionReason =
  | 'NOT_ACTIVE'
  | 'NOT_CERTIFIED'
  | 'IDENTITY_NOT_VERIFIED'
  | 'SERVICE_NOT_OFFERED'
  | 'ZONE_NOT_COVERED'
  | 'NOT_AVAILABLE'
  | 'ABOVE_MAX_PRICE'

export const EXCLUSION_LABELS: Record<ExclusionReason, string> = {
  NOT_ACTIVE: 'No está activo',
  NOT_CERTIFIED: 'Sin certificación de VARA',
  IDENTITY_NOT_VERIFIED: 'Identidad sin verificar',
  SERVICE_NOT_OFFERED: 'No ofrece este servicio',
  ZONE_NOT_COVERED: 'No cubre esta zona',
  NOT_AVAILABLE: 'Sin disponibilidad en ese horario',
  ABOVE_MAX_PRICE: 'Por encima del precio máximo',
}

/** Normaliza para comparar zonas escritas a mano: "Pilar " ≈ "pilar" ≈ "Pilár". */
function normalizeZone(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim()
}

/**
 * Afinidad de zona, 0–1.
 * 1 = vive/trabaja habitualmente ahí · 0.7 = la declaró como cobertura · 0 = no llega.
 */
export function zoneAffinity(partner: PartnerPublicProfile, zoneLabel: string): number {
  const target = normalizeZone(zoneLabel)
  if (!target) return 0
  if (normalizeZone(partner.homeZoneLabel).includes(target)) return 1
  const covers = partner.coverageZones.some(z => {
    const n = normalizeZone(z)
    return n === target || n.includes(target) || target.includes(n)
  })
  return covers ? 0.7 : 0
}

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

/**
 * ¿Trabaja ese día a esa hora?
 *
 * Si el partner no declaró disponibilidad, asumimos que SÍ y que lo confirma
 * al aceptar. Bloquear por un campo vacío dejaría el marketplace en cero
 * durante todo el piloto, que es peor que una asignación que se rechaza.
 */
export function isAvailableAt(
  availability: Record<string, string[]> | undefined,
  date: string,
  time: string,
): boolean {
  if (!availability || Object.keys(availability).length === 0) return true

  const d = new Date(`${date}T00:00:00`)
  if (Number.isNaN(d.getTime())) return true
  const slots = availability[WEEKDAY_KEYS[d.getDay()]]
  if (!slots || slots.length === 0) return false

  const minutes = toMinutes(time)
  if (minutes === null) return true

  return slots.some(slot => {
    const [from, to] = slot.split('-').map(s => toMinutes(s.trim()))
    if (from === null || to === null) return false
    return minutes >= from && minutes <= to
  })
}

/**
 * Filtros duros. Devuelve la razón de exclusión, o null si el partner pasa.
 * Se evalúa en orden de gravedad: lo primero que aparece es lo que se reporta.
 */
export function excludeReason(
  partner: PartnerPublicProfile,
  c: MatchCriteria,
  availability?: Record<string, string[]>,
): ExclusionReason | null {
  if (!canReceiveVisits(partner.status)) return 'NOT_ACTIVE'
  if (!partner.verifiedIdentity) return 'IDENTITY_NOT_VERIFIED'
  if (!partner.certified) return 'NOT_CERTIFIED'
  if (!partner.serviceTypes.includes(c.serviceType)) return 'SERVICE_NOT_OFFERED'
  if (zoneAffinity(partner, c.zoneLabel) === 0) return 'ZONE_NOT_COVERED'
  if (!isAvailableAt(availability, c.date, c.time)) return 'NOT_AVAILABLE'
  if (c.maxPrice !== undefined && partner.ratePerVisit > c.maxPrice) return 'ABOVE_MAX_PRICE'
  return null
}

/**
 * Pesos del ranking. Suman 1.
 * Están acá, explícitos y en un solo lugar, para poder discutirlos sin leer código.
 */
export const MATCH_WEIGHTS = {
  zone: 0.30,
  rating: 0.25,
  punctuality: 0.20,
  completion: 0.10,
  experience: 0.10,
  price: 0.05,
} as const

/**
 * Score 0–1 de un partner que ya pasó los filtros.
 *
 * Los partners sin historial (rating null) reciben 0.6 en esas dimensiones,
 * no 0: un partner nuevo y certificado no es peor que uno malo con historial.
 * Sin esto, nadie nuevo conseguiría jamás su primera visita.
 */
export function scorePartner(partner: PartnerPublicProfile, c: MatchCriteria): MatchResult {
  const reasons: string[] = []

  const zone = zoneAffinity(partner, c.zoneLabel)
  if (zone === 1) reasons.push('Trabaja habitualmente en esta zona')
  else if (zone > 0) reasons.push('Cubre esta zona')

  const NEUTRAL = 0.6

  /*
   * El rating NO es lineal sobre 5.
   *
   * Con `avg / 5`, un partner de 2.5 sacaba 0.5 — más que la mitad del puntaje
   * máximo por tener a la mitad de sus clientes disconformes. Sumado al peso de
   * la experiencia, un partner malo con volumen le ganaba a uno nuevo y
   * certificado. Lo detectó un test.
   *
   * Acá 2.5 vale 0: por debajo de eso no hay nada que rescatar. El "no sé"
   * de un partner sin historial (0.6) pasa a valer más que un "sé que es malo",
   * que es como debería ser cuando lo que está en juego es a quién se le abre
   * la puerta.
   */
  const RATING_FLOOR = 2.5
  const rating = partner.metrics.averageRating === null
    ? NEUTRAL
    : Math.max(0, Math.min((partner.metrics.averageRating - RATING_FLOOR) / (5 - RATING_FLOOR), 1))
  if (partner.metrics.averageRating !== null) {
    reasons.push(`${partner.metrics.averageRating.toFixed(2)} de calificación promedio`)
  } else {
    reasons.push('Todavía sin calificaciones')
  }

  const punctuality = partner.metrics.punctualityRate ?? NEUTRAL
  if (partner.metrics.punctualityRate !== null) {
    reasons.push(`${Math.round(partner.metrics.punctualityRate * 100)}% de puntualidad`)
  }

  const completion = partner.metrics.completionRate ?? NEUTRAL

  // Se satura a las 50 visitas: a partir de ahí, más experiencia no mueve la aguja.
  const experience = Math.min(partner.metrics.completedVisits / 50, 1)
  if (partner.metrics.completedVisits > 0) {
    reasons.push(`${partner.metrics.completedVisits} visitas completadas`)
  }

  // Más barato puntúa apenas mejor, pero pesa poco: no queremos una carrera al fondo.
  const priceScore = c.maxPrice && c.maxPrice > 0
    ? Math.max(0, 1 - partner.ratePerVisit / c.maxPrice)
    : 0.5

  const score =
    zone * MATCH_WEIGHTS.zone +
    rating * MATCH_WEIGHTS.rating +
    punctuality * MATCH_WEIGHTS.punctuality +
    completion * MATCH_WEIGHTS.completion +
    experience * MATCH_WEIGHTS.experience +
    priceScore * MATCH_WEIGHTS.price

  return { partner, score: Number(score.toFixed(4)), reasons }
}

export interface MatchOutcome {
  /** Ordenados de mejor a peor. Vacío es un resultado válido, no un error. */
  matches: MatchResult[]
  /** Por qué quedaron afuera los demás. Sirve para el admin y para explicar. */
  excluded: { partnerId: string; reason: ExclusionReason }[]
}

/**
 * Busca partners para una visita.
 *
 * Que devuelva vacío es lo normal al principio. La UI tiene que mostrar
 * "todavía no hay nadie en esta zona" con una salida real, no un perfil falso.
 */
export function findMatches(
  partners: PartnerPublicProfile[],
  c: MatchCriteria,
  availabilityByPartner: Record<string, Record<string, string[]>> = {},
): MatchOutcome {
  const matches: MatchResult[] = []
  const excluded: { partnerId: string; reason: ExclusionReason }[] = []

  for (const p of partners) {
    const reason = excludeReason(p, c, availabilityByPartner[p.id])
    if (reason) { excluded.push({ partnerId: p.id, reason }); continue }
    matches.push(scorePartner(p, c))
  }

  matches.sort((a, b) => b.score - a.score)
  return { matches, excluded }
}

/**
 * "Elegí por mí": devuelve el mejor, o null si no hay nadie.
 * Nunca inventa un resultado para no dejar la pantalla vacía.
 */
export function autoMatch(
  partners: PartnerPublicProfile[],
  c: MatchCriteria,
  availabilityByPartner: Record<string, Record<string, string[]>> = {},
): MatchResult | null {
  return findMatches(partners, c, availabilityByPartner).matches[0] ?? null
}

/**
 * Estado de cobertura de una zona, a partir de la oferta real.
 * Es lo que decide si mostramos el marketplace o la lista de espera.
 */
export function coverageFor(
  partners: PartnerPublicProfile[],
  c: MatchCriteria,
  availabilityByPartner: Record<string, Record<string, string[]>> = {},
): 'AVAILABLE' | 'LIMITED' | 'WAITLIST' {
  const { matches, excluded } = findMatches(partners, c, availabilityByPartner)
  if (matches.length >= 2) return 'AVAILABLE'
  if (matches.length === 1) return 'LIMITED'
  // Hay gente en la zona pero nadie disponible ese día: no es lo mismo que zona vacía.
  const onlyUnavailable = excluded.some(e => e.reason === 'NOT_AVAILABLE')
  return onlyUnavailable ? 'LIMITED' : 'WAITLIST'
}
