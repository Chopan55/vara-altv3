import { describe, it, expect } from 'vitest'
import { scrubWalkAway, walkAwayAmounts } from '@/lib/negotiation/walkAway'

describe('walkAwayAmounts', () => {
  it('extrae el monto del límite escrito a mano', () => {
    expect(walkAwayAmounts('no pagar más de USD 130.000')).toEqual([130000])
    expect(walkAwayAmounts('máximo 130k')).toEqual([130000])
    expect(walkAwayAmounts('sin límite')).toEqual([])
  })
})

describe('scrubWalkAway', () => {
  const limit = 'no más de USD 130.000'

  it('tapa el límite en cualquier formato y en cualquier campo', () => {
    const out = scrubWalkAway({
      nextAction: 'Ofrecé USD 125.000 y no pases de USD 130.000.',
      strategy: 'Tu techo es 130000, o 130 mil, o 130k.',
      redFlags: ['Si piden 130,000 cortá'],
      nested: { text: 'U$S 130.000' },
    }, limit)
    const all = JSON.stringify(out)
    expect(all).not.toMatch(/130[.,]?000|130 ?mil|130k/)
    expect(out.nextAction).toContain('USD 125.000')
    expect(out.nextAction).toContain('[tu límite privado]')
  })

  it('no toca montos distintos ni respuestas sin límite cargado', () => {
    const r = { nextAction: 'Ofrecé USD 125.000' }
    expect(scrubWalkAway(r, limit)).toEqual(r)
    expect(scrubWalkAway({ a: 'USD 130.000' }, undefined)).toEqual({ a: 'USD 130.000' })
  })
})
