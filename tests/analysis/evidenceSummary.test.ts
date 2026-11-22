import { describe, expect, it } from 'vitest'
import { buildEvidenceSummary } from '@/lib/analysis/evidenceSummary'
import type { PropertyAnalysis } from '@/lib/analysis/types'

const a = (country: string, band: boolean) => ({
  subjectProperty: { country },
  pricePositioning: { subjectAskingPrice: { amount: 180000, currency: 'USD' }, comparableListingRange: band ? { low: 1, high: 2, median: 1, currency: 'USD', sampleSize: 4 } : null },
  extractionQuality: { present: ['dormitorios', 'superficie cubierta'] },
  estimatedTransactionCost: { lines: [{ kind: 'ESTIMATED' }] },
  missingInformation: { items: [{ label: 'Expensas' }] },
  prioritizedRisks: [{ id: 'r1', title: 'Falta la antigüedad' }],
}) as unknown as PropertyAnalysis

describe('semáforo de evidencia', () => {
  it('separa sabido, estimado y a confirmar', () => {
    const s = buildEvidenceSummary(a('AR', true))
    expect(s.known[0]).toContain('USD')
    expect(s.estimated.join(' ')).toContain('precios pedidos')
    expect(s.toConfirm).toContain('Expensas')
    expect(s.toConfirm.join(' ')).toContain('escribano')
  })
  it('sin comparables lo dice y en México habla de notario', () => {
    const s = buildEvidenceSummary(a('MX', false))
    expect(s.estimated.join(' ')).toContain('faltan avisos')
    expect(s.toConfirm.join(' ')).toContain('notario')
  })
})
