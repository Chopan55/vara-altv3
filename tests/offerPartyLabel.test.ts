import { describe, it, expect } from 'vitest'
import { offerPartyLabel } from '@/components/offers/RealOffersPanel'

describe('palabras de las ofertas según el recorrido', () => {
  it('en venta habla desde el vendedor', () => {
    expect(offerPartyLabel('BUYER', 'SELL')).toBe('Oferta del comprador')
    expect(offerPartyLabel('SELLER', 'SELL')).toBe('Tu contraoferta')
  })

  it('en compra habla desde el comprador', () => {
    expect(offerPartyLabel('BUYER', 'BUY')).toBe('Ofreciste vos')
    expect(offerPartyLabel('SELLER', 'BUY')).toBe('Contraoferta del vendedor')
  })
})
