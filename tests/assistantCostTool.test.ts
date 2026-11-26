import { describe, expect, it } from 'vitest'
import { COST_TOOL, COST_TOOL_NAME, runCostTool } from '@/lib/ai/costTools'
import { generateChecklist, resolveProvinceCode } from '@/lib/regulations'

const ar = { province: 'Buenos Aires', country: 'AR' as const, audience: 'BUY' as const }

describe('herramienta calcular_costos', () => {
  it('declara un solo parámetro obligatorio, el precio en USD', () => {
    expect(COST_TOOL.function.name).toBe(COST_TOOL_NAME)
    expect(COST_TOOL.function.parameters.required).toEqual(['precio_usd'])
    expect(COST_TOOL.function.parameters.additionalProperties).toBe(false)
  })

  it('devuelve los números de la misma función que usa la pantalla de Costos', () => {
    const out = runCostTool({ precio_usd: 150_000 }, ar)
    expect(out.ok).toBe(true)
    if (!out.ok) return
    const checklist = generateChecklist(resolveProvinceCode('Buenos Aires', 'AR'), 'BUY_PROPERTY', 150_000, 'AR')
    const comprador = out.result.comprador as { total: { min: number; max: number } }
    expect(comprador.total).toEqual({ min: Math.round(checklist.costs.totalBuyer.min), max: Math.round(checklist.costs.totalBuyer.max) })
    expect(out.result.jurisdiccion).toBe(checklist.provinceName)
    expect(out.result.confianza_de_los_datos).toBe(checklist.dataConfidence)
    expect(out.result).not.toHaveProperty('vendedor')
  })

  it('con cotización informada suma el total en pesos; sin ella, no inventa ninguna', () => {
    const withRate = runCostTool({ precio_usd: 100_000, cotizacion_ars: 1200 }, ar)
    const without = runCostTool({ precio_usd: 100_000 }, ar)
    expect(withRate.ok && withRate.result.en_pesos_con_la_cotizacion_informada).toMatchObject({ cotizacion_ars_por_usd: 1200 })
    expect(without.ok && without.result).not.toHaveProperty('en_pesos_con_la_cotizacion_informada')
  })

  it('para vendedores devuelve solo la parte vendedora y para ambos las dos', () => {
    const sell = runCostTool({ precio_usd: 100_000 }, { ...ar, audience: 'SELL' })
    expect(sell.ok && sell.result).toHaveProperty('vendedor')
    expect(sell.ok && sell.result).not.toHaveProperty('comprador')
    const both = runCostTool({ precio_usd: 100_000 }, { ...ar, audience: 'BOTH' })
    expect(both.ok && both.result).toHaveProperty('comprador')
    expect(both.ok && both.result).toHaveProperty('vendedor')
  })

  it('México usa ISAI y notario y no convierte a pesos argentinos', () => {
    const out = runCostTool({ precio_usd: 100_000, cotizacion_ars: 1200 }, { province: 'Ciudad de México', country: 'MX', audience: 'BUY' })
    expect(out.ok).toBe(true)
    if (!out.ok) return
    const text = JSON.stringify(out.result)
    expect(text).toContain('isai')
    expect(text).toContain('honorarios_notario')
    expect(text).not.toContain('sellos')
    expect(text).not.toContain('en_pesos')
  })

  it('rechaza argumentos inválidos del modelo sin calcular nada', () => {
    for (const bad of [{}, null, undefined, 'texto', { precio_usd: 'cien mil' }, { precio_usd: -5 }, { precio_usd: 10 }, { precio_usd: 1e12 }, { precio_usd: NaN }]) {
      expect(runCostTool(bad, ar).ok, JSON.stringify(bad)).toBe(false)
    }
  })

  it('ignora una cotización absurda en vez de usarla', () => {
    const out = runCostTool({ precio_usd: 100_000, cotizacion_ars: -3 }, ar)
    expect(out.ok && out.result).not.toHaveProperty('en_pesos_con_la_cotizacion_informada')
  })
})
