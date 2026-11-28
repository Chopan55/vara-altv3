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
  const f = a.subjectProperty.fields ?? {}
  const add = (key: string, label: string, format: (value: unknown) => string = String) => {
    const field = (f as Record<string, { value?: unknown }>)[key]
    if (field?.value !== null && field?.value !== undefined && key !== 'price') known.push(`${label}: ${format(field.value)}`)
  }
  add('kind', 'Tipo', value => ({ house: 'casa', apartment: 'departamento', ph: 'PH', lot: 'lote', other: 'propiedad' }[String(value)] ?? String(value)))
  add('totalArea', 'Superficie total', value => `${String(value)} m²`)
  add('coveredArea', isMX ? 'Superficie construida' : 'Superficie cubierta', value => `${String(value)} m²`)
  add('landArea', 'Superficie de terreno', value => `${String(value)} m²`)
  add('bedrooms', isMX ? 'Recámaras' : 'Dormitorios')
  add('bathrooms', 'Baños')
  add('parking', isMX ? 'Estacionamientos' : 'Cocheras')
  add('expenses', isMX ? 'Mantenimiento' : 'Expensas', value => `${Number(value).toLocaleString(isMX ? 'es-MX' : 'es-AR')} / mes`)
  add('ageYears', 'Antigüedad', value => `${String(value)} años`)
  add('condition', 'Estado', value => ({ new: 'a estrenar', excellent: 'excelente', good: 'bueno', to_refresh: 'a actualizar', to_renovate: 'a reciclar' }[String(value)] ?? String(value)))
  add('community', isMX ? 'Desarrollo/condominio' : 'Barrio/edificio')
  add('city', isMX ? 'Ciudad' : 'Localidad')
  if (known.length === (ask ? 1 : 0)) {
    const present = a.extractionQuality.present.filter(p => p !== 'precio' && p !== 'price')
    if (present.length) known.push(`Datos disponibles: ${present.join(', ')}`)
  }

  const estimated: string[] = []
  const c = a.estimatedTransactionCost
  if (c.lines.some(l => l.kind === 'ESTIMATED')) estimated.push('Gastos de escritura e impuestos (la fuente de cada uno está en «¿Cuánta plata podrías necesitar?»)')
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
