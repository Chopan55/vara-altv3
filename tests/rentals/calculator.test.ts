/**
 * VARA Alquiler Check — calculadora de costos.
 *
 * Lo que se protege acá: que los números que ve la persona sean los que ella
 * cargó, sumados bien, y que un dato que NO cargó nunca se disfrace de cero
 * declarado. Un "costo de entrada" subestimado porque faltaba un dato, y
 * presentado como si estuviera completo, es peor que no mostrar nada.
 *
 * Además: no hay conversión de moneda. Los importes se interpretan en la
 * moneda del contrato y el resultado la repite tal cual.
 */

import { describe, it, expect } from 'vitest'
import {
  calculateCosts, emptyRentalInput, runRentalCheck,
  type CostItem, type RentalInput,
} from '@/lib/rentals'

const AR = (over: Partial<RentalInput> = {}): RentalInput => ({ ...emptyRentalInput('AR'), ...over })
const MX = (over: Partial<RentalInput> = {}): RentalInput => ({ ...emptyRentalInput('MX'), ...over })

const byId = (items: CostItem[], id: string): CostItem => {
  const found = items.find(i => i.id === id)
  if (!found) throw new Error(`No existe el ítem ${id}`)
  return found
}

const sum = (items: CostItem[]) => items.reduce((acc, i) => acc + i.amount, 0)

const ENTRY_IDS = [
  'entry.upfront-rent',
  'entry.deposit',
  'entry.broker-fee',
  'entry.guarantee-cost',
  'entry.reports',
  'entry.moving',
]
const MONTHLY_IDS = ['monthly.rent', 'monthly.expenses']

/** Caso de referencia AR_CABA (ARS). */
const AR_EXAMPLE = AR({
  currency: 'ARS',
  monthlyRent: 500_000,
  upfrontMonths: 1,
  depositAmount: 500_000,
  guaranteeType: 'SEGURO_CAUCION',
  guaranteeCost: 150_000,
  hasBroker: false,
  reportsAndCertificationCost: 20_000,
  movingCost: 80_000,
  maintenanceOrExpenses: 90_000,
})

/** Caso de referencia MX_CDMX (MXN). */
const MX_EXAMPLE = MX({
  currency: 'MXN',
  monthlyRent: 18_000,
  upfrontMonths: 1,
  depositAmount: 18_000,
  guaranteeType: 'POLIZA_JURIDICA',
  guaranteeCost: 9_000,
  hasBroker: false,
  maintenanceOrExpenses: 1_500,
})

describe('casos de referencia', () => {
  it('AR_CABA: entrada 1.250.000 y mensual 590.000 (ARS)', () => {
    const r = runRentalCheck(AR_EXAMPLE)
    expect(r.entryTotal).toBe(1_250_000)
    expect(r.monthlyTotal).toBe(590_000)
    expect(r.currency).toBe('ARS')
  })

  it('MX_CDMX: entrada 45.000 y mensual 19.500 (MXN)', () => {
    const r = runRentalCheck(MX_EXAMPLE)
    expect(r.entryTotal).toBe(45_000)
    expect(r.monthlyTotal).toBe(19_500)
    expect(r.currency).toBe('MXN')
  })

  it('calculateCosts da lo mismo que runRentalCheck', () => {
    const direct = calculateCosts(AR_EXAMPLE)
    const full = runRentalCheck(AR_EXAMPLE)
    expect(direct.entryTotal).toBe(full.entryTotal)
    expect(direct.monthlyTotal).toBe(full.monthlyTotal)
    expect(direct.currency).toBe(full.currency)
    expect(direct.entryCostItems).toEqual(full.entryCostItems)
    expect(direct.monthlyCostItems).toEqual(full.monthlyCostItems)
  })
})

describe('ítems de costo', () => {
  it('expone los ítems de entrada y mensuales con ids estables', () => {
    const r = runRentalCheck(AR_EXAMPLE)
    expect(r.entryCostItems.map(i => i.id)).toEqual(expect.arrayContaining(ENTRY_IDS))
    expect(r.monthlyCostItems.map(i => i.id)).toEqual(expect.arrayContaining(MONTHLY_IDS))
    // Sin ids repetidos: la UI usa el id como key.
    const all = [...r.entryCostItems, ...r.monthlyCostItems].map(i => i.id)
    expect(new Set(all).size).toBe(all.length)
  })

  it('cada ítem declarado trae el importe cargado', () => {
    const r = runRentalCheck(AR_EXAMPLE)
    expect(byId(r.entryCostItems, 'entry.upfront-rent').amount).toBe(500_000)
    expect(byId(r.entryCostItems, 'entry.deposit').amount).toBe(500_000)
    expect(byId(r.entryCostItems, 'entry.guarantee-cost').amount).toBe(150_000)
    expect(byId(r.entryCostItems, 'entry.reports').amount).toBe(20_000)
    expect(byId(r.entryCostItems, 'entry.moving').amount).toBe(80_000)
    expect(byId(r.monthlyCostItems, 'monthly.rent').amount).toBe(500_000)
    expect(byId(r.monthlyCostItems, 'monthly.expenses').amount).toBe(90_000)
  })

  it('el alquiler adelantado es renta mensual × meses por adelantado', () => {
    const r = runRentalCheck(AR({ monthlyRent: 100_000, upfrontMonths: 3 }))
    expect(byId(r.entryCostItems, 'entry.upfront-rent').amount).toBe(300_000)
    expect(byId(r.entryCostItems, 'entry.upfront-rent').declared).toBe(true)
  })

  it('el total de entrada es la suma de sus ítems', () => {
    const r = runRentalCheck(AR_EXAMPLE)
    expect(r.entryTotal).toBe(sum(r.entryCostItems))
  })

  it('el total mensual es renta + expensas', () => {
    const r = runRentalCheck(AR_EXAMPLE)
    expect(r.monthlyTotal).toBe(sum(r.monthlyCostItems))
    expect(r.monthlyTotal).toBe(500_000 + 90_000)
  })

  it('todos los ítems llevan la moneda del contrato', () => {
    const r = runRentalCheck(MX_EXAMPLE)
    for (const item of [...r.entryCostItems, ...r.monthlyCostItems]) {
      expect(item.currency).toBe('MXN')
    }
  })

  it('redondea el total a 2 decimales (sin ruido de punto flotante)', () => {
    // 0.1 + 0.2 === 0.30000000000000004 en JS.
    const r = runRentalCheck(AR({ monthlyRent: 0.1, upfrontMonths: 1, depositAmount: 0.2 }))
    expect(r.entryTotal).toBe(0.3)
    const m = runRentalCheck(AR({ monthlyRent: 0.1, maintenanceOrExpenses: 0.2 }))
    expect(m.monthlyTotal).toBe(0.3)
  })
})

describe('comisión inmobiliaria', () => {
  it('es 0 si declaró que no hay inmobiliaria, aunque haya un importe cargado', () => {
    const r = runRentalCheck(AR({ hasBroker: false, brokerFeeAmount: 90_000 }))
    expect(byId(r.entryCostItems, 'entry.broker-fee').amount).toBe(0)
  })

  it('es el importe cargado si hay inmobiliaria', () => {
    const r = runRentalCheck(AR({ hasBroker: true, brokerFeeAmount: 90_000 }))
    const fee = byId(r.entryCostItems, 'entry.broker-fee')
    expect(fee.amount).toBe(90_000)
    expect(fee.declared).toBe(true)
    expect(r.entryTotal).toBe(90_000)
  })

  it('hay inmobiliaria pero sin importe: 0 y NO declarado', () => {
    const r = runRentalCheck(AR({ hasBroker: true, brokerFeeAmount: null }))
    const fee = byId(r.entryCostItems, 'entry.broker-fee')
    expect(fee.amount).toBe(0)
    expect(fee.declared).toBe(false)
  })
})

describe('dato no declarado vs. cero declarado', () => {
  it('un dato null suma 0 y queda marcado como no declarado', () => {
    const r = runRentalCheck(AR({ monthlyRent: 100_000, upfrontMonths: null, depositAmount: null }))
    for (const id of ['entry.upfront-rent', 'entry.deposit']) {
      const item = byId(r.entryCostItems, id)
      expect(item.amount).toBe(0)
      expect(item.declared).toBe(false)
    }
  })

  it('un 0 cargado es un dato declarado', () => {
    const r = runRentalCheck(AR({ monthlyRent: 100_000, upfrontMonths: 1, depositAmount: 0 }))
    const deposit = byId(r.entryCostItems, 'entry.deposit')
    expect(deposit.amount).toBe(0)
    expect(deposit.declared).toBe(true)
  })

  it('un costo declarado en 0 no es lo mismo que uno sin declarar', () => {
    const declared = runRentalCheck(AR({ movingCost: 0 }))
    const undeclared = runRentalCheck(AR({ movingCost: null }))
    expect(byId(declared.entryCostItems, 'entry.moving').declared).toBe(true)
    expect(byId(undeclared.entryCostItems, 'entry.moving').declared).toBe(false)
    expect(declared.entryTotal).toBe(undeclared.entryTotal)
  })

  it('la renta mensual sin declarar suma 0 y no se declara', () => {
    const r = runRentalCheck(AR({ monthlyRent: null, maintenanceOrExpenses: 5_000 }))
    const rent = byId(r.monthlyCostItems, 'monthly.rent')
    expect(rent.amount).toBe(0)
    expect(rent.declared).toBe(false)
    expect(r.monthlyTotal).toBe(5_000)
  })
})

describe('costo de la garantía', () => {
  it('con una garantía con costo y sin importe cargado: 0 y NO declarado', () => {
    const r = runRentalCheck(AR({ guaranteeType: 'SEGURO_CAUCION', guaranteeCost: null }))
    const item = byId(r.entryCostItems, 'entry.guarantee-cost')
    expect(item.amount).toBe(0)
    expect(item.declared).toBe(false)
  })

  it('con el importe cargado: se suma y queda declarado', () => {
    const r = runRentalCheck(AR({ guaranteeType: 'SEGURO_CAUCION', guaranteeCost: 150_000 }))
    const item = byId(r.entryCostItems, 'entry.guarantee-cost')
    expect(item.amount).toBe(150_000)
    expect(item.declared).toBe(true)
    expect(r.entryTotal).toBe(150_000)
  })

  it('sin garantía (NONE) no suma nada', () => {
    const r = runRentalCheck(AR({ guaranteeType: 'NONE', guaranteeCost: null }))
    expect(byId(r.entryCostItems, 'entry.guarantee-cost').amount).toBe(0)
    expect(r.entryTotal).toBe(0)
  })
})

describe('vacío y ceros', () => {
  it.each([
    ['AR', () => emptyRentalInput('AR')],
    ['MX', () => emptyRentalInput('MX')],
  ])('input vacío (%s): totales en 0 y ningún ítem declarado', (_country, build) => {
    const input = build()
    const r = runRentalCheck(input)
    expect(r.entryTotal).toBe(0)
    expect(r.monthlyTotal).toBe(0)
    expect(r.currency).toBe(input.currency)
    // La garantía NONE ("sin garantía") no tiene un costo que cargar, así que se
    // trata aparte (ver "costo de la garantía"); el resto sí es dato no declarado.
    for (const item of [...r.entryCostItems, ...r.monthlyCostItems]) {
      expect(item.amount).toBe(0)
      if (item.id !== 'entry.guarantee-cost') expect(item.declared, item.id).toBe(false)
    }
  })

  it('todo en cero declarado: totales en 0 y ítems declarados', () => {
    const r = runRentalCheck(AR({
      monthlyRent: 0, upfrontMonths: 0, depositAmount: 0, maintenanceOrExpenses: 0,
      guaranteeCost: 0, brokerFeeAmount: 0, hasBroker: true,
      reportsAndCertificationCost: 0, movingCost: 0,
    }))
    expect(r.entryTotal).toBe(0)
    expect(r.monthlyTotal).toBe(0)
    for (const item of [...r.entryCostItems, ...r.monthlyCostItems]) {
      expect(item.amount).toBe(0)
      expect(item.declared).toBe(true)
    }
  })
})

describe('monedas: mismos números, mismos totales', () => {
  const combos: { country: 'AR' | 'MX'; currency: 'ARS' | 'USD' | 'MXN' }[] = [
    { country: 'AR', currency: 'ARS' },
    { country: 'AR', currency: 'USD' },
    { country: 'MX', currency: 'MXN' },
    { country: 'MX', currency: 'USD' },
  ]

  const numbers: Partial<RentalInput> = {
    monthlyRent: 1_000,
    upfrontMonths: 1,
    depositAmount: 1_000,
    guaranteeCost: 200,
    hasBroker: false,
    reportsAndCertificationCost: 50,
    movingCost: 150,
    maintenanceOrExpenses: 120,
  }
  // 1000 + 1000 + 0 + 200 + 50 + 150 = 2400 ; 1000 + 120 = 1120
  const EXPECTED_ENTRY = 2_400
  const EXPECTED_MONTHLY = 1_120

  it.each(combos)('$country + $currency: totales idénticos y moneda repetida', ({ country, currency }) => {
    const base = country === 'AR' ? AR : MX
    const r = runRentalCheck(base({ ...numbers, currency }))
    expect(r.currency).toBe(currency)
    expect(r.entryTotal).toBe(EXPECTED_ENTRY)
    expect(r.monthlyTotal).toBe(EXPECTED_MONTHLY)
    for (const item of [...r.entryCostItems, ...r.monthlyCostItems]) {
      expect(item.currency).toBe(currency)
    }
  })

  it('no convierte: cambiar la moneda no cambia los importes', () => {
    const ars = runRentalCheck(AR({ ...numbers, currency: 'ARS' }))
    const usd = runRentalCheck(AR({ ...numbers, currency: 'USD' }))
    expect(usd.entryTotal).toBe(ars.entryTotal)
    expect(usd.monthlyTotal).toBe(ars.monthlyTotal)
    expect(usd.entryCostItems.map(i => i.amount)).toEqual(ars.entryCostItems.map(i => i.amount))
  })
})
