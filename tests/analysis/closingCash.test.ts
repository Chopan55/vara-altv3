import { describe, expect, it } from 'vitest'
import { closingCash, parseRate } from '@/lib/analysis/closingCash'
import type { TransactionCost } from '@/lib/analysis/types'

const cost: TransactionCost = {
  jurisdiction: 'AR', notIncluded: [], assumptions: [],
  lines: [
    { id: 'price', label: 'Precio', kind: 'KNOWN', min: 200000, max: 200000, currency: 'USD', basis: 'Aviso' },
    { id: 'stamp', label: 'Sellos', kind: 'ESTIMATED', min: 3600, max: 3600, currency: 'USD', basis: 'x' },
    { id: 'notary', label: 'Escribano', kind: 'ESTIMATED', min: 1800, max: 3000, currency: 'USD', basis: 'x' },
  ],
  totalRange: { min: 205400, max: 206600, currency: 'USD' },
}

describe('plata para el cierre', () => {
  it('separa precio en dólares y gastos, y convierte con la cotización cargada', () => {
    const r = closingCash(cost, 1200)
    expect(r?.priceUSD).toBe(200000)
    expect(r?.feesUSD).toEqual({ min: 5400, max: 6600 })
    expect(r?.feesARS).toEqual({ min: 6480000, max: 7920000 })
  })
  it('sin cotización no inventa pesos', () => {
    expect(closingCash(cost, null)?.feesARS).toBeNull()
  })
  it('lee cotizaciones con puntos de miles', () => {
    expect(parseRate('1.250')).toBe(1250)
    expect(parseRate('1.250,5')).toBe(1250.5)
    expect(parseRate('')).toBeNull()
  })
  it('no aplica en México', () => {
    expect(closingCash({ ...cost, jurisdiction: 'MX' }, 20)).toBeNull()
  })
})
