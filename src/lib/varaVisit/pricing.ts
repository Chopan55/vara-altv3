/**
 * Precio de una visita.
 *
 * Regla del proyecto, la misma que rige los costos regulatorios: **los montos
 * no se hardcodean en pantallas**. Las bandas y los suplementos viven en
 * `src/types/varaVisit.ts` (PRICE_BANDS, PRICE_SURCHARGES) y acá se aplican.
 *
 * Lo que el cliente ve antes de contratar es el desglose completo, no un total
 * suelto. Si un suplemento no se puede explicar en una línea, no se cobra.
 *
 * Nota: `formatVisitPrice` es de este módulo. No confundir con `formatPrice`
 * de `src/lib/utils.ts`, que formatea precios de propiedades.
 */

import {
  CANCELLATION_POLICY,
  PRICE_SURCHARGES,
  bandFor,
  computePrice,
  type PriceSurcharge,
  type VisitCurrency,
} from '@/types/varaVisit'

export interface PriceContext {
  /** Precio base del partner, ya dentro de la banda. */
  partnerRate: number
  currency: VisitCurrency
  durationMinutes: number
  /** YYYY-MM-DD */
  date: string
  /** HH:MM */
  time: string
  /** Momento desde el que se mide la urgencia. Inyectable para testear. */
  now?: Date
  /** Distancia estimada. Cuando haya geocoding real esto deja de ser opcional. */
  distanceKm?: number
}

export interface PriceLine {
  label: string
  description: string
  /** Monto que suma esta línea sobre el acumulado anterior. */
  amount: number
}

export interface PriceBreakdown {
  base: number
  lines: PriceLine[]
  total: number
  currency: VisitCurrency
  appliedSurchargeIds: string[]
  /** Texto de cancelación, para mostrarlo junto al precio y no en letra chica. */
  cancellationPolicy: string
}

export const URGENCY_THRESHOLD_HOURS = 24
export const OFF_HOURS_BEFORE = 9
export const OFF_HOURS_AFTER = 19
export const DISTANCE_THRESHOLD_KM = 15

/** Postgres devuelve `time` como HH:MM:SS; los formularios mandan HH:MM. */
function parseWhen(date: string, time: string): Date | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(time.trim())
  if (!m) return null
  const d = new Date(`${date}T${m[1].padStart(2, '0')}:${m[2]}:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Qué suplementos aplican. Se decide con datos, no con criterio del operador:
 * si el mismo pedido puede costar distinto según quién lo cargue, el precio
 * deja de ser confiable.
 */
export function detectSurcharges(ctx: PriceContext): PriceSurcharge[] {
  const out: PriceSurcharge[] = []
  const when = parseWhen(ctx.date, ctx.time)
  const now = ctx.now ?? new Date()

  if (when) {
    const hoursAhead = (when.getTime() - now.getTime()) / 3_600_000
    if (hoursAhead >= 0 && hoursAhead < URGENCY_THRESHOLD_HOURS) {
      const s = PRICE_SURCHARGES.find(x => x.id === 'urgency')
      if (s) out.push(s)
    }
    const hour = when.getHours()
    if (hour < OFF_HOURS_BEFORE || hour >= OFF_HOURS_AFTER) {
      const s = PRICE_SURCHARGES.find(x => x.id === 'off_hours')
      if (s) out.push(s)
    }
  }

  if (ctx.distanceKm !== undefined && ctx.distanceKm > DISTANCE_THRESHOLD_KM) {
    const s = PRICE_SURCHARGES.find(x => x.id === 'distance')
    if (s) out.push(s)
  }

  return out
}

/**
 * Desglose completo. Cada línea es un monto que el cliente puede entender
 * y discutir, no un ajuste invisible dentro del total.
 */
export function quote(ctx: PriceContext): PriceBreakdown {
  const band = bandFor(ctx.durationMinutes)
  // El precio del partner se acota a la banda: nadie cobra fuera del rango
  // que VARA publicó, ni por arriba ni por abajo.
  const base = Math.min(Math.max(ctx.partnerRate, band.minPrice), band.maxPrice)

  const surcharges = detectSurcharges(ctx)
  const lines: PriceLine[] = []

  let running = base
  for (const s of surcharges) {
    const next = Math.round(running * s.multiplier)
    lines.push({ label: s.label, description: s.description, amount: next - running })
    running = next
  }

  return {
    base,
    lines,
    total: computePrice(base, surcharges.map(s => s.id)),
    currency: ctx.currency,
    appliedSurchargeIds: surcharges.map(s => s.id),
    cancellationPolicy: CANCELLATION_POLICY.text,
  }
}

/**
 * Cuánto se cobra si el cliente cancela ahora.
 * Gratis hasta 24 horas antes; después, la mitad.
 */
export function cancellationCharge(
  total: number,
  date: string,
  time: string,
  now: Date = new Date(),
): { charge: number; free: boolean; hoursBefore: number } {
  const when = parseWhen(date, time)
  if (!when) return { charge: 0, free: true, hoursBefore: Infinity }

  const hoursBefore = (when.getTime() - now.getTime()) / 3_600_000
  const free = hoursBefore >= CANCELLATION_POLICY.freeUntilHoursBefore
  return {
    charge: free ? 0 : Math.round(total * CANCELLATION_POLICY.lateCancellationChargeRate),
    free,
    hoursBefore,
  }
}

/** ¿El precio que quiere cobrar el partner está dentro de lo que VARA publica? */
export function isRateWithinBand(rate: number, durationMinutes: number): boolean {
  const band = bandFor(durationMinutes)
  return rate >= band.minPrice && rate <= band.maxPrice
}

export function formatVisitPrice(amount: number, currency: VisitCurrency): string {
  return `${currency} ${amount.toLocaleString('es-AR')}`
}
