import type { RentalJurisdictionPack, RentalRule } from '../types'
import { amount, isDeclared } from '../normalize'
import {
  missingFields,
  noContractRule,
  noInventoryRule,
  rulePrefix,
  sourceFields,
  type RuleSource,
} from '../contractChecks'

/**
 * México — Ciudad de México, arrendamiento de vivienda.
 *
 * Reglas cargadas a partir de una lectura del Código Civil para el Distrito Federal
 * (texto consolidado del PAOT, última reforma 24-dic-2025) y de la Gaceta Oficial
 * del 28-ago-2024, al 2026-10-06. No hubo revisión legal profesional ni se confirmó
 * si hubo reformas entre enero y octubre de 2026.
 */

const J = 'MX_CDMX' as const
const P = rulePrefix(J)
const REVIEWED = '2026-10-06'

const CC_URL = 'https://paot.org.mx/centro/codigos/df/pdf/2026/CODIGO_CIVIL_PARA_DF_24122025.pdf'
const GACETA_2024_URL = 'https://paot.org.mx/centro/codigos/df/pdf/2024/GOCDMX_28_08_2024_4.pdf'

const SRC = {
  deposito: {
    label: 'Código Civil para el Distrito Federal, art. 2448-E (depósito: una mensualidad) y art. 2448-F fr. IX',
    url: CC_URL,
    confidence: 'VERIFIED',
  },
  moneda: {
    label: 'Código Civil para el Distrito Federal, arts. 2448 y 2448-D (renta en moneda nacional)',
    url: CC_URL,
    confidence: 'VERIFIED',
  },
  contrato: {
    label: 'Código Civil para el Distrito Federal, arts. 2406 y 2448-F (contrato por escrito)',
    url: CC_URL,
    confidence: 'VERIFIED',
  },
  descripcion: {
    label: 'Código Civil para el Distrito Federal, art. 2448-F fr. III y arts. 2442-2443 (descripción y estado del inmueble)',
    url: CC_URL,
    confidence: 'VERIFIED',
  },
  inventario: {
    label: 'Código Civil para el Distrito Federal, arts. 2412, 2442, 2443 y 2448-F fr. III (inventario: sin obligación expresa)',
    url: CC_URL,
    confidence: 'VERIFIED',
  },
  aumentoFrecuencia: {
    label: 'Código Civil para el Distrito Federal, art. 2448-D (la renta solo puede aumentarse anualmente)',
    url: CC_URL,
    confidence: 'VERIFIED',
  },
  aumentoTope: {
    label: 'Gaceta Oficial CDMX del 28-ago-2024: art. 2448-D, párr. 2 (tope: inflación de Banxico del año anterior)',
    url: GACETA_2024_URL,
    confidence: 'VERIFIED',
  },
  pagoAnticipado: {
    label: 'CONDUSEF — guía para evitar fraudes en la renta de inmuebles (2020; no es una norma)',
    url: 'https://www.gob.mx/condusef/articulos/97865',
    confidence: 'NEEDS_REVIEW',
  },
  comision: {
    label: 'Código Civil para el Distrito Federal, arts. 2448 a 2448-M (sin regla sobre comisión de intermediación)',
    url: CC_URL,
    confidence: 'NEEDS_REVIEW',
  },
} satisfies Record<string, RuleSource>

const rules: RentalRule[] = [
  {
    id: `${P}.deposit-over-one-month`,
    jurisdiction: J,
    role: 'ANY',
    kind: 'RISK',
    severity: 'HIGH',
    title: 'Depósito mayor a una mensualidad de renta',
    explanation:
      'Alerta: el depósito declarado supera una mensualidad de renta. Según la regla cargada para CDMX (Código Civil para el DF, art. 2448-E), en el arrendamiento de vivienda el arrendador no puede exigir más de una mensualidad de renta como depósito. Potencialmente no corresponde. La regla limita el depósito y no regula expresamente otros anticipos. Requiere validación local.',
    ...sourceFields(SRC.deposito),
    missing: i => missingFields(i, ['depositAmount', 'monthlyRent']),
    evaluate: i => {
      if (!isDeclared(i.depositAmount) || amount(i.monthlyRent) <= 0) return 'UNKNOWN'
      return amount(i.depositAmount) - amount(i.monthlyRent) > 0.005 ? 'TRIGGERED' : 'OK'
    },
  },
  {
    id: `${P}.currency-not-mxn`,
    jurisdiction: J,
    role: 'ANY',
    kind: 'CONTRACT',
    severity: 'HIGH',
    title: 'Renta pactada en una moneda distinta al peso mexicano',
    explanation:
      'Alerta: según la regla cargada para CDMX (Código Civil para el DF, art. 2448-D), la renta de vivienda debe estipularse en moneda nacional. Una cláusula en otra moneda potencialmente no corresponde; sus efectos concretos los define un juez. Revisar con un profesional local.',
    ...sourceFields(SRC.moneda),
    evaluate: i => (i.currency === 'MXN' ? 'OK' : 'TRIGGERED'),
  },
  noContractRule(J, {
    title: 'Arrendamiento sin contrato escrito',
    explanation:
      'Alerta: no hay contrato escrito. Según la regla cargada para CDMX (Código Civil para el DF, arts. 2406 y 2448-F) el contrato de arrendamiento de vivienda debe otorgarse por escrito, y la falta de esa formalidad se imputa al arrendador. Sin contrato es difícil probar condiciones, plazos y depósito. Revisar antes de pagar.',
    source: SRC.contrato,
  }),
  {
    id: `${P}.no-property-description`,
    jurisdiction: J,
    role: 'ANY',
    kind: 'CONTRACT',
    severity: 'MEDIUM',
    title: 'Contrato sin descripción del inmueble, su estado y accesorios',
    explanation:
      'Alerta: el contrato no incluye una descripción detallada del inmueble, de sus instalaciones y accesorios, y del estado en que se encuentran. Según la regla cargada para CDMX (Código Civil para el DF, art. 2448-F fr. III) es contenido mínimo del contrato de vivienda, y sirve para probar el estado inicial (arts. 2442 y 2443). Revisar y pedir que se incluya.',
    ...sourceFields(SRC.descripcion),
    missing: i => missingFields(i, ['hasPropertyDescription']),
    evaluate: i => (i.hasPropertyDescription === false ? 'TRIGGERED' : i.hasPropertyDescription === true ? 'OK' : 'UNKNOWN'),
  },
  {
    id: `${P}.pays-before-signing`,
    jurisdiction: J,
    role: 'TENANT',
    kind: 'RISK',
    severity: 'HIGH',
    title: 'Piden pagar antes de ver, firmar o recibir las llaves',
    explanation:
      'Alerta: piden pagar depósito o renta antes de ver la propiedad, firmar el contrato y recibir las llaves. Una guía de CONDUSEF sugiere ver el inmueble, firmar y recibir las llaves antes de pagar, y señala los pagos anticipados como una señal de posible fraude. Dato sensible: conviene verificar quién ofrece la propiedad y que tiene facultades para alquilarla antes de pagar.',
    ...sourceFields(SRC.pagoAnticipado),
    missing: i => missingFields(i, ['paysBeforeSigning']),
    evaluate: i => (i.paysBeforeSigning === true ? 'TRIGGERED' : i.paysBeforeSigning === false ? 'OK' : 'UNKNOWN'),
  },
  noInventoryRule(J, {
    title: 'Sin inventario ni acta de entrega',
    explanation:
      'Revisar: no hay inventario ni acta de entrega. El Código Civil para el DF no exige un inventario expreso, pero prevé que se devuelva el inmueble tal como se recibió (arts. 2442 y 2443) y que el contrato describa el inmueble y su estado (art. 2448-F fr. III). Documentar el estado inicial con fotos fechadas ayuda a probarlo al salir.',
    source: SRC.inventario,
  }),
  {
    id: `${P}.increase-frequency`,
    jurisdiction: J,
    role: 'ANY',
    kind: 'CONTRACT',
    severity: 'MEDIUM',
    title: 'Aumento de renta con una frecuencia distinta a la anual',
    explanation:
      'Alerta: la frecuencia de ajuste declarada no es anual. Según la regla cargada para CDMX (Código Civil para el DF, art. 2448-D), en vivienda la renta solo puede aumentarse anualmente. Potencialmente no corresponde; revisar la cláusula de aumento.',
    ...sourceFields(SRC.aumentoFrecuencia),
    missing: i => missingFields(i, ['adjustmentFrequency']),
    evaluate: i => {
      if (!i.adjustmentFrequency) return 'UNKNOWN'
      return i.adjustmentFrequency === 'NONE' || i.adjustmentFrequency === 'ANNUAL' ? 'OK' : 'TRIGGERED'
    },
  },
  {
    id: `${P}.increase-cap-reminder`,
    jurisdiction: J,
    role: 'ANY',
    kind: 'CONTRACT',
    severity: 'LOW',
    title: 'Revisar que el aumento no supere la inflación del año anterior',
    explanation:
      'Revisar: según la regla cargada para CDMX (Código Civil para el DF, art. 2448-D, párr. 2, reforma de la Gaceta Oficial del 28-ago-2024), el incremento de la renta no puede ser mayor a la inflación reportada por el Banco de México en el año anterior. El texto no define con precisión el año de referencia: confirmar cómo se calcula con un profesional local.',
    ...sourceFields(SRC.aumentoTope),
    evaluate: i => (i.adjustmentIndex === 'FIXED_PERCENT' || i.adjustmentIndex === 'OTHER' ? 'TRIGGERED' : 'OK'),
  },
  {
    id: `${P}.broker-fee-unclear`,
    jurisdiction: J,
    role: 'TENANT',
    kind: 'RISK',
    severity: 'LOW',
    title: 'Comisión de intermediación cargada al inquilino',
    explanation:
      'Dato sensible: se le pide al inquilino una comisión de intermediación. En el capítulo de arrendamiento de vivienda del Código Civil para el DF no se encontró una regla sobre quién la paga ni un tope (es una ausencia de hallazgo: no afirma que ninguna otra norma lo regule). Confirmar por escrito quién la paga, por qué concepto y por cuánto. Requiere validación local.',
    ...sourceFields(SRC.comision),
    missing: i => {
      if (i.hasBroker === false) return []
      return missingFields(i, i.hasBroker === true ? ['brokerFeeAmount'] : ['hasBroker'])
    },
    evaluate: i => {
      if (i.hasBroker === false) return 'OK'
      if (i.hasBroker !== true || !isDeclared(i.brokerFeeAmount)) return 'UNKNOWN'
      return amount(i.brokerFeeAmount) > 0 ? 'TRIGGERED' : 'OK'
    },
  },
]

export const MX_CDMX_PACK: RentalJurisdictionPack = {
  jurisdiction: J,
  country: 'MX',
  label: 'México — Ciudad de México (vivienda)',
  localCurrency: 'MXN',
  commonCurrencies: ['MXN'],
  applicableGuarantees: ['NONE', 'DEPOSITO', 'FIADOR', 'OBLIGADO_SOLIDARIO', 'POLIZA_JURIDICA', 'FIANZA', 'OTRA'],
  adjustmentIndexes: ['NONE', 'INPC', 'FIXED_PERCENT', 'OTHER'],
  guaranteeCopy: {
    DEPOSITO: {
      summary: 'Suma que se entrega al inicio y se devuelve al terminar, según lo que diga el contrato.',
      caveats: [
        'Según la regla cargada para CDMX (Código Civil para el DF, art. 2448-E), el arrendador no puede exigir más de una mensualidad de renta como depósito.',
        'El contrato debe indicar el monto del depósito o los datos del fiador (art. 2448-F fr. IX).',
      ],
    },
    FIADOR: {
      summary: 'Una tercera persona se obliga a responder por las obligaciones del inquilino.',
      caveats: [
        'El contrato de vivienda debe indicar los datos del fiador cuando lo haya (art. 2448-F fr. IX); la fianza se rige por las reglas generales del Código Civil.',
        'Revisar qué cubre la fianza y por cuánto tiempo.',
      ],
    },
    OBLIGADO_SOLIDARIO: {
      summary: 'Una persona se obliga junto con el inquilino por la totalidad de las obligaciones del contrato.',
      caveats: [
        'El capítulo de arrendamiento de vivienda del Código Civil para el DF no menciona esta figura: se pacta por contrato. En general implica responsabilidad directa por el total; revisar los términos antes de aceptar ese rol.',
      ],
    },
    POLIZA_JURIDICA: {
      summary:
        'Servicio privado de una empresa que revisa al inquilino y respalda el contrato; puede asumir ciertos costos de un eventual incumplimiento.',
      caveats: [
        'No figura regulada en el capítulo de arrendamiento de vivienda: es un producto comercial. Su alcance depende del contrato con la empresa; comparar qué cubre, qué excluye y cuánto cuesta.',
        'El costo lo informa la empresa: VARA no estima precios.',
      ],
    },
    FIANZA: {
      summary: 'Garantía emitida por una empresa o institución a favor del propietario.',
      caveats: [
        'Verificar quién la emite, qué monto cubre y si hay contragarantías a cargo del inquilino.',
        'El costo lo informa la empresa: VARA no estima precios.',
      ],
    },
  },
  rules,
  checklist: [
    {
      text: 'Ver la propiedad, firmar el contrato y recibir las llaves antes de pagar depósito o renta (guía de CONDUSEF; no es una norma).',
      priority: 'MUST',
      relatedRuleId: `${P}.pays-before-signing`,
    },
    {
      text: 'Pedir al arrendador el documento que acredite su carácter y facultades: el contrato debe indicar con qué carácter celebra y los datos de ese instrumento (art. 2448-F fr. X).',
      priority: 'MUST',
    },
    {
      text: 'Revisar que el contrato indique el monto del depósito o los datos del fiador (art. 2448-F fr. IX).',
      priority: 'SHOULD',
    },
    {
      text: 'Pedir un recibo por cada mensualidad pagada (art. 2448-E).',
      priority: 'SHOULD',
    },
    {
      text: 'Preguntar si el contrato debe inscribirse en el registro digital de contratos de arrendamiento de la CDMX (art. 2448-F, párrs. 3 y 4; confirmar su vigencia operativa).',
      priority: 'SHOULD',
    },
  ],
  maxConfidence: 'MEDIUM',
  maxConfidenceReason:
    'Las reglas se leyeron en el Código Civil consolidado y la Gaceta Oficial, pero no se confirmó si hubo reformas en 2026 y no tuvieron revisión legal profesional: validar con un profesional local.',
  lastReviewed: REVIEWED,
  disclaimer: `Herramienta orientativa y experimental de VARA: no es asesoría legal ni reemplaza a un profesional. Las reglas de esta jurisdicción se leyeron en fuentes oficiales al ${REVIEWED} y todavía no fueron revisadas por un abogado; pueden cambiar. Antes de firmar, validar con un abogado o notario local.`,
}
