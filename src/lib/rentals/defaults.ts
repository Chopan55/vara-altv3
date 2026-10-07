import type {
  AdjustmentFrequency,
  AdjustmentIndex,
  GuaranteeType,
  RentalCountry,
  RentalCurrency,
  RentalInput,
  RentalJurisdiction,
  RentalRole,
} from './types'
import { JURISDICTION_COUNTRY } from './normalize'
import { ADJUSTMENT_FREQUENCY_LABELS, ADJUSTMENT_INDEX_LABELS, GUARANTEE_LABELS } from './labels'

const DEFAULT_JURISDICTION: Record<RentalCountry, RentalJurisdiction> = { AR: 'AR_CABA', MX: 'MX_CDMX' }
const LOCAL_CURRENCY: Record<RentalCountry, RentalCurrency> = { AR: 'ARS', MX: 'MXN' }

const COUNTRIES: RentalCountry[] = ['AR', 'MX']
const JURISDICTIONS = Object.keys(JURISDICTION_COUNTRY) as RentalJurisdiction[]
const ROLES: RentalRole[] = ['TENANT', 'OWNER']
const CURRENCIES: RentalCurrency[] = ['ARS', 'USD', 'MXN']
const GUARANTEES = Object.keys(GUARANTEE_LABELS) as GuaranteeType[]
const FREQUENCIES = Object.keys(ADJUSTMENT_FREQUENCY_LABELS) as AdjustmentFrequency[]
const INDEXES = Object.keys(ADJUSTMENT_INDEX_LABELS) as AdjustmentIndex[]

const NUMBER_FIELDS = [
  'monthlyRent',
  'contractMonths',
  'depositAmount',
  'upfrontMonths',
  'maintenanceOrExpenses',
  'guaranteeCost',
  'brokerFeeAmount',
  'reportsAndCertificationCost',
  'movingCost',
] as const

const BOOLEAN_FIELDS = [
  'extraordinaryExpensesToTenant',
  'extraordinaryExpensesClear',
  'hasBroker',
  'hasContract',
  'hasPropertyDescription',
  'hasDepositReturnClause',
  'isFurnished',
  'paysBeforeSigning',
  'hasHandoverInventory',
] as const

const NOTES_MAX = 500

/** Formulario vacío: ningún dato declarado. */
export function emptyRentalInput(country: RentalCountry = 'AR'): RentalInput {
  return {
    country,
    jurisdiction: DEFAULT_JURISDICTION[country],
    role: 'TENANT',
    currency: LOCAL_CURRENCY[country],
    incomeCurrency: null,
    monthlyRent: null,
    contractMonths: null,
    depositAmount: null,
    upfrontMonths: null,
    maintenanceOrExpenses: null,
    extraordinaryExpensesToTenant: null,
    extraordinaryExpensesClear: null,
    guaranteeType: 'NONE',
    guaranteeCost: null,
    hasBroker: null,
    brokerFeeAmount: null,
    reportsAndCertificationCost: null,
    movingCost: null,
    hasContract: null,
    hasPropertyDescription: null,
    hasDepositReturnClause: null,
    adjustmentFrequency: null,
    adjustmentIndex: null,
    isFurnished: null,
    paysBeforeSigning: null,
    hasHandoverInventory: null,
    notes: '',
  }
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : null
}

/**
 * Deja la entrada en una forma segura: lo que no es un número finito y no negativo
 * pasa a null (dato no declarado), los valores fuera de las listas vuelven al
 * default y las notas se acortan. Así el resto del módulo no se rompe con vacíos,
 * NaN, strings o negativos.
 */
export function sanitizeInput(raw: Partial<RentalInput> | null | undefined): RentalInput {
  const src = (raw ?? {}) as Record<string, unknown>
  const country = oneOf(src.country, COUNTRIES) ?? 'AR'
  const out = emptyRentalInput(country)

  out.jurisdiction = oneOf(src.jurisdiction, JURISDICTIONS) ?? out.jurisdiction
  out.role = oneOf(src.role, ROLES) ?? out.role
  out.currency = oneOf(src.currency, CURRENCIES) ?? out.currency
  out.incomeCurrency = oneOf(src.incomeCurrency, CURRENCIES)
  out.guaranteeType = oneOf(src.guaranteeType, GUARANTEES) ?? 'NONE'
  out.adjustmentFrequency = oneOf(src.adjustmentFrequency, FREQUENCIES)
  out.adjustmentIndex = oneOf(src.adjustmentIndex, INDEXES)

  for (const f of NUMBER_FIELDS) {
    const v = src[f]
    out[f] = typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null
  }
  for (const f of BOOLEAN_FIELDS) {
    const v = src[f]
    out[f] = typeof v === 'boolean' ? v : null
  }
  out.notes = typeof src.notes === 'string' ? src.notes.slice(0, NOTES_MAX) : ''

  return out
}
