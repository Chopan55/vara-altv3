/**
 * Riesgos de una operación.
 *
 * El problema que resuelve: los riesgos decían *qué* y *por qué*, pero no
 * *con qué evidencia*. "Riesgo dominial alto" sin decir de dónde sale es una
 * afirmación que el usuario no puede verificar ni discutir — y en una
 * compraventa eso lo deja peor que no decir nada.
 *
 * La decisión de fondo: **los riesgos se derivan, no se guardan.**
 *
 * Un riesgo almacenado envejece. Alguien sube la escritura y el riesgo
 * "falta la escritura" sigue ahí hasta que otro proceso se acuerde de
 * borrarlo. Derivándolos de los datos reales pasan dos cosas buenas:
 *
 *  1. No pueden existir sin evidencia, porque la evidencia *es* el hecho que
 *     los produjo.
 *  2. Desaparecen solos cuando el hecho deja de ser cierto. El estado no es
 *     un campo que alguien marca: es si la condición sigue dándose o no.
 *
 * Por eso tampoco hay "aceptar un riesgo". Un riesgo que aceptás pero que
 * sigue siendo cierto, sigue siendo cierto.
 */

import {
  isCriticalCategory, hasFile,
  DOCUMENT_CATEGORY_LABELS,
  type OperationDocument,
} from '@/lib/documents/model'
import { isExpired, isOpen, daysUntil, type Offer } from '@/lib/offers/model'

export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW'

export type RiskArea =
  | 'DOMINIAL'    // quién es el titular y si la propiedad está libre
  | 'DOCUMENTAL'  // falta un papel
  | 'ECONOMICO'   // plata: precio, costos, oferta
  | 'TEMPORAL'    // plazos que se vencen
  | 'DATOS'       // no sabemos lo suficiente como para opinar

export interface DerivedRisk {
  id: string
  level: RiskLevel
  area: RiskArea
  /** Qué pasa, en una línea. */
  label: string
  /** Por qué importa. */
  detail: string
  /**
   * De dónde sale. Obligatorio, no opcional: un riesgo sin evidencia es una
   * opinión, y acá no damos opiniones sobre la casa de otra persona.
   */
  evidence: string[]
  /** Qué hacer. Concreto, no "consultá a un profesional". */
  action: string
  /** Prioridad de atención. Menor = antes. */
  priority: number
}

export interface RiskInput {
  documents: OperationDocument[]
  offers: Offer[]
  propertyPrice?: number
  propertySurface?: number
  provinceName?: string
  /** Confianza del dato regulatorio de la provincia. */
  dataConfidence?: 'VERIFIED' | 'PARTIAL' | 'ESTIMATED'
  /** Para poder testear sin depender del reloj. */
  today?: string
}

// ───────────────────────── Reglas ─────────────────────────

/**
 * Sin escritura no se puede verificar quién es el titular. Es el riesgo más
 * caro de todos porque se descubre tarde.
 */
function ruleMissingCriticalDocs(input: RiskInput): DerivedRisk[] {
  const missing = input.documents.filter(
    d => isCriticalCategory(d.category) && !hasFile(d),
  )
  if (missing.length === 0) return []

  return [{
    id: 'doc.critical.missing',
    level: 'HIGH',
    area: 'DOMINIAL',
    label: missing.length === 1
      ? `Falta ${missing[0].name}`
      : `Faltan ${missing.length} documentos que frenan la operación`,
    detail:
      'Sin estos papeles no se puede verificar quién es el titular ni si la ' +
      'propiedad está libre de deudas o embargos.',
    evidence: missing.map(
      d => `${DOCUMENT_CATEGORY_LABELS[d.category]}: "${d.name}" sin archivo cargado`,
    ),
    action: 'Pedíselos al vendedor o a su escribano y subilos en Documentos.',
    priority: 10,
  }]
}

/** Un documento rechazado o vencido es peor que uno que falta: parecía estar. */
function ruleRejectedDocs(input: RiskInput): DerivedRisk[] {
  const bad = input.documents.filter(d => d.status === 'REJECTED' || d.status === 'EXPIRED')
  if (bad.length === 0) return []

  return [{
    id: 'doc.rejected',
    level: 'HIGH',
    area: 'DOCUMENTAL',
    label: bad.length === 1
      ? `"${bad[0].name}" no sirve como está`
      : `${bad.length} documentos no sirven como están`,
    detail:
      'Figuran cargados, así que es fácil darlos por resueltos. No lo están: ' +
      'hay que reemplazarlos por una versión válida.',
    evidence: bad.map(
      d => `"${d.name}" en estado ${d.status === 'EXPIRED' ? 'vencido' : 'rechazado'}`,
    ),
    action: 'Conseguí una versión nueva y subila como otra versión del mismo documento.',
    priority: 15,
  }]
}

/** Una oferta que se vence sin respuesta es plata y tiempo perdidos. */
function ruleExpiringOffer(input: RiskInput): DerivedRisk[] {
  const risky = input.offers
    .filter(o => isOpen(o) && !isExpired(o, input.today))
    .map(o => ({ o, d: daysUntil(o.validUntil, input.today) }))
    .filter((x): x is { o: Offer; d: number } => x.d !== null && x.d >= 0 && x.d <= 3)

  if (risky.length === 0) return []
  const { o, d } = risky.sort((a, b) => a.d - b.d)[0]

  return [{
    id: 'offer.expiring',
    level: 'MEDIUM',
    area: 'TEMPORAL',
    label: d === 0 ? 'Tu oferta vence hoy' : `Tu oferta vence en ${d} ${d === 1 ? 'día' : 'días'}`,
    detail:
      'Cuando se vence el plazo que pusiste, la oferta deja de estar en pie y ' +
      'hay que volver a empezar la negociación.',
    evidence: [
      `Oferta de ${o.currency} ${o.amount.toLocaleString('es-AR')} con validez hasta ${o.validUntil}`,
    ],
    action: 'Hacé el seguimiento, o extendé el plazo con una oferta nueva.',
    priority: 20,
  }]
}

/** Una oferta ya vencida que nadie cerró. */
function ruleExpiredOffer(input: RiskInput): DerivedRisk[] {
  const dead = input.offers.filter(o => isExpired(o, input.today))
  if (dead.length === 0) return []

  return [{
    id: 'offer.expired',
    level: 'MEDIUM',
    area: 'TEMPORAL',
    label: 'Tenés una oferta vencida sin resolver',
    detail: 'Figura como enviada pero el plazo que le pusiste ya pasó.',
    evidence: dead.map(
      o => `Oferta de ${o.currency} ${o.amount.toLocaleString('es-AR')} venció el ${o.validUntil}`,
    ),
    action: 'Marcá qué pasó con ella, o hacé una oferta nueva.',
    priority: 30,
  }]
}

/**
 * Sin precio no se puede calcular nada: ni costos, ni cuánto te aparta una
 * oferta del pedido.
 */
function ruleMissingPrice(input: RiskInput): DerivedRisk[] {
  if (input.propertyPrice && input.propertyPrice > 0) return []

  return [{
    id: 'data.no_price',
    level: 'MEDIUM',
    area: 'DATOS',
    label: 'No hay precio cargado',
    detail:
      'Sin el precio no podemos calcular sellos, honorarios ni gastos de ' +
      'registro, que suelen ser entre el 3% y el 8% de la operación.',
    evidence: ['La propiedad de esta operación no tiene precio cargado'],
    action: 'Cargá el precio en la ficha de la propiedad.',
    priority: 40,
  }]
}

/**
 * Que los datos de la provincia no estén verificados es un riesgo del dato,
 * no de la propiedad. Se dice igual: el usuario está por presupuestar con eso.
 */
function ruleUnverifiedProvince(input: RiskInput): DerivedRisk[] {
  if (!input.dataConfidence || input.dataConfidence === 'VERIFIED') return []

  const label = input.dataConfidence === 'PARTIAL' ? 'parciales' : 'estimados'
  return [{
    id: 'data.province_confidence',
    level: 'LOW',
    area: 'DATOS',
    label: `Los costos de ${input.provinceName ?? 'esta provincia'} son ${label}`,
    detail:
      'Las alícuotas que usamos no están confirmadas contra la fuente oficial ' +
      'de esta provincia. El número real puede diferir.',
    evidence: [`Confianza del dato regulatorio: ${input.dataConfidence}`],
    action: 'Confirmá los montos con un escribano matriculado antes de firmar.',
    priority: 60,
  }]
}

const RULES = [
  ruleMissingCriticalDocs,
  ruleRejectedDocs,
  ruleExpiringOffer,
  ruleExpiredOffer,
  ruleMissingPrice,
  ruleUnverifiedProvince,
]

/**
 * Los riesgos vigentes, del más urgente al menos.
 *
 * Si devuelve vacío es porque no hay ninguno con los datos de hoy — no porque
 * no hayamos buscado. Es una diferencia que la pantalla tiene que respetar.
 */
export function computeRisks(input: RiskInput): DerivedRisk[] {
  return RULES
    .flatMap(rule => rule(input))
    .sort((a, b) => a.priority - b.priority)
}

const LEVEL_WEIGHT: Record<RiskLevel, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }

/** Cuántos frenan de verdad la operación. Es lo que va en el badge. */
export function highRiskCount(risks: DerivedRisk[]): number {
  return risks.filter(r => r.level === 'HIGH').length
}

export function groupByLevel(risks: DerivedRisk[]): Record<RiskLevel, DerivedRisk[]> {
  const out: Record<RiskLevel, DerivedRisk[]> = { HIGH: [], MEDIUM: [], LOW: [] }
  for (const r of [...risks].sort((a, b) => LEVEL_WEIGHT[a.level] - LEVEL_WEIGHT[b.level])) {
    out[r.level].push(r)
  }
  return out
}
