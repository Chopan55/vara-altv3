/**
 * Proveedor de costos de Argentina.
 *
 * Reutiliza los datos regulatorios que ya mantiene `lib/regulations` (sellos,
 * escribano y registro por provincia) y los devuelve como rangos con su
 * etiqueta KNOWN / ESTIMATED / NOT_INCLUDED. No inventa tasas: si el pack
 * provincial es parcial, lo dice entre los supuestos.
 *
 * Solo calcula cuando el precio está en USD: no hay tipo de cambio confiable
 * en el análisis y convertir "a ojo" sería fabricar un número.
 */

import { generateChecklist } from '@/lib/regulations'
import { registerCostProvider, type CostInput, type CostProvider } from '../cost'
import type { CostLine, TransactionCost } from '../types'

const NOT_INCLUDED = [
  'Comisión de la inmobiliaria, si corresponde: consultala antes de avanzar',
  'Refacciones, mudanza y amoblamiento',
  'Costos de financiación, si pedís un crédito',
  'Expensas e impuestos mensuales o anuales de la propiedad',
]

export const AR_COST_PROVIDER: CostProvider = {
  country: 'AR',
  estimate(input: CostInput): TransactionCost {
    const { price, currency } = input

    if (!price || price <= 0) {
      return {
        jurisdiction: 'AR', lines: [], totalRange: null, notIncluded: NOT_INCLUDED,
        assumptions: ['Falta el precio de la propiedad para estimar los costos.'],
      }
    }
    if (currency !== 'USD') {
      return {
        jurisdiction: 'AR',
        lines: [{ id: 'price', label: 'Precio publicado', kind: 'KNOWN', min: price, max: price, currency: currency ?? 'ARS', basis: 'Aviso' }],
        totalRange: null,
        notIncluded: NOT_INCLUDED,
        assumptions: ['Los costos de escrituración se estiman sobre precios en dólares; este aviso no está en USD o no aclara la moneda.'],
      }
    }

    const checklist = generateChecklist(input.provinceCode ?? 'BUENOS_AIRES', 'BUY_PROPERTY', price, 'AR')
    const c = checklist.costs

    const est = (id: string, label: string, line: { minAmount: number; maxAmount: number; source: string }): CostLine => ({
      id, label, kind: 'ESTIMATED',
      min: Math.round(line.minAmount), max: Math.round(line.maxAmount),
      currency: 'USD', basis: line.source,
    })

    const lines: CostLine[] = [
      { id: 'price', label: 'Precio publicado', kind: 'KNOWN', min: price, max: price, currency: 'USD', basis: 'Aviso' },
      est('stamp', 'Impuesto de sellos (parte compradora)', c.stampTaxBuyer),
      est('notary', 'Honorarios del escribano (parte compradora)', c.notaryFeeBuyer),
      est('registry', 'Inscripción en el Registro de la Propiedad', c.registryFee),
      est('certificates', 'Certificados, informes y gestiones', c.certificates),
    ]

    const extras = lines.filter(l => l.kind === 'ESTIMATED')
    const min = price + extras.reduce((s, l) => s + (l.min ?? 0), 0)
    const max = price + extras.reduce((s, l) => s + (l.max ?? 0), 0)

    const assumptions = [
      input.provinceCode
        ? `Reglas de ${checklist.provinceName}.`
        : `No se informó la provincia: se usaron las reglas de ${checklist.provinceName}.`,
      checklist.dataConfidence === 'VERIFIED'
        ? 'Datos regulatorios verificados.'
        : `Datos regulatorios ${checklist.dataConfidence}: confirmalos con un escribano.`,
      'Sobre el precio publicado; el precio final puede cambiar tras negociar.',
    ]

    return {
      jurisdiction: 'AR', lines,
      totalRange: { min: Math.round(min), max: Math.round(max), currency: 'USD' },
      notIncluded: NOT_INCLUDED, assumptions,
    }
  },
}

registerCostProvider(AR_COST_PROVIDER)
