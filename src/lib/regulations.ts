import { PROVINCE_MAP, ONBOARDING_PROVINCE_TO_CODE, ALL_PROVINCES } from '@/data/regulations/provinces'
import type { RegulatoryChecklist, ProvinceCode, CostBreakdown, CostLine, ChecklistStage } from '@/data/regulations/types'
import type { OperationType, CountryCode } from '@/types'
import { getJurisdiction } from '@/lib/jurisdiction'

const UNIVERSAL_DOCS_SELLER: ChecklistStage['tasks'] = [
  { id: 'u-v1', title: 'DNI vigente + CUIT/CUIL', description: 'Documento Nacional de Identidad vigente más constancia de CUIT o CUIL.', responsibleParty: 'Vendedor', documents: ['DNI', 'Constancia CUIT/CUIL'] },
  { id: 'u-v2', title: 'Escritura original del inmueble', description: 'Título de propiedad que acredita la titularidad. Si fue adquirida por sucesión: declaratoria de herederos inscripta en el Registro.', responsibleParty: 'Vendedor', documents: ['Escritura anterior'] },
  { id: 'u-v3', title: 'Documentación de estado civil', description: 'Libreta matrimonial, sentencia de divorcio, o acta de nacimiento según corresponda. Los bienes gananciales requieren conformidad del cónyuge.', responsibleParty: 'Vendedor', documents: ['Libreta matrimonial o acta de soltería'] },
  { id: 'u-v4', title: 'Últimas boletas de servicios', description: 'Gas, electricidad y agua — demuestran que los servicios están activos y al día.', responsibleParty: 'Vendedor', documents: ['Boleta gas', 'Boleta electricidad', 'Boleta agua'] },
  { id: 'u-v5', title: 'Libre deuda de expensas (si PH o barrio)', description: 'Firmado por el administrador del consorcio. Debe estar emitido dentro de los 30 días previos a la escritura.', responsibleParty: 'Vendedor', documents: ['Libre deuda de expensas'], warnings: ['Si el inmueble tiene deudas de expensas, el vendedor debe saldarlas antes de escriturar'] },
]

const UNIVERSAL_DOCS_BUYER: ChecklistStage['tasks'] = [
  { id: 'u-c1', title: 'DNI vigente + CUIT/CUIL', description: 'Documento Nacional de Identidad vigente más constancia de CUIT o CUIL.', responsibleParty: 'Comprador', documents: ['DNI', 'Constancia CUIT/CUIL'] },
  { id: 'u-c2', title: 'Declaración jurada de origen de fondos (UIF)', description: 'Obligatoria por Resolución UIF 30-E/2017. El comprador declara el origen lícito de los fondos ante el escribano. Sin esta DDJJ el escribano no puede escriturar.', responsibleParty: 'Comprador', documents: ['DDJJ origen de fondos'], warnings: ['Sin esta DDJJ el escribano no puede escriturar — el incumplimiento es infracción antilavado'] },
  { id: 'u-c3', title: 'Documentación de estado civil', description: 'Libreta matrimonial, sentencia de divorcio, o acta de nacimiento.', responsibleParty: 'Comprador', documents: ['Libreta matrimonial o acta de soltería'] },
]

const NOTARY_TASKS: ChecklistStage['tasks'] = [
  { id: 'n-1', title: 'Estudio de títulos (últimos 20 años)', description: 'El escribano analiza la cadena de titularidad de los últimos 20 años para detectar vicios, irregularidades o limitaciones al dominio.', responsibleParty: 'Escribano', documents: ['Informe de dominio'], warnings: ['Si el título tiene vicios, puede impedir o demorar la escrituración'] },
  { id: 'n-2', title: 'Informe de dominio y gravámenes (Registro)', description: 'El escribano solicita el informe oficial al Registro que muestra hipotecas, embargos y restricciones vigentes.', responsibleParty: 'Escribano', documents: ['Informe de dominio del RPI'] },
  { id: 'n-3', title: 'Certificado de inhibición del vendedor', description: 'Verifica si el vendedor tiene restricciones judiciales. Si está inhibido, no puede escriturar hasta que se levante la medida.', responsibleParty: 'Escribano', documents: ['Certificado de inhibición'], warnings: ['Si el vendedor está inhibido, la escritura no puede realizarse'] },
  { id: 'n-4', title: 'Liquidación y pago de impuesto de sellos', description: 'El escribano actúa como agente de retención: calcula el sellado, lo cobra de las partes y lo deposita ante el organismo impositivo provincial.', responsibleParty: 'Escribano', documents: ['Comprobante de pago de sellos'] },
  { id: 'n-5', title: 'Inscripción en el Registro de la Propiedad', description: 'Una vez firmada la escritura, el escribano la presenta al Registro para inscribir el cambio de titularidad a nombre del comprador.', responsibleParty: 'Escribano', documents: ['Escritura inscripta'] },
]

function makeCostLine(label: string, min: number, max: number, source: string, notes?: string): CostLine {
  return { label, minAmount: min, maxAmount: max, currency: 'USD', isEstimate: true, source, notes }
}

export function getRegulation(provinceCode: string, country?: CountryCode | null) {
  const defaultCode = getJurisdiction(country).defaultProvinceCode
  return PROVINCE_MAP[provinceCode] ?? PROVINCE_MAP[defaultCode] ?? PROVINCE_MAP['BUENOS_AIRES']
}

export function resolveProvinceCode(onboardingProvince: string, country?: CountryCode | null): ProvinceCode {
  const defaultCode = getJurisdiction(country).defaultProvinceCode
  return (ONBOARDING_PROVINCE_TO_CODE[onboardingProvince] ?? defaultCode) as ProvinceCode
}

export function generateChecklist(
  provinceCode: ProvinceCode | string,
  operationType: OperationType,
  propertyValueUSD = 0,
  country?: CountryCode | null,
): RegulatoryChecklist {
  const defaultCode = getJurisdiction(country).defaultProvinceCode
  const reg = PROVINCE_MAP[provinceCode] ?? PROVINCE_MAP[defaultCode] ?? PROVINCE_MAP['BUENOS_AIRES']

  const stampBuyerRate = reg.stampTax.totalRate * reg.stampTax.buyerShare
  const stampSellerRate = reg.stampTax.totalRate * reg.stampTax.sellerShare
  const stampBuyerUSD = propertyValueUSD * stampBuyerRate
  const stampSellerUSD = propertyValueUSD * stampSellerRate
  const notaryMin = propertyValueUSD * reg.notaryFee.minRate
  const notaryMax = propertyValueUSD * reg.notaryFee.maxRate
  const notaryBuyerMin = notaryMin * reg.notaryFee.buyerShare
  const notaryBuyerMax = notaryMax * reg.notaryFee.buyerShare
  const notarySellerMin = notaryMin * reg.notaryFee.sellerShare
  const notarySellerMax = notaryMax * reg.notaryFee.sellerShare
  const registryFeeUSD = (reg.registryFee.rate ?? 0.003) * propertyValueUSD
  const certsMin = 400
  const certsMax = 900

  /*
   * Un porcentaje "sobre el valor de la propiedad" no existe si no hay valor.
   * Antes esto dividía por cero y devolvía Infinity, que la pantalla de
   * costos pintaba como "Infinity%". Cero es honesto: no hay proporción
   * que mostrar todavía.
   */
  const pct = (amount: number): number =>
    propertyValueUSD > 0 ? (amount / propertyValueUSD) * 100 : 0

  const costs: CostBreakdown = {
    currency: 'USD',
    propertyValue: propertyValueUSD,
    stampTaxBuyer: makeCostLine(
      `Sellos ${reg.displayName} (parte comprador)`,
      stampBuyerUSD, stampBuyerUSD,
      reg.stampTax.sourceUrl ?? `Org. impositivo ${reg.displayName}`,
      reg.stampTax.confidence !== 'VERIFIED' ? `Estimado — verificar en ${reg.displayName}` : reg.stampTax.notes
    ),
    stampTaxSeller: makeCostLine(
      `Sellos ${reg.displayName} (parte vendedor)`,
      stampSellerUSD, stampSellerUSD,
      reg.stampTax.sourceUrl ?? `Org. impositivo ${reg.displayName}`,
    ),
    notaryFeeBuyer: makeCostLine(
      'Honorarios escribano (parte comprador)',
      notaryBuyerMin, notaryBuyerMax,
      reg.entities.find(e => e.role === 'COLEGIO_ESCRIBANOS')?.url ?? 'Colegio de Escribanos provincial',
      reg.notaryFee.notes
    ),
    notaryFeeSeller: makeCostLine(
      'Honorarios escribano (parte vendedor)',
      notarySellerMin, notarySellerMax,
      reg.entities.find(e => e.role === 'COLEGIO_ESCRIBANOS')?.url ?? 'Colegio de Escribanos provincial',
    ),
    registryFee: makeCostLine(
      'Inscripción Registro de la Propiedad',
      registryFeeUSD, registryFeeUSD,
      reg.entities.find(e => e.role === 'REGISTRO')?.url ?? 'Registro de la Propiedad provincial',
      reg.registryFee.notes
    ),
    certificates: makeCostLine('Certificados, informes y gestiones', certsMin, certsMax, 'Estimado promedio'),
    totalBuyer: {
      min: stampBuyerUSD + notaryBuyerMin + registryFeeUSD + certsMin,
      max: stampBuyerUSD + notaryBuyerMax + registryFeeUSD + certsMax,
      percentMin: pct(stampBuyerUSD + notaryBuyerMin + registryFeeUSD + certsMin),
      percentMax: pct(stampBuyerUSD + notaryBuyerMax + registryFeeUSD + certsMax),
      currency: 'USD',
    },
    totalSeller: {
      min: stampSellerUSD + notarySellerMin,
      max: stampSellerUSD + notarySellerMax,
      percentMin: pct(stampSellerUSD + notarySellerMin),
      percentMax: pct(stampSellerUSD + notarySellerMax),
      currency: 'USD',
    },
    notes: [
      reg.stampTax.notes ?? '',
      `Fuente de sellos: ${reg.stampTax.confidence === 'VERIFIED' ? 'VERIFICADA (fuente oficial)' : reg.stampTax.confidence === 'PARTIAL' ? 'PARCIAL — confirmar con escribano' : 'ESTIMADA — verificar en organismo provincial'}`,
      'ITI derogado desde 07/2024 — vendedor persona física no habitual sin impuesto nacional',
      'Valores en USD al tipo de cambio vigente. El escribano liquida en ARS.',
    ].filter(Boolean),
  }

  const provinceDocTasks: ChecklistStage['tasks'] = [
    ...reg.documents.map((doc, i) => ({
      id: `prov-doc-${i}`,
      title: doc.name,
      description: doc.notes ?? `Requerido por ${reg.displayName} para la transmisión de dominio.`,
      responsibleParty: doc.responsibleParty === 'ESCRIBANO' ? 'Escribano' : doc.responsibleParty === 'VENDEDOR' ? 'Vendedor' : 'Comprador',
      documents: [doc.name],
      isProvinceSpecific: true,
    })),
  ]

  const stages: ChecklistStage[] = [
    {
      order: 1, name: 'Reserva', durationDays: '3-10 días',
      tasks: [
        { id: 's1-1', title: 'Oferta y negociación de precio', description: 'Negociar precio, forma de pago, fecha de escritura y condiciones. Definir si hay cláusula de ajuste.', responsibleParty: 'Ambas partes / Inmobiliaria', documents: [] },
        { id: 's1-2', title: 'Firma de reserva y entrega de seña', description: 'El comprador entrega 1-2% del valor como seña. Si el vendedor desiste: devuelve el doble. Si el comprador desiste: pierde la seña. Plazo típico: 10-15 días.', responsibleParty: 'Comprador', documents: ['Recibo de reserva'], warnings: ['Siempre pedir recibo detallado con dirección completa y datos del vendedor'] },
        { id: 's1-3', title: 'Verificación básica de titularidad', description: 'Confirmar que el inmueble está a nombre del vendedor y sin embargos visibles antes de comprometer más fondos.', responsibleParty: 'Comprador / Escribano', documents: [] },
      ],
    },
    {
      order: 2, name: 'Documentación del vendedor', durationDays: '10-25 días',
      tasks: [...UNIVERSAL_DOCS_SELLER, ...provinceDocTasks],
    },
    {
      order: 3, name: 'Documentación del comprador', durationDays: '5-10 días',
      tasks: UNIVERSAL_DOCS_BUYER,
    },
    {
      order: 4, name: 'Estudio de títulos y certificaciones', durationDays: '15-25 días',
      tasks: NOTARY_TASKS.slice(0, 3),
    },
    {
      order: 5, name: 'Boleto de compraventa', durationDays: '1-3 días',
      tasks: [
        { id: 'bolt-1', title: 'Firma del boleto de compraventa', description: 'Contrato privado que compromete definitivamente la operación. Suele acompañarse del pago del 30-40% del precio.', responsibleParty: 'Ambas partes', documents: ['Boleto de compraventa', 'Comprobante de pago a cuenta'], warnings: ['El boleto es el documento más importante antes de la escritura — revisarlo con escribano o abogado'] },
      ],
    },
    {
      order: 6, name: 'Escrituración', durationDays: '30-60 días desde boleto',
      tasks: [
        ...NOTARY_TASKS.slice(3),
        {
          id: 'esc-final', title: 'Liquidación final y firma de escritura',
          description: 'Se paga el saldo del precio, honorarios del escribano, impuesto de sellos y costos registrales. El escribano certifica la transferencia ante las partes.',
          responsibleParty: 'Ambas partes + Escribano',
          documents: ['Escritura pública'],
          warnings: reg.particularities.length > 0 ? reg.particularities.slice(0, 2) : undefined,
        },
      ],
    },
  ]

  const warnings: string[] = [
    ...reg.particularities,
    ...(reg.dataConfidence !== 'VERIFIED' ? [`⚠️ Datos regulatorios de ${reg.displayName} son ${reg.dataConfidence} — verificar en organismo impositivo antes de operar`] : []),
    ...reg.stampTax.exemptions.map(e => `Posible exención: ${e.description} — ${e.condition}`),
  ]

  return { province: reg.code, provinceName: reg.name, operationType, stages, costs, warnings, dataConfidence: reg.dataConfidence }
}

export function getProvinceList() {
  return ALL_PROVINCES.map(p => ({
    code: p.code,
    name: p.name,
    displayName: p.displayName,
    stampTaxRate: p.stampTax.totalRate,
    confidence: p.dataConfidence,
  }))
}

export function formatPercent(rate: number): string {
  if (rate === 0) return '0%'
  return `${(rate * 100).toFixed(2).replace(/\.?0+$/, '')}%`
}
