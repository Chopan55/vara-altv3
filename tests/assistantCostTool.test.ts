import { describe, expect, it } from 'vitest'
import { COST_TOOL, COST_TOOL_NAME, pricesFromUserMessages, runCostTool } from '@/lib/ai/costTools'
import { generateChecklist, resolveProvinceCode } from '@/lib/regulations'

const ar = { province: 'Buenos Aires', country: 'AR' as const, audience: 'BUY' as const, allowedPrices: [150_000, 100_000] }

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
    const out = runCostTool({ precio_usd: 100_000, cotizacion_ars: 1200 }, { province: 'Ciudad de México', country: 'MX', audience: 'BUY', allowedPrices: [100_000] })
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

  it('en México el vendedor no tiene ISAI ni sellos: solo notario, y se avisa del ISR', () => {
    const out = runCostTool({ precio_usd: 100_000 }, { province: 'Ciudad de México', country: 'MX', audience: 'SELL', allowedPrices: [100_000] })
    expect(out.ok).toBe(true)
    if (!out.ok) return
    const vendedor = out.result.vendedor as Record<string, unknown>
    expect(Object.keys(vendedor)).toEqual(expect.arrayContaining(['honorarios_notario', 'total_sin_isr', 'nota']))
    expect(JSON.stringify(vendedor)).not.toMatch(/isai"|sellos|escribano/)
    expect(String(vendedor.nota)).toContain('ISR')
  })

  it('con provincia mexicana y país argentino usa México', () => {
    const out = runCostTool({ precio_usd: 100_000, cotizacion_ars: 1200 }, { province: 'Ciudad de México', country: 'AR', audience: 'BUY', allowedPrices: [100_000] })
    expect(out.ok).toBe(true)
    if (!out.ok) return
    const text = JSON.stringify(out.result)
    expect(text).toContain('isai')
    expect(text).not.toMatch(/sellos|escribano|en_pesos/)
  })

  it('rechaza un precio que el modelo inventó: no coincide con lo que dijo la persona ni con la propiedad', () => {
    const out = runCostTool({ precio_usd: 200_000 }, ar)
    expect(out.ok).toBe(false)
    expect(!out.ok && out.error).toMatch(/pedile el precio/)
    expect(runCostTool({ precio_usd: 152_000 }, ar).ok).toBe(false) // 1,3 % de diferencia: no es redondeo
  })

  it('acepta el precio con una diferencia de redondeo menor al 0,5 %', () => {
    expect(runCostTool({ precio_usd: 150_400 }, ar).ok).toBe(true)
  })

  it('sin ningún precio permitido no calcula nada', () => {
    expect(runCostTool({ precio_usd: 150_000 }, { ...ar, allowedPrices: [] }).ok).toBe(false)
  })

  it('los precios permitidos salen de los mensajes de la persona, en distintos formatos, y no de los del asistente', () => {
    const prices = pricesFromUserMessages([
      { role: 'user', content: 'Estoy mirando una casa de USD 150.000, tal vez de 180 mil.' },
      { role: 'assistant', content: 'Con USD 999.000 sería distinto.' },
      { role: 'user', content: 'o una de U$S 1,2 millones' },
    ])
    expect(prices).toEqual(expect.arrayContaining([150_000, 180_000, 1_200_000]))
    expect(prices).not.toContain(999_000)
  })

  describe('qué cuenta como precio dicho por la persona', () => {
    const price = (text: string) => pricesFromUserMessages([{ role: 'user', content: text }])

    it('acepta dólares con o sin marca de moneda en distintos formatos', () => {
      expect(price('Una casa de USD 150.000')).toContain(150_000)
      expect(price('cuesta 150.000 dólares')).toContain(150_000)
      expect(price('U$S 1,2 millones')).toContain(1_200_000)
      expect(price('pedían 180 mil')).toContain(180_000)
      expect(price('es de 150.000')).toContain(150_000) // sin moneda pero plausible como precio
      expect(price('valor 95000')).toContain(95_000)
    })

    it('descarta montos en pesos aunque sean grandes', () => {
      expect(price('Me piden $150.000.000')).toEqual([])
      expect(price('son 120.000.000 pesos')).toEqual([])
      expect(price('ARS 90.000.000')).toEqual([])
      expect(price('AR$ 90.000.000')).toEqual([])
    })

    it('descarta años, teléfonos, documentos y montos que no pueden ser un precio', () => {
      expect(price('en 2026 firmo')).toEqual([])
      expect(price('llamame al 1122334455')).toEqual([])
      expect(price('mi DNI es 30123456')).toEqual([])
      expect(price('pago 5.000 de expensas')).toEqual([]) // por debajo de un precio plausible sin marca de dólares
      expect(price('son 3 ambientes y 2 baños')).toEqual([])
    })

    it('un monto chico con marca de dólares sí cuenta; el precio del asistente nunca', () => {
      expect(price('USD 5.000 de seña')).toContain(5_000)
      expect(pricesFromUserMessages([{ role: 'assistant', content: 'Con USD 999.000 sería distinto.' }])).toEqual([])
    })

    it('el año no se cuela como precio permitido para el cálculo', () => {
      const out = runCostTool({ precio_usd: 2026 }, { ...ar, allowedPrices: price('en 2026 compro') })
      expect(out.ok).toBe(false)
    })
  })
})
