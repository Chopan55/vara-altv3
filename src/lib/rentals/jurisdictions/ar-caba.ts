import type { RentalJurisdictionPack, RentalRule } from '../types'
import { amount, isDeclared } from '../normalize'
import {
  missingFields,
  noContractRule,
  noDepositReturnClauseRule,
  noInventoryRule,
  rulePrefix,
  sourceFields,
  type RuleSource,
} from '../contractChecks'

/**
 * Argentina — Ciudad Autónoma de Buenos Aires, alquiler habitacional.
 *
 * Reglas cargadas a partir de una lectura de fuentes oficiales (Infoleg, Boletín
 * Oficial, Digesto de la Ciudad, guía del IVC) al 2026-10-06. No hubo revisión legal
 * profesional. Tras el DNU 70/2023 muchas condiciones son pactables: por eso las
 * alertas son orientativas y el techo de confianza es MEDIUM.
 */

const J = 'AR_CABA' as const
const P = rulePrefix(J)
const REVIEWED = '2026-10-06'

const DNU_URL = 'https://www.argentina.gob.ar/normativa/nacional/decreto-70-2023-395521/texto'
const CCYC_URL = 'https://servicios.infoleg.gob.ar/infolegInternet/anexos/235000-239999/235975/texact.htm'
const IVC_URL = 'https://vivienda.buenosaires.gob.ar/dnu-70-2023'

const SRC = {
  ley2340: {
    label: 'Ley 2340 (CABA), art. 13 inc. 7 — Digesto de la Ciudad',
    url: 'https://digesto.buenosaires.gob.ar/documento/download/Ley%20Ciudad-2340__c8e248b5bd8ff8c365caea58522135f792eaf8b5.pdf',
    confidence: 'VERIFIED',
  },
  dnu: {
    label: 'Decreto 70/2023, arts. 249 a 263 (deroga la Ley 27.551 y sustituye artículos del CCyC)',
    url: DNU_URL,
    confidence: 'VERIFIED',
  },
  moneda: {
    label: 'CCyC arts. 765, 766 y 1199 según DNU 70/2023 (moneda del alquiler)',
    url: DNU_URL,
    confidence: 'VERIFIED',
  },
  ajuste: {
    label: 'CCyC art. 1199 según DNU 70/2023, art. 257 (ajuste con el índice que pacten las partes)',
    url: DNU_URL,
    confidence: 'VERIFIED',
  },
  deposito: {
    label: 'CCyC art. 1196 según DNU 70/2023, art. 255 (depósito y forma de devolución)',
    url: DNU_URL,
    confidence: 'VERIFIED',
  },
  anticipos: {
    label: 'CCyC art. 1196 según DNU 70/2023, art. 255 (anticipos y valor llave: sin regla expresa hoy)',
    url: DNU_URL,
    confidence: 'NEEDS_REVIEW',
  },
  contrato: {
    label: 'Código Civil y Comercial, art. 1188 (la locación de inmueble consta por escrito) — Infoleg',
    url: CCYC_URL,
    confidence: 'VERIFIED',
  },
  inventario: {
    label: 'CCyC arts. 1200 y 1210 y guía oficial del IVC (inventario: recomendación, no requisito legal expreso)',
    url: CCYC_URL,
    confidence: 'VERIFIED',
  },
  expensas: {
    label: 'CCyC art. 1209 y guía del IVC (expensas extraordinarias: texto aún en discusión tras el DNU)',
    url: IVC_URL,
    confidence: 'NEEDS_REVIEW',
  },
} satisfies Record<string, RuleSource>

const rules: RentalRule[] = [
  {
    id: `${P}.broker-fee-tenant`,
    jurisdiction: J,
    role: 'ANY',
    kind: 'RISK',
    severity: 'HIGH',
    title: 'Comisión inmobiliaria cargada al inquilino',
    explanation:
      'Alerta: según la regla cargada para CABA (Ley 2340, art. 13 inc. 7), en alquileres de vivienda con inquilino persona física el corredor inmobiliario no debería cobrar comisión, honorarios de intermediación ni de administración al inquilino. Potencialmente no corresponde. Revisar quién contrató al corredor y pedir el detalle del cobro por escrito. Requiere validación local.',
    ...sourceFields(SRC.ley2340),
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
  {
    id: `${P}.dnu-pactable`,
    jurisdiction: J,
    role: 'ANY',
    kind: 'CONTRACT',
    severity: 'LOW',
    title: 'Muchas condiciones dependen de lo pactado en el contrato',
    explanation:
      'Dato sensible: desde el DNU 70/2023 (que derogó la Ley 27.551) muchas condiciones del alquiler (plazo, moneda, ajuste, depósito, garantías) dependen de lo que pacten las partes. Si el contrato es anterior a fines de 2023 pueden regir otras reglas. Según las fuentes consultadas, el estado del decreto en el Congreso sigue abierto. Requiere validación local.',
    ...sourceFields(SRC.dnu),
    evaluate: () => 'TRIGGERED',
  },
  {
    id: `${P}.usd-income-mismatch`,
    jurisdiction: J,
    role: 'TENANT',
    kind: 'RISK',
    severity: 'MEDIUM',
    title: 'Contrato en dólares con ingresos en otra moneda o sin declarar',
    explanation:
      'Alerta: el contrato está en dólares y los ingresos declarados están en pesos (o no se declaró la moneda de ingresos). Según el Código Civil y Comercial vigente (DNU 70/2023), la moneda pactada es la que se debe entregar para cumplir. Revisar el riesgo de descalce cambiario antes de firmar.',
    ...sourceFields(SRC.moneda),
    missing: i => (i.currency === 'USD' ? missingFields(i, ['incomeCurrency']) : []),
    evaluate: i => (i.currency !== 'USD' || i.incomeCurrency === 'USD' ? 'OK' : 'TRIGGERED'),
  },
  {
    id: `${P}.no-adjustment`,
    jurisdiction: J,
    role: 'ANY',
    kind: 'CONTRACT',
    severity: 'MEDIUM',
    title: 'Ajuste del alquiler sin índice o frecuencia definidos',
    explanation:
      'Revisar: no se declaró un índice o una frecuencia de ajuste. Según el Código Civil y Comercial vigente (art. 1199, DNU 70/2023) las partes pueden pactar el índice que quieran; si el contrato no lo define con claridad pueden surgir diferencias sobre cuánto sube el alquiler y cuándo. Conviene dejarlo por escrito.',
    ...sourceFields(SRC.ajuste),
    missing: i => missingFields(i, ['adjustmentFrequency', 'adjustmentIndex']),
    evaluate: i => {
      const noIndex = !i.adjustmentIndex || i.adjustmentIndex === 'NONE'
      const noFrequency = !i.adjustmentFrequency || i.adjustmentFrequency === 'NONE'
      return noIndex || noFrequency ? 'TRIGGERED' : 'OK'
    },
  },
  {
    id: `${P}.extraordinary-expenses`,
    jurisdiction: J,
    role: 'ANY',
    kind: 'CONTRACT',
    severity: 'MEDIUM',
    title: 'Expensas extraordinarias al inquilino sin una cláusula clara',
    explanation:
      'Revisar: se cargan expensas extraordinarias al inquilino sin una cláusula clara. Quién las soporta en un alquiler habitacional nuevo no está claro en las fuentes consultadas (la Ley 27.551 lo regulaba y fue derogada por el DNU 70/2023). Dejar por escrito qué conceptos y qué montos corresponden. Requiere validación local.',
    ...sourceFields(SRC.expensas),
    missing: i => {
      if (i.extraordinaryExpensesToTenant === null) return ['extraordinaryExpensesToTenant']
      return i.extraordinaryExpensesToTenant ? missingFields(i, ['extraordinaryExpensesClear']) : []
    },
    evaluate: i => {
      if (i.extraordinaryExpensesToTenant === false) return 'OK'
      if (i.extraordinaryExpensesToTenant !== true) return 'UNKNOWN'
      if (i.extraordinaryExpensesClear === false) return 'TRIGGERED'
      return i.extraordinaryExpensesClear === true ? 'OK' : 'UNKNOWN'
    },
  },
  {
    id: `${P}.upfront-months`,
    jurisdiction: J,
    role: 'TENANT',
    kind: 'RISK',
    severity: 'MEDIUM',
    title: 'Más de un mes de alquiler por adelantado',
    explanation:
      'Dato sensible: se piden más de un mes de alquiler adelantado. La regla anterior (Ley 27.551) lo limitaba, pero fue derogada; en las fuentes consultadas no hay hoy una norma expresa que lo limite. Revisar que esté justificado y documentado por escrito. Requiere validación local.',
    ...sourceFields(SRC.anticipos),
    missing: i => missingFields(i, ['upfrontMonths']),
    evaluate: i => {
      if (!isDeclared(i.upfrontMonths)) return 'UNKNOWN'
      return (i.upfrontMonths as number) > 1 ? 'TRIGGERED' : 'OK'
    },
  },
  noContractRule(J, {
    title: 'Alquiler sin contrato escrito',
    explanation:
      'Alerta: no hay contrato escrito. Según el Código Civil y Comercial (art. 1188) el contrato de locación de inmueble debe constar por escrito. Sin contrato es difícil probar condiciones, plazos y devolución del depósito. Revisar antes de pagar.',
    source: SRC.contrato,
  }),
  noInventoryRule(J, {
    title: 'Sin inventario ni acta de entrega',
    explanation:
      'Revisar: no hay inventario ni acta de entrega del inmueble. El Código Civil y Comercial (art. 1210) prevé que el inquilino devuelva la cosa en el estado en que la recibió, pero no exige un inventario: es una buena práctica que recomienda la guía oficial del IVC. Sin un registro del estado inicial es difícil probarlo al salir.',
    source: SRC.inventario,
  }),
  noDepositReturnClauseRule(J, {
    title: 'Depósito sin cláusula clara de devolución',
    explanation:
      'Revisar: hay depósito pero el contrato no tiene una cláusula clara de devolución. Según el Código Civil y Comercial vigente (art. 1196, DNU 70/2023) las partes definen monto, moneda y forma de devolución; si no está escrito pueden surgir disputas. Dejar por escrito monto, moneda, plazo y forma de devolución.',
    source: SRC.deposito,
  }),
]

export const AR_CABA_PACK: RentalJurisdictionPack = {
  jurisdiction: J,
  country: 'AR',
  label: 'Argentina — Ciudad Autónoma de Buenos Aires (vivienda)',
  localCurrency: 'ARS',
  commonCurrencies: ['ARS', 'USD'],
  applicableGuarantees: ['NONE', 'DEPOSITO', 'FIADOR', 'GARANTE_PROPIETARIO', 'SEGURO_CAUCION', 'OTRA'],
  adjustmentIndexes: ['NONE', 'ICL', 'IPC', 'FIXED_PERCENT', 'OTHER'],
  guaranteeCopy: {
    NONE: {
      summary: 'No se declaró una garantía. Conviene confirmar, antes de firmar, si el propietario la va a exigir y de qué tipo.',
      caveats: [
        'Tras el DNU 70/2023 la ley no fija una lista cerrada de garantías ni un tope; se define por contrato (según la norma consultada, a validar localmente).',
      ],
    },
    DEPOSITO: {
      summary: 'Suma que se entrega al inicio y se devuelve al terminar, según lo que diga el contrato.',
      caveats: [
        'Según el Código Civil y Comercial vigente (art. 1196, DNU 70/2023) las partes definen monto, moneda y forma de devolución: dejarlo por escrito.',
        'En las fuentes consultadas no hay hoy un tope legal expreso; la regla anterior (Ley 27.551) fue derogada.',
      ],
    },
    FIADOR: {
      summary: 'Una tercera persona se obliga a responder por las obligaciones del inquilino.',
      caveats: [
        'Según el texto consultado del art. 1225 del Código Civil y Comercial, las obligaciones del fiador cesan al vencer el plazo de la locación, salvo su consentimiento expreso para renovar o prorrogar.',
        'Revisar qué cubre la fianza (alquiler, expensas, daños).',
      ],
    },
    SEGURO_CAUCION: {
      summary:
        'Una aseguradora emite una póliza a favor del propietario por incumplimientos del inquilino; el inquilino suele pagar una prima.',
      caveats: [
        'Pedir las condiciones generales de la póliza: qué cubre, vigencia y si la aseguradora puede reclamar luego al inquilino.',
        'El costo (prima) lo informa la aseguradora: VARA no estima primas.',
        'No se revisó la normativa de la Superintendencia de Seguros sobre estos seguros.',
      ],
    },
    GARANTE_PROPIETARIO: {
      summary: 'Un tercero propietario de un inmueble respalda el alquiler.',
      caveats: [
        'Según la guía oficial del IVC, cuando hay una garantía personal de un tercero entre los gastos iniciales figura el arancel de los informes del Registro de la Propiedad Inmueble.',
        'Confirmar qué informes se piden y quién los paga.',
      ],
    },
  },
  rules,
  checklist: [
    {
      text: 'Confirmar la fecha de celebración del contrato: los contratos anteriores al DNU 70/2023 pueden regirse por otro régimen.',
      priority: 'MUST',
      relatedRuleId: `${P}.dnu-pactable`,
    },
    {
      text: 'Pedir por escrito qué conceptos se cobran al entrar y quién cobra cada uno (alquiler, depósito, comisión, informes, certificación de firmas).',
      priority: 'MUST',
    },
    {
      text: 'Dejar por escrito la moneda, el índice y la frecuencia de ajuste, y cómo se calcula el primer aumento.',
      priority: 'SHOULD',
      relatedRuleId: `${P}.no-adjustment`,
    },
    {
      text: 'Aclarar por escrito quién paga las expensas extraordinarias y cuáles se consideran.',
      priority: 'SHOULD',
      relatedRuleId: `${P}.extraordinary-expenses`,
    },
    {
      text: 'Consultar si el IVC ofrece certificación de firmas gratuita para este caso (programa con condiciones que pueden cambiar).',
      priority: 'SHOULD',
    },
  ],
  maxConfidence: 'MEDIUM',
  maxConfidenceReason:
    'En Argentina muchas condiciones son pactables tras el DNU 70/2023, el estado del decreto en el Congreso sigue abierto y las reglas no tuvieron revisión legal profesional: validar con un profesional local.',
  lastReviewed: REVIEWED,
  disclaimer: `Herramienta orientativa y experimental de VARA: no es asesoría legal ni reemplaza a un profesional. Las reglas de esta jurisdicción se leyeron en fuentes oficiales al ${REVIEWED} y todavía no fueron revisadas por un abogado; pueden cambiar. Antes de firmar, validar con un abogado o escribano local.`,
}
