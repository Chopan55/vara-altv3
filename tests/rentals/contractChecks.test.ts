/**
 * VARA Alquiler Check — chequeos de contrato y checklist de firma.
 *
 * Dos cosas se protegen acá:
 *  1. Las reglas "de contrato" que existen en ambas jurisdicciones (sin
 *     contrato escrito, sin inventario de entrega) se comportan igual en
 *     Argentina y México. Si una cambia sin la otra, alguien lo hizo a propósito.
 *  2. El checklist de firma: que lo grave nunca quede afuera, que lo
 *     obligatorio vaya antes que lo recomendable, y que siempre haya un
 *     primer paso concreto (leer el contrato).
 */

import { describe, it, expect } from 'vitest'
import {
  runRentalCheck, emptyRentalInput,
  type RentalInput, type RentalCheckResult, type RuleFinding, type RentalJurisdiction,
} from '@/lib/rentals'

const AR = (over: Partial<RentalInput> = {}): RentalInput => ({ ...emptyRentalInput('AR'), ...over })
const MX = (over: Partial<RentalInput> = {}): RentalInput => ({ ...emptyRentalInput('MX'), ...over })

const allFindings = (r: RentalCheckResult): RuleFinding[] => [...r.riskFlags, ...r.contractAlerts]
const idsOf = (r: RentalCheckResult): string[] => allFindings(r).map(f => f.ruleId)

const AR_STRESS: RentalInput = AR({
  role: 'TENANT', currency: 'USD', incomeCurrency: 'ARS',
  monthlyRent: 500_000, depositAmount: 500_000, upfrontMonths: 3,
  hasBroker: true, brokerFeeAmount: 100_000,
  extraordinaryExpensesToTenant: true, extraordinaryExpensesClear: false,
  hasContract: false, hasHandoverInventory: false, hasDepositReturnClause: false,
  adjustmentFrequency: 'NONE', adjustmentIndex: 'NONE', paysBeforeSigning: true,
})

const MX_STRESS: RentalInput = MX({
  role: 'TENANT', currency: 'USD',
  monthlyRent: 18_000, depositAmount: 54_000, upfrontMonths: 3,
  hasBroker: true, brokerFeeAmount: 18_000,
  hasContract: false, hasPropertyDescription: false,
  paysBeforeSigning: true, hasHandoverInventory: false,
  adjustmentFrequency: 'MONTHLY', adjustmentIndex: 'FIXED_PERCENT',
})

const JURISDICTIONS: {
  name: RentalJurisdiction
  prefix: string
  base: (over?: Partial<RentalInput>) => RentalInput
  stress: RentalInput
}[] = [
  { name: 'AR_CABA', prefix: 'ar-caba', base: AR, stress: AR_STRESS },
  { name: 'MX_CDMX', prefix: 'mx-cdmx', base: MX, stress: MX_STRESS },
]

// ── Reglas compartidas ──────────────────────────────────────────────────────

describe.each(JURISDICTIONS)('$name — reglas de contrato compartidas', ({ name, prefix, base }) => {
  describe(`${prefix}.no-contract`, () => {
    const id = `${prefix}.no-contract`

    it('sin contrato escrito: alerta de contrato HIGH', () => {
      const r = runRentalCheck(base({ hasContract: false }))
      const f = r.contractAlerts.find(x => x.ruleId === id)
      expect(f).toBeDefined()
      expect(f!.severity).toBe('HIGH')
      expect(f!.jurisdiction).toBe(name)
      // Es una alerta de contrato, no un riesgo.
      expect(r.riskFlags.some(x => x.ruleId === id)).toBe(false)
    })

    it.each([
      ['hay contrato', true],
      ['sin declarar', null],
    ])('NO se dispara si %s', (_label, hasContract) => {
      expect(idsOf(runRentalCheck(base({ hasContract })))).not.toContain(id)
    })

    it('se dispara también para el propietario (no es solo de inquilino)', () => {
      const r = runRentalCheck(base({ hasContract: false, role: 'OWNER' }))
      expect(idsOf(r)).toContain(id)
    })

    it('se apaga cuando el dato cambia a "hay contrato"', () => {
      expect(idsOf(runRentalCheck(base({ hasContract: false })))).toContain(id)
      expect(idsOf(runRentalCheck(base({ hasContract: true })))).not.toContain(id)
    })
  })

  describe(`${prefix}.no-handover-inventory`, () => {
    const id = `${prefix}.no-handover-inventory`

    it('sin inventario de entrega: riesgo MEDIUM', () => {
      const r = runRentalCheck(base({ hasHandoverInventory: false }))
      const f = r.riskFlags.find(x => x.ruleId === id)
      expect(f).toBeDefined()
      expect(f!.severity).toBe('MEDIUM')
      expect(f!.jurisdiction).toBe(name)
      expect(r.contractAlerts.some(x => x.ruleId === id)).toBe(false)
    })

    it.each([
      ['hay inventario', true],
      ['sin declarar', null],
    ])('NO se dispara si %s', (_label, hasHandoverInventory) => {
      expect(idsOf(runRentalCheck(base({ hasHandoverInventory })))).not.toContain(id)
    })

    it('se dispara también para el propietario', () => {
      const r = runRentalCheck(base({ hasHandoverInventory: false, role: 'OWNER' }))
      expect(idsOf(r)).toContain(id)
    })
  })

  it('las dos reglas son independientes entre sí', () => {
    const onlyContract = idsOf(runRentalCheck(base({ hasContract: false, hasHandoverInventory: true })))
    expect(onlyContract).toContain(`${prefix}.no-contract`)
    expect(onlyContract).not.toContain(`${prefix}.no-handover-inventory`)

    const onlyInventory = idsOf(runRentalCheck(base({ hasContract: true, hasHandoverInventory: false })))
    expect(onlyInventory).not.toContain(`${prefix}.no-contract`)
    expect(onlyInventory).toContain(`${prefix}.no-handover-inventory`)
  })
})

describe('ar-caba.no-deposit-return-clause', () => {
  const id = 'ar-caba.no-deposit-return-clause'

  it('con depósito y sin cláusula de devolución: alerta de contrato MEDIUM', () => {
    const r = runRentalCheck(AR({ depositAmount: 500_000, hasDepositReturnClause: false }))
    const f = r.contractAlerts.find(x => x.ruleId === id)
    expect(f).toBeDefined()
    expect(f!.severity).toBe('MEDIUM')
    expect(r.riskFlags.some(x => x.ruleId === id)).toBe(false)
  })

  it.each([
    ['depósito 0', { depositAmount: 0, hasDepositReturnClause: false }],
    ['depósito sin declarar', { depositAmount: null, hasDepositReturnClause: false }],
    ['hay cláusula de devolución', { depositAmount: 500_000, hasDepositReturnClause: true }],
    ['cláusula sin declarar', { depositAmount: 500_000, hasDepositReturnClause: null }],
  ])('NO se dispara con %s', (_label, over) => {
    expect(idsOf(runRentalCheck(AR(over)))).not.toContain(id)
  })

  it('es una regla de Argentina: no aparece en un input de México', () => {
    const r = runRentalCheck(MX({ depositAmount: 18_000, hasDepositReturnClause: false }))
    expect(idsOf(r)).not.toContain(id)
  })
})

// ── Checklist de firma ──────────────────────────────────────────────────────

describe('checklist de firma', () => {
  const scenarios: [string, RentalInput][] = [
    ['AR vacío', AR()],
    ['MX vacío', MX()],
    ['AR estrés', AR_STRESS],
    ['MX estrés', MX_STRESS],
    ['AR estrés propietario', { ...AR_STRESS, role: 'OWNER' }],
    ['MX estrés propietario', { ...MX_STRESS, role: 'OWNER' }],
    ['AR inconsistente', { ...AR_STRESS, jurisdiction: 'MX_CDMX' }],
    ['MX inconsistente', { ...MX_STRESS, jurisdiction: 'AR_CABA' }],
  ]

  it.each(scenarios)('%s: los ids son únicos', (_n, input) => {
    const ids = runRentalCheck(input).signingChecklist.map(i => i.id)
    expect(ids.length).toBeGreaterThan(0)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(scenarios)('%s: los MUST van antes que los SHOULD', (_n, input) => {
    const priorities = runRentalCheck(input).signingChecklist.map(i => i.priority)
    for (const p of priorities) expect(['MUST', 'SHOULD']).toContain(p)
    const firstShould = priorities.indexOf('SHOULD')
    if (firstShould !== -1) {
      expect(priorities.slice(firstShould).every(p => p === 'SHOULD')).toBe(true)
    }
  })

  it.each(scenarios)('%s: siempre incluye leer el contrato', (_n, input) => {
    const ids = runRentalCheck(input).signingChecklist.map(i => i.id)
    expect(ids).toContain('common.read-contract')
  })

  it.each(scenarios)('%s: cada ítem tiene texto', (_n, input) => {
    for (const item of runRentalCheck(input).signingChecklist) {
      expect(item.text.trim().length).toBeGreaterThan(0)
    }
  })

  describe.each(JURISDICTIONS)('$name', ({ stress, base, prefix }) => {
    it('cada hallazgo HIGH genera un ítem del checklist con su ruleId', () => {
      const r = runRentalCheck(stress)
      const high = allFindings(r).filter(f => f.severity === 'HIGH')
      expect(high.length).toBeGreaterThan(0)
      for (const f of high) {
        const item = r.signingChecklist.find(i => i.relatedRuleId === f.ruleId)
        expect(item, `falta ítem para ${f.ruleId}`).toBeDefined()
      }
    })

    it('si no hay inventario de entrega declarado, el checklist lo pide', () => {
      for (const hasHandoverInventory of [false, null] as const) {
        const r = runRentalCheck(base({ hasHandoverInventory }))
        expect(r.signingChecklist.map(i => i.id)).toContain('common.handover-inventory')
      }
    })

    it('un hallazgo HIGH que aparece y desaparece mueve su ítem del checklist', () => {
      const withProblem = runRentalCheck(base({ hasContract: false }))
      const fixed = runRentalCheck(base({ hasContract: true }))
      const ruleId = `${prefix}.no-contract`
      expect(withProblem.signingChecklist.some(i => i.relatedRuleId === ruleId)).toBe(true)
      expect(fixed.signingChecklist.some(i => i.relatedRuleId === ruleId)).toBe(false)
    })
  })

  it('los ítems con relatedRuleId apuntan a hallazgos que existen en el resultado', () => {
    for (const input of [AR_STRESS, MX_STRESS]) {
      const r = runRentalCheck(input)
      const known = new Set(idsOf(r))
      for (const item of r.signingChecklist) {
        if (item.relatedRuleId === undefined) continue
        // Puede venir de un dato faltante o de un hallazgo; si es de un hallazgo, existe.
        const looksLikeRule = /^(ar-caba|mx-cdmx|rentals)\./.test(item.relatedRuleId)
        if (looksLikeRule) expect(known.has(item.relatedRuleId), item.relatedRuleId).toBe(true)
      }
    }
  })
})
