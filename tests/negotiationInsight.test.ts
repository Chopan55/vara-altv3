/**
 * Negotiation Intelligence: lectura de la cadena de ofertas.
 * Hechos medibles separados de lecturas, sin sugerir nunca un monto, y honesto con lo que no sabe.
 * Ofertas sintéticas, sin red.
 */
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { analyzeNegotiation } from '@/lib/offers/negotiation'
import { NegotiationInsightCard } from '@/components/offers/NegotiationInsight'
import type { Offer, OfferParty, OfferStatus } from '@/lib/offers/model'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

let clock = 1_000
function offer(id: string, party: OfferParty, amount: number, status: OfferStatus, extra: Partial<Offer> = {}): Offer {
  return { id, operationId: 'op-1', party, status, amount, currency: 'USD', conditions: [], createdAt: ++clock, ...extra }
}
const TODAY = '2026-10-22'
const ASKING = 130_000

/** comprador 100k → vendedor 125k → comprador 110k (cadena de tres posiciones) */
function threeStep(): Offer[] {
  return [
    offer('a', 'BUYER', 100_000, 'COUNTERED'),
    offer('b', 'SELLER', 125_000, 'COUNTERED', { parentOfferId: 'a' }),
    offer('c', 'BUYER', 110_000, 'SENT', { parentOfferId: 'b' }),
  ]
}
const texts = (i: NonNullable<ReturnType<typeof analyzeNegotiation>>, c: 'FACT' | 'INFERENCE') => i.observations.filter(o => o.certainty === c).map(o => o.text).join(' | ')

describe('sin negociación que leer', () => {
  it('sin ofertas, o solo borradores, no hay lectura', () => {
    expect(analyzeNegotiation([])).toBeNull()
    expect(analyzeNegotiation([offer('d', 'BUYER', 100_000, 'DRAFT')])).toBeNull()
  })
})

describe('hechos medibles', () => {
  it('una sola oferta enviada: ronda 1, espera al vendedor y dice que todavía no puede leer la tendencia', () => {
    const i = analyzeNegotiation([offer('a', 'BUYER', 100_000, 'SENT')], { askingPrice: ASKING, today: TODAY })!
    expect(i.round).toBe(1)
    expect(i.state).toBe('OPEN')
    expect(i.waitingOn).toBe('SELLER')
    expect(i.gap).toBeNull()
    expect(i.momentum).toBe('UNKNOWN')
    expect(i.unknowns.join(' ')).toMatch(/menos de tres posiciones/)
    expect(i.options.map(o => o.id)).toEqual(['wait'])
  })

  it('tres posiciones: brecha, porcentaje del precio pedido, cuánto se cerró y cuánto se movió cada uno', () => {
    const i = analyzeNegotiation(threeStep(), { askingPrice: ASKING, today: TODAY })!
    expect(i.round).toBe(3)
    expect(i.lastBuyer).toBe(110_000)
    expect(i.lastSeller).toBe(125_000)
    expect(i.gap).toBe(15_000)
    expect(i.gapPercentOfAsking).toBe(11.5) // 15.000 / 130.000
    expect(i.closedPercent).toBe(40) // de 25.000 iniciales quedan 15.000
    expect(i.buyerMoved).toBe(10_000)
    expect(i.sellerMoved).toBe(5_000) // desde el precio pedido
    expect(i.momentum).toBe('CONVERGING')
    expect(i.waitingOn).toBe('SELLER')
  })

  it('si le toca a quien mira: puede aceptar o contraofertar, y se le dice la brecha como hecho', () => {
    const chain = [offer('a', 'BUYER', 100_000, 'COUNTERED'), offer('b', 'SELLER', 125_000, 'SENT', { parentOfferId: 'a' })]
    const i = analyzeNegotiation(chain, { askingPrice: ASKING, today: TODAY })!
    expect(i.waitingOn).toBe('BUYER')
    expect(i.options.map(o => o.id)).toEqual(['accept', 'counter'])
    expect(i.options[0].why).toContain('25.000')
  })

  it('desde el lado del vendedor las opciones se leen al revés', () => {
    const chain = [offer('a', 'BUYER', 100_000, 'SENT')]
    const i = analyzeNegotiation(chain, { askingPrice: ASKING, today: TODAY, viewer: 'SELLER' })!
    expect(i.waitingOn).toBe('SELLER')
    expect(i.options.map(o => o.id)).toEqual(['accept', 'counter'])
    expect(i.options[0].label).toContain('del comprador')
  })

  it('detecta estancamiento, alejamiento y ritmo decreciente', () => {
    const stalled = [offer('a', 'BUYER', 100_000, 'COUNTERED'), offer('b', 'SELLER', 120_000, 'COUNTERED', { parentOfferId: 'a' }), offer('c', 'BUYER', 100_000, 'SENT', { parentOfferId: 'b' })]
    expect(analyzeNegotiation(stalled, { today: TODAY })!.momentum).toBe('STALLED')
    const diverging = [offer('a', 'BUYER', 100_000, 'COUNTERED'), offer('b', 'SELLER', 120_000, 'COUNTERED', { parentOfferId: 'a' }), offer('c', 'BUYER', 95_000, 'SENT', { parentOfferId: 'b' })]
    expect(analyzeNegotiation(diverging, { today: TODAY })!.momentum).toBe('DIVERGING')
    const slow = [
      offer('a', 'BUYER', 100_000, 'COUNTERED'), offer('b', 'SELLER', 130_000, 'COUNTERED', { parentOfferId: 'a' }),
      offer('c', 'BUYER', 110_000, 'COUNTERED', { parentOfferId: 'b' }), offer('d', 'SELLER', 120_000, 'COUNTERED', { parentOfferId: 'c' }),
      offer('e', 'BUYER', 114_000, 'SENT', { parentOfferId: 'd' }),
    ]
    const s = analyzeNegotiation(slow, { today: TODAY })!
    expect(s.slowing.BUYER).toBe(true) // subió 10.000 y después 4.000
    expect(s.slowing.SELLER).toBe(false)
  })

  it('plazo: cuenta los días a partir de la fecha de hoy', () => {
    const o = [offer('a', 'BUYER', 100_000, 'SENT', { validUntil: '2026-10-24' })]
    const i = analyzeNegotiation(o, { today: TODAY })!
    expect(i.daysToExpiry).toBe(2)
    expect(texts(i, 'FACT')).toContain('vence en 2 días')
  })

  it('condiciones nuevas respecto de la posición anterior', () => {
    const chain = [
      offer('a', 'BUYER', 100_000, 'COUNTERED', { conditions: ['Sujeto a crédito'] }),
      offer('b', 'SELLER', 125_000, 'SENT', { parentOfferId: 'a', conditions: ['Sujeto a crédito', 'Entrega en 30 días'] }),
    ]
    const i = analyzeNegotiation(chain, { today: TODAY })!
    expect(i.newConditions).toEqual(['Entrega en 30 días'])
    expect(i.options.map(o => o.id)).toContain('review_conditions')
  })

  it('una negociación aceptada o cerrada no ofrece "esperar"', () => {
    const accepted = [offer('a', 'BUYER', 100_000, 'COUNTERED'), offer('b', 'SELLER', 110_000, 'ACCEPTED', { parentOfferId: 'a' })]
    const a = analyzeNegotiation(accepted, { today: TODAY })!
    expect(a.state).toBe('ACCEPTED')
    expect(a.options).toEqual([])
    const rejected = [offer('a', 'BUYER', 100_000, 'REJECTED')]
    const r = analyzeNegotiation(rejected, { today: TODAY })!
    expect(r.state).toBe('CLOSED')
    expect(r.options.map(o => o.id)).toEqual(['new_offer'])
  })
})

describe('honestidad: hechos vs lecturas, y lo que no sabe', () => {
  it('la tendencia es una lectura (INFERENCE), nunca un hecho', () => {
    const i = analyzeNegotiation(threeStep(), { askingPrice: ASKING, today: TODAY })!
    expect(texts(i, 'INFERENCE')).toMatch(/se está achicando/)
    expect(texts(i, 'FACT')).not.toMatch(/achicando|estancada|alejan|cada vez menos/)
  })

  it('sin precio pedido no inventa porcentajes y lo dice', () => {
    const i = analyzeNegotiation(threeStep(), { today: TODAY })!
    expect(i.gapPercentOfAsking).toBeNull()
    expect(i.unknowns.join(' ')).toMatch(/No hay precio pedido/)
    expect(texts(i, 'FACT')).not.toMatch(/del precio pedido/)
  })

  it('monedas mezcladas: no compara ni convierte', () => {
    const chain = [offer('a', 'BUYER', 100_000, 'COUNTERED', { currency: 'ARS' }), offer('b', 'SELLER', 125_000, 'SENT', { parentOfferId: 'a', currency: 'USD' })]
    const i = analyzeNegotiation(chain, { askingPrice: ASKING, today: TODAY })!
    expect(i.gap).toBeNull()
    expect(i.closedPercent).toBeNull()
    expect(i.unknowns.join(' ')).toMatch(/monedas distintas/)
  })

  it('nunca sugiere cuánto ofrecer: ninguna opción trae un monto propuesto', () => {
    const states: Offer[][] = [
      threeStep(),
      [offer('a', 'BUYER', 100_000, 'COUNTERED'), offer('b', 'SELLER', 125_000, 'SENT', { parentOfferId: 'a' })],
      [offer('a', 'BUYER', 100_000, 'REJECTED')],
    ]
    for (const chain of states) {
      const i = analyzeNegotiation(chain, { askingPrice: ASKING, today: TODAY })!
      const all = i.options.map(o => `${o.label} ${o.why}`).join(' ')
      expect(all).not.toMatch(/ofrec[eé]\s+(USD|ARS|\$)|te conviene ofrecer|monto (sugerido|ideal|óptimo)/i)
      // el punto medio es lo primero que se calcularía: no aparece
      expect(all).not.toContain('112.500')
      expect(Object.keys(i.options[0] ?? { id: 1, label: 1, why: 1 }).sort()).toEqual(['id', 'label', 'why'])
    }
  })
})

describe('tarjeta en la pestaña Ofertas', () => {
  it('muestra lo que sabemos, la lectura aparte, lo que no sabemos y las opciones', () => {
    const html = renderToStaticMarkup(createElement(NegotiationInsightCard, { offers: threeStep(), askingPrice: ASKING }))
    expect(html).toContain('La negociación sigue abierta')
    expect(html).toContain('Lo que sabemos')
    expect(html).toContain('Lectura de VARA (no es un hecho)')
    expect(html).toContain('VARA no sugiere cuánto ofrecer')
    expect(renderToStaticMarkup(createElement(NegotiationInsightCard, { offers: [] }))).toBe('')
  })

  it('está en la pestaña Ofertas de la operación y Labs ya no dice "en desarrollo" para NBA ni Negotiation', () => {
    expect(read('src/components/offers/OperationOffers.tsx')).toContain('<NegotiationInsightCard offers={offers} askingPrice={askingPrice} />')
    const labs = read('src/app/vara-labs/page.tsx')
    const card = (id: string) => {
      const at = labs.indexOf(`id: '${id}'`)
      return labs.slice(at, labs.indexOf('estado:', at) + 40)
    }
    expect(card('lf-012')).toContain("estado: 'LISTO'")
    expect(card('lf-009')).toContain("estado: 'LISTO'")
    // lo que sigue sin existir sigue marcado como tal
    for (const id of ['lf-011', 'lf-013', 'lf-014']) expect(card(id)).toContain("estado: 'EN_DESARROLLO'")
  })
})
