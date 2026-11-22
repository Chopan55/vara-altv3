import { describe, expect, it } from 'vitest'
import { buildNextSteps } from '@/lib/analysis/nextSteps'
import type { PropertyAnalysis } from '@/lib/analysis/types'

const a = (country: string, risks: unknown[], missing: unknown[]) => ({
  subjectProperty: { country },
  prioritizedRisks: risks,
  missingInformation: { items: missing },
}) as unknown as PropertyAnalysis

describe('tu plan para esta propiedad', () => {
  it('ordena: riesgo más grave, datos que faltan, escribano, visita', () => {
    const s = buildNextSteps(a('AR',
      [{ id: 'm', title: 'Expensas altas', reason: 'r', impact: 'MEDIUM' }, { id: 'h', title: 'Precio alto', reason: 'r2', impact: 'HIGH', nextAction: 'Negociá con los avisos' }],
      [{ label: 'Expensas', impact: 'LOW' }, { label: 'Antigüedad', impact: 'HIGH' }]))
    expect(s.map(x => x.id)).toEqual(['resolve', 'ask', 'professional', 'visit'])
    expect(s[0].title).toContain('Precio alto')
    expect(s[0].detail).toBe('Negociá con los avisos')
    expect(s[1].detail).toContain('antigüedad y expensas')
    expect(s[2].title).toContain('escribano')
    expect(s[3].href).toBe('/vara-visit')
  })
  it('sin riesgos ni faltantes quedan escribano y visita; en México habla de notario y de tú', () => {
    const s = buildNextSteps(a('MX', [], []))
    expect(s.map(x => x.id)).toEqual(['professional', 'visit'])
    expect(s[0].title).toContain('notario')
    expect(s[0].title).toContain('apartar')
    expect(s[1].detail).toContain('contratas')
  })
})
