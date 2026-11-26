/**
 * Herramienta de cálculo para el asistente: «calcular_costos».
 * El modelo no hace cuentas de memoria: pide el cálculo con el precio que dio la persona y recibe los números exactos
 * de la misma función que usa la pantalla de Costos (`generateChecklist`). Sus argumentos se validan acá: lo que
 * manda el modelo nunca se usa sin revisar.
 */
import { generateChecklist, resolveProvinceCode } from '@/lib/regulations'
import { effectiveCountry } from './costFacts'
import type { CountryCode } from '@/types'

export const COST_TOOL_NAME = 'calcular_costos'

export const COST_TOOL = {
  type: 'function' as const,
  function: {
    name: COST_TOOL_NAME,
    description:
      'Calcula los costos de escrituración de la operación (sellos o ISAI, honorarios del escribano o notario, registro y certificados) para un precio dado, con los valores de la calculadora de VARA. Usala siempre que la persona mencione un precio; no hagas la cuenta de memoria.',
    parameters: {
      type: 'object',
      properties: {
        precio_usd: { type: 'number', description: 'Precio de la propiedad en dólares (USD).' },
        cotizacion_ars: { type: 'number', description: 'Pesos por dólar que informó la persona, si dio una, como número sin puntos de miles (1.250 → 1250). No la inventes.' },
      },
      required: ['precio_usd'],
      additionalProperties: false,
    },
  },
}

const MIN_PRICE = 1_000
const MAX_PRICE = 100_000_000

export interface CostToolContext {
  province: string | null
  country: CountryCode
  audience?: 'BUY' | 'SELL' | 'BOTH'
  /** Precios en dólares que el cálculo puede usar: los que dijo la persona y el de su propiedad registrada. Nada más. */
  allowedPrices: number[]
}

const USD_MARK = /(?:U\$S|US\$|\bUSD\b|d[oó]lar(?:es)?|\bu\$s\b)/i
const ARS_AFTER = /^\s*(?:pesos?|ARS\b)/i
const ARS_BEFORE = /(?:\bAR\$|\bARS\b|(?:^|[^A-Za-z])\$)\s*$/i
const AMOUNT = /(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d{1,2})?)(?:\s*(mil\b|k\b|millones?\b|M\b))?/gi

function amountValue(token: string, suffix: string | undefined): number | null {
  let n: number
  if (/^\d{1,3}(?:\.\d{3})+$/.test(token)) n = Number(token.replace(/\./g, ''))
  else if (/^\d{1,3}(?:,\d{3})+$/.test(token)) n = Number(token.replace(/,/g, ''))
  else n = Number(token.replace(',', '.'))
  if (!Number.isFinite(n)) return null
  const unit = suffix?.toLowerCase()
  if (unit === 'mil' || unit === 'k') n *= 1_000
  else if (unit && (unit.startsWith('millon') || unit === 'm')) n *= 1_000_000
  return n
}

/**
 * Precios en dólares que la persona escribió en sus propios mensajes (lo que dijo el asistente no cuenta).
 * Se descartan los montos en pesos («$», «pesos», «ARS»), los años (2026), los teléfonos y los números que no pueden ser
 * un precio de propiedad. Un monto sin moneda se acepta solo si es plausible como precio en dólares.
 */
export function pricesFromUserMessages(messages: { role: string; content: string }[]): number[] {
  const prices: number[] = []
  for (const message of messages) {
    if (message.role !== 'user') continue
    const text = message.content
    for (const match of text.matchAll(AMOUNT)) {
      const index = match.index ?? 0
      const end = index + match[0].length
      const before = text.slice(Math.max(0, index - 12), index)
      const after = text.slice(end, end + 14)
      if (ARS_BEFORE.test(before) && !USD_MARK.test(before)) continue
      if (ARS_AFTER.test(after) && !USD_MARK.test(before)) continue
      const hasUsd = USD_MARK.test(before) || USD_MARK.test(after)
      const bare = !match[2] && !/[.,]/.test(match[1])
      const value = amountValue(match[1], match[2])
      if (value === null || value < 1_000 || value > 100_000_000) continue
      if (!hasUsd) {
        if (value < 10_000) continue
        if (bare && value >= 1900 && value <= 2100) continue // un año
        if (bare && match[1].length >= 8) continue // teléfono, DNI, código
      }
      prices.push(value)
    }
  }
  return prices
}

const sameAmount = (a: number, b: number) => b > 0 && Math.abs(a - b) / b < 0.005

type Range = { min: number; max: number }
const r = (min: number, max: number): Range => ({ min: Math.round(min), max: Math.round(max) })

export type CostToolResult =
  | { ok: true; result: Record<string, unknown> }
  | { ok: false; error: string }

export function runCostTool(rawArgs: unknown, ctx: CostToolContext): CostToolResult {
  const args = (rawArgs && typeof rawArgs === 'object' ? rawArgs : {}) as { precio_usd?: unknown; cotizacion_ars?: unknown }
  const price = typeof args.precio_usd === 'number' ? args.precio_usd : NaN
  if (!Number.isFinite(price) || price < MIN_PRICE || price > MAX_PRICE) {
    return { ok: false, error: 'precio_usd inválido: pedile a la persona el precio en dólares.' }
  }
  // El modelo no puede inventar la base del cálculo: el precio tiene que salir de lo que dijo la persona o de su propiedad registrada.
  if (!ctx.allowedPrices.some(allowed => sameAmount(price, allowed))) {
    return { ok: false, error: 'precio_usd no coincide con ningún precio que haya dicho la persona ni con el de su propiedad registrada: pedile el precio en dólares.' }
  }
  const rate = typeof args.cotizacion_ars === 'number' && Number.isFinite(args.cotizacion_ars) && args.cotizacion_ars > 0 && args.cotizacion_ars < 1_000_000
    ? args.cotizacion_ars
    : null

  const country = effectiveCountry(ctx.province, ctx.country)
  const code = resolveProvinceCode(ctx.province ?? '', country)
  const checklist = generateChecklist(code, 'BUY_PROPERTY', price, country)
  const c = checklist.costs
  const mx = country === 'MX'
  const line = (l: { minAmount: number; maxAmount: number }) => r(l.minAmount, l.maxAmount)

  const buyer = {
    [mx ? 'isai' : 'sellos']: line(c.stampTaxBuyer),
    [mx ? 'honorarios_notario' : 'honorarios_escribano']: line(c.notaryFeeBuyer),
    registro: line(c.registryFee),
    certificados_y_gestiones: line(c.certificates),
    total: r(c.totalBuyer.min, c.totalBuyer.max),
    total_porcentaje_del_precio: { min: Number(c.totalBuyer.percentMin.toFixed(2)), max: Number(c.totalBuyer.percentMax.toFixed(2)) },
  }
  // En México el ISAI lo paga el comprador: el vendedor solo tiene su parte del notario y el ISR queda fuera (lo calcula el notario).
  const seller = mx
    ? {
        honorarios_notario: line(c.notaryFeeSeller),
        total_sin_isr: r(c.notaryFeeSeller.minAmount, c.notaryFeeSeller.maxAmount),
        total_porcentaje_del_precio_sin_isr: {
          min: Number(((c.notaryFeeSeller.minAmount / price) * 100).toFixed(2)),
          max: Number(((c.notaryFeeSeller.maxAmount / price) * 100).toFixed(2)),
        },
        nota: 'El ISAI lo paga el comprador. El ISR del vendedor no está incluido: lo calcula el notario.',
      }
    : {
        sellos: line(c.stampTaxSeller),
        honorarios_escribano: line(c.notaryFeeSeller),
        total: r(c.totalSeller.min, c.totalSeller.max),
        total_porcentaje_del_precio: { min: Number(c.totalSeller.percentMin.toFixed(2)), max: Number(c.totalSeller.percentMax.toFixed(2)) },
      }

  const result: Record<string, unknown> = {
    jurisdiccion: checklist.provinceName,
    confianza_de_los_datos: checklist.dataConfidence,
    actualizado: checklist.lastUpdated,
    precio_usd: Math.round(price),
    moneda_de_los_valores: 'USD',
    ...(ctx.audience !== 'SELL' ? { comprador: buyer } : {}),
    ...(ctx.audience !== 'BUY' ? { vendedor: seller } : {}),
    aviso: 'Valores aproximados. No incluyen comisión inmobiliaria, ganancias ni gastos del crédito. Confirmalos con el profesional a cargo.',
  }
  if (!mx && rate && ctx.audience !== 'SELL') {
    result.en_pesos_con_la_cotizacion_informada = {
      cotizacion_ars_por_usd: rate,
      comprador_total_ars: r(c.totalBuyer.min * rate, c.totalBuyer.max * rate),
      nota: 'El escribano liquida los gastos en pesos al día de la escritura; la cotización la informó la persona, VARA no la inventa.',
    }
  }
  return { ok: true, result }
}
