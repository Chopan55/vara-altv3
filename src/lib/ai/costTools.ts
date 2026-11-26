/**
 * Herramienta de cálculo para el asistente: «calcular_costos».
 * El modelo no hace cuentas de memoria: pide el cálculo con el precio que dio la persona y recibe los números exactos
 * de la misma función que usa la pantalla de Costos (`generateChecklist`). Sus argumentos se validan acá: lo que
 * manda el modelo nunca se usa sin revisar.
 */
import { generateChecklist, resolveProvinceCode } from '@/lib/regulations'
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
        cotizacion_ars: { type: 'number', description: 'Pesos por dólar que informó la persona, si dio una. No la inventes.' },
      },
      required: ['precio_usd'],
      additionalProperties: false,
    },
  },
}

const MIN_PRICE = 1_000
const MAX_PRICE = 100_000_000

export interface CostToolContext { province: string | null; country: CountryCode; audience?: 'BUY' | 'SELL' | 'BOTH' }

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
  const rate = typeof args.cotizacion_ars === 'number' && Number.isFinite(args.cotizacion_ars) && args.cotizacion_ars > 0 && args.cotizacion_ars < 1_000_000
    ? args.cotizacion_ars
    : null

  const code = resolveProvinceCode(ctx.province ?? '', ctx.country)
  const checklist = generateChecklist(code, 'BUY_PROPERTY', price, ctx.country)
  const c = checklist.costs
  const mx = ctx.country === 'MX'
  const line = (l: { minAmount: number; maxAmount: number }) => r(l.minAmount, l.maxAmount)

  const buyer = {
    [mx ? 'isai' : 'sellos']: line(c.stampTaxBuyer),
    [mx ? 'honorarios_notario' : 'honorarios_escribano']: line(c.notaryFeeBuyer),
    registro: line(c.registryFee),
    certificados_y_gestiones: line(c.certificates),
    total: r(c.totalBuyer.min, c.totalBuyer.max),
    total_porcentaje_del_precio: { min: Number(c.totalBuyer.percentMin.toFixed(2)), max: Number(c.totalBuyer.percentMax.toFixed(2)) },
  }
  const seller = {
    [mx ? 'isai' : 'sellos']: line(c.stampTaxSeller),
    [mx ? 'honorarios_notario' : 'honorarios_escribano']: line(c.notaryFeeSeller),
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
