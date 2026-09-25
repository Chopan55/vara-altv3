/**
 * Precios.
 *
 * Lo que se verifica acá es que el cliente vea ANTES de contratar todo lo que
 * va a pagar, y que nadie pueda cobrar fuera de la banda publicada. Un precio
 * que aparece después es una traición a la promesa del producto.
 *
 * `now` se inyecta en todos los casos: un test de precios que depende del
 * reloj del sistema falla solo un martes a las 23:50 y nadie entiende por qué.
 */

import { describe, it, expect } from 'vitest'
import {
  quote, detectSurcharges, cancellationCharge, isRateWithinBand,
  formatVisitPrice, URGENCY_THRESHOLD_HOURS, DISTANCE_THRESHOLD_KM,
  type PriceContext,
} from '@/lib/varaVisit/pricing'
import { PRICE_BANDS, CANCELLATION_POLICY, bandFor, computePrice } from '@/types/varaVisit'

const NOW = new Date('2026-10-10T12:00:00')

function ctx(over: Partial<PriceContext> = {}): PriceContext {
  return {
    partnerRate: 30,
    currency: 'USD',
    durationMinutes: 30,
    date: '2026-10-20',   // 10 días después: sin urgencia
    time: '11:00',        // horario normal
    now: NOW,
    ...over,
  }
}

describe('bandas', () => {
  it('cada duración tiene su banda', () => {
    expect(bandFor(30).minPrice).toBe(25)
    expect(bandFor(60).minPrice).toBe(35)
    expect(bandFor(90).minPrice).toBe(50)
  })

  it('una duración desconocida cae en la primera banda, no rompe', () => {
    expect(bandFor(45)).toEqual(PRICE_BANDS[0])
  })

  it('valida si la tarifa del partner está dentro de la banda', () => {
    expect(isRateWithinBand(30, 30)).toBe(true)
    expect(isRateWithinBand(20, 30)).toBe(false)
    expect(isRateWithinBand(40, 30)).toBe(false)
  })
})

describe('el precio del partner se acota a la banda', () => {
  it('un precio por encima del máximo se recorta', () => {
    // Nadie cobra fuera de lo que VARA publicó.
    expect(quote(ctx({ partnerRate: 999 })).base).toBe(bandFor(30).maxPrice)
  })

  it('un precio por debajo del mínimo se sube', () => {
    // Tampoco hay carrera al fondo: el piso protege al partner.
    expect(quote(ctx({ partnerRate: 1 })).base).toBe(bandFor(30).minPrice)
  })

  it('un precio dentro de la banda se respeta', () => {
    expect(quote(ctx({ partnerRate: 32 })).base).toBe(32)
  })
})

describe('suplementos', () => {
  it('sin suplementos, el total es la base', () => {
    const q = quote(ctx())
    expect(q.lines).toHaveLength(0)
    expect(q.total).toBe(q.base)
  })

  it('urgencia cuando falta menos de 24 horas', () => {
    const q = quote(ctx({ date: '2026-10-10', time: '20:00' }))
    expect(q.appliedSurchargeIds).toContain('urgency')
    expect(q.total).toBeGreaterThan(q.base)
  })

  it('sin urgencia justo en el límite de 24 horas', () => {
    const q = quote(ctx({ date: '2026-10-11', time: '12:00' }))
    expect(q.appliedSurchargeIds).not.toContain('urgency')
  })

  it('horario especial temprano y tarde', () => {
    expect(detectSurcharges(ctx({ time: '08:00' })).map(s => s.id)).toContain('off_hours')
    expect(detectSurcharges(ctx({ time: '20:00' })).map(s => s.id)).toContain('off_hours')
  })

  it('horario normal no suma', () => {
    expect(detectSurcharges(ctx({ time: '09:00' })).map(s => s.id)).not.toContain('off_hours')
    expect(detectSurcharges(ctx({ time: '18:59' })).map(s => s.id)).not.toContain('off_hours')
  })

  it('distancia solo por encima del umbral', () => {
    expect(detectSurcharges(ctx({ distanceKm: DISTANCE_THRESHOLD_KM })).map(s => s.id))
      .not.toContain('distance')
    expect(detectSurcharges(ctx({ distanceKm: DISTANCE_THRESHOLD_KM + 1 })).map(s => s.id))
      .toContain('distance')
  })

  it('una fecha pasada no cuenta como urgente', () => {
    const q = quote(ctx({ date: '2026-01-01', time: '11:00' }))
    expect(q.appliedSurchargeIds).not.toContain('urgency')
  })

  it('los suplementos se acumulan', () => {
    const q = quote(ctx({ date: '2026-10-10', time: '21:00', distanceKm: 30 }))
    expect(q.appliedSurchargeIds).toEqual(['urgency', 'off_hours', 'distance'])
    expect(q.lines).toHaveLength(3)
  })
})

describe('desglose', () => {
  it('cada línea es explicable y las líneas suman el total', () => {
    const q = quote(ctx({ date: '2026-10-10', time: '21:00' }))
    for (const l of q.lines) {
      expect(l.label.length).toBeGreaterThan(0)
      expect(l.description.length).toBeGreaterThan(0)
      expect(l.amount).toBeGreaterThan(0)
    }
    const sum = q.base + q.lines.reduce((a, l) => a + l.amount, 0)
    expect(sum).toBe(q.total)
  })

  it('la política de cancelación viaja con el precio, no en letra chica', () => {
    expect(quote(ctx()).cancellationPolicy).toBe(CANCELLATION_POLICY.text)
  })

  it('el total coincide con computePrice', () => {
    const q = quote(ctx({ date: '2026-10-10', time: '20:00' }))
    expect(q.total).toBe(computePrice(q.base, q.appliedSurchargeIds))
  })
})

describe('cancelación', () => {
  it('gratis con más de 24 horas', () => {
    const r = cancellationCharge(100, '2026-10-20', '11:00', NOW)
    expect(r.free).toBe(true)
    expect(r.charge).toBe(0)
  })

  it('cobra la mitad dentro de las 24 horas', () => {
    const r = cancellationCharge(100, '2026-10-10', '20:00', NOW)
    expect(r.free).toBe(false)
    expect(r.charge).toBe(50)
  })

  it('el umbral coincide con la política publicada', () => {
    expect(CANCELLATION_POLICY.freeUntilHoursBefore).toBe(URGENCY_THRESHOLD_HOURS)
  })

  it('ante una fecha inválida no cobra', () => {
    // Si no podemos probar que fue tarde, no se cobra.
    expect(cancellationCharge(100, 'x', 'y', NOW).charge).toBe(0)
  })
})

describe('formato', () => {
  it('muestra moneda y monto', () => {
    expect(formatVisitPrice(1500, 'USD')).toContain('USD')
    expect(formatVisitPrice(1500, 'USD')).toContain('1.500')
  })
})
