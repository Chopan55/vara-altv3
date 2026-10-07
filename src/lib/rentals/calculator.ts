import type { CostItem, GuaranteeType, RentalCurrency, RentalInput } from './types'
import { amount, isDeclared, round2 } from './normalize'

/**
 * Costos de entrada y mensuales. Todo en la moneda del contrato: no convierte
 * monedas ni estima precios de mercado; suma solo lo que el usuario declaró.
 */

export interface CostCalculation {
  currency: RentalCurrency
  entryCostItems: CostItem[]
  entryTotal: number
  monthlyCostItems: CostItem[]
  monthlyTotal: number
}

/** Garantías cuyo costo viene de un tercero (aseguradora o empresa): sin dato, es un faltante. */
const GUARANTEES_WITH_COST: GuaranteeType[] = ['SEGURO_CAUCION', 'POLIZA_JURIDICA', 'FIANZA']

function item(id: string, label: string, value: number | null, currency: RentalCurrency, declared: boolean, note?: string): CostItem {
  return { id, label, amount: round2(amount(value)), currency, declared, ...(note ? { note } : {}) }
}

export function sumItems(items: CostItem[]): number {
  return round2(items.reduce((total, i) => total + i.amount, 0))
}

export function computeEntryCosts(input: RentalInput): CostItem[] {
  const c = input.currency
  const months = amount(input.upfrontMonths)
  const upfrontDeclared = isDeclared(input.monthlyRent) && isDeclared(input.upfrontMonths)

  const brokerDeclared = input.hasBroker === false || (input.hasBroker === true && isDeclared(input.brokerFeeAmount))
  const brokerAmount = input.hasBroker === false ? 0 : amount(input.brokerFeeAmount)

  const guaranteeDeclared = isDeclared(input.guaranteeCost) || !GUARANTEES_WITH_COST.includes(input.guaranteeType)
  const guaranteeNote = GUARANTEES_WITH_COST.includes(input.guaranteeType)
    ? 'El costo lo informa la aseguradora o la empresa; VARA no lo estima.'
    : undefined

  return [
    item(
      'entry.upfront-rent',
      months > 0 ? `Alquiler adelantado (${months} ${months === 1 ? 'mes' : 'meses'})` : 'Alquiler adelantado',
      amount(input.monthlyRent) * months,
      c,
      upfrontDeclared,
    ),
    item('entry.deposit', 'Depósito en garantía', input.depositAmount, c, isDeclared(input.depositAmount)),
    item(
      'entry.broker-fee',
      'Comisión de intermediación pedida al inquilino',
      brokerAmount,
      c,
      brokerDeclared,
      input.hasBroker === true && brokerAmount > 0 ? 'Revisar las alertas: este cobro puede no corresponder según la jurisdicción.' : undefined,
    ),
    item('entry.guarantee-cost', 'Costo de la garantía', input.guaranteeCost, c, guaranteeDeclared, guaranteeNote),
    item(
      'entry.reports',
      'Informes, certificaciones y gestoría',
      input.reportsAndCertificationCost,
      c,
      isDeclared(input.reportsAndCertificationCost),
    ),
    item('entry.moving', 'Mudanza', input.movingCost, c, isDeclared(input.movingCost)),
  ]
}

export function computeMonthlyCosts(input: RentalInput): CostItem[] {
  const c = input.currency
  return [
    item('monthly.rent', 'Alquiler mensual', input.monthlyRent, c, isDeclared(input.monthlyRent)),
    item(
      'monthly.expenses',
      'Expensas o mantenimiento',
      input.maintenanceOrExpenses,
      c,
      isDeclared(input.maintenanceOrExpenses),
      input.extraordinaryExpensesToTenant === true ? 'No incluye expensas extraordinarias, que pueden sumarse.' : undefined,
    ),
  ]
}

export function calculateCosts(input: RentalInput): CostCalculation {
  const entryCostItems = computeEntryCosts(input)
  const monthlyCostItems = computeMonthlyCosts(input)
  return {
    currency: input.currency,
    entryCostItems,
    entryTotal: sumItems(entryCostItems),
    monthlyCostItems,
    monthlyTotal: sumItems(monthlyCostItems),
  }
}
