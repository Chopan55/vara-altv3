/**
 * VARA Alquiler Check — tipos del módulo.
 *
 * Módulo experimental y aislado: nada del core de VARA (compra/venta, dashboard,
 * Transaction Room) importa este directorio. Se puede borrar `src/lib/rentals`,
 * `src/components/rentals` y `src/app/alquileres` sin romper el resto.
 *
 * Convención de datos: lo que el usuario no sabe o no cargó es `null`, nunca 0 ni
 * false. Un `null` es un dato faltante; un 0 es un dato declarado.
 */

export type RentalCountry = 'AR' | 'MX'
export type RentalJurisdiction = 'AR_CABA' | 'MX_CDMX'
export type RentalRole = 'TENANT' | 'OWNER'
export type RentalCurrency = 'ARS' | 'USD' | 'MXN'

export type GuaranteeType =
  | 'NONE'
  | 'FIADOR'
  | 'OBLIGADO_SOLIDARIO'
  | 'GARANTE_PROPIETARIO'
  | 'SEGURO_CAUCION'
  | 'POLIZA_JURIDICA'
  | 'FIANZA'
  | 'DEPOSITO'
  | 'OTRA'

export type AdjustmentFrequency = 'NONE' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL' | 'OTHER'
export type AdjustmentIndex = 'NONE' | 'ICL' | 'IPC' | 'INPC' | 'FIXED_PERCENT' | 'OTHER'

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH'
export type RuleConfidence = 'VERIFIED' | 'NEEDS_REVIEW'
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW'

/** Lo que carga el usuario. Importes en la moneda del contrato (`currency`). */
export interface RentalInput {
  country: RentalCountry
  jurisdiction: RentalJurisdiction
  role: RentalRole
  /** Moneda del contrato. Todos los importes se interpretan en esta moneda. */
  currency: RentalCurrency
  /** Moneda en la que el usuario cobra sus ingresos. Solo para alertar descalces. */
  incomeCurrency: RentalCurrency | null

  monthlyRent: number | null
  contractMonths: number | null
  /** Depósito en garantía, en importe. */
  depositAmount: number | null
  /** Meses de alquiler que se pagan por adelantado al entrar (sin contar el depósito). */
  upfrontMonths: number | null
  /** Expensas ordinarias / mantenimiento mensual a cargo del inquilino. */
  maintenanceOrExpenses: number | null
  /** ¿Se le cargan expensas extraordinarias al inquilino? */
  extraordinaryExpensesToTenant: boolean | null
  /** Si se cargan, ¿el contrato dice claramente cuáles y cómo? */
  extraordinaryExpensesClear: boolean | null

  guaranteeType: GuaranteeType
  /** Costo declarado de la garantía (prima de caución, costo de póliza, etc.). */
  guaranteeCost: number | null

  hasBroker: boolean | null
  /** Importe que se le pide pagar al inquilino por intermediación (no el que paga el propietario). */
  brokerFeeAmount: number | null
  /** Informes, certificación de firmas, gestoría, etc. */
  reportsAndCertificationCost: number | null
  movingCost: number | null

  hasContract: boolean | null
  hasPropertyDescription: boolean | null
  hasDepositReturnClause: boolean | null
  adjustmentFrequency: AdjustmentFrequency | null
  adjustmentIndex: AdjustmentIndex | null
  isFurnished: boolean | null
  /** ¿Piden pagar (depósito, renta, reserva) antes de ver, firmar o recibir llaves? */
  paysBeforeSigning: boolean | null
  hasHandoverInventory: boolean | null
  notes: string
}

export interface CostItem {
  id: string
  label: string
  amount: number
  currency: RentalCurrency
  /** false = el usuario no cargó el dato; el importe es 0 y está en `missingData`. */
  declared: boolean
  note?: string
}

export interface SourceRef {
  label: string
  url: string
  confidence: RuleConfidence
}

/**
 * Una regla de una jurisdicción. Es dato + un predicado puro: la UI nunca contiene
 * lógica legal. `evaluate` devuelve:
 *  - TRIGGERED: la regla aplica con los datos declarados;
 *  - OK: no aplica o está cumplida;
 *  - UNKNOWN: falta un dato para saberlo (se informa como dato faltante).
 */
export type RuleOutcome = 'TRIGGERED' | 'OK' | 'UNKNOWN'

export interface RentalRule {
  id: string
  jurisdiction: RentalJurisdiction
  /** TENANT / OWNER = solo ese rol; ANY = ambos. */
  role: RentalRole | 'ANY'
  /** RISK va a `riskFlags`; CONTRACT va a `contractAlerts`. */
  kind: 'RISK' | 'CONTRACT'
  severity: Severity
  title: string
  explanation: string
  sourceLabel: string
  sourceUrl: string
  confidence: RuleConfidence
  /** Campos que faltan para poder evaluar esta regla con certeza (null = el usuario no lo cargó). */
  missing?: (input: RentalInput) => (keyof RentalInput)[]
  evaluate: (input: RentalInput) => RuleOutcome
}

export interface RuleFinding {
  ruleId: string
  jurisdiction: RentalJurisdiction
  severity: Severity
  title: string
  explanation: string
  source: SourceRef
}

export interface GuaranteeNote {
  type: GuaranteeType
  label: string
  /** Hechos generales y prudentes; nunca precios de mercado inventados. */
  summary: string
  caveats: string[]
  /** true si es la garantía que el usuario declaró. */
  selected: boolean
  /** Costo que el usuario declaró para esta garantía, si es la seleccionada. */
  declaredCost: number | null
}

export interface MissingDatum {
  field: keyof RentalInput
  label: string
  why: string
}

export interface ChecklistItem {
  id: string
  text: string
  /** Si viene de una regla o un dato faltante, para poder rastrearlo. */
  relatedRuleId?: string
  priority: 'MUST' | 'SHOULD'
}

export interface RentalCheckResult {
  currency: RentalCurrency
  entryCostItems: CostItem[]
  entryTotal: number
  monthlyCostItems: CostItem[]
  monthlyTotal: number
  riskFlags: RuleFinding[]
  contractAlerts: RuleFinding[]
  guaranteeNotes: GuaranteeNote[]
  missingData: MissingDatum[]
  signingChecklist: ChecklistItem[]
  confidenceLevel: ConfidenceLevel
  confidenceReasons: string[]
  sources: SourceRef[]
  /** Texto fijo: herramienta orientativa, no asesoría legal. */
  disclaimer: string
}

/** Lo que define una jurisdicción: sus reglas, sus garantías y su checklist. */
export interface RentalJurisdictionPack {
  jurisdiction: RentalJurisdiction
  country: RentalCountry
  label: string
  localCurrency: RentalCurrency
  /** Monedas razonables para este mercado (el resto dispara revisión, no error). */
  commonCurrencies: RentalCurrency[]
  applicableGuarantees: GuaranteeType[]
  /** Textos propios de la jurisdicción para cada garantía; lo que falte usa el texto general. */
  guaranteeCopy: Partial<Record<GuaranteeType, { summary: string; caveats: string[] }>>
  adjustmentIndexes: AdjustmentIndex[]
  rules: RentalRule[]
  /** Pasos extra del checklist propios de la jurisdicción. */
  checklist: Omit<ChecklistItem, 'id'>[]
  /** Techo de confianza del resultado. Subirlo a HIGH solo después de revisión legal profesional. */
  maxConfidence: ConfidenceLevel
  maxConfidenceReason: string
  /** Fecha (YYYY-MM-DD) en que las reglas se leyeron por última vez en las fuentes. */
  lastReviewed: string
  disclaimer: string
}
