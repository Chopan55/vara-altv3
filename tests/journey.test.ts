import { describe, it, expect } from 'vitest'
import { deriveJourney, journeyToStored, pickActiveOperation, resolveOperationContext } from '@/lib/journey'

const buy = { id: 'b1', type: 'BUY' as const }
const sell = { id: 's1', type: 'SELL' as const }

describe('recorrido del usuario', () => {
  it('la elecciÃ³n explÃ­cita manda sobre las operaciones', () => {
    expect(deriveJourney('SELL_PROPERTY', [buy], 'b1')).toBe('SELL')
    expect(deriveJourney('BUY_PROPERTY', [sell], 's1')).toBe('BUY')
  })

  it('sin elecciÃ³n se deduce de la operaciÃ³n seleccionada o la primera', () => {
    expect(deriveJourney('', [sell], null)).toBe('SELL')
    expect(deriveJourney('', [buy, sell], 's1')).toBe('SELL')
    expect(deriveJourney('', [buy, sell], null)).toBe('BUY')
  })

  it('sin nada se asume compra', () => {
    expect(deriveJourney('', [], null)).toBe('BUY')
  })

  it('la operaciÃ³n activa es siempre del recorrido actual', () => {
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

describe('resolveOperationContext: Ãºnica fuente de la operaciÃ³n activa', () => {
  const ops = [
    { id: '02b705f0-aaaa', type: 'BUY' as const },
    { id: 'op-171-xyz', type: 'SELL' as const },
  ]

  it('un id guardado que no existe (stale) se ignora y nunca llega a un enlace', () => {
    const r = resolveOperationContext(ops, { journeyType: 'BUY_PROPERTY', selectedId: 'e205f828-no-existe' })
    expect(r.activeOperationId).toBe('02b705f0-aaaa')
    expect(ops.some(o => o.id === r.activeOperationId)).toBe(true)
  })

  it('sin operaciones no hay operaciÃ³n activa: estado vacÃ­o, no un id inventado', () => {
    const r = resolveOperationContext([], { journeyType: 'SELL_PROPERTY', selectedId: '02b705f0-aaaa' })
    expect(r.activeOperationId).toBeNull()
    expect(r.activeOperation).toBeNull()
  })

  it('la operaciÃ³n activa es siempre del recorrido actual', () => {
    expect(resolveOperationContext(ops, { journeyType: 'SELL_PROPERTY', selectedId: '02b705f0-aaaa' }).activeOperationId).toBe('op-171-xyz')
    expect(resolveOperationContext(ops, { journeyType: 'BUY_PROPERTY', selectedId: 'op-171-xyz' }).activeOperationId).toBe('02b705f0-aaaa')
  })

  it('abrir una operaciÃ³n de venta fija el contexto vendedor; una de compra, comprador', () => {
    const sell = resolveOperationContext(ops, { journeyType: 'BUY_PROPERTY', selectedId: null, pathOperationId: 'op-171-xyz' })
    expect(sell.journey).toBe('SELL')
    expect(sell.activeOperationId).toBe('op-171-xyz')
    const buy = resolveOperationContext(ops, { journeyType: 'SELL_PROPERTY', selectedId: null, pathOperationId: '02b705f0-aaaa' })
    expect(buy.journey).toBe('BUY')
  })

  it('una ruta con un id que no existe no cambia el contexto ni inventa una operaciÃ³n', () => {
    const r = resolveOperationContext(ops, { journeyType: 'BUY_PROPERTY', selectedId: null, pathOperationId: 'no-existe' })
    expect(r.journey).toBe('BUY')
    expect(r.activeOperationId).toBe('02b705f0-aaaa')
  })
})
