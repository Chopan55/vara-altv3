import { describe, it, expect } from 'vitest'
import { sanitizeDocSummary, isPdfPath, summaryTone } from '@/lib/documents/summary'

describe('sanitizeDocSummary', () => {
  it('reconstruye la respuesta y descarta basura', () => {
    const s = sanitizeDocSummary({
      holders: ['Juan Pérez', 3, ''], encumbrances: 'hipoteca', restrictions: null,
      alerts: ['Revisar inhibición'], excerpt: 'ESCRITURA NÚMERO 123. En la ciudad de Pilar, a los...',
    })
    expect(s).toEqual({
      holders: ['Juan Pérez'], encumbrances: [], restrictions: [], alerts: ['Revisar inhibición'],
      excerpt: 'ESCRITURA NÚMERO 123. En la ciudad de Pilar, a los...', readable: true,
    })
  })

  it('un documento sin texto extraído no es legible (no es "sin cargas")', () => {
    const s = sanitizeDocSummary({ holders: [], encumbrances: [], restrictions: [], alerts: [], excerpt: '' })!
    expect(s.readable).toBe(false)
    expect(summaryTone(s)).toBe('unreadable')
  })

  it('respeta readable: false del modelo', () => {
    expect(sanitizeDocSummary({ holders: ['X'], excerpt: 'texto suficiente para pasar el umbral de cuarenta letras', readable: false })!.readable).toBe(false)
  })

  it('rechaza lo que no es un objeto', () => {
    expect(sanitizeDocSummary('hola')).toBeNull()
    expect(sanitizeDocSummary(null)).toBeNull()
  })
})

describe('summaryTone', () => {
  const base = { holders: ['A'], encumbrances: [], restrictions: [], alerts: [], excerpt: 'x'.repeat(50), readable: true }
  it('las cargas ganan sobre las alertas', () => {
    expect(summaryTone({ ...base, encumbrances: ['Hipoteca'], alerts: ['Revisar'] })).toBe('issues')
  })
  it('alertas sin cargas, y limpio', () => {
    expect(summaryTone({ ...base, alerts: ['Revisar'] })).toBe('alerts')
    expect(summaryTone(base)).toBe('clear')
  })
})

describe('isPdfPath', () => {
  it('no distingue mayúsculas', () => {
    expect(isPdfPath('u/escritura.PDF')).toBe(true)
    expect(isPdfPath('u/escritura.pdf')).toBe(true)
    expect(isPdfPath('u/escritura.jpg')).toBe(false)
    expect(isPdfPath(null)).toBe(false)
  })
})
