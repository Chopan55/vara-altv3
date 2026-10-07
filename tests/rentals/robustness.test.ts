/**
 * VARA Alquiler Check — robustez.
 *
 * Este módulo recibe lo que una persona tipea en un formulario (y lo que
 * llegue por la red desde ese formulario). Lo que se protege acá: que NINGÚN
 * input, por roto que sea, tire la pantalla ni muestre "NaN" o un total
 * negativo. Un costo de entrada de "NaN ARS" no es un error visible: es la
 * persona decidiendo con un número que no significa nada.
 *
 * Y que el módulo sea una función pura de verdad: no muta lo que recibe y no
 * guarda estado entre llamadas.
 */

import { describe, it, expect } from 'vitest'
import {
  runRentalCheck, emptyRentalInput, sanitizeInput,
  type RentalInput, type RentalCheckResult,
} from '@/lib/rentals'

// ── Helpers ────────────────────────────────────────────────────────────────

const AR = (over: Partial<RentalInput> = {}): RentalInput => ({ ...emptyRentalInput('AR'), ...over })
const MX = (over: Partial<RentalInput> = {}): RentalInput => ({ ...emptyRentalInput('MX'), ...over })

/** Fuerza cualquier cosa a pasar por la firma pública, como haría un request sin validar. */
const asInput = (x: unknown): RentalInput => x as RentalInput
const sanitize = (x: unknown): RentalInput => sanitizeInput(x as Partial<RentalInput>)

const NUMERIC_FIELDS = [
  'monthlyRent', 'contractMonths', 'depositAmount', 'upfrontMonths', 'maintenanceOrExpenses',
  'guaranteeCost', 'brokerFeeAmount', 'reportsAndCertificationCost', 'movingCost',
] as const

const BOOLEAN_FIELDS = [
  'extraordinaryExpensesToTenant', 'extraordinaryExpensesClear', 'hasBroker', 'hasContract',
  'hasPropertyDescription', 'hasDepositReturnClause', 'isFurnished', 'paysBeforeSigning',
  'hasHandoverInventory',
] as const

const withNumeric = (base: RentalInput, value: unknown): RentalInput => {
  const copy: Record<string, unknown> = { ...base }
  for (const f of NUMERIC_FIELDS) copy[f] = value
  return copy as unknown as RentalInput
}

const withBoolean = (base: RentalInput, value: unknown): RentalInput => {
  const copy: Record<string, unknown> = { ...base }
  for (const f of BOOLEAN_FIELDS) copy[f] = value
  return copy as unknown as RentalInput
}

function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === 'object') {
    Object.freeze(obj)
    for (const v of Object.values(obj as Record<string, unknown>)) deepFreeze(v)
  }
  return obj
}

function expectAllNumbersFinite(value: unknown, path = 'result'): void {
  if (typeof value === 'number') {
    expect(Number.isFinite(value), `${path} = ${value}`).toBe(true)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => expectAllNumbersFinite(v, `${path}[${i}]`))
    return
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) expectAllNumbersFinite(v, `${path}.${k}`)
  }
}

function expectWellFormed(r: RentalCheckResult): void {
  expectAllNumbersFinite(r)
  expect(Number.isNaN(r.entryTotal)).toBe(false)
  expect(Number.isNaN(r.monthlyTotal)).toBe(false)
  expect(r.entryTotal).toBeGreaterThanOrEqual(0)
  expect(r.monthlyTotal).toBeGreaterThanOrEqual(0)
  expect(['ARS', 'USD', 'MXN']).toContain(r.currency)
  expect(['HIGH', 'MEDIUM', 'LOW']).toContain(r.confidenceLevel)
  expect(Array.isArray(r.entryCostItems)).toBe(true)
  expect(Array.isArray(r.monthlyCostItems)).toBe(true)
  expect(Array.isArray(r.riskFlags)).toBe(true)
  expect(Array.isArray(r.contractAlerts)).toBe(true)
  expect(Array.isArray(r.guaranteeNotes)).toBe(true)
  expect(Array.isArray(r.missingData)).toBe(true)
  expect(Array.isArray(r.signingChecklist)).toBe(true)
  expect(Array.isArray(r.confidenceReasons)).toBe(true)
  expect(Array.isArray(r.sources)).toBe(true)
  expect(typeof r.disclaimer).toBe('string')
  expect(r.disclaimer.trim().length).toBeGreaterThan(0)
  for (const item of [...r.entryCostItems, ...r.monthlyCostItems]) {
    expect(item.amount).toBeGreaterThanOrEqual(0)
  }
  // Tiene que poder serializarse (la UI y cualquier API lo hacen).
  expect(() => JSON.stringify(r)).not.toThrow()
}

// ── Entradas rotas ──────────────────────────────────────────────────────────

const BROKEN_INPUTS: [string, unknown][] = [
  ['emptyRentalInput AR', emptyRentalInput('AR')],
  ['emptyRentalInput MX', emptyRentalInput('MX')],
  ['todos los importes en 0', withNumeric(AR(), 0)],
  ['todos los importes en 0 (MX)', withNumeric(MX(), 0)],
  ['importes NaN', withNumeric(AR(), NaN)],
  ['importes Infinity', withNumeric(AR(), Infinity)],
  ['importes -Infinity', withNumeric(AR(), -Infinity)],
  ['importes -1', withNumeric(AR(), -1)],
  ['importes -1 (MX)', withNumeric(MX(), -1)],
  ['importes como string "abc"', withNumeric(AR(), 'abc')],
  ['importes como string numérico', withNumeric(AR(), '1000')],
  ['importes undefined', withNumeric(AR(), undefined)],
  ['importes objeto', withNumeric(AR(), {})],
  ['importes array', withNumeric(AR(), [1, 2])],
  ['importes gigantes (1e15)', withNumeric(AR(), 1e15)],
  ['importes gigantes (1e15) MX', withNumeric(MX(), 1e15)],
  ['importes MAX_SAFE_INTEGER', withNumeric(AR(), Number.MAX_SAFE_INTEGER)],
  ['importes con muchos decimales', withNumeric(AR(), 0.1 + 0.2)],
  ['booleanos como string', withBoolean(AR(), 'true')],
  ['booleanos como número', withBoolean(AR(), 1)],
  ['booleanos undefined', withBoolean(AR(), undefined)],
  ['booleanos NaN', withBoolean(MX(), NaN)],
  ['país desconocido', { ...AR(), country: 'BR' }],
  ['jurisdicción desconocida', { ...AR(), jurisdiction: 'BR_SP' }],
  ['moneda desconocida', { ...AR(), currency: 'EUR' }],
  ['moneda de ingresos desconocida', { ...AR(), incomeCurrency: 'EUR' }],
  ['rol desconocido', { ...AR(), role: 'ADMIN' }],
  ['garantía desconocida', { ...AR(), guaranteeType: 'MAGIA' }],
  ['frecuencia de ajuste desconocida', { ...AR(), adjustmentFrequency: 'DIARIO' }],
  ['índice de ajuste desconocido', { ...AR(), adjustmentIndex: 'DOLAR_BLUE' }],
  ['todo desconocido a la vez', {
    ...withNumeric(AR(), 'abc'), country: 'ZZ', jurisdiction: 'ZZ_ZZ', currency: 'ZZZ', role: 'ZZ',
    guaranteeType: 'ZZ', adjustmentFrequency: 'ZZ', adjustmentIndex: 'ZZ', incomeCurrency: 'ZZ',
  }],
  ['notas de más de 500 caracteres', { ...AR(), notes: 'x'.repeat(5_000) }],
  ['notas que no son string', { ...AR(), notes: 12345 }],
  ['notas con caracteres raros', { ...AR(), notes: '\u0000‮<script>alert(1)</script>\n\t😀' }],
  ['campos undefined (objeto casi vacío)', { country: undefined, jurisdiction: undefined }],
  ['objeto vacío', {}],
  ['objeto parcial', { monthlyRent: 1000 }],
  ['objeto con campos extra', { ...AR(), hacker: 'x', __proto__: { polluted: true } }],
  ['null', null],
  ['undefined', undefined],
  ['string', 'hola'],
  ['número', 42],
  ['array', []],
  ['booleano', true],
]

describe('runRentalCheck con entradas rotas', () => {
  it.each(BROKEN_INPUTS)('%s: no lanza y devuelve un resultado bien formado', (_n, input) => {
    let result: RentalCheckResult | undefined
    expect(() => { result = runRentalCheck(asInput(input)) }).not.toThrow()
    expectWellFormed(result!)
  })

  it('importes gigantes (1e15): los totales siguen siendo finitos', () => {
    const r = runRentalCheck(asInput(withNumeric(AR({ upfrontMonths: 1 }), 1e15)))
    expect(Number.isFinite(r.entryTotal)).toBe(true)
    expect(Number.isFinite(r.monthlyTotal)).toBe(true)
  })

  it('un importe negativo no resta del total: se trata como no declarado', () => {
    const r = runRentalCheck(AR({ monthlyRent: 100_000, upfrontMonths: 1, depositAmount: -500_000 }))
    expect(r.entryTotal).toBe(100_000)
    expect(r.entryTotal).toBeGreaterThanOrEqual(0)
  })

  it('un importe NaN o Infinity no contamina el total', () => {
    const nan = runRentalCheck(asInput(AR({ monthlyRent: 100_000, upfrontMonths: 1, depositAmount: NaN })))
    expect(nan.entryTotal).toBe(100_000)
    const inf = runRentalCheck(asInput(AR({ monthlyRent: 100_000, upfrontMonths: 1, depositAmount: Infinity })))
    expect(inf.entryTotal).toBe(100_000)
  })

  it('un importe en texto ("abc") no contamina el total', () => {
    const r = runRentalCheck(asInput(AR({ monthlyRent: 100_000, upfrontMonths: 1, maintenanceOrExpenses: 'abc' as unknown as number })))
    expect(r.monthlyTotal).toBe(100_000)
  })

  it('los datos rotos se informan como faltantes, no como ceros declarados', () => {
    const r = runRentalCheck(asInput(AR({ monthlyRent: 'abc' as unknown as number })))
    expect(r.missingData.map(m => m.field)).toContain('monthlyRent')
  })

  it('un input roto de una jurisdicción desconocida igual devuelve disclaimer y checklist', () => {
    const r = runRentalCheck(asInput({ ...AR(), country: 'BR', jurisdiction: 'BR_SP' }))
    expect(r.disclaimer.trim().length).toBeGreaterThan(0)
    expect(r.signingChecklist.length).toBeGreaterThan(0)
  })
})

// ── sanitizeInput ───────────────────────────────────────────────────────────

describe('sanitizeInput', () => {
  describe.each(NUMERIC_FIELDS)('campo numérico %s', (field) => {
    it.each([
      ['negativo', -1],
      ['negativo grande', -1e9],
      ['NaN', NaN],
      ['Infinity', Infinity],
      ['-Infinity', -Infinity],
      ['string no numérico', 'abc'],
      ['objeto', {}],
      ['booleano', true],
    ])('%s → null', (_label, value) => {
      expect(sanitize({ [field]: value })[field]).toBeNull()
    })

    it('conserva 0 (dato declarado) y los positivos', () => {
      expect(sanitize({ [field]: 0 })[field]).toBe(0)
      expect(sanitize({ [field]: 123.45 })[field]).toBe(123.45)
    })

    it('undefined → null (no declarado)', () => {
      expect(sanitize({ [field]: undefined })[field]).toBeNull()
    })
  })

  describe.each(BOOLEAN_FIELDS)('campo booleano %s', (field) => {
    it.each([
      ['string "true"', 'true'],
      ['string "yes"', 'yes'],
      ['número 1', 1],
      ['número 0', 0],
      ['NaN', NaN],
      ['objeto', {}],
    ])('%s → null', (_label, value) => {
      expect(sanitize({ [field]: value })[field]).toBeNull()
    })

    it('conserva true y false', () => {
      expect(sanitize({ [field]: true })[field]).toBe(true)
      expect(sanitize({ [field]: false })[field]).toBe(false)
    })
  })

  describe('enums inválidos → valores por defecto', () => {
    const defaults = emptyRentalInput('AR')

    it('rol inválido', () => {
      expect(sanitize({ role: 'ADMIN' }).role).toBe(defaults.role)
      expect(sanitize({ role: 42 }).role).toBe(defaults.role)
    })

    it('tipo de garantía inválido', () => {
      expect(sanitize({ guaranteeType: 'MAGIA' }).guaranteeType).toBe(defaults.guaranteeType)
    })

    it('moneda del contrato inválida: queda una moneda válida', () => {
      expect(['ARS', 'USD', 'MXN']).toContain(sanitize({ currency: 'EUR' }).currency)
      expect(['ARS', 'USD', 'MXN']).toContain(sanitize({ currency: 42 }).currency)
    })

    it('moneda de ingresos inválida: no declarada', () => {
      expect(sanitize({ incomeCurrency: 'EUR' }).incomeCurrency).toBe(defaults.incomeCurrency)
    })

    it('frecuencia e índice de ajuste inválidos', () => {
      expect(sanitize({ adjustmentFrequency: 'DIARIO' }).adjustmentFrequency).toBe(defaults.adjustmentFrequency)
      expect(sanitize({ adjustmentIndex: 'DOLAR_BLUE' }).adjustmentIndex).toBe(defaults.adjustmentIndex)
    })

    it('país y jurisdicción inválidos: quedan valores válidos', () => {
      const s = sanitize({ country: 'BR', jurisdiction: 'BR_SP' })
      expect(['AR', 'MX']).toContain(s.country)
      expect(['AR_CABA', 'MX_CDMX']).toContain(s.jurisdiction)
    })

    it('los valores válidos se conservan', () => {
      const s = sanitize({
        country: 'MX', jurisdiction: 'MX_CDMX', role: 'OWNER', currency: 'USD', incomeCurrency: 'MXN',
        guaranteeType: 'FIANZA', adjustmentFrequency: 'SEMIANNUAL', adjustmentIndex: 'INPC',
      })
      expect(s).toMatchObject({
        country: 'MX', jurisdiction: 'MX_CDMX', role: 'OWNER', currency: 'USD', incomeCurrency: 'MXN',
        guaranteeType: 'FIANZA', adjustmentFrequency: 'SEMIANNUAL', adjustmentIndex: 'INPC',
      })
    })

    it('un país y una jurisdicción válidos pero inconsistentes se conservan tal cual (se avisa después)', () => {
      const s = sanitize({ country: 'MX', jurisdiction: 'AR_CABA' })
      expect(s.country).toBe('MX')
      expect(s.jurisdiction).toBe('AR_CABA')
    })
  })

  describe('notas', () => {
    it('trunca a 500 caracteres', () => {
      expect(sanitize({ notes: 'x'.repeat(2_000) }).notes).toHaveLength(500)
      expect(sanitize({ notes: 'x'.repeat(501) }).notes).toHaveLength(500)
    })

    it('no toca las notas de hasta 500 caracteres', () => {
      expect(sanitize({ notes: 'x'.repeat(500) }).notes).toBe('x'.repeat(500))
      expect(sanitize({ notes: 'hola' }).notes).toBe('hola')
      expect(sanitize({ notes: '' }).notes).toBe('')
    })

    it('algo que no es string queda como string (vacío)', () => {
      for (const bad of [12345, null, undefined, {}, [], true]) {
        const s = sanitize({ notes: bad })
        expect(typeof s.notes).toBe('string')
        expect(s.notes.length).toBeLessThanOrEqual(500)
      }
    })

    it('runRentalCheck con notas larguísimas no falla', () => {
      expect(() => runRentalCheck(AR({ notes: 'x'.repeat(100_000) }))).not.toThrow()
    })
  })

  describe('forma del resultado', () => {
    it.each(BROKEN_INPUTS)('%s: devuelve un RentalInput válido', (_n, input) => {
      const s = sanitize(input)
      expect(Object.keys(s).sort()).toEqual(Object.keys(emptyRentalInput('AR')).sort())
      expect(['AR', 'MX']).toContain(s.country)
      expect(['AR_CABA', 'MX_CDMX']).toContain(s.jurisdiction)
      expect(['TENANT', 'OWNER']).toContain(s.role)
      expect(['ARS', 'USD', 'MXN']).toContain(s.currency)
      expect(typeof s.notes).toBe('string')
      expect(s.notes.length).toBeLessThanOrEqual(500)
      for (const f of NUMERIC_FIELDS) {
        const v = s[f]
        if (v !== null) {
          expect(typeof v).toBe('number')
          expect(Number.isFinite(v)).toBe(true)
          expect(v).toBeGreaterThanOrEqual(0)
        }
      }
      for (const f of BOOLEAN_FIELDS) {
        const v = s[f]
        expect(v === null || typeof v === 'boolean', `${f} = ${String(v)}`).toBe(true)
      }
    })

    it('sanitizeInput({}) tiene todos los campos de RentalInput', () => {
      expect(Object.keys(sanitize({})).sort()).toEqual(Object.keys(emptyRentalInput('AR')).sort())
    })

    it('descarta campos que no pertenecen a RentalInput', () => {
      const s = sanitize({ ...AR(), hacker: 'x', extra: 1 }) as unknown as Record<string, unknown>
      expect(s).not.toHaveProperty('hacker')
      expect(s).not.toHaveProperty('extra')
    })
  })

  describe('idempotencia', () => {
    const valid: [string, unknown][] = [
      ['AR vacío', emptyRentalInput('AR')],
      ['MX vacío', emptyRentalInput('MX')],
      ['AR completo', AR({
        monthlyRent: 500_000, depositAmount: 500_000, upfrontMonths: 2, hasBroker: true,
        brokerFeeAmount: 100_000, hasContract: false, guaranteeType: 'SEGURO_CAUCION', guaranteeCost: 150_000,
        adjustmentFrequency: 'ANNUAL', adjustmentIndex: 'ICL', notes: 'notas',
      })],
    ]

    it.each([...BROKEN_INPUTS, ...valid])('%s: sanitize(sanitize(x)) = sanitize(x)', (_n, input) => {
      const once = sanitize(input)
      const twice = sanitize(once)
      expect(twice).toEqual(once)
    })
  })

  it('no muta lo que recibe', () => {
    const input = deepFreeze({ ...AR({ monthlyRent: -5, notes: 'x'.repeat(900) }), role: 'ADMIN' })
    const snapshot = JSON.parse(JSON.stringify(input))
    expect(() => sanitize(input)).not.toThrow()
    expect(JSON.parse(JSON.stringify(input))).toEqual(snapshot)
  })

  it('devuelve un objeto nuevo, no el mismo que recibió', () => {
    const input = AR({ monthlyRent: 1000 })
    const s = sanitize(input)
    expect(s).not.toBe(input)
  })
})

// ── Pureza ──────────────────────────────────────────────────────────────────

describe('runRentalCheck es una función pura', () => {
  const FILLED = AR({
    role: 'TENANT', currency: 'USD', incomeCurrency: 'ARS',
    monthlyRent: 500_000, depositAmount: 1_000_000, upfrontMonths: 3, maintenanceOrExpenses: 90_000,
    hasBroker: true, brokerFeeAmount: 100_000, guaranteeType: 'SEGURO_CAUCION', guaranteeCost: 150_000,
    hasContract: false, hasHandoverInventory: false, notes: 'x'.repeat(900),
  })

  it('no muta el input (deep-freeze)', () => {
    const frozen = deepFreeze({ ...FILLED })
    const snapshot = JSON.parse(JSON.stringify(frozen))
    expect(() => runRentalCheck(frozen)).not.toThrow()
    expect(JSON.parse(JSON.stringify(frozen))).toEqual(snapshot)
  })

  it('no muta un input roto y congelado', () => {
    const frozen = deepFreeze(asInput({ ...withNumeric(AR(), -1), role: 'ADMIN', notes: 'x'.repeat(2_000) }))
    expect(() => runRentalCheck(frozen)).not.toThrow()
  })

  it('el mismo input da siempre el mismo resultado', () => {
    expect(runRentalCheck(FILLED)).toEqual(runRentalCheck(FILLED))
    expect(runRentalCheck(MX({ monthlyRent: 18_000, depositAmount: 54_000 })))
      .toEqual(runRentalCheck(MX({ monthlyRent: 18_000, depositAmount: 54_000 })))
  })

  it('no guarda estado entre llamadas: un resultado anterior no afecta al siguiente', () => {
    const baseline = JSON.parse(JSON.stringify(runRentalCheck(FILLED)))

    // Se ensucia otro cálculo y se ensucia el resultado devuelto.
    const dirty = runRentalCheck(FILLED)
    runRentalCheck(MX({ monthlyRent: 1, depositAmount: 99 }))
    dirty.riskFlags.length = 0
    dirty.contractAlerts.forEach(f => { f.title = 'ADULTERADO'; f.source.label = 'ADULTERADO' })
    dirty.sources.forEach(s => { s.label = 'ADULTERADO' })
    dirty.guaranteeNotes.forEach(n => { n.caveats.push('ADULTERADO'); n.summary = 'ADULTERADO' })
    dirty.signingChecklist.length = 0
    dirty.missingData.length = 0
    dirty.confidenceReasons.push('ADULTERADO')
    dirty.entryCostItems.forEach(i => { i.amount = 999 })

    expect(JSON.parse(JSON.stringify(runRentalCheck(FILLED)))).toEqual(baseline)
  })

  it('el orden de las llamadas no importa', () => {
    const a1 = JSON.stringify(runRentalCheck(FILLED))
    const m1 = JSON.stringify(runRentalCheck(MX({ monthlyRent: 18_000 })))
    const m2 = JSON.stringify(runRentalCheck(MX({ monthlyRent: 18_000 })))
    const a2 = JSON.stringify(runRentalCheck(FILLED))
    expect(a1).toBe(a2)
    expect(m1).toBe(m2)
  })
})
