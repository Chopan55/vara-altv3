import { describe, expect, it } from 'vitest'
import { buildProfessionalQuery } from '@/lib/analysis/professionalQuery'
import type { PropertyAnalysis } from '@/lib/analysis/types'

const base = (country: string) => ({
  subjectProperty: { country, url: 'https://ejemplo.com/aviso/1' },
  prioritizedRisks: [{ id: 'r1', title: 'El aviso no informa la superficie cubierta', reason: '', evidence: [], impact: 'HIGH', nextAction: 'pedí el plano' }],
  missingInformation: { items: [{ field: 'expenses', label: 'Expensas', why: '' }], draftMessage: null },
}) as unknown as PropertyAnalysis

describe('buildProfessionalQuery', () => {
  it('incluye riesgos, faltantes, papeles a pedir y el partido', () => {
    const m = buildProfessionalQuery(base('AR'), 'Pilar')
    expect(m).toContain('https://ejemplo.com/aviso/1')
    expect(m).toContain('superficie cubierta')
    expect(m).toContain('expensas')
    expect(m).toContain('informe de dominio')
    expect(m).toContain('Pilar')
  })
  it('usa el proceso mexicano en México', () => {
    const m = buildProfessionalQuery(base('MX'))
    expect(m).toContain('libertad de gravamen')
    expect(m).not.toContain('señar')
  })
})
