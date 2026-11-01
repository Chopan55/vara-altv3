/**
 * Flujo de la entrada conversacional (/empezar), sin UI: qué se pregunta, en qué
 * orden y a dónde se va al terminar. Cada respuesta se guarda, así se puede retomar
 * y no se repiten preguntas.
 */
export type Intent = 'BUY' | 'SELL'

export interface Answers {
  intent?: Intent
  country?: string
  province?: string
  city?: string
  /** Se contestó la pregunta de ciudad (aunque se haya salteado). */
  cityDone?: boolean
  propertyType?: string
  /** Vender: ¿ya está publicada? Comprar: ¿ya viste alguna propiedad? */
  alreadyHas?: boolean
}

export type Step = 'country' | 'province' | 'city' | 'type' | 'already' | 'done'

export const PROPERTY_TYPES = ['Casa', 'Departamento', 'PH', 'Terreno', 'Local'] as const

export function nextStep(a: Answers): Step {
  if (!a.country) return 'country'
  if (!a.province) return 'province'
  if (!a.cityDone) return 'city'
  if (!a.propertyType) return 'type'
  if (a.alreadyHas === undefined) return 'already'
  return 'done'
}

/** Pregunta de VARA para cada paso, con el tono de la conversación. */
export function question(step: Step, a: Answers): string {
  const verb = a.intent === 'SELL' ? 'la propiedad' : 'lo que buscás'
  switch (step) {
    case 'country': return a.intent === 'SELL' ? 'Perfecto, vamos a preparar tu venta. ¿En qué país está la propiedad?' : 'Perfecto, vamos a ordenar tu compra. ¿En qué país buscás?'
    case 'province': return 'Bien. ¿En qué provincia o estado?'
    case 'city': return `¿En qué ciudad o zona está ${verb}? Si todavía no lo sabés, podés saltear.`
    case 'type': return '¿Qué tipo de propiedad es?'
    case 'already': return a.intent === 'SELL' ? '¿Ya está publicada?' : '¿Ya viste alguna propiedad que te interese?'
    case 'done': return 'Con esto ya puedo empezar. Te armo el plan de tu operación…'
  }
}

export function operationTitle(a: Answers): string {
  const place = a.city || a.province || ''
  const base = a.intent === 'SELL' ? 'Venta' : 'Compra'
  return [a.propertyType ?? base, place && `en ${place}`].filter(Boolean).join(' ') || base
}

/** Pantalla a la que lleva el final de la conversación. */
export function destination(a: Answers): string {
  if (a.intent === 'SELL') return a.alreadyHas ? '/revisar-publicacion' : '/preparar-venta'
  return a.alreadyHas ? '/propiedades' : '/mi-busqueda'
}
