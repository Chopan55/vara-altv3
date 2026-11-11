/**
 * Proveedor de costos de México.
 *
 * Igual que Argentina, la única fuente es `generateChecklist` (datos de cada
 * estado en `data/regulations/mx.ts`): ISAI, honorarios del notario y derechos
 * del Registro Público de la Propiedad, como rangos.
 *
 * Moneda: esos conceptos son porcentajes del valor, así que salen en la moneda
 * del aviso (MXN o USD). El único monto fijo del checklist (avalúo y
 * certificados) está en USD: con un aviso en pesos se deja afuera y se dice,
 * en vez de convertir "a ojo" con un tipo de cambio inventado.
 */

import { generateChecklist, MX_CODES } from '@/lib/regulations'
import { registerCostProvider, type CostInput, type CostProvider } from '../cost'
import type { CostLine, ListingCurrency, TransactionCost } from '../types'

const DEFAULT_STATE = 'CDMX'

const NOT_INCLUDED = [
  'Comisión del asesor inmobiliario, si corresponde: consultala antes de avanzar',
  'Gastos del crédito (avalúo bancario, comisión por apertura), si pedís uno',
  'Cuota de mantenimiento, predial y agua de la propiedad',
  'Mudanza, remodelación y amueblado',
]

export const MX_COST_PROVIDER: CostProvider = {
  country: 'MX',
  estimate(input: CostInput): TransactionCost {
    const { price, currency } = input

    if (!price || price <= 0 || !currency) {
      return {
        jurisdiction: 'MX', lines: [], totalRange: null, notIncluded: NOT_INCLUDED,
        assumptions: [price ? 'El aviso no aclara la moneda del precio: no estimo costos sin saberla.' : 'Falta el precio de la propiedad para estimar los costos.'],
      }
    }
    if (currency !== 'MXN' && currency !== 'USD') {
      return {
        jurisdiction: 'MX',
        lines: [{ id: 'price', label: 'Precio publicado', kind: 'KNOWN', min: price, max: price, currency, basis: 'Aviso' }],
        totalRange: null, notIncluded: NOT_INCLUDED,
        assumptions: ['El precio está en una moneda que no corresponde a México: revisá el aviso.'],
      }
    }

    const stateCode = input.provinceCode && MX_CODES.has(input.provinceCode) ? input.provinceCode : DEFAULT_STATE
    const checklist = generateChecklist(stateCode, 'BUY_PROPERTY', price, 'MX')
    const c = checklist.costs
    const cur: ListingCurrency = currency

    const est = (id: string, label: string, line: { minAmount: number; maxAmount: number; source: string }): CostLine => ({
      id, label, kind: 'ESTIMATED',
      min: Math.round(line.minAmount), max: Math.round(line.maxAmount),
      currency: cur, basis: line.source,
    })

    const lines: CostLine[] = [
      { id: 'price', label: 'Precio publicado', kind: 'KNOWN', min: price, max: price, currency: cur, basis: 'Aviso' },
      est('isai', `ISAI de ${checklist.provinceName} (lo paga el comprador)`, c.stampTaxBuyer),
      est('notary', 'Honorarios del notario (parte compradora)', c.notaryFeeBuyer),
      est('registry', 'Derechos de inscripción en el Registro Público de la Propiedad', c.registryFee),
    ]
    const notIncluded = [...NOT_INCLUDED]
    if (cur === 'USD') lines.push(est('certificates', 'Avalúo, certificados y gestiones', c.certificates))
    else notIncluded.unshift('Avalúo y certificados: pedile el presupuesto al notario')

    const extras = lines.filter(l => l.kind === 'ESTIMATED')
    const min = price + extras.reduce((s, l) => s + (l.min ?? 0), 0)
    const max = price + extras.reduce((s, l) => s + (l.max ?? 0), 0)

    const assumptions = [
      input.provinceCode && MX_CODES.has(input.provinceCode)
        ? `Reglas de ${checklist.provinceName}.`
        : `No identifiqué el estado en el aviso: usé las reglas de ${checklist.provinceName}.`,
      checklist.dataConfidence === 'VERIFIED'
        ? 'Datos verificados con fuentes oficiales.'
        : 'Rangos de referencia, todavía no validados por un notario: confirmalos con el notario antes de ofertar.',
      'El ISAI se calcula sobre el valor más alto entre el precio, el avalúo y el valor catastral: puede salir más.',
      'Sobre el precio publicado; el precio final puede cambiar al negociar.',
    ]

    return {
      jurisdiction: 'MX', region: input.provinceCode && MX_CODES.has(input.provinceCode) ? input.provinceCode : undefined, lines,
      totalRange: { min: Math.round(min), max: Math.round(max), currency: cur },
      notIncluded, assumptions,
    }
  },
}

registerCostProvider(MX_COST_PROVIDER)
