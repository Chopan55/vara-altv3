import { priceRef } from '@/lib/market/priceReference'

/**
 * Estrategia de precio para vender. Usa la referencia histórica USD/m² por
 * provincia (rangos de portales publicados), NO comparables reales ni precios de
 * cierre. Por eso todo sale como rango y como punto de partida a revisar.
 */
export interface PricingPlan {
  reference: { min: number; max: number; label: string }
  /** Rango de publicación según la referencia por m². */
  range: { min: number; max: number }
  /** Punto de partida sugerido (mitad del rango). */
  start: number
  /** Precio al que revisar si tras el período inicial hay poco interés. */
  fallback: number
  /** Dónde cae el precio que quiere el vendedor respecto del rango. */
  desired?: { price: number; position: 'BELOW' | 'IN' | 'ABOVE'; vsStartPct: number }
}

const round = (n: number) => Math.round(n / 1000) * 1000
const FALLBACK_CUT = 0.05

export function planPricing(surfaceM2: number, province: string, desiredPrice?: number): PricingPlan | null {
  if (!Number.isFinite(surfaceM2) || surfaceM2 <= 0) return null
  const ref = priceRef(province)
  const range = { min: round(ref.min * surfaceM2), max: round(ref.max * surfaceM2) }
  const start = round((range.min + range.max) / 2)
  const plan: PricingPlan = { reference: ref, range, start, fallback: round(start * (1 - FALLBACK_CUT)) }
  if (desiredPrice && desiredPrice > 0) {
    plan.desired = {
      price: desiredPrice,
      position: desiredPrice < range.min ? 'BELOW' : desiredPrice > range.max ? 'ABOVE' : 'IN',
      vsStartPct: Math.round(((desiredPrice - start) / start) * 100),
    }
  }
  return plan
}

export interface Monitoring { daysListed: number; inquiries: number; visits: number; offers: number }

/** Lectura de la publicación a partir de números que carga el vendedor. Sin datos de mercado inventados. */
export function readListing(m: Monitoring): { tone: 'wait' | 'ok' | 'review'; text: string } {
  if (m.offers > 0) return { tone: 'ok', text: 'Ya hay ofertas: el precio y la presentación están funcionando. Pasá a evaluarlas y negociar.' }
  if (m.daysListed < 21) return { tone: 'wait', text: 'Todavía es pronto. Dale al menos 3 semanas antes de tocar el precio.' }
  if (m.inquiries === 0) return { tone: 'review', text: 'Pasaron más de 3 semanas sin consultas. Revisá primero la presentación (fotos, título, descripción) y el precio.' }
  if (m.visits === 0 || m.visits / m.inquiries < 0.2) return { tone: 'review', text: 'Hay interés pero pocas visitas. Conviene revisar el precio o cómo presentás la propiedad.' }
  return { tone: 'ok', text: 'Hay consultas y visitas pero sin ofertas todavía. Pedí devoluciones a quienes visitaron antes de cambiar nada.' }
}
