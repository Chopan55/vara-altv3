/**
 * Información faltante → acción.
 *
 * Lo que falta no es un error: es trabajo. Cada dato desconocido que importa
 * para decidir se convierte en un pedido concreto, con el mensaje ya armado
 * para copiar. VARA nunca lo envía solo.
 */

import type { ListingFacts, MissingInformation, MissingItem, SubjectProperty } from './types'

interface Spec {
  field: string
  label: string
  /** Cómo se pide dentro de una frase: "la antigüedad". */
  ask: string
  impact: MissingItem['impact']
  why: string
  appliesTo?: (l: ListingFacts) => boolean
  present: (l: ListingFacts) => boolean
}

const SPECS: Spec[] = [
  { field: 'price', label: 'Precio', ask: 'el precio', impact: 'HIGH',
    why: 'Sin precio no puedo ubicarla frente a otros avisos.', present: l => !!l.price },
  { field: 'bedrooms', label: 'Dormitorios', ask: 'la cantidad de dormitorios', impact: 'HIGH',
    why: 'Es de lo primero que define con qué se la puede comparar.', present: l => l.bedrooms !== undefined,
    appliesTo: l => l.kind !== 'lot' },
  { field: 'coveredArea', label: 'Superficie cubierta', ask: 'la superficie cubierta', impact: 'HIGH',
    why: 'Es la base para comparar con otras propiedades.', present: l => !!l.coveredArea },
  { field: 'ageYears', label: 'Antigüedad', ask: 'la antigüedad', impact: 'HIGH',
    why: 'Cambia mucho el estado esperable y el precio razonable.', present: l => l.ageYears !== undefined },
  { field: 'condition', label: 'Estado de conservación', ask: 'el estado de conservación', impact: 'MEDIUM',
    why: 'Dos casas iguales pueden valer distinto según su estado.', present: l => !!l.condition },
  { field: 'expenses', label: 'Expensas', ask: 'las expensas actuales', impact: 'MEDIUM',
    why: 'Suman al costo mensual real.', present: l => l.expenses !== undefined,
    appliesTo: l => !!l.community || l.kind === 'apartment' || l.kind === 'ph' },
  { field: 'landArea', label: 'Superficie del terreno', ask: 'la superficie del terreno', impact: 'MEDIUM',
    why: 'En casas, el terreno pesa en el precio.', present: l => !!l.landArea,
    appliesTo: l => l.kind === 'house' },
  { field: 'bathrooms', label: 'Baños', ask: 'la cantidad de baños', impact: 'LOW',
    why: 'Completa la comparación.', present: l => l.bathrooms !== undefined },
]

const IMPACT_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const

function joinEs(parts: string[]): string {
  if (parts.length <= 1) return parts.join('')
  return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`
}

export function findMissing(facts: ListingFacts, subject?: SubjectProperty): MissingInformation {
  const items: MissingItem[] = SPECS
    .filter(s => (s.appliesTo ? s.appliesTo(facts) : true) && !s.present(facts))
    .map(s => ({ field: s.field, label: s.label, impact: s.impact, why: s.why }))
    .sort((a, b) => IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact])

  // El precio no se le pregunta a la inmobiliaria: ya debería figurar en el aviso.
  const askable = items.filter(i => i.field !== 'price').slice(0, 4)
  const asks = askable.map(i => SPECS.find(s => s.field === i.field)!.ask)
  const what = subject?.fields.title?.value ?? facts.title

  return {
    items,
    draftMessage: asks.length
      ? `Hola, ¿me podrían confirmar ${joinEs(asks)}?${what ? ` Estoy evaluando la propiedad "${what}".` : ''} Gracias.`
      : null,
  }
}
