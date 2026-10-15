/**
 * Costo total de la operación.
 *
 * Responde "¿cuánta plata podría necesitar realmente?" separando lo que se
 * sabe (el precio pedido), lo que se estima (sellos, escribano, registro, con
 * rangos) y lo que no está incluido. Las reglas de cada país viven en un
 * `CostProvider`: el núcleo no conoce impuestos de ningún país.
 */

import type { TransactionCost } from './types'

export interface CostInput {
  price?: number
  currency?: 'USD' | 'ARS'
  /** Código de provincia/estado del pack regulatorio, si se conoce. */
  provinceCode?: string
}

export interface CostProvider {
  country: string
  estimate(input: CostInput): TransactionCost
}

const providers = new Map<string, CostProvider>()

export function registerCostProvider(p: CostProvider): void {
  providers.set(p.country, p)
}

export function estimateTransactionCost(country: string, input: CostInput): TransactionCost {
  const provider = providers.get(country)
  if (!provider) {
    return {
      jurisdiction: country,
      lines: [],
      totalRange: null,
      notIncluded: ['Todos los costos de la operación'],
      assumptions: [`Todavía no hay reglas de costos cargadas para ${country}.`],
    }
  }
  return provider.estimate(input)
}
