/**
 * «Tu plan para esta propiedad»: los próximos pasos, en orden, armados solo con
 * lo que el análisis ya detectó (riesgos, faltantes, país). No agrega datos ni
 * promete servicios: el escribano/notario y VARA Visit se ofrecen como opción.
 */

import type { PropertyAnalysis } from './types'

export interface NextStep {
  id: 'resolve' | 'ask' | 'professional' | 'visit'
  title: string
  detail: string
  /** Ancla dentro del análisis o ruta de la app. */
  href: string
  cta: string
}

const IMPACT_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const

export function buildNextSteps(a: PropertyAnalysis): NextStep[] {
  const isMX = (a.subjectProperty.country ?? '').toUpperCase() === 'MX'
  const steps: NextStep[] = []

  const risks = [...a.prioritizedRisks].sort((x, y) => IMPACT_ORDER[x.impact] - IMPACT_ORDER[y.impact])
  const missing = [...a.missingInformation.items].sort((x, y) => IMPACT_ORDER[x.impact] - IMPACT_ORDER[y.impact])
  // Los datos que faltan ya tienen su propio paso: el primero pasa a ser el riesgo siguiente.
  const topRisk = risks.find(r => !(r.id === 'missing-critical' && missing.length > 0))

  if (topRisk) {
    steps.push({
      id: 'resolve',
      title: `${isMX ? 'Resuelve' : 'Resolvé'} primero: ${topRisk.title}`,
      detail: topRisk.nextAction ?? `${topRisk.reason} ${isMX ? 'Acláralo antes de avanzar.' : 'Aclaralo antes de avanzar.'}`,
      href: '#riesgos',
      cta: 'Ver el riesgo',
    })
  }

  const asks = missing.slice(0, 2).map(m => m.label.toLowerCase())
  if (asks.length) {
    steps.push({
      id: 'ask',
      title: isMX ? 'Pregúntale al vendedor' : 'Preguntale al vendedor',
      detail: `${isMX ? 'Pídele' : 'Pedile'}: ${asks.join(' y ')}. Sin esos datos la comparación queda floja.`,
      href: '#faltantes',
      cta: 'Ver qué falta',
    })
  }

  steps.push({
    id: 'professional',
    title: isMX ? 'Antes de apartar, consulta al notario' : 'Antes de señar, consultá al escribano',
    detail: isMX
      ? 'Llévale la consulta que armó VARA. Puede ser tu notario o uno que te recomendemos.'
      : 'Llevale la consulta que armó VARA. Puede ser tu escribano o uno que te recomendemos.',
    href: '#consulta',
    cta: 'Ver la consulta',
  })

  steps.push({
    id: 'visit',
    title: isMX ? 'Si quieres, ve a la visita acompañado' : 'Si querés, andá a la visita acompañado',
    detail: isMX
      ? 'Con VARA Visit puedes pedir que alguien con experiencia te acompañe. Primero ves si hay cobertura en tu zona y el precio antes de confirmar.'
      : 'Con VARA Visit podés pedir que alguien con experiencia te acompañe. Primero ves si hay cobertura en tu zona y el precio antes de confirmar.',
    href: '/vara-visit',
    cta: 'Conocer VARA Visit',
  })

  return steps
}
