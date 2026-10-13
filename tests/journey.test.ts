import { describe, it, expect } from 'vitest'
import { deriveJourney, journeyToStored, pickActiveOperation } from '@/lib/journey'

const buy = { id: 'b1', type: 'BUY' as const }
const sell = { id: 's1', type: 'SELL' as const }

describe('recorrido del usuario', () => {
  it('la elección explícita manda sobre las operaciones', () => {
    expect(deriveJourney('SELL_PROPERTY', [buy], 'b1')).toBe('SELL')
    expect(deriveJourney('BUY_PROPERTY', [sell], 's1')).toBe('BUY')
  })

  it('sin elección se deduce de la operación seleccionada o la primera', () => {
    expect(deriveJourney('', [sell], null)).toBe('SELL')
    expect(deriveJourney('', [buy, sell], 's1')).toBe('SELL')
    expect(deriveJourney('', [buy, sell], null)).toBe('BUY')
  })

  it('sin nada se asume compra', () => {
    expect(deriveJourney('', [], null)).toBe('BUY')
  })

  it('la operación activa es siempre del recorrido actual', () => {
    expect(pickActiveOperation([sell], null, 'BUY')).toBeNull()
    expect(pickActiveOperation([buy, sell], 's1', 'SELL')).toBe(sell)
    expect(pickActiveOperation([buy, sell], 's1', 'BUY')).toBe(buy)
    const s2 = { id: 's2', type: 'SELL' as const }
    expect(pickActiveOperation([sell, s2], 's2', 'SELL')).toBe(s2)
    expect(pickActiveOperation([sell, s2], 'otro', 'SELL')).toBe(sell)
  })

  it('guarda el valor que ya espera el resto de la app', () => {
    expect(journeyToStored('SELL')).toBe('SELL_PROPERTY')
    expect(journeyToStored('BUY')).toBe('BUY_PROPERTY')
  })
})
