/**
 * «Semáforo de evidencia»: el análisis separado en lo que se sabe (dato del
 * aviso), lo que VARA estima y lo que hay que confirmar con el escribano o
 * notario. Sale solo de lo que el análisis ya tiene: no agrega datos.
 */

import type { PropertyAnalysis } from './types'

export interface EvidenceSummary {
  known: string[]
  estimated: string[]
  toConfirm: string[]
}

export function buildEvidenceSummary(a: PropertyAnalysis): EvidenceSummary {
  const isMX = (a.subjectProperty.country ?? '').toUpperCase() === 'MX'
  const known: string[] = []
  const ask = a.pricePositioning.subjectAskingPrice
  if (ask) known.push(`Precio publicado: ${ask.currency} ${ask.amount.toLocaleString(isMX ? 'es-MX' : 'es-AR')}`)
  const present = a.extractionQuality.present.filter(p => p !== 'precio' && p !== 'price')
  if (present.length) known.push(`Datos del aviso: ${present.slice(0, 6).join(', ')}`)

  const estimated: string[] = []
  const c = a.estimatedTransactionCost
  if (c.lines.some(l => l.kind === 'ESTIMATED')) estimated.push('Gastos de escritura e impuestos, con su fuente')
  const band = a.pricePositioning.comparableListingRange
  if (band) estimated.push(`Rango de avisos parecidos (${band.sampleSize} aviso${band.sampleSize === 1 ? '' : 's'}; precios pedidos, no de cierre)`)
  else estimated.push('Rango de precio: faltan avisos parecidos para estimarlo')

  const toConfirm: string[] = []
  a.missingInformation.items.slice(0, 3).forEach(m => toConfirm.push(m.label))
  a.prioritizedRisks.filter(r => r.id !== 'deal-breaker').slice(0, 2).forEach(r => toConfirm.push(r.title))
  toConfirm.push(isMX
    ? 'Escritura inscrita y libertad de gravamen (lo revisa el notario)'
    : 'Título, dominio e inhibiciones (lo revisa el escribano)')
  return { known, estimated, toConfirm: [...new Set(toConfirm)] }
}
