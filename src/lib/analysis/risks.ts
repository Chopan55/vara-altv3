/**
 * Riesgos con evidencia.
 *
 * Nada de listas genéricas ("revisá el título", "verificá el estado"): cada
 * riesgo sale de algo medido en este análisis y lo cita. Se devuelven todos,
 * ordenados por impacto; la pantalla muestra los 2–3 primeros y deja
 * "Ver todos" para el resto.
 */

import type {
  ListingFacts, MissingInformation, PriorityRisk, PricePositioning, UserFit,
} from './types'

export interface RiskInput {
  facts: ListingFacts
  price: PricePositioning
  missing: MissingInformation
  fit: UserFit
  completenessWarnings: string[]
}

const ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const

export function deriveRisks(input: RiskInput): PriorityRisk[] {
  const { price, missing, fit, facts } = input
  const risks: PriorityRisk[] = []

  if (fit.dealBreakerHit) {
    risks.push({
      id: 'deal-breaker',
      title: 'No cumple algo que marcaste como no negociable',
      reason: fit.dealBreakers.join('; '),
      evidence: fit.dealBreakers,
      impact: 'HIGH',
      nextAction: 'Descartala o revisá si ese requisito realmente es innegociable.',
    })
  }

  const reliable = price.confidence === 'HIGH' || price.confidence === 'MEDIUM'
  if (price.position === 'ABOVE' && reliable && price.differencePct !== null) {
    risks.push({
      id: 'price-above',
      title: 'Pide más que los avisos más parecidos',
      reason: `El precio publicado está ${Math.abs(price.differencePct)}% por encima de la mediana de los avisos comparables.`,
      evidence: [price.interpretation],
      impact: price.differencePct > 15 ? 'HIGH' : 'MEDIUM',
      nextAction: 'Preguntá qué justifica la diferencia (estado, terreno, terminaciones) antes de ofertar.',
    })
  }

  if (price.confidence === 'INSUFFICIENT' || price.confidence === 'LOW') {
    // La primera razón de una confianza LOW es el conteo (positivo); lo que explica la debilidad viene después.
    const weak = price.confidence === 'INSUFFICIENT' ? price.confidenceReasons : price.confidenceReasons.slice(1)
    risks.push({
      id: 'thin-evidence',
      title: price.confidence === 'INSUFFICIENT'
        ? 'No hay base sólida para juzgar el precio'
        : 'La referencia de precio es débil',
      reason: weak[0] ?? 'Pocos avisos realmente comparables.',
      evidence: weak.length ? weak : price.confidenceReasons,
      impact: 'MEDIUM',
      nextAction: 'Sumá 2 o 3 avisos parecidos que hayas visto para mejorar la referencia.',
    })
  }

  const critical = missing.items.filter(i => i.impact === 'HIGH')
  if (critical.length) {
    risks.push({
      id: 'missing-critical',
      title: critical.length === 1 ? 'Falta un dato clave' : `Faltan ${critical.length} datos clave`,
      reason: critical.map(i => i.label.toLowerCase()).join(', '),
      evidence: critical.map(i => `${i.label}: ${i.why}`),
      impact: 'HIGH',
      nextAction: 'Pedíselos a la inmobiliaria antes de coordinar la visita.',
    })
  }

  if (missing.items.some(i => i.field === 'expenses')) {
    risks.push({
      id: 'expenses-unknown',
      title: 'El costo mensual real no está claro',
      reason: 'El aviso no informa las expensas y la propiedad está en una comunidad o edificio.',
      evidence: ['Expensas sin confirmar'],
      impact: 'MEDIUM',
      nextAction: 'Pedí el monto actual de expensas.',
    })
  }

  if (facts.price && !facts.currency) {
    risks.push({
      id: 'currency-unclear',
      title: 'No queda clara la moneda del precio',
      reason: 'El aviso muestra un precio sin aclarar si es en dólares o pesos.',
      evidence: input.completenessWarnings,
      impact: 'MEDIUM',
      nextAction: 'Confirmá la moneda con la inmobiliaria.',
    })
  }

  return risks.sort((a, b) => ORDER[a.impact] - ORDER[b.impact])
}
