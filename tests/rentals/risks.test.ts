/**
 * VARA Alquiler Check — reglas de riesgo por jurisdicción.
 *
 * Lo que se protege acá, en este orden:
 *  1. Que una alerta aparezca solo cuando el dato declarado la justifica, y que
 *     desaparezca cuando deja de ser cierto. Una alerta que no se apaga entrena
 *     a ignorar todas las demás.
 *  2. Que las reglas de un país JAMÁS se apliquen a otro: decirle a un inquilino
 *     de CDMX que la ley argentina lo protege (o viceversa) es peor que callar.
 *  3. Que sin base jurídica no se afirme más de lo que se sabe: la confianza
 *     tiene techo, y el lenguaje tajante ("es ilegal") solo vale con fuente
 *     verificada.
 *
 * Las reglas compartidas (sin contrato, sin inventario, cláusula de devolución
 * del depósito) y el checklist están en contractChecks.test.ts.
 */

import { describe, it, expect } from 'vitest'
import {
  runRentalCheck, emptyRentalInput, getPack, RENTAL_JURISDICTIONS,
  type RentalInput, type RentalCheckResult, type RuleFinding,
  type RentalJurisdiction, type Severity,
} from '@/lib/rentals'

// ── Helpers ────────────────────────────────────────────────────────────────

const AR = (over: Partial<RentalInput> = {}): RentalInput => ({ ...emptyRentalInput('AR'), ...over })
const MX = (over: Partial<RentalInput> = {}): RentalInput => ({ ...emptyRentalInput('MX'), ...over })

type ListName = 'riskFlags' | 'contractAlerts'

const allFindings = (r: RentalCheckResult): RuleFinding[] => [...r.riskFlags, ...r.contractAlerts]
const idsOf = (r: RentalCheckResult): string[] => allFindings(r).map(f => f.ruleId)
const find = (r: RentalCheckResult, list: ListName, id: string): RuleFinding | undefined =>
  r[list].find(f => f.ruleId === id)

const SEVERITY_RANK: Record<Severity, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }

/** Inputs sin ningún dato faltante y sin ninguna alerta disparada. */
const FULL_AR: RentalInput = {
  country: 'AR', jurisdiction: 'AR_CABA', role: 'TENANT', currency: 'ARS', incomeCurrency: 'ARS',
  monthlyRent: 500_000, contractMonths: 36, depositAmount: 500_000, upfrontMonths: 1,
  maintenanceOrExpenses: 90_000,
  extraordinaryExpensesToTenant: false, extraordinaryExpensesClear: true,
  guaranteeType: 'SEGURO_CAUCION', guaranteeCost: 150_000,
  hasBroker: false, brokerFeeAmount: 0,
  reportsAndCertificationCost: 20_000, movingCost: 80_000,
  hasContract: true, hasPropertyDescription: true, hasDepositReturnClause: true,
  adjustmentFrequency: 'ANNUAL', adjustmentIndex: 'ICL',
  isFurnished: false, paysBeforeSigning: false, hasHandoverInventory: true,
  notes: '',
}

const FULL_MX: RentalInput = {
  country: 'MX', jurisdiction: 'MX_CDMX', role: 'TENANT', currency: 'MXN', incomeCurrency: 'MXN',
  monthlyRent: 18_000, contractMonths: 12, depositAmount: 18_000, upfrontMonths: 1,
  maintenanceOrExpenses: 1_500,
  extraordinaryExpensesToTenant: false, extraordinaryExpensesClear: true,
  guaranteeType: 'POLIZA_JURIDICA', guaranteeCost: 9_000,
  hasBroker: false, brokerFeeAmount: 0,
  reportsAndCertificationCost: 1_000, movingCost: 3_000,
  hasContract: true, hasPropertyDescription: true, hasDepositReturnClause: true,
  adjustmentFrequency: 'ANNUAL', adjustmentIndex: 'INPC',
  isFurnished: false, paysBeforeSigning: false, hasHandoverInventory: true,
  notes: '',
}

/** Todo lo que puede salir mal, a la vez. */
const AR_STRESS: RentalInput = {
  ...emptyRentalInput('AR'),
  role: 'TENANT', currency: 'USD', incomeCurrency: 'ARS',
  monthlyRent: 500_000, depositAmount: 500_000, upfrontMonths: 3,
  hasBroker: true, brokerFeeAmount: 100_000,
  extraordinaryExpensesToTenant: true, extraordinaryExpensesClear: false,
  hasContract: false, hasHandoverInventory: false, hasDepositReturnClause: false,
  adjustmentFrequency: 'NONE', adjustmentIndex: 'NONE',
  paysBeforeSigning: true,
}

const MX_STRESS: RentalInput = {
  ...emptyRentalInput('MX'),
  role: 'TENANT', currency: 'USD',
  monthlyRent: 18_000, depositAmount: 54_000, upfrontMonths: 3,
  hasBroker: true, brokerFeeAmount: 18_000,
  hasContract: false, hasPropertyDescription: false,
  paysBeforeSigning: true, hasHandoverInventory: false,
  adjustmentFrequency: 'MONTHLY', adjustmentIndex: 'FIXED_PERCENT',
}

// ── Tabla de comportamiento de reglas ───────────────────────────────────────

interface Case { name: string; input: Partial<RentalInput> }

interface RuleSpec {
  id: string
  jurisdiction: RentalJurisdiction
  list: ListName
  severity: Severity
  /** Confianza de la fuente, si el spec la fija. */
  confidence?: 'VERIFIED' | 'NEEDS_REVIEW'
  /** Solo se muestra al inquilino. */
  tenantOnly?: boolean
  /** Inputs que la disparan. */
  triggers: Case[]
  /** Inputs que NO la disparan. */
  quiet: Case[]
}

function describeRule(spec: RuleSpec) {
  const base = spec.jurisdiction === 'AR_CABA' ? AR : MX
  const otherList: ListName = spec.list === 'riskFlags' ? 'contractAlerts' : 'riskFlags'

  describe(spec.id, () => {
    it(`va a ${spec.list} con severidad ${spec.severity}`, () => {
      const r = runRentalCheck(base({ role: 'TENANT', ...spec.triggers[0].input }))
      const f = find(r, spec.list, spec.id)
      expect(f).toBeDefined()
      expect(f!.severity).toBe(spec.severity)
      expect(f!.jurisdiction).toBe(spec.jurisdiction)
      // Nunca aparece en la otra lista.
      expect(find(r, otherList, spec.id)).toBeUndefined()
    })

    if (spec.confidence) {
      it(`su fuente es ${spec.confidence}`, () => {
        const r = runRentalCheck(base({ role: 'TENANT', ...spec.triggers[0].input }))
        expect(find(r, spec.list, spec.id)!.source.confidence).toBe(spec.confidence)
      })
    }

    it.each(spec.triggers)('se dispara: $name', ({ input }) => {
      const r = runRentalCheck(base({ role: 'TENANT', ...input }))
      expect(find(r, spec.list, spec.id)).toBeDefined()
    })

    it.each(spec.quiet)('NO se dispara: $name', ({ input }) => {
      const r = runRentalCheck(base({ role: 'TENANT', ...input }))
      expect(idsOf(r)).not.toContain(spec.id)
    })

    if (spec.tenantOnly) {
      it('no se muestra al propietario (rol OWNER)', () => {
        const r = runRentalCheck(base({ ...spec.triggers[0].input, role: 'OWNER' }))
        expect(idsOf(r)).not.toContain(spec.id)
      })
    }
  })
}

// ── AR_CABA ────────────────────────────────────────────────────────────────

describe('AR_CABA — reglas', () => {
  describeRule({
    id: 'ar-caba.broker-fee-tenant', jurisdiction: 'AR_CABA', list: 'riskFlags',
    severity: 'HIGH', confidence: 'VERIFIED',
    triggers: [
      { name: 'inmobiliaria con comisión al inquilino', input: { hasBroker: true, brokerFeeAmount: 100_000 } },
      { name: 'comisión mínima (1)', input: { hasBroker: true, brokerFeeAmount: 1 } },
    ],
    quiet: [
      { name: 'sin inmobiliaria', input: { hasBroker: false, brokerFeeAmount: null } },
      { name: 'sin inmobiliaria aunque haya un importe cargado', input: { hasBroker: false, brokerFeeAmount: 100_000 } },
      { name: 'inmobiliaria con comisión 0', input: { hasBroker: true, brokerFeeAmount: 0 } },
      { name: 'inmobiliaria sin importe cargado', input: { hasBroker: true, brokerFeeAmount: null } },
      { name: 'dato de inmobiliaria sin declarar', input: { hasBroker: null, brokerFeeAmount: null } },
    ],
  })

  describeRule({
    id: 'ar-caba.dnu-pactable', jurisdiction: 'AR_CABA', list: 'contractAlerts',
    severity: 'LOW',
    triggers: [
      { name: 'con input vacío (siempre presente)', input: {} },
      { name: 'con input completo (siempre presente)', input: FULL_AR },
    ],
    quiet: [],
  })

  describeRule({
    id: 'ar-caba.usd-income-mismatch', jurisdiction: 'AR_CABA', list: 'riskFlags',
    severity: 'MEDIUM', tenantOnly: true,
    triggers: [
      { name: 'contrato en USD, ingresos en ARS', input: { currency: 'USD', incomeCurrency: 'ARS' } },
      { name: 'contrato en USD, ingresos sin declarar', input: { currency: 'USD', incomeCurrency: null } },
    ],
    quiet: [
      { name: 'contrato en ARS, ingresos en ARS', input: { currency: 'ARS', incomeCurrency: 'ARS' } },
      { name: 'contrato en ARS, ingresos sin declarar', input: { currency: 'ARS', incomeCurrency: null } },
      { name: 'contrato en USD, ingresos en USD', input: { currency: 'USD', incomeCurrency: 'USD' } },
    ],
  })

  describeRule({
    id: 'ar-caba.no-adjustment', jurisdiction: 'AR_CABA', list: 'contractAlerts',
    severity: 'MEDIUM',
    triggers: [
      { name: 'índice null', input: { adjustmentIndex: null, adjustmentFrequency: 'ANNUAL' } },
      { name: 'índice NONE', input: { adjustmentIndex: 'NONE', adjustmentFrequency: 'ANNUAL' } },
      { name: 'frecuencia null', input: { adjustmentIndex: 'ICL', adjustmentFrequency: null } },
      { name: 'frecuencia NONE', input: { adjustmentIndex: 'ICL', adjustmentFrequency: 'NONE' } },
      { name: 'ambos NONE', input: { adjustmentIndex: 'NONE', adjustmentFrequency: 'NONE' } },
    ],
    quiet: [
      { name: 'ICL + ANNUAL', input: { adjustmentIndex: 'ICL', adjustmentFrequency: 'ANNUAL' } },
      { name: 'IPC + SEMIANNUAL', input: { adjustmentIndex: 'IPC', adjustmentFrequency: 'SEMIANNUAL' } },
    ],
  })

  describeRule({
    id: 'ar-caba.extraordinary-expenses', jurisdiction: 'AR_CABA', list: 'contractAlerts',
    severity: 'MEDIUM', confidence: 'NEEDS_REVIEW',
    triggers: [
      { name: 'se cargan al inquilino y el contrato no es claro', input: { extraordinaryExpensesToTenant: true, extraordinaryExpensesClear: false } },
    ],
    quiet: [
      { name: 'no se cargan al inquilino', input: { extraordinaryExpensesToTenant: false, extraordinaryExpensesClear: false } },
      { name: 'no se cargan y el contrato es claro', input: { extraordinaryExpensesToTenant: false, extraordinaryExpensesClear: true } },
      { name: 'se cargan pero el contrato es claro', input: { extraordinaryExpensesToTenant: true, extraordinaryExpensesClear: true } },
      { name: 'se cargan y no se sabe si es claro', input: { extraordinaryExpensesToTenant: true, extraordinaryExpensesClear: null } },
      { name: 'sin declarar si se cargan', input: { extraordinaryExpensesToTenant: null, extraordinaryExpensesClear: false } },
    ],
  })

  describeRule({
    id: 'ar-caba.upfront-months', jurisdiction: 'AR_CABA', list: 'riskFlags',
    severity: 'MEDIUM', confidence: 'NEEDS_REVIEW', tenantOnly: true,
    triggers: [
      { name: '2 meses por adelantado', input: { upfrontMonths: 2 } },
      { name: '3 meses por adelantado', input: { upfrontMonths: 3 } },
      { name: '6 meses por adelantado', input: { upfrontMonths: 6 } },
    ],
    quiet: [
      { name: '1 mes por adelantado', input: { upfrontMonths: 1 } },
      { name: '0 meses por adelantado', input: { upfrontMonths: 0 } },
      { name: 'sin declarar', input: { upfrontMonths: null } },
    ],
  })
})

// ── MX_CDMX ────────────────────────────────────────────────────────────────

describe('MX_CDMX — reglas', () => {
  describeRule({
    id: 'mx-cdmx.deposit-over-one-month', jurisdiction: 'MX_CDMX', list: 'riskFlags',
    severity: 'HIGH', confidence: 'VERIFIED',
    triggers: [
      { name: 'depósito de 2 rentas', input: { monthlyRent: 18_000, depositAmount: 36_000 } },
      { name: 'depósito apenas por encima de 1 renta', input: { monthlyRent: 18_000, depositAmount: 18_001 } },
    ],
    quiet: [
      { name: 'depósito igual a 1 renta', input: { monthlyRent: 18_000, depositAmount: 18_000 } },
      { name: 'depósito menor a 1 renta', input: { monthlyRent: 18_000, depositAmount: 9_000 } },
      { name: 'depósito 0', input: { monthlyRent: 18_000, depositAmount: 0 } },
      { name: 'renta sin declarar', input: { monthlyRent: null, depositAmount: 36_000 } },
      { name: 'depósito sin declarar', input: { monthlyRent: 18_000, depositAmount: null } },
      { name: 'renta 0', input: { monthlyRent: 0, depositAmount: 36_000 } },
    ],
  })

  describeRule({
    id: 'mx-cdmx.currency-not-mxn', jurisdiction: 'MX_CDMX', list: 'contractAlerts',
    severity: 'HIGH',
    triggers: [
      { name: 'contrato en USD', input: { currency: 'USD' } },
      { name: 'contrato en ARS', input: { currency: 'ARS' } },
    ],
    quiet: [
      { name: 'contrato en MXN', input: { currency: 'MXN' } },
    ],
  })

  describeRule({
    id: 'mx-cdmx.no-property-description', jurisdiction: 'MX_CDMX', list: 'contractAlerts',
    severity: 'MEDIUM',
    triggers: [
      { name: 'el contrato no describe el inmueble', input: { hasPropertyDescription: false } },
    ],
    quiet: [
      { name: 'el contrato describe el inmueble', input: { hasPropertyDescription: true } },
      { name: 'sin declarar', input: { hasPropertyDescription: null } },
    ],
  })

  describeRule({
    id: 'mx-cdmx.pays-before-signing', jurisdiction: 'MX_CDMX', list: 'riskFlags',
    severity: 'HIGH', confidence: 'NEEDS_REVIEW', tenantOnly: true,
    triggers: [
      { name: 'le piden pagar antes de firmar', input: { paysBeforeSigning: true } },
    ],
    quiet: [
      { name: 'no le piden pagar antes de firmar', input: { paysBeforeSigning: false } },
      { name: 'sin declarar', input: { paysBeforeSigning: null } },
    ],
  })

  describeRule({
    id: 'mx-cdmx.increase-frequency', jurisdiction: 'MX_CDMX', list: 'contractAlerts',
    severity: 'MEDIUM',
    triggers: [
      { name: 'ajuste mensual', input: { adjustmentFrequency: 'MONTHLY' } },
      { name: 'ajuste trimestral', input: { adjustmentFrequency: 'QUARTERLY' } },
      { name: 'ajuste semestral', input: { adjustmentFrequency: 'SEMIANNUAL' } },
      { name: 'ajuste con otra frecuencia', input: { adjustmentFrequency: 'OTHER' } },
    ],
    quiet: [
      { name: 'ajuste anual', input: { adjustmentFrequency: 'ANNUAL' } },
      { name: 'sin ajuste (NONE)', input: { adjustmentFrequency: 'NONE' } },
    ],
  })

  describeRule({
    id: 'mx-cdmx.increase-cap-reminder', jurisdiction: 'MX_CDMX', list: 'contractAlerts',
    severity: 'LOW',
    triggers: [
      { name: 'porcentaje fijo', input: { adjustmentIndex: 'FIXED_PERCENT' } },
      { name: 'otro índice', input: { adjustmentIndex: 'OTHER' } },
    ],
    quiet: [
      { name: 'INPC', input: { adjustmentIndex: 'INPC' } },
      { name: 'sin ajuste (NONE)', input: { adjustmentIndex: 'NONE' } },
    ],
  })

  describeRule({
    id: 'mx-cdmx.broker-fee-unclear', jurisdiction: 'MX_CDMX', list: 'riskFlags',
    severity: 'LOW', confidence: 'NEEDS_REVIEW', tenantOnly: true,
    triggers: [
      { name: 'inmobiliaria con comisión', input: { hasBroker: true, brokerFeeAmount: 18_000 } },
    ],
    quiet: [
      { name: 'sin inmobiliaria', input: { hasBroker: false, brokerFeeAmount: 18_000 } },
      { name: 'inmobiliaria con comisión 0', input: { hasBroker: true, brokerFeeAmount: 0 } },
      { name: 'inmobiliaria sin importe', input: { hasBroker: true, brokerFeeAmount: null } },
      { name: 'sin declarar', input: { hasBroker: null, brokerFeeAmount: null } },
    ],
  })
})

// ── Aislamiento entre jurisdicciones ────────────────────────────────────────

describe('aislamiento de jurisdicciones', () => {
  const arInputs: [string, RentalInput][] = [
    ['vacío', AR()],
    ['completo', FULL_AR],
    ['estrés', AR_STRESS],
    ['estrés propietario', { ...AR_STRESS, role: 'OWNER' }],
  ]
  const mxInputs: [string, RentalInput][] = [
    ['vacío', MX()],
    ['completo', FULL_MX],
    ['estrés', MX_STRESS],
    ['estrés propietario', { ...MX_STRESS, role: 'OWNER' }],
  ]

  it.each(mxInputs)('un input MX (%s) nunca produce reglas ar-caba.*', (_n, input) => {
    const r = runRentalCheck(input)
    expect(idsOf(r).filter(id => id.startsWith('ar-caba.'))).toEqual([])
    for (const f of allFindings(r)) expect(f.jurisdiction).toBe('MX_CDMX')
    for (const item of r.signingChecklist) {
      expect(item.relatedRuleId ?? '').not.toMatch(/^ar-caba\./)
    }
  })

  it.each(arInputs)('un input AR (%s) nunca produce reglas mx-cdmx.*', (_n, input) => {
    const r = runRentalCheck(input)
    expect(idsOf(r).filter(id => id.startsWith('mx-cdmx.'))).toEqual([])
    for (const f of allFindings(r)) expect(f.jurisdiction).toBe('AR_CABA')
    for (const item of r.signingChecklist) {
      expect(item.relatedRuleId ?? '').not.toMatch(/^mx-cdmx\./)
    }
  })

  it('los resultados de cada país son disjuntos con el mismo input base', () => {
    const shared = { monthlyRent: 100_000, depositAmount: 300_000, hasContract: false, hasHandoverInventory: false }
    const ar = new Set(idsOf(runRentalCheck(AR(shared))))
    const mx = new Set(idsOf(runRentalCheck(MX(shared))))
    for (const id of ar) expect(mx.has(id)).toBe(false)
  })

  it('el depósito > 1 renta es regla de México, no de Argentina', () => {
    const shared = { monthlyRent: 100_000, depositAmount: 300_000 }
    expect(idsOf(runRentalCheck(MX(shared)))).toContain('mx-cdmx.deposit-over-one-month')
    expect(idsOf(runRentalCheck(AR(shared)))).not.toContain('mx-cdmx.deposit-over-one-month')
  })

  it('la comisión inmobiliaria al inquilino es regla de Argentina, no de México', () => {
    const shared = { hasBroker: true, brokerFeeAmount: 100_000 }
    expect(idsOf(runRentalCheck(AR(shared)))).toContain('ar-caba.broker-fee-tenant')
    expect(idsOf(runRentalCheck(MX(shared)))).not.toContain('ar-caba.broker-fee-tenant')
  })
})

// ── País y jurisdicción inconsistentes ──────────────────────────────────────

describe('país y jurisdicción inconsistentes', () => {
  const mismatches: [string, RentalInput][] = [
    ['MX con AR_CABA (estrés)', { ...MX_STRESS, country: 'MX', jurisdiction: 'AR_CABA' }],
    ['MX con AR_CABA (vacío)', { ...MX(), country: 'MX', jurisdiction: 'AR_CABA' }],
    ['AR con MX_CDMX (estrés)', { ...AR_STRESS, country: 'AR', jurisdiction: 'MX_CDMX' }],
    ['AR con MX_CDMX (vacío)', { ...AR(), country: 'AR', jurisdiction: 'MX_CDMX' }],
  ]

  it.each(mismatches)('%s: no aplica ninguna regla jurisdiccional', (_n, input) => {
    const r = runRentalCheck(input)
    const all = allFindings(r)
    expect(all.filter(f => f.severity === 'HIGH')).toEqual([])
    expect(idsOf(r).filter(id => /^(ar-caba|mx-cdmx)\./.test(id))).toEqual([])
  })

  it.each(mismatches)('%s: exactamente un hallazgo LOW, el de inconsistencia', (_n, input) => {
    const r = runRentalCheck(input)
    const low = allFindings(r).filter(f => f.severity === 'LOW')
    expect(low).toHaveLength(1)
    expect(low[0].ruleId).toBe('rentals.jurisdiction-mismatch')
  })

  it.each(mismatches)('%s: la confianza es LOW', (_n, input) => {
    expect(runRentalCheck(input).confidenceLevel).toBe('LOW')
  })

  it('el cálculo de costos sigue funcionando aunque haya inconsistencia', () => {
    const r = runRentalCheck({
      ...FULL_MX, jurisdiction: 'AR_CABA',
    })
    expect(r.entryTotal).toBeGreaterThan(0)
    expect(Number.isFinite(r.monthlyTotal)).toBe(true)
  })

  it('un input consistente NO genera el hallazgo de inconsistencia', () => {
    expect(idsOf(runRentalCheck(AR_STRESS))).not.toContain('rentals.jurisdiction-mismatch')
    expect(idsOf(runRentalCheck(MX_STRESS))).not.toContain('rentals.jurisdiction-mismatch')
  })
})

// ── Rol ─────────────────────────────────────────────────────────────────────

describe('rol: las reglas de inquilino no se muestran al propietario', () => {
  it.each([
    ['AR_CABA', AR_STRESS, getPack('AR_CABA')!],
    ['MX_CDMX', MX_STRESS, getPack('MX_CDMX')!],
  ])('%s: ninguna regla role=TENANT aparece con role=OWNER', (_j, stress, pack) => {
    const tenantOnly = pack.rules.filter(r => r.role === 'TENANT').map(r => r.id)
    expect(tenantOnly.length).toBeGreaterThan(0)

    const asTenant = idsOf(runRentalCheck({ ...stress, role: 'TENANT' }))
    const asOwner = idsOf(runRentalCheck({ ...stress, role: 'OWNER' }))

    // El input de estrés dispara al menos una regla solo-inquilino: si no, el test no prueba nada.
    expect(tenantOnly.some(id => asTenant.includes(id))).toBe(true)
    for (const id of tenantOnly) expect(asOwner).not.toContain(id)
  })

  it('el propietario ve un subconjunto de lo que ve el inquilino', () => {
    for (const stress of [AR_STRESS, MX_STRESS]) {
      const tenant = new Set(idsOf(runRentalCheck({ ...stress, role: 'TENANT' })))
      const owner = idsOf(runRentalCheck({ ...stress, role: 'OWNER' }))
      for (const id of owner) expect(tenant.has(id)).toBe(true)
    }
  })

  it('las reglas de ambos roles siguen apareciendo para el propietario', () => {
    const ar = idsOf(runRentalCheck({ ...AR_STRESS, role: 'OWNER' }))
    expect(ar).toContain('ar-caba.broker-fee-tenant')
    const mx = idsOf(runRentalCheck({ ...MX_STRESS, role: 'OWNER' }))
    expect(mx).toContain('mx-cdmx.deposit-over-one-month')
  })
})

// ── Orden por severidad ─────────────────────────────────────────────────────

describe('orden por severidad (HIGH, MEDIUM, LOW)', () => {
  const inputs: [string, RentalInput][] = [
    ['AR estrés', AR_STRESS],
    ['AR estrés propietario', { ...AR_STRESS, role: 'OWNER' }],
    ['MX estrés', MX_STRESS],
    ['MX estrés propietario', { ...MX_STRESS, role: 'OWNER' }],
    ['AR completo', FULL_AR],
    ['MX vacío', MX()],
  ]

  it.each(inputs)('%s: riskFlags y contractAlerts vienen ordenados', (_n, input) => {
    const r = runRentalCheck(input)
    for (const list of [r.riskFlags, r.contractAlerts]) {
      const ranks = list.map(f => SEVERITY_RANK[f.severity])
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    }
  })

  it('el ordenamiento se prueba con severidades mezcladas', () => {
    const mx = runRentalCheck(MX_STRESS)
    expect(new Set(mx.riskFlags.map(f => f.severity)).size).toBeGreaterThanOrEqual(3)
    const ar = runRentalCheck(AR_STRESS)
    expect(new Set(ar.contractAlerts.map(f => f.severity)).size).toBeGreaterThanOrEqual(3)
  })
})

// ── Datos faltantes ─────────────────────────────────────────────────────────

describe('datos faltantes', () => {
  const missingFields = (r: RentalCheckResult) => r.missingData.map(m => m.field)

  it('un input AR vacío lista los datos básicos', () => {
    const fields = missingFields(runRentalCheck(emptyRentalInput('AR')))
    for (const f of [
      'monthlyRent', 'depositAmount', 'hasContract', 'hasHandoverInventory',
      'adjustmentFrequency', 'adjustmentIndex', 'hasBroker',
    ]) {
      expect(fields).toContain(f)
    }
  })

  it('cargar la renta la saca de los datos faltantes', () => {
    expect(missingFields(runRentalCheck(AR()))).toContain('monthlyRent')
    expect(missingFields(runRentalCheck(AR({ monthlyRent: 500_000 })))).not.toContain('monthlyRent')
  })

  it('un 0 declarado cuenta como dato cargado (no es faltante)', () => {
    expect(missingFields(runRentalCheck(AR({ depositAmount: 0 })))).not.toContain('depositAmount')
  })

  it('con inmobiliaria y sin importe de comisión, falta brokerFeeAmount', () => {
    const r = runRentalCheck(AR({ hasBroker: true, brokerFeeAmount: null }))
    expect(missingFields(r)).toContain('brokerFeeAmount')
  })

  it('con inmobiliaria y comisión cargada, no falta brokerFeeAmount', () => {
    const r = runRentalCheck(AR({ hasBroker: true, brokerFeeAmount: 50_000 }))
    expect(missingFields(r)).not.toContain('brokerFeeAmount')
  })

  it('en México, la descripción del inmueble sin declarar figura como faltante', () => {
    expect(missingFields(runRentalCheck(MX({ hasPropertyDescription: null })))).toContain('hasPropertyDescription')
    expect(missingFields(runRentalCheck(MX({ hasPropertyDescription: true })))).not.toContain('hasPropertyDescription')
  })

  it('un input completamente cargado no tiene datos faltantes', () => {
    expect(runRentalCheck(FULL_AR).missingData).toEqual([])
    expect(runRentalCheck(FULL_MX).missingData).toEqual([])
  })

  it('cada dato faltante dice qué es y por qué importa, sin repetirse', () => {
    for (const input of [emptyRentalInput('AR'), emptyRentalInput('MX')]) {
      const r = runRentalCheck(input)
      expect(r.missingData.length).toBeGreaterThan(0)
      for (const m of r.missingData) {
        expect(m.label.trim().length).toBeGreaterThan(0)
        expect(m.why.trim().length).toBeGreaterThan(0)
      }
      const fields = missingFields(r)
      expect(new Set(fields).size).toBe(fields.length)
    }
  })
})

// ── Confianza ───────────────────────────────────────────────────────────────

describe('nivel de confianza', () => {
  const BASICS: (keyof RentalInput)[] = [
    'monthlyRent', 'depositAmount', 'hasContract', 'hasHandoverInventory', 'adjustmentFrequency',
  ]
  const without = (base: RentalInput, fields: (keyof RentalInput)[]): RentalInput => {
    const copy: Record<string, unknown> = { ...base }
    for (const f of fields) copy[f] = null
    return copy as unknown as RentalInput
  }

  it.each([
    ['AR', emptyRentalInput('AR')],
    ['MX', emptyRentalInput('MX')],
  ])('%s: con un input vacío (muchos faltantes) la confianza es LOW', (_c, input) => {
    const r = runRentalCheck(input)
    expect(r.confidenceLevel).toBe('LOW')
    expect(r.confidenceReasons.length).toBeGreaterThan(0)
  })

  it.each([
    ['AR', FULL_AR],
    ['MX', FULL_MX],
  ])('%s: con 5 datos básicos faltantes la confianza es LOW', (_c, full) => {
    const r = runRentalCheck(without(full, BASICS))
    expect(r.missingData.length).toBeGreaterThanOrEqual(5)
    expect(r.confidenceLevel).toBe('LOW')
  })

  it.each([
    ['AR', FULL_AR, getPack('AR_CABA')!],
    ['MX', FULL_MX, getPack('MX_CDMX')!],
  ])('%s: un input completo y consistente da MEDIUM (techo de la jurisdicción)', (_c, full, pack) => {
    const r = runRentalCheck(full)
    expect(r.confidenceLevel).toBe('MEDIUM')
    // Y la razón del techo se le explica a la persona.
    expect(r.confidenceReasons.some(x => x.includes(pack.maxConfidenceReason))).toBe(true)
  })

  it('con pocos faltantes y consistente no baja a LOW', () => {
    const r = runRentalCheck(without(FULL_AR, ['hasHandoverInventory']))
    expect(r.confidenceLevel).toBe('MEDIUM')
  })

  it('hoy ninguna jurisdicción llega a HIGH: las reglas no tuvieron revisión legal', () => {
    // Si alguien sube maxConfidence a HIGH sin revisión profesional, este test
    // tiene que romper y obligar a una decisión explícita.
    for (const j of ['AR_CABA', 'MX_CDMX'] as const) {
      expect(getPack(j)!.maxConfidence).toBe('MEDIUM')
    }
    const inputs = [FULL_AR, FULL_MX, AR_STRESS, MX_STRESS, AR(), MX(), { ...FULL_AR, role: 'OWNER' as const }]
    for (const input of inputs) {
      expect(runRentalCheck(input).confidenceLevel).not.toBe('HIGH')
    }
  })

  it('la confianza solo toma valores válidos y las razones son texto no vacío', () => {
    for (const input of [FULL_AR, FULL_MX, AR_STRESS, MX_STRESS, AR(), MX()]) {
      const r = runRentalCheck(input)
      expect(['HIGH', 'MEDIUM', 'LOW']).toContain(r.confidenceLevel)
      expect(Array.isArray(r.confidenceReasons)).toBe(true)
      for (const reason of r.confidenceReasons) expect(reason.trim().length).toBeGreaterThan(0)
    }
  })
})

// ── Fuentes y aviso legal ───────────────────────────────────────────────────

describe('fuentes', () => {
  const inputs: [string, RentalInput][] = [
    ['AR estrés', AR_STRESS],
    ['MX estrés', MX_STRESS],
    ['AR completo', FULL_AR],
    ['MX completo', FULL_MX],
    ['AR vacío', AR()],
    ['MX vacío', MX()],
  ]

  it.each(inputs)('%s: la fuente de cada hallazgo aparece en result.sources', (_n, input) => {
    const r = runRentalCheck(input)
    expect(r.sources.length).toBeGreaterThan(0)
    for (const f of allFindings(r)) {
      expect(r.sources.some(s => s.label === f.source.label && s.url === f.source.url)).toBe(true)
    }
  })

  it.each(inputs)('%s: no hay fuentes duplicadas (label, url)', (_n, input) => {
    const r = runRentalCheck(input)
    const keys = r.sources.map(s => `${s.label}|${s.url}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it.each(inputs)('%s: toda fuente tiene label, https y confianza válida', (_n, input) => {
    for (const s of runRentalCheck(input).sources) {
      expect(s.label.trim().length).toBeGreaterThan(0)
      expect(s.url.startsWith('https://')).toBe(true)
      expect(['VERIFIED', 'NEEDS_REVIEW']).toContain(s.confidence)
    }
  })

  it.each([
    ['AR_CABA', AR_STRESS],
    ['MX_CDMX', MX_STRESS],
  ] as const)('%s: las fuentes salen solo de las reglas de esa jurisdicción', (j, input) => {
    const own = new Set(getPack(j)!.rules.map(r => `${r.sourceLabel}|${r.sourceUrl}`))
    const other = new Set(getPack(j === 'AR_CABA' ? 'MX_CDMX' : 'AR_CABA')!.rules.map(r => `${r.sourceLabel}|${r.sourceUrl}`))
    for (const s of runRentalCheck(input).sources) {
      const key = `${s.label}|${s.url}`
      expect(own.has(key), key).toBe(true)
      expect(other.has(key), key).toBe(false)
    }
  })

  it.each([
    ['AR_CABA', AR_STRESS],
    ['MX_CDMX', MX_STRESS],
  ] as const)('%s: reglas con la misma fuente la listan una sola vez', (j, input) => {
    const keys = getPack(j)!.rules.map(r => `${r.sourceLabel}|${r.sourceUrl}`)
    const distinct = new Set(keys).size
    const sources = runRentalCheck(input).sources
    expect(sources.length).toBeGreaterThan(0)
    expect(sources.length).toBeLessThanOrEqual(distinct)
  })

  it.each(inputs)('%s: el aviso legal es texto no vacío y aclara que no es asesoría legal', (_n, input) => {
    const r = runRentalCheck(input)
    expect(typeof r.disclaimer).toBe('string')
    expect(r.disclaimer.trim().length).toBeGreaterThan(0)
    expect(r.disclaimer).toMatch(/asesor[ií]a legal/i)
  })
})

// ── Integridad de las reglas (datos) ─────────────────────────────────────────

describe('integridad de las reglas de ambas jurisdicciones', () => {
  const JURISDICTIONS: RentalJurisdiction[] = ['AR_CABA', 'MX_CDMX']
  const packs = JURISDICTIONS.map(j => getPack(j)!)
  const allRules = packs.flatMap(p => p.rules)

  it('RENTAL_JURISDICTIONS expone exactamente las dos jurisdicciones', () => {
    expect(RENTAL_JURISDICTIONS.map(j => j.jurisdiction).sort()).toEqual([...JURISDICTIONS].sort())
  })

  it('cada jurisdicción tiene un pack con reglas', () => {
    for (const p of packs) {
      expect(p).toBeDefined()
      expect(p.rules.length).toBeGreaterThan(0)
    }
  })

  it('los ids son no vacíos, únicos entre packs y con el prefijo de su jurisdicción', () => {
    const ids = allRules.map(r => r.id)
    for (const id of ids) expect(id.trim().length).toBeGreaterThan(0)
    expect(new Set(ids).size).toBe(ids.length)

    const prefix: Record<RentalJurisdiction, string> = { AR_CABA: 'ar-caba.', MX_CDMX: 'mx-cdmx.' }
    for (const p of packs) {
      for (const r of p.rules) {
        expect(r.jurisdiction).toBe(p.jurisdiction)
        expect(r.id.startsWith(prefix[p.jurisdiction])).toBe(true)
        expect(r.id.length).toBeGreaterThan(prefix[p.jurisdiction].length)
      }
    }
  })

  it('cada regla tiene título, explicación y fuente con texto', () => {
    for (const r of allRules) {
      expect(r.title.trim().length, `${r.id} title`).toBeGreaterThan(0)
      expect(r.explanation.trim().length, `${r.id} explanation`).toBeGreaterThan(0)
      expect(r.sourceLabel.trim().length, `${r.id} sourceLabel`).toBeGreaterThan(0)
    }
  })

  it('cada regla tiene confianza y severidad válidas', () => {
    for (const r of allRules) {
      expect(['VERIFIED', 'NEEDS_REVIEW'], `${r.id} confidence`).toContain(r.confidence)
      expect(['LOW', 'MEDIUM', 'HIGH'], `${r.id} severity`).toContain(r.severity)
    }
  })

  it('cada regla tiene una URL de fuente https', () => {
    for (const r of allRules) {
      expect(r.sourceUrl.startsWith('https://'), `${r.id} sourceUrl`).toBe(true)
    }
  })

  it('cada regla tiene rol y tipo válidos y un evaluate que no explota con input vacío', () => {
    for (const p of packs) {
      const empty = p.country === 'AR' ? emptyRentalInput('AR') : emptyRentalInput('MX')
      for (const r of p.rules) {
        expect(['TENANT', 'OWNER', 'ANY'], `${r.id} role`).toContain(r.role)
        expect(['RISK', 'CONTRACT'], `${r.id} kind`).toContain(r.kind)
        expect(['TRIGGERED', 'OK', 'UNKNOWN'], `${r.id} outcome`).toContain(r.evaluate(empty))
      }
    }
  })

  it('el kind de cada regla determina en qué lista sale', () => {
    for (const [stress, p] of [[AR_STRESS, getPack('AR_CABA')!], [MX_STRESS, getPack('MX_CDMX')!]] as const) {
      const r = runRentalCheck(stress)
      for (const rule of p.rules) {
        const inRisk = r.riskFlags.some(f => f.ruleId === rule.id)
        const inContract = r.contractAlerts.some(f => f.ruleId === rule.id)
        if (rule.kind === 'RISK') expect(inContract, `${rule.id} en contractAlerts`).toBe(false)
        if (rule.kind === 'CONTRACT') expect(inRisk, `${rule.id} en riskFlags`).toBe(false)
      }
    }
  })
})

describe('lenguaje de las reglas', () => {
  const allRules = (['AR_CABA', 'MX_CDMX'] as const).flatMap(j => getPack(j)!.rules)
  const STRONG = /ilegal|prohibido/i

  it('ninguna regla afirma "ilegal" o "prohibido" salvo que su fuente esté VERIFIED', () => {
    for (const r of allRules) {
      if (r.confidence === 'VERIFIED') continue
      expect(STRONG.test(r.title), `${r.id} title`).toBe(false)
      expect(STRONG.test(r.explanation), `${r.id} explanation`).toBe(false)
    }
  })

  it('ni siquiera las reglas VERIFIED hoy usan "es ilegal"', () => {
    for (const r of allRules) {
      expect(/es ilegal/i.test(r.title), `${r.id} title`).toBe(false)
      expect(/es ilegal/i.test(r.explanation), `${r.id} explanation`).toBe(false)
    }
  })

  it('los hallazgos que llegan a la persona respetan la misma regla de lenguaje', () => {
    for (const input of [AR_STRESS, MX_STRESS]) {
      const r = runRentalCheck(input)
      for (const f of allFindings(r)) {
        if (f.source.confidence === 'VERIFIED') continue
        expect(STRONG.test(f.title), `${f.ruleId} title`).toBe(false)
        expect(STRONG.test(f.explanation), `${f.ruleId} explanation`).toBe(false)
      }
    }
  })
})
