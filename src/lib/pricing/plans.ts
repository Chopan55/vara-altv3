/**
 * Única fuente de los planes para personas (2026-11-23, precios definidos por Pancho).
 * El análisis de un aviso sigue siendo gratis y sin cuenta. Los planes son mensuales.
 * MXN: equivalente al tipo de cambio de referencia del 22/11/2026 (1 ARS ≈ 0,0121 MXN), redondeado.
 * Durante la beta privada no se cobra: no hay medio de pago conectado.
 * VARA Visit se contrata aparte, por visita.
 */
export type Plan = {
  id: 'esencial' | 'operacion' | 'full'
  name: string
  tagline: string
  priceARS: number
  priceMXN: number
  includes: string[]
  /** Funciones con IA: hoy en beta por invitación. */
  beta?: string[]
  highlight?: boolean
}

export const RATE_NOTE = 'Equivalente en pesos mexicanos al tipo de cambio del 22/11/2026.'

export const PLANS: Plan[] = [
  {
    id: 'esencial',
    name: 'Esencial',
    tagline: 'Para entender bien cada propiedad antes de decidir.',
    priceARS: 30000,
    priceMXN: 360,
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
    id: 'operacion',
    name: 'Operación',
    tagline: 'Para llevar tu compra o venta hasta la escritura.',
    priceARS: 80000,
    priceMXN: 970,
    highlight: true,
    includes: [
      'Todo lo de Esencial',
      'Tu operación paso a paso hasta la escritura',
      'Documentos ordenados: qué falta y qué pedir',
      'Plata que necesitás para el cierre',
      'Preparación de la oferta',
      'Si vendés: tu aviso armado para publicar en Zonaprop, Argenprop o MercadoLibre',
    ],
  },
  {
    id: 'full',
    name: 'Full',
    tagline: 'Todo VARA, más las herramientas con IA.',
    priceARS: 100000,
    priceMXN: 1210,
    includes: ['Todo lo de Operación'],
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
