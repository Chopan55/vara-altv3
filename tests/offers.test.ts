/**
 * Ofertas.
 *
 * Lo que se protege acá: que VARA **no opine sobre la plata de nadie**.
 * Ofrecer un 30% menos del precio pedido es una estrategia legítima, y el
 * producto no está para desalentarla — solo para decir, con un número
 * verificable, cuánto es esa diferencia.
 *
 * El otro invariante es la cadena: una contraoferta nunca pisa a la anterior.
 */

import { describe, it, expect } from 'vitest'
import {
  checkOffer, offerGap, canTransitionOffer, currentOffer, offerChain,
  sortOffers, isOpen, isClosed, isExpired, offerNextStep, daysUntil, expiringSoon,
  type Offer, type OfferStatus,
} from '@/lib/offers/model'

const TODAY = '2026-03-20'

function offer(over: Partial<Offer> = {}): Offer {
  return {
    id: 'of-1', operationId: 'op-1', party: 'BUYER', status: 'SENT',
    amount: 185_000, currency: 'USD', conditions: [],
    createdAt: 1_700_000_000_000,
    ...over,
  }
}

function draft(over: Partial<Parameters<typeof checkOffer>[0]> = {}) {
  return { amount: 185_000, currency: 'USD' as const, conditions: [], ...over }
}

describe('validación', () => {
  it('una oferta con monto y plazo pasa', () => {
    const r = checkOffer(draft({ validUntil: '2026-04-10' }), { today: TODAY })
    expect(r.ok).toBe(true)
    expect(r.errors).toEqual([])
  })

  it('sin monto no se puede enviar', () => {
    expect(checkOffer(draft({ amount: 0 }), { today: TODAY }).ok).toBe(false)
  })

  it('una fecha ya pasada es un error', () => {
    const r = checkOffer(draft({ validUntil: '2026-03-01' }), { today: TODAY })
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toMatch(/ya pasó/)
  })

  it('una fecha mal escrita es un error', () => {
    expect(checkOffer(draft({ validUntil: '10/04/2026' }), { today: TODAY }).ok).toBe(false)
  })

  it('sin plazo se avisa, pero se puede enviar', () => {
    const r = checkOffer(draft(), { today: TODAY })
    expect(r.ok).toBe(true)
    expect(r.warnings.join(' ')).toMatch(/sin plazo/i)
  })

  it('ofrecer MUY por debajo del pedido NO es un error ni un aviso', () => {
    // Es una estrategia. VARA no está para desalentarla.
    const r = checkOffer(draft({ amount: 90_000, validUntil: '2026-04-10' }), {
      askingPrice: 200_000, today: TODAY,
    })
    expect(r.ok).toBe(true)
    expect(r.warnings).toEqual([])
  })

  it('ofrecer más que el precio pedido sí se avisa', () => {
    const r = checkOffer(draft({ amount: 220_000, validUntil: '2026-04-10' }), {
      askingPrice: 200_000, today: TODAY,
    })
    expect(r.ok).toBe(true)
    expect(r.warnings.join(' ')).toMatch(/más que el precio pedido/)
  })

  it('una condición vacía se rechaza', () => {
    const r = checkOffer(draft({ conditions: ['Sujeto a crédito', '  '] }), { today: TODAY })
    expect(r.ok).toBe(false)
  })

  it('vencer hoy se avisa', () => {
    const r = checkOffer(draft({ validUntil: TODAY }), { today: TODAY })
    expect(r.ok).toBe(true)
    expect(r.warnings.join(' ')).toMatch(/vence hoy/)
  })
})

describe('diferencia contra el precio pedido', () => {
  it('calcula el porcentaje por debajo', () => {
    const g = offerGap(180_000, 200_000)
    expect(g?.difference).toBe(-20_000)
    expect(g?.percent).toBe(-10)
    expect(g?.label).toMatch(/10% por debajo/)
  })

  it('calcula el porcentaje por encima', () => {
    expect(offerGap(210_000, 200_000)?.label).toMatch(/5% por encima/)
  })

  it('una oferta igual al pedido lo dice sin porcentaje', () => {
    expect(offerGap(200_000, 200_000)?.label).toBe('Igual al precio pedido')
  })

  it('sin precio publicado no hay diferencia que mostrar', () => {
    // Un 0% acá sería mentira: no hay referencia contra la cual comparar.
    expect(offerGap(180_000, undefined)).toBeNull()
    expect(offerGap(180_000, 0)).toBeNull()
  })

  it('redondea a un decimal', () => {
    expect(offerGap(185_000, 200_000)?.percent).toBe(-7.5)
  })
})

describe('estados', () => {
  it('un borrador se puede enviar', () => {
    expect(canTransitionOffer('DRAFT', 'SENT')).toBe(true)
  })

  it('una enviada ya no vuelve a borrador', () => {
    expect(canTransitionOffer('SENT', 'DRAFT')).toBe(false)
  })

  it('lo cerrado es terminal: se negocia con una oferta nueva', () => {
    for (const from of ['ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED'] as OfferStatus[]) {
      for (const to of ['SENT', 'COUNTERED', 'ACCEPTED', 'DRAFT'] as OfferStatus[]) {
        expect(canTransitionOffer(from, to)).toBe(false)
      }
    }
  })

  it('abiertas vs cerradas', () => {
    expect(isOpen(offer({ status: 'SENT' }))).toBe(true)
    expect(isOpen(offer({ status: 'COUNTERED' }))).toBe(true)
    expect(isClosed(offer({ status: 'REJECTED' }))).toBe(true)
  })
})

describe('vencimiento', () => {
  it('una enviada con fecha pasada está vencida', () => {
    expect(isExpired(offer({ validUntil: '2026-03-01' }), TODAY)).toBe(true)
  })

  it('sin fecha nunca vence', () => {
    expect(isExpired(offer(), TODAY)).toBe(false)
  })

  it('una ya aceptada no vence aunque pase la fecha', () => {
    // El acuerdo ya existe: el plazo era para contestar.
    expect(isExpired(offer({ status: 'ACCEPTED', validUntil: '2026-03-01' }), TODAY)).toBe(false)
  })

  it('el mismo día todavía vale', () => {
    expect(isExpired(offer({ validUntil: TODAY }), TODAY)).toBe(false)
  })
})

describe('dónde está parada la negociación', () => {
  it('si hay una aceptada, esa manda', () => {
    const list = [
      offer({ id: 'a', status: 'SENT', createdAt: 3000 }),
      offer({ id: 'b', status: 'ACCEPTED', createdAt: 1000 }),
    ]
    expect(currentOffer(list)?.id).toBe('b')
  })

  it('sin aceptada, gana la abierta más reciente', () => {
    const list = [
      offer({ id: 'vieja', status: 'SENT', createdAt: 1000 }),
      offer({ id: 'nueva', status: 'COUNTERED', createdAt: 2000 }),
      offer({ id: 'muerta', status: 'REJECTED', createdAt: 3000 }),
    ]
    expect(currentOffer(list)?.id).toBe('nueva')
  })

  it('si todo está cerrado, no hay oferta actual', () => {
    expect(currentOffer([offer({ status: 'REJECTED' })])).toBeNull()
  })

  it('sin ofertas, null', () => {
    expect(currentOffer([])).toBeNull()
  })
})

describe('la cadena de la negociación', () => {
  it('reconstruye de la más vieja a la más nueva', () => {
    const list = [
      offer({ id: 'o1', amount: 170_000, createdAt: 1000 }),
      offer({ id: 'o2', amount: 190_000, parentOfferId: 'o1', party: 'SELLER', createdAt: 2000 }),
      offer({ id: 'o3', amount: 180_000, parentOfferId: 'o2', createdAt: 3000 }),
    ]
    expect(offerChain(list, 'o3').map(o => o.id)).toEqual(['o1', 'o2', 'o3'])
  })

  it('una contraoferta NO borra la anterior', () => {
    const list = [
      offer({ id: 'o1', amount: 170_000 }),
      offer({ id: 'o2', amount: 190_000, parentOfferId: 'o1' }),
    ]
    const chain = offerChain(list, 'o2')
    expect(chain).toHaveLength(2)
    expect(chain[0].amount).toBe(170_000)
  })

  it('una oferta suelta es una cadena de uno', () => {
    expect(offerChain([offer({ id: 'x' })], 'x').map(o => o.id)).toEqual(['x'])
  })

  it('un padre que no existe corta la cadena sin romper', () => {
    const list = [offer({ id: 'o2', parentOfferId: 'fantasma' })]
    expect(offerChain(list, 'o2').map(o => o.id)).toEqual(['o2'])
  })

  it('un ciclo no cuelga', () => {
    const list = [
      offer({ id: 'a', parentOfferId: 'b' }),
      offer({ id: 'b', parentOfferId: 'a' }),
    ]
    expect(offerChain(list, 'a')).toHaveLength(2)
  })

  it('ordena de la más nueva a la más vieja', () => {
    const list = [offer({ id: 'v', createdAt: 1000 }), offer({ id: 'n', createdAt: 2000 })]
    expect(sortOffers(list).map(o => o.id)).toEqual(['n', 'v'])
  })

  it('no muta la lista original', () => {
    const list = [offer({ id: 'v', createdAt: 1000 }), offer({ id: 'n', createdAt: 2000 })]
    sortOffers(list)
    expect(list.map(o => o.id)).toEqual(['v', 'n'])
  })
})

describe('vencimientos próximos', () => {
  it('cuenta los días que faltan', () => {
    expect(daysUntil('2026-03-25', TODAY)).toBe(5)
    expect(daysUntil(TODAY, TODAY)).toBe(0)
  })

  it('una fecha pasada da negativo', () => {
    expect(daysUntil('2026-03-15', TODAY)).toBe(-5)
  })

  it('sin fecha no hay cuenta regresiva', () => {
    expect(daysUntil(undefined, TODAY)).toBeNull()
  })

  it('lista solo las abiertas que vencen dentro del plazo', () => {
    const list = [
      offer({ id: 'pronto', validUntil: '2026-03-22' }),
      offer({ id: 'lejos', validUntil: '2026-05-01' }),
      offer({ id: 'cerrada', status: 'REJECTED', validUntil: '2026-03-22' }),
      offer({ id: 'sinfecha' }),
    ]
    expect(expiringSoon(list, 7, TODAY).map(o => o.id)).toEqual(['pronto'])
  })

  it('la más urgente primero', () => {
    const list = [
      offer({ id: 'b', validUntil: '2026-03-24' }),
      offer({ id: 'a', validUntil: '2026-03-21' }),
    ]
    expect(expiringSoon(list, 7, TODAY).map(o => o.id)).toEqual(['a', 'b'])
  })

  it('una ya vencida no figura como "por vencer"', () => {
    const list = [offer({ id: 'x', validUntil: '2026-03-01' })]
    expect(expiringSoon(list, 7, TODAY)).toEqual([])
  })
})

describe('siguiente paso', () => {
  it('una vencida lo dice aunque figure como enviada', () => {
    const msg = offerNextStep(offer({ validUntil: '2026-03-01' }), TODAY)
    expect(msg).toMatch(/venció/)
  })

  it('cada estado dice algo accionable', () => {
    for (const s of ['DRAFT', 'SENT', 'COUNTERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED'] as OfferStatus[]) {
      expect(offerNextStep(offer({ status: s }), TODAY).length).toBeGreaterThan(0)
    }
  })
})
