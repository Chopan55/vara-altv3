import { PROVINCE_MAP, ONBOARDING_PROVINCE_TO_CODE, ALL_PROVINCES_WITH_MX } from '@/data/regulations/provinces'
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

/**
 * Documentación del comprador para México (H13).
 * Reemplaza los requisitos argentinos (DNI/CUIT/CUIL/UIF) por los equivalentes mexicanos.
 * AVISO: datos sintéticos para prueba arquitectónica — validar con notario mexicano antes de usar en producción.
 */
const MX_DOCS_BUYER: ChecklistStage['tasks'] = [
  { id: 'mx-c1', title: 'INE / pasaporte vigente', description: 'Credencial para votar (INE/IFE) vigente o pasaporte. Identificación oficial con fotografía.', responsibleParty: 'Comprador', documents: ['INE o pasaporte'] },
  { id: 'mx-c2', title: 'RFC con homoclave', description: 'Registro Federal de Contribuyentes vigente. El notario lo requiere para la escritura.', responsibleParty: 'Comprador', documents: ['Constancia de RFC'] },
  { id: 'mx-c3', title: 'Constancia de situación fiscal (SAT)', description: 'Documento emitido por el SAT que acredita el RFC y la situación fiscal del comprador.', responsibleParty: 'Comprador', documents: ['Constancia de situación fiscal'] },
  { id: 'mx-c4', title: 'Documentación de estado civil', description: 'Acta de matrimonio o acta de nacimiento según estado civil. Los bienes de la sociedad conyugal requieren firma de ambos cónyuges.', responsibleParty: 'Comprador', documents: ['Acta de matrimonio o nacimiento'] },
  { id: 'mx-c5', title: 'CURP', description: 'Clave Única de Registro de Población. Necesaria para la escritura y el aviso al SAT.', responsibleParty: 'Comprador', documents: ['Constancia CURP'] },
  { id: 'mx-c6', title: 'Origen de los recursos y forma de pago', description: 'Por la ley antilavado, el notario identifica a las partes, pide declarar de dónde sale el dinero y quién es el beneficiario real. La ley limita los pagos en efectivo para comprar inmuebles: pagá por transferencia o cheque.', responsibleParty: 'Comprador', documents: ['Comprobantes de transferencias', 'Estados de cuenta'], warnings: ['No pagues el precio en efectivo: el notario puede negarse a escriturar'] },
  { id: 'mx-c7', title: 'Comprobante de domicilio', description: 'Reciente (luz, agua, teléfono o estado de cuenta). Lo pide el notario para identificar al comprador.', responsibleParty: 'Comprador', documents: ['Comprobante de domicilio'] },
  { id: 'mx-c8', title: 'Si sos extranjero: permiso y fideicomiso', description: 'En la zona restringida (franja de 100 km de las fronteras y 50 km de las costas) un extranjero compra a través de un fideicomiso bancario; fuera de ella necesita un permiso de la Secretaría de Relaciones Exteriores. Si no aplica, marcalo como hecho.', responsibleParty: 'Comprador / Notario', documents: ['Permiso de la SRE', 'Contrato de fideicomiso (si aplica)'], warnings: ['Arrancá este trámite temprano: suma semanas al cierre'] },
]

const MX_DOCS_SELLER: ChecklistStage['tasks'] = [
  { id: 'mx-v1', title: 'INE / pasaporte vigente', description: 'Identificación oficial vigente del vendedor.', responsibleParty: 'Vendedor', documents: ['INE o pasaporte'] },
  { id: 'mx-v2', title: 'Escritura o título de propiedad', description: 'Escritura pública inscripta en el Registro Público de la Propiedad que acredita la titularidad.', responsibleParty: 'Vendedor', documents: ['Escritura de propiedad inscripta'] },
  { id: 'mx-v3', title: 'Boletas de predial y agua al corriente', description: 'Predial municipal e impuesto al agua al corriente de pago. El notario los requiere para la escritura.', responsibleParty: 'Vendedor', documents: ['Boleta predial', 'Boleta agua'] },
  { id: 'mx-v4', title: 'Certificado de libertad de gravamen', description: 'Emitido por el Registro Público de la Propiedad. Acredita que el inmueble no tiene hipotecas ni embargos.', responsibleParty: 'Vendedor', documents: ['Certificado de libertad de gravamen'] },
  { id: 'mx-v5', title: 'RFC con homoclave (vendedor)', description: 'Registro Federal de Contribuyentes del vendedor para la declaración fiscal de la operación.', responsibleParty: 'Vendedor', documents: ['Constancia de RFC vendedor'] },
  { id: 'mx-v6', title: 'Acta de matrimonio o de nacimiento', description: 'Si estás casado por bienes mancomunados, tu cónyuge también firma la venta.', responsibleParty: 'Vendedor', documents: ['Acta de matrimonio o nacimiento'] },
  { id: 'mx-v7', title: 'Comprobantes de que es tu casa habitación', description: 'Si vas a pedir la exención de ISR, el notario pide demostrar que vivís ahí: INE y recibos de luz o estados de cuenta con ese domicilio, a tu nombre.', responsibleParty: 'Vendedor', documents: ['Comprobantes de domicilio a nombre del vendedor'], warnings: ['Sin estos comprobantes la venta puede pagar ISR completo'] },
]

const NOTARY_TASKS: ChecklistStage['tasks'] = [
  { id: 'n-1', title: 'Estudio de títulos (últimos 20 años)', description: 'El escribano analiza la cadena de titularidad de los últimos 20 años para detectar vicios, irregularidades o limitaciones al dominio.', responsibleParty: 'Escribano', documents: ['Informe de dominio'], warnings: ['Si el título tiene vicios, puede impedir o demorar la escrituración'] },
  { id: 'n-2', title: 'Informe de dominio y gravámenes (Registro)', description: 'El escribano solicita el informe oficial al Registro que muestra hipotecas, embargos y restricciones vigentes.', responsibleParty: 'Escribano', documents: ['Informe de dominio del RPI'] },
  { id: 'n-3', title: 'Certificado de inhibición del vendedor', description: 'Verifica si el vendedor tiene restricciones judiciales. Si está inhibido, no puede escriturar hasta que se levante la medida.', responsibleParty: 'Escribano', documents: ['Certificado de inhibición'], warnings: ['Si el vendedor está inhibido, la escritura no puede realizarse'] },
  { id: 'n-4', title: 'Liquidación y pago de impuesto de sellos', description: 'El escribano actúa como agente de retención: calcula el sellado, lo cobra de las partes y lo deposita ante el organismo impositivo provincial.', responsibleParty: 'Escribano', documents: ['Comprobante de pago de sellos'] },
  { id: 'n-5', title: 'Inscripción en el Registro de la Propiedad', description: 'Una vez firmada la escritura, el escribano la presenta al Registro para inscribir el cambio de titularidad a nombre del comprador.', responsibleParty: 'Escribano', documents: ['Escritura inscripta'] },
]

/**
 * Trámites del notario en México. Proceso general de una compraventa con
 * escritura pública; cada estado tiene variantes (las que conocemos están en
 * `particularities` de cada estado). Se valida con un notario local.
 */
const MX_NOTARY_TASKS: ChecklistStage['tasks'] = [
  { id: 'mxn-1', title: 'Certificado de libertad de gravamen', description: 'El notario lo pide al Registro Público de la Propiedad (RPP): confirma que el inmueble no tiene hipotecas, embargos ni limitaciones.', responsibleParty: 'Notario', documents: ['Certificado de libertad de gravamen'], warnings: ['Si aparece un gravamen, tiene que cancelarse antes o en la misma firma'] },
  { id: 'mxn-1b', title: 'Aviso preventivo al RPP', description: 'El notario avisa al Registro Público de la Propiedad que se va a firmar la compraventa. Mientras está vigente, protege al comprador frente a otros actos sobre el inmueble.', responsibleParty: 'Notario', documents: ['Aviso preventivo'] },
  { id: 'mxn-2', title: 'Avalúo del inmueble', description: 'Lo hace un perito valuador autorizado. Sirve de base para el ISAI y, si hay crédito, lo exige el banco o INFONAVIT.', responsibleParty: 'Notario / Perito valuador', documents: ['Avalúo'] },
  { id: 'mxn-3', title: 'Constancias de no adeudo', description: 'Predial y agua al corriente; en condominio, constancia de no adeudo de cuotas de mantenimiento.', responsibleParty: 'Vendedor', documents: ['Constancia de no adeudo predial', 'Constancia de no adeudo de agua'] },
  { id: 'mxn-4', title: 'Cálculo del ISR del vendedor e ISAI del comprador', description: 'El notario calcula y retiene el ISR por la venta (puede estar exento si es casa habitación y se cumplen los requisitos del SAT) y el ISAI que paga el comprador.', responsibleParty: 'Notario', documents: ['Liquidación de impuestos'], warnings: ['La exención de ISR por casa habitación tiene requisitos y topes: confirmalos con el notario antes de pactar el precio'] },
  { id: 'mxn-5', title: 'Inscripción en el Registro Público de la Propiedad', description: 'Después de la firma, el notario inscribe la escritura en el RPP y entrega el testimonio al comprador.', responsibleParty: 'Notario', documents: ['Testimonio de la escritura inscrita'] },
]

/** Códigos de los estados de México con datos regulatorios. */
export const MX_CODES = new Set([
  'CDMX', 'JALISCO', 'NUEVO_LEON', 'ESTADO_DE_MEXICO',
  'PUEBLA', 'GUANAJUATO', 'CHIHUAHUA', 'BAJA_CALIFORNIA', 'QUERETARO', 'YUCATAN',
])

/** Trámites del notario que van en la etapa de firma; el resto, antes. */
const MX_SIGNING_TASK_IDS = new Set(['mxn-4', 'mxn-5'])

function makeCostLine(label: string, min: number, max: number, source: string, notes?: string): CostLine {
  return { label, minAmount: min, maxAmount: max, currency: 'USD', isEstimate: true, source, notes }
}

/** País de una jurisdicción a partir de su nombre o código (p. ej. "Ciudad de México" → MX). */
export function countryOfProvince(province: string | null | undefined): CountryCode {
  if (!province) return 'AR'
  const code = ONBOARDING_PROVINCE_TO_CODE[province] ?? province
  return MX_CODES.has(code) ? 'MX' : 'AR'
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
  // El país lo define la jurisdicción: un estado de México siempre usa el proceso mexicano,
  // aunque quien llama no pase `country` (H13: MX usa INE/RFC/CURP, notario e ISAI).
  const isMX = MX_CODES.has(reg.code) || country === 'MX'
  const notary = isMX ? 'notario' : 'escribano'

  const rateMax = reg.stampTax.totalRateMax ?? reg.stampTax.totalRate
  const stampBuyerUSD = propertyValueUSD * reg.stampTax.totalRate * reg.stampTax.buyerShare
  const stampSellerUSD = propertyValueUSD * reg.stampTax.totalRate * reg.stampTax.sellerShare
  const stampBuyerMaxUSD = propertyValueUSD * rateMax * reg.stampTax.buyerShare
  const stampSellerMaxUSD = propertyValueUSD * rateMax * reg.stampTax.sellerShare
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
      isMX ? `ISAI ${reg.displayName} (comprador)` : `Sellos ${reg.displayName} (parte comprador)`,
      stampBuyerUSD, stampBuyerMaxUSD,
      reg.stampTax.sourceUrl ?? `Org. impositivo ${reg.displayName}`,
      reg.stampTax.confidence !== 'VERIFIED' ? `Estimado — verificar en ${reg.displayName}` : reg.stampTax.notes
    ),
    stampTaxSeller: makeCostLine(
      isMX ? `ISAI ${reg.displayName} (vendedor)` : `Sellos ${reg.displayName} (parte vendedor)`,
      stampSellerUSD, stampSellerMaxUSD,
      reg.stampTax.sourceUrl ?? `Org. impositivo ${reg.displayName}`,
    ),
    notaryFeeBuyer: makeCostLine(
      `Honorarios ${notary} (parte comprador)`,
      notaryBuyerMin, notaryBuyerMax,
      reg.entities.find(e => e.role === 'COLEGIO_ESCRIBANOS')?.url ?? (isMX ? 'Colegio de Notarios del estado' : 'Colegio de Escribanos provincial'),
      reg.notaryFee.notes
    ),
    notaryFeeSeller: makeCostLine(
      `Honorarios ${notary} (parte vendedor)`,
      notarySellerMin, notarySellerMax,
      reg.entities.find(e => e.role === 'COLEGIO_ESCRIBANOS')?.url ?? (isMX ? 'Colegio de Notarios del estado' : 'Colegio de Escribanos provincial'),
    ),
    registryFee: makeCostLine(
      isMX ? 'Derechos de inscripción en el RPP' : 'Inscripción Registro de la Propiedad',
      registryFeeUSD, registryFeeUSD,
      reg.entities.find(e => e.role === 'REGISTRO')?.url ?? (isMX ? 'Registro Público de la Propiedad del estado' : 'Registro de la Propiedad provincial'),
      reg.registryFee.notes
    ),
    certificates: makeCostLine(
      isMX ? 'Avalúo, certificados y gestiones' : 'Certificados, informes y gestiones',
      certsMin, certsMax, 'Estimado promedio',
    ),
    totalBuyer: {
      min: stampBuyerUSD + notaryBuyerMin + registryFeeUSD + certsMin,
      max: stampBuyerMaxUSD + notaryBuyerMax + registryFeeUSD + certsMax,
      percentMin: pct(stampBuyerUSD + notaryBuyerMin + registryFeeUSD + certsMin),
      percentMax: pct(stampBuyerMaxUSD + notaryBuyerMax + registryFeeUSD + certsMax),
      currency: 'USD',
    },
    totalSeller: {
      min: stampSellerUSD + notarySellerMin,
      max: stampSellerMaxUSD + notarySellerMax,
      percentMin: pct(stampSellerUSD + notarySellerMin),
      percentMax: pct(stampSellerMaxUSD + notarySellerMax),
      currency: 'USD',
    },
    notes: (isMX ? [
      reg.stampTax.notes ?? '',
      `Fuente del ISAI: ${reg.stampTax.confidence === 'VERIFIED' ? 'VERIFICADA (fuente oficial)' : reg.stampTax.confidence === 'PARTIAL' ? 'PARCIAL — confirmar con el notario' : 'ESTIMADA — verificar con el notario o la tesorería del estado'}`,
      'ISR del vendedor: no se incluye. Depende de la ganancia y puede estar exento si es casa habitación; lo calcula el notario.',
      'Valores en USD al tipo de cambio vigente. El notario liquida en MXN.',
    ] : [
      reg.stampTax.notes ?? '',
      `Fuente de sellos: ${reg.stampTax.confidence === 'VERIFIED' ? 'VERIFICADA (fuente oficial)' : reg.stampTax.confidence === 'PARTIAL' ? 'PARCIAL — confirmar con escribano' : 'ESTIMADA — verificar en organismo provincial'}`,
      'ITI derogado desde 07/2024 — vendedor persona física no habitual sin impuesto nacional',
      'Valores en USD al tipo de cambio vigente. El escribano liquida en ARS.',
    ]).filter(Boolean),
  }

  const provinceDocTasks: ChecklistStage['tasks'] = [
    ...reg.documents.map((doc, i) => ({
      id: `prov-doc-${i}`,
      title: doc.name,
      description: doc.notes ?? `Requerido por ${reg.displayName} para la transmisión de dominio.`,
      responsibleParty: doc.responsibleParty === 'ESCRIBANO' ? (isMX ? 'Notario' : 'Escribano') : doc.responsibleParty === 'VENDEDOR' ? 'Vendedor' : 'Comprador',
      documents: [doc.name],
      isProvinceSpecific: true,
    })),
  ]

  const buyerDocs = isMX ? MX_DOCS_BUYER : UNIVERSAL_DOCS_BUYER
  const sellerDocs = isMX ? MX_DOCS_SELLER : UNIVERSAL_DOCS_SELLER

  const stages: ChecklistStage[] = isMX ? [
    {
      order: 1, name: 'Apartado', durationDays: '3-10 días',
      tasks: [
        { id: 'mx1-1', title: 'Oferta y negociación de precio', description: 'Acordar precio, forma de pago (contado, crédito bancario o INFONAVIT), fecha de firma y condiciones.', responsibleParty: 'Ambas partes / Asesor inmobiliario', documents: [] },
        { id: 'mx1-2', title: 'Apartado', description: 'Depósito para separar el inmueble mientras se revisa la documentación. Dejar por escrito el monto, el plazo y qué pasa si alguna parte desiste.', responsibleParty: 'Comprador', documents: ['Recibo de apartado'], warnings: ['Pedir siempre recibo con datos completos del inmueble y del vendedor'] },
        { id: 'mx1-3', title: 'Verificación básica de titularidad', description: 'Confirmar que el vendedor es el titular según la escritura inscrita, antes de comprometer más dinero.', responsibleParty: 'Comprador / Notario', documents: [] },
      ],
    },
    { order: 2, name: 'Documentación del vendedor', durationDays: '10-20 días', tasks: [...sellerDocs, ...provinceDocTasks] },
    { order: 3, name: 'Documentación del comprador', durationDays: '5-10 días', tasks: buyerDocs },
    { order: 4, name: 'Certificados y avalúo', durationDays: '10-20 días', tasks: MX_NOTARY_TASKS.filter(t => !MX_SIGNING_TASK_IDS.has(t.id)) },
    {
      order: 5, name: 'Promesa de compraventa', durationDays: '1-3 días',
      tasks: [
        { id: 'mxp-1', title: 'Firma del contrato de promesa de compraventa', description: 'Contrato privado que fija precio, plazos, anticipo y penas por incumplimiento hasta la firma ante notario. No siempre se usa, pero protege a las dos partes.', responsibleParty: 'Ambas partes', documents: ['Contrato de promesa de compraventa', 'Comprobante de anticipo'], warnings: ['Revisarlo con el notario o un abogado antes de firmar'] },
      ],
    },
    {
      order: 6, name: 'Firma ante notario', durationDays: '15-45 días',
      tasks: [
        ...MX_NOTARY_TASKS.filter(t => MX_SIGNING_TASK_IDS.has(t.id)),
        {
          id: 'mx-firma', title: 'Firma de la escritura pública',
          description: 'Se paga el saldo, los honorarios del notario, el ISAI y los derechos de registro. El notario da fe de la compraventa.',
          responsibleParty: 'Ambas partes + Notario',
          documents: ['Escritura pública'],
          warnings: reg.particularities.length > 0 ? reg.particularities.slice(0, 2) : undefined,
        },
      ],
    },
  ] : [
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
      tasks: [...sellerDocs, ...provinceDocTasks],
    },
    {
      order: 3, name: 'Documentación del comprador', durationDays: '5-10 días',
      tasks: buyerDocs,
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
    ...(reg.dataConfidence !== 'VERIFIED' ? [`⚠️ Datos regulatorios de ${reg.displayName} son ${reg.dataConfidence} — verificar ${isMX ? 'con el notario' : 'en organismo impositivo'} antes de operar`] : []),
    ...reg.stampTax.exemptions.map(e => `Posible exención: ${e.description} — ${e.condition}`),
  ]

  return { province: reg.code, provinceName: reg.name, operationType, stages, costs, warnings, dataConfidence: reg.dataConfidence }
}

export function getProvinceList() {
  return ALL_PROVINCES_WITH_MX.map(p => ({
    code: p.code,
    name: p.name,
    displayName: p.displayName,
    stampTaxRate: p.stampTax.totalRate,
    confidence: p.dataConfidence,
  }))
}


export function getProvinceListGrouped() {
  const all = getProvinceList()
  return [
    { country: 'AR', label: 'Argentina', items: all.filter(p => !MX_CODES.has(p.code)) },
    { country: 'MX', label: 'México', items: all.filter(p => MX_CODES.has(p.code)) },
  ]
}

export function formatPercent(rate: number): string {
  if (rate === 0) return '0%'
  return `${(rate * 100).toFixed(2).replace(/\.?0+$/, '')}%`
}
