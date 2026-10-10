import { describe, it, expect } from 'vitest'
import { encodeDiscard, summarizeDiscards } from '@/lib/candidates/discard'

describe('motivos de descarte', () => {
  it('codifica motivos y nota', () => {
    expect(encodeDiscard(['Precio', 'Ruido'])).toBe('Precio, Ruido')
    expect(encodeDiscard(['Luz'], ' muy oscura ')).toBe('Luz — muy oscura')
    expect(encodeDiscard([], 'solo nota')).toBe('solo nota')
    expect(encodeDiscard([])).toBe('')
  })

  it('resume lo que más se repite e ignora texto libre y no descartadas', () => {
    const r = summarizeDiscards([
      { status: 'DISCARDED', discardReason: 'Precio, Ruido' },
      { status: 'DISCARDED', discardReason: 'Precio — carísima' },
      { status: 'DISCARDED', discardReason: 'me dio mala espina' },
      { status: 'ANALYZING', discardReason: 'Luz' },
      { status: 'DISCARDED' },
    ])
    expect(r).toEqual([{ reason: 'Precio', count: 2 }, { reason: 'Ruido', count: 1 }])
  })
})
