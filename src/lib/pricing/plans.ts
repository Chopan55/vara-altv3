/**
 * Única fuente de los planes. BORRADOR: los precios todavía no están definidos
 * (price = null se muestra como "A definir"). Cuando existan, se cargan acá y
 * en ningún otro lado. Los límites son los que hay que fijar con los costos reales.
 */
export type Limit = { label: string; value: string }

export type Plan = {
  id: 'explorer' | 'etapa' | 'visit'
  name: string
  tagline: string
  price: number | null
  priceNote: string
  includes: string[]
  limits: Limit[]
}

export const PLANS: Plan[] = [
  {
    id: 'explorer',
    name: 'Explorer',
    tagline: 'Para entender antes de decidir.',
    price: 0,
    priceNote: 'Gratis',
    includes: ['Costos por provincia con fuente', 'Riesgos y documentos explicados', 'Comparador con tus prioridades', 'Próximo paso de tu operación'],
    limits: [
      { label: 'Propiedades activas', value: 'A definir' },
      { label: 'Análisis con IA', value: 'A definir' },
    ],
  },
  {
    id: 'etapa',
    name: 'Por etapa',
    tagline: 'Pagás por la etapa que necesitás: preparar, ofertar o cerrar.',
    price: null,
    priceNote: 'A definir',
    includes: ['Todo lo de Explorer', 'Preparación de oferta y negociación asistida', 'Property Pack y descripción de publicación', 'Visualización de mejoras (imagen generada)'],
    limits: [
      { label: 'Negociaciones asistidas', value: 'A definir' },
      { label: 'Generaciones de imagen', value: 'A definir' },
      { label: 'Documentos analizados', value: 'A definir' },
    ],
  },
  {
    id: 'visit',
    name: 'VARA Visit',
    tagline: 'Presencia física cuando la necesitás. Se contrata por visita.',
    price: null,
    priceNote: 'A definir por visita',
    includes: ['Visit Partner verificado', 'PIN para empezar la visita', 'Checklist y reporte'],
    limits: [{ label: 'Visitas', value: 'Por visita contratada' }],
  },
]
