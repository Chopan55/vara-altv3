/**
 * Referencia histórica de precio USD/m² por zona (2024–2025).
 * Fuente: portales AR (Zonaprop, Argenprop) + informes Reporte Inmobiliario.
 * Son rangos de mercado publicado — no escritura, no cierre.
 */

export interface PriceRange {
  min: number
  max: number
  label: string
}

const PRICE_REFERENCE: Record<string, PriceRange> = {
  'CABA':          { min: 1800, max: 2600, label: 'CABA' },
  'Buenos Aires':  { min: 900,  max: 1700, label: 'GBA / Prov. Bs. As.' },
  'Córdoba':       { min: 800,  max: 1400, label: 'Córdoba' },
  'Santa Fe':      { min: 700,  max: 1200, label: 'Santa Fe' },
  'Mendoza':       { min: 700,  max: 1100, label: 'Mendoza' },
  'Tucumán':       { min: 600,  max: 1000, label: 'Tucumán' },
  'Rosario':       { min: 900,  max: 1500, label: 'Rosario' },
}

export function priceRef(province: string): PriceRange {
  return PRICE_REFERENCE[province] ?? { min: 600, max: 1100, label: province || 'Tu zona' }
}

export type PricePosition = 'BELOW' | 'AT' | 'ABOVE' | 'UNKNOWN'

/**
 * Calcula si el precio/m² está por debajo, dentro o por encima del rango de referencia.
 * Margen de ±10% para considerar "en línea con el mercado".
 */
export function analyzePricePosition(
  pricePerM2: number,
  province: string,
): { position: PricePosition; ref: PriceRange; delta: number | null } {
  if (!pricePerM2 || pricePerM2 <= 0) return { position: 'UNKNOWN', ref: priceRef(province), delta: null }

  const ref = priceRef(province)
  const mid = (ref.min + ref.max) / 2
  const TOLERANCE = 0.10
  const delta = Math.round(((pricePerM2 - mid) / mid) * 100)

  let position: PricePosition
  if (pricePerM2 < ref.min * (1 - TOLERANCE)) position = 'BELOW'
  else if (pricePerM2 > ref.max * (1 + TOLERANCE)) position = 'ABOVE'
  else position = 'AT'

  return { position, ref, delta }
}
