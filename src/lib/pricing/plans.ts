/** Planes simulados de la beta privada, según el borrador de Pancho (2026-11-28). */
export type Plan = {
  id: 'essential' | 'plus' | 'premium'
  name: string
  tagline: string
  priceARS: number
  priceMXN: number
  aiCredits: number
  includes: string[]
  /** Funciones con IA: hoy en beta por invitación. */
  beta?: string[]
  highlight?: boolean
}

const configuredRate = Number(process.env.NEXT_PUBLIC_ARS_PER_MXN ?? 82.5)
export const ARS_PER_MXN = Number.isFinite(configuredRate) && configuredRate > 0 ? configuredRate : 82.5
const formattedRate = ARS_PER_MXN.toLocaleString('es-AR', { maximumFractionDigits: 2 })
export const RATE_NOTE = `Tipo de cambio de referencia: 1 MXN ≈ ${formattedRate} ARS (a confirmar).`
export const EXTRA_CREDITS = { credits: 100, priceARS: 5000, priceMXN: Math.round(5000 / ARS_PER_MXN) } as const

/**
 * El catálogo anterior mostraba Esencial/Operación/Full a ARS 30.000/80.000/100.000.
 * Pancho lo reemplazó para esta beta por Essential/Plus/Premium a 30.000/50.000/80.000;
 * estos alias documentan la transición sin seguir mostrando los precios anteriores.
 */
export const LEGACY_PLAN_ALIASES = { esencial: 'essential', operacion: 'plus', full: 'premium' } as const

export const PLANS: Plan[] = [
  {
    id: 'essential',
    name: 'Essential',
    tagline: 'Para entender bien cada propiedad antes de decidir.',
    priceARS: 30000,
    priceMXN: Math.round(30000 / ARS_PER_MXN),
    aiCredits: 100,
    includes: [
      'Análisis de avisos',
      'Costo total con gastos y la fuente de cada uno',
      'Comparación con avisos parecidos',
      'Qué sabemos, qué estimamos y qué falta confirmar',
      'Tu plan para cada propiedad y preguntas para el vendedor',
      'Consulta lista para tu escribano o notario',
      'Checklist de visita',
      'Análisis en PDF',
    ],
  },
  {
    id: 'plus',
    name: 'Plus',
    tagline: 'Para llevar tu compra o venta hasta la escritura.',
    priceARS: 50000,
    priceMXN: Math.round(50000 / ARS_PER_MXN),
    aiCredits: 250,
    highlight: true,
    includes: [
      'Todo lo de Essential',
      'Tu operación paso a paso hasta la escritura',
      'Documentos ordenados: qué falta y qué pedir',
      'Plata que necesitás para el cierre',
      'Preparación de la oferta',
      'Si vendés: tu aviso armado para publicar en Zonaprop, Argenprop o MercadoLibre',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    tagline: 'Todo VARA, más las herramientas con IA.',
    priceARS: 80000,
    priceMXN: Math.round(80000 / ARS_PER_MXN),
    aiCredits: 500,
    includes: ['Todo lo de Plus'],
    beta: [
      'Lectura de documentos con IA',
      'Ayuda para negociar con IA',
      'Asistente VARA AI sobre tu operación',
      'Visualización de mejoras de la propiedad',
    ],
  },
]

export const formatARS = (n: number) => `$${n.toLocaleString('es-AR')}`
export const formatMXN = (n: number) => `MXN ${n.toLocaleString('es-MX')}`
