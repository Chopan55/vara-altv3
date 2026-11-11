/**
 * Costos de un análisis compartido. No viajan en el link: se recalculan con
 * el país, la provincia o estado y el precio publicado, con el mismo motor que
 * el análisis original (`generateChecklist` vía los proveedores de costos).
 */

import { estimateTransactionCost } from './cost'
import './costProviders/ar'
import './costProviders/mx'
import type { SharedAnalysis } from './share'
import type { TransactionCost } from './types'

export function sharedCost(s: SharedAnalysis): TransactionCost | null {
  if (!s.price) return null
  return estimateTransactionCost(s.country ?? 'AR', { price: s.price.a, currency: s.price.c, provinceCode: s.prov })
}
