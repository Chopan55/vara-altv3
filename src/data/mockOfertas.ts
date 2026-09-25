export type MetodoPago = 'CONTADO' | 'HIPOTECA' | 'CUOTAS' | 'MIXTO'
export type EstadoOferta = 'ACTIVA' | 'EN_NEGOCIACION' | 'RECHAZADA' | 'ACEPTADA'

export interface Oferta {
  id: string
  buyerName: string
  buyerPhone: string
  buyerEmail?: string
  offeredPrice: number
  askingPrice: number
  paymentMethod: MetodoPago
  timelineDays: number
  conditions: string[]
  date: string
  portalId: string
  portalName: string
  portalUrl: string
  estado: EstadoOferta
  isMockData: true
}

export interface OfertaConScore extends Oferta {
  score: number
  scoreDetalle: {
    precio: number
    metodoPago: number
    timeline: number
    condiciones: number
  }
  notes?: string
}

const ASKING_PRICE = 185000

function calcularScore(oferta: Oferta): OfertaConScore['scoreDetalle'] {
  const pctPrecio = oferta.offeredPrice / oferta.askingPrice
  const scoreP = pctPrecio >= 1 ? 40 : pctPrecio >= 0.97 ? 35 : pctPrecio >= 0.94 ? 27 : pctPrecio >= 0.90 ? 18 : 8

  const scoreM: Record<MetodoPago, number> = { CONTADO: 30, MIXTO: 22, HIPOTECA: 14, CUOTAS: 6 }

  const scoreT = oferta.timelineDays <= 30 ? 20 : oferta.timelineDays <= 60 ? 15 : oferta.timelineDays <= 90 ? 10 : 4

  const scoreC = oferta.conditions.length === 0 ? 10 : oferta.conditions.length === 1 ? 7 : oferta.conditions.length === 2 ? 4 : 1

  return { precio: scoreP, metodoPago: scoreM[oferta.paymentMethod], timeline: scoreT, condiciones: scoreC }
}

const OFERTAS_BASE: Oferta[] = [
  {
    id: 'of-001',
    buyerName: 'Martín y Valeria Suárez',
    buyerPhone: '+54 9 11 4523-8801',
    buyerEmail: 'msuarez@gmail.com',
    offeredPrice: 182000,
    askingPrice: ASKING_PRICE,
    paymentMethod: 'CONTADO',
    timelineDays: 45,
    conditions: [],
    date: '2026-09-10',
    portalId: 'zonaprop',
    portalName: 'Zonaprop',
    portalUrl: 'https://www.zonaprop.com.ar',
    estado: 'ACTIVA',
    isMockData: true,
  },
  {
    id: 'of-002',
    buyerName: 'Diego Ferreyra',
    buyerPhone: '+54 9 341 655-2200',
    buyerEmail: 'dferreyra@outlook.com',
    offeredPrice: 175000,
    askingPrice: ASKING_PRICE,
    paymentMethod: 'HIPOTECA',
    timelineDays: 90,
    conditions: ['Sujeto a aprobación crediticia', 'Tasación del banco requerida'],
    date: '2026-09-12',
    portalId: 'argenprop',
    portalName: 'Argenprop',
    portalUrl: 'https://www.argenprop.com',
    estado: 'ACTIVA',
    isMockData: true,
  },
  {
    id: 'of-003',
    buyerName: 'Lucía Ramírez',
    buyerPhone: '+54 9 11 6700-4412',
    offeredPrice: 188000,
    askingPrice: ASKING_PRICE,
    paymentMethod: 'MIXTO',
    timelineDays: 60,
    conditions: ['Solicita cochera incluida'],
    date: '2026-09-14',
    portalId: 'zonaprop',
    portalName: 'Zonaprop',
    portalUrl: 'https://www.zonaprop.com.ar',
    estado: 'EN_NEGOCIACION',
    isMockData: true,
  },
  {
    id: 'of-004',
    buyerName: 'Familia Goldstein',
    buyerPhone: '+54 9 11 2288-9934',
    buyerEmail: 'pgoldstein@yahoo.com.ar',
    offeredPrice: 165000,
    askingPrice: ASKING_PRICE,
    paymentMethod: 'CUOTAS',
    timelineDays: 120,
    conditions: ['Pago en 3 cuotas', 'Boleto en 30 días', 'Escritura a 120 días'],
    date: '2026-09-15',
    portalId: 'mercadolibre',
    portalName: 'MercadoLibre',
    portalUrl: 'https://inmuebles.mercadolibre.com.ar',
    estado: 'ACTIVA',
    isMockData: true,
  },
  {
    id: 'of-005',
    buyerName: 'Carolina Méndez',
    buyerPhone: '+54 9 11 5512-6643',
    offeredPrice: 185000,
    askingPrice: ASKING_PRICE,
    paymentMethod: 'CONTADO',
    timelineDays: 30,
    conditions: [],
    date: '2026-09-16',
    portalId: 'zonaprop',
    portalName: 'Zonaprop',
    portalUrl: 'https://www.zonaprop.com.ar',
    estado: 'ACTIVA',
    isMockData: true,
  },
]

export const MOCK_OFERTAS: OfertaConScore[] = OFERTAS_BASE.map(o => {
  const d = calcularScore(o)
  return { ...o, score: d.precio + d.metodoPago + d.timeline + d.condiciones, scoreDetalle: d }
}).sort((a, b) => b.score - a.score)

export const ASKING_PRICE_DEMO = ASKING_PRICE

export const METODO_PAGO_LABEL: Record<MetodoPago, string> = {
  CONTADO: 'Contado',
  HIPOTECA: 'Hipoteca bancaria',
  CUOTAS: 'Cuotas',
  MIXTO: 'Mixto (contado + cuotas)',
}

export const ESTADO_CONFIG: Record<EstadoOferta, { label: string; color: string; bg: string }> = {
  ACTIVA: { label: 'Activa', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  EN_NEGOCIACION: { label: 'En negociación', color: 'text-amber-700', bg: 'bg-amber-50' },
  RECHAZADA: { label: 'Rechazada', color: 'text-red-600', bg: 'bg-red-50' },
  ACEPTADA: { label: 'Aceptada', color: 'text-blue-700', bg: 'bg-blue-50' },
}
