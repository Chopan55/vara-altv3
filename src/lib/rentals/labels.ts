import type { AdjustmentFrequency, AdjustmentIndex, GuaranteeType, RentalInput } from './types'

export const GUARANTEE_LABELS: Record<GuaranteeType, string> = {
  NONE: 'Sin garantía declarada',
  FIADOR: 'Fiador',
  OBLIGADO_SOLIDARIO: 'Obligado solidario / aval',
  GARANTE_PROPIETARIO: 'Garantía propietaria',
  SEGURO_CAUCION: 'Seguro de caución',
  POLIZA_JURIDICA: 'Póliza jurídica',
  FIANZA: 'Fianza (empresa o institución)',
  DEPOSITO: 'Depósito en garantía',
  OTRA: 'Otra garantía',
}

export const ADJUSTMENT_FREQUENCY_LABELS: Record<AdjustmentFrequency, string> = {
  NONE: 'Sin ajuste',
  MONTHLY: 'Mensual',
  QUARTERLY: 'Trimestral',
  SEMIANNUAL: 'Semestral',
  ANNUAL: 'Anual',
  OTHER: 'Otra',
}

export const ADJUSTMENT_INDEX_LABELS: Record<AdjustmentIndex, string> = {
  NONE: 'Sin índice',
  ICL: 'ICL (índice para contratos de locación, BCRA)',
  IPC: 'IPC (inflación)',
  INPC: 'INPC (inflación)',
  FIXED_PERCENT: 'Porcentaje fijo pactado',
  OTHER: 'Otro índice',
}

/** Cómo se nombra cada dato en la lista de "datos que faltan". El orden es el de la lista. */
export const FIELD_INFO: Partial<Record<keyof RentalInput, { label: string; why: string }>> = {
  monthlyRent: {
    label: 'Monto del alquiler mensual',
    why: 'Sin este dato no se puede calcular el costo mensual ni contrastar el depósito.',
  },
  contractMonths: {
    label: 'Duración del contrato (meses)',
    why: 'Define cuánto dura el compromiso y cuándo corresponde ajustar.',
  },
  depositAmount: {
    label: 'Depósito en garantía',
    why: 'Es uno de los principales costos de entrada.',
  },
  upfrontMonths: {
    label: 'Meses de alquiler por adelantado',
    why: 'Se suman al costo de entrada.',
  },
  maintenanceOrExpenses: {
    label: 'Expensas o mantenimiento mensual',
    why: 'Forma parte del costo mensual real.',
  },
  hasBroker: {
    label: 'Si interviene una inmobiliaria o corredor',
    why: 'Puede sumar una comisión al costo de entrada.',
  },
  brokerFeeAmount: {
    label: 'Importe pedido al inquilino por intermediación',
    why: 'Hay que saber cuánto se cobra y a quién.',
  },
  guaranteeCost: {
    label: 'Costo de la garantía',
    why: 'La prima o el costo de la garantía elegida suma al costo de entrada.',
  },
  incomeCurrency: {
    label: 'Moneda de los ingresos',
    why: 'Sirve para detectar un descalce entre ingresos y moneda del contrato.',
  },
  hasContract: {
    label: 'Si hay contrato escrito',
    why: 'Sin contrato es difícil probar condiciones, plazos y devolución del depósito.',
  },
  hasPropertyDescription: {
    label: 'Si el contrato describe el inmueble, su estado y accesorios',
    why: 'Ayuda a probar en qué estado se recibe el inmueble.',
  },
  hasDepositReturnClause: {
    label: 'Si el contrato define cómo se devuelve el depósito',
    why: 'Evita disputas al terminar el alquiler.',
  },
  adjustmentFrequency: {
    label: 'Frecuencia de ajuste',
    why: 'Define cada cuánto cambia el alquiler.',
  },
  adjustmentIndex: {
    label: 'Índice de ajuste',
    why: 'Define con qué referencia cambia el alquiler.',
  },
  extraordinaryExpensesToTenant: {
    label: 'Si se cargan expensas extraordinarias al inquilino',
    why: 'Pueden sumar gastos que no están en el costo mensual.',
  },
  extraordinaryExpensesClear: {
    label: 'Si el contrato aclara cuáles expensas extraordinarias se cargan',
    why: 'Sin aclarar, el gasto puede ser imprevisible.',
  },
  paysBeforeSigning: {
    label: 'Si piden pagar antes de ver, firmar o recibir las llaves',
    why: 'Pagar antes de verificar es una señal de riesgo.',
  },
  hasHandoverInventory: {
    label: 'Si habrá inventario o acta de entrega',
    why: 'Documenta el estado del inmueble al entrar.',
  },
}
