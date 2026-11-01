/**
 * Conclusión y próxima mejor acción.
 *
 * Todo sale de campos ya calculados. Las frases son plantillas determinísticas:
 * una IA puede reescribirlas con mejor estilo, pero no puede cambiar el
 * veredicto, los números ni la acción. `basedOn` dice de qué campos sale cada
 * afirmación.
 */

import type {
  Conclusion, MissingInformation, NbaType, NextBestAction, PricePositioning,
  PriorityRisk, UserFit, Verdict,
} from './types'

export interface DecisionContext {
  fit: UserFit
  price: PricePositioning
  missing: MissingInformation
  risks: PriorityRisk[]
}

const NBA_LABEL: Record<NbaType, string> = {
  GET_MISSING_INFORMATION: 'Pedí los datos que faltan',
  COMPARE: 'Compará con otra propiedad',
  VISIT: 'Coordiná una visita',
  VERIFY_DOCUMENT: 'Verificá la documentación',
  SAVE: 'Guardala para decidir después',
  DISCARD: 'Descartala',
  PREPARE_OFFER: 'Preparar una oferta',
  PROFESSIONAL_REVIEW: 'Consultá a un profesional',
  ADD_COMPARABLES: 'Sumá avisos parecidos para comparar',
}

const hasHighMissing = (m: MissingInformation) => m.items.some(i => i.impact === 'HIGH')
const priceReliable = (p: PricePositioning) => p.confidence === 'HIGH' || p.confidence === 'MEDIUM'

function listEs(parts: string[]): string {
  if (parts.length <= 1) return parts.join('')
  return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`
}

export function decideNextAction(ctx: DecisionContext): NextBestAction {
  const { fit, price, missing } = ctx
  const blockers = [
    ...fit.dealBreakers,
    ...missing.items.filter(i => i.impact === 'HIGH').map(i => `Falta ${i.label.toLowerCase()}`),
  ]

  let primary: NbaType
  let reason: string
  let secondary: NbaType[]

  if (fit.dealBreakerHit) {
    primary = 'DISCARD'
    reason = 'Incumple algo que marcaste como no negociable.'
    secondary = ['COMPARE', 'SAVE']
  } else if (hasHighMissing(missing)) {
    primary = 'GET_MISSING_INFORMATION'
    reason = `Hay datos clave que cambian la evaluación: ${listEs(missing.items.filter(i => i.impact === 'HIGH').map(i => i.label.toLowerCase()))}.`
    secondary = ['SAVE', 'COMPARE']
  } else if (price.confidence === 'INSUFFICIENT') {
    primary = 'ADD_COMPARABLES'
    reason = 'No hay avisos comparables suficientes para opinar sobre el precio.'
    secondary = ['SAVE', 'VISIT']
  } else if (price.confidence === 'LOW' && missing.items.length > 0) {
    // Con una referencia débil, ir a visitar sin completar lo que falta es apurarse.
    primary = 'GET_MISSING_INFORMATION'
    reason = 'La referencia de precio es débil y todavía hay datos por confirmar.'
    secondary = ['SAVE', 'COMPARE']
  } else if (price.position === 'ABOVE' && priceReliable(price)) {
    primary = 'COMPARE'
    reason = 'El precio publicado está por encima de los avisos más parecidos.'
    secondary = ['GET_MISSING_INFORMATION', 'SAVE']
  } else if (fit.state === 'EVALUATED' && (fit.score ?? 0) < 50) {
    primary = 'COMPARE'
    reason = 'Encaja poco con lo que buscás.'
    secondary = ['SAVE', 'DISCARD']
  } else {
    primary = 'VISIT'
    reason = 'No aparecen bloqueos con la información disponible.'
    secondary = ['SAVE', 'COMPARE']
  }

  return {
    type: primary,
    label: NBA_LABEL[primary],
    reason,
    secondary: secondary.slice(0, 2).map(type => ({ type, label: NBA_LABEL[type] })),
    blockers,
  }
}

export function buildConclusion(ctx: DecisionContext, nba: NextBestAction): Conclusion {
  const { fit, price, missing } = ctx
  const basedOn: string[] = ['nextBestAction']

  let verdict: Verdict
  let headline: string

  if (fit.dealBreakerHit) {
    verdict = 'WEAK'
    headline = 'Esta propiedad no cumple algo que marcaste como imprescindible.'
  } else if (price.confidence === 'INSUFFICIENT' && fit.state === 'NO_PROFILE') {
    verdict = 'UNDETERMINED'
    headline = 'Todavía no tengo base para opinar: faltan avisos comparables y saber qué buscás.'
  } else if (hasHighMissing(missing) || (price.position === 'ABOVE' && priceReliable(price))) {
    verdict = 'CAUTION'
    headline = fit.state === 'EVALUATED' && (fit.score ?? 0) >= 60
      ? 'Parece una buena candidata para vos, pero todavía no avanzaría con una oferta.'
      : 'Hay cosas para aclarar antes de avanzar con esta propiedad.'
  } else if (fit.state === 'EVALUATED' && (fit.score ?? 0) >= 70) {
    verdict = 'PROMISING'
    headline = 'Es una buena candidata para vos y no aparecen alertas con lo que sabemos.'
  } else if (fit.state === 'NO_PROFILE' && priceReliable(price) && price.position !== 'ABOVE') {
    verdict = 'PROMISING'
    headline = 'El precio publicado está en línea con los avisos comparables. Falta saber si encaja con lo que buscás.'
  } else {
    verdict = 'UNDETERMINED'
    headline = 'Con lo que sabemos hasta ahora no hay una señal clara a favor ni en contra.'
  }
  basedOn.push('userFit', 'pricePositioning', 'missingInformation')

  const matches = fit.items.filter(i => i.status === 'MATCH' && i.importance !== 'NICE_TO_HAVE').length
  const demanded = fit.items.filter(i => i.importance !== 'NICE_TO_HAVE').length
  const why = fit.state === 'EVALUATED'
    ? `Cumple ${matches} de ${demanded} de tus prioridades.`
    : fit.scoreExplanation

  const unknownLabels = missing.items.filter(i => i.impact !== 'LOW').slice(0, 3).map(i => i.label.toLowerCase())
  const unknown = unknownLabels.length
    ? `Todavía falta confirmar ${listEs(unknownLabels)}.`
    : 'No quedan datos clave sin confirmar.'

  return { verdict, headline, why, price: price.interpretation, unknown, next: `${nba.label}.`, basedOn }
}
