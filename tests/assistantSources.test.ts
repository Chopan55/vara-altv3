import { describe, expect, it } from 'vitest'
import { buildSources } from '@/lib/ai/sources'

describe('en qué se basa la respuesta', () => {
  it('sin datos verificados declara conocimiento general y pide confirmar con un profesional', () => {
    const s = buildSources({ operation: null, cost: null, knowledgeTitles: [] })
    expect(s).toHaveLength(1)
    expect(s[0].kind).toBe('general')
    expect(s[0].detail).toMatch(/profesional/)
  })

  it('con una operación verificada la cita con su etapa y los documentos pendientes', () => {
    const s = buildSources({ operation: { stage: 'RESERVA', documentCount: 2 }, cost: null, knowledgeTitles: [] })
    expect(s[0]).toMatchObject({ kind: 'operation', label: 'Tu operación en VARA' })
    expect(s[0].detail).toContain('etapa RESERVA')
    expect(s[0].detail).toContain('2 documentos pendientes o en revisión')
    expect(s.some(x => x.kind === 'general')).toBe(false)
  })

  it('un documento pendiente va en singular y un fallo al verificar se dice', () => {
    expect(buildSources({ operation: { stage: null, documentCount: 1 }, cost: null, knowledgeTitles: [] })[0].detail).toBe('1 documento pendiente o en revisión')
    expect(buildSources({ operation: { stage: null, documentCount: null }, cost: null, knowledgeTitles: [] })[0].detail).toBe('documentos sin verificar')
  })

  it('la calculadora declara jurisdicción, confianza y fecha, y lleva a la pantalla de Costos', () => {
    const s = buildSources({ operation: null, cost: { jurisdiction: 'Buenos Aires', confidence: 'PARTIAL', updatedAt: '2026-10-01' }, knowledgeTitles: [] })
    expect(s[0]).toMatchObject({ kind: 'calculator', href: '/dinero?tab=costos' })
    expect(s[0].detail).toBe('Buenos Aires · datos parciales · actualizados 2026-10-01')
  })

  it('las guías se deduplican y se limitan a tres', () => {
    const s = buildSources({ operation: null, cost: null, knowledgeTitles: ['A', 'A', 'B', 'C', 'D'] })
    expect(s[0].detail).toBe('A · B · C')
  })
})
