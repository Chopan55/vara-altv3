/**
 * Consulta para el escribano (o notario) armada con lo que VARA ya sabe de la
 * propiedad: riesgos detectados, datos que faltan y papeles a pedir antes de
 * ofertar. VARA no la envía: el comprador la copia y elige a quién mandarla.
 */

import type { PropertyAnalysis } from './types'

export function buildProfessionalQuery(analysis: PropertyAnalysis, municipality?: string | null): string {
  const isMX = (analysis.subjectProperty.country ?? '').toUpperCase() === 'MX'
  const url = analysis.subjectProperty.url
  const lines: string[] = []
  lines.push(`Hola, estoy por hacer una oferta por esta propiedad${url ? `: ${url}` : ''}.`)
  lines.push(`Antes de avanzar, te quería consultar estos puntos:`)

  const risks = analysis.prioritizedRisks.slice(0, 4)
  risks.forEach(r => lines.push(`- ${r.title}${r.nextAction ? ` (${r.nextAction})` : ''}`))

  const missing = analysis.missingInformation.items.slice(0, 3)
  missing.forEach(m => lines.push(`- No tengo confirmado: ${m.label.toLowerCase()}.`))

  if (isMX) {
    lines.push('- ¿Qué tengo que pedir antes de dejar el apartado? (escritura inscrita, certificado de libertad de gravamen, predial y agua al corriente)')
  } else {
    lines.push('- ¿Qué tengo que pedir antes de señar? (título, informe de dominio y de inhibiciones, plano o mensura)')
  }
  if (municipality) lines.push(`- La propiedad está en ${municipality}: ¿qué pide el municipio para escriturar?`)
  lines.push(`- ¿Cuánto me costaría la escritura con tus honorarios y los impuestos?`)
  lines.push(`Gracias.`)
  return lines.join('\n').replace(/\n{2,}/g, '\n') + `\n\n(Lo preparé con VARA para llegar con las preguntas claras.)`
}
