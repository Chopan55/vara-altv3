import { describe, expect, it } from 'vitest'
import { costFacts, costIntent, effectiveCountry, provinceFromContext } from '@/lib/ai/costFacts'
import { generateChecklist, resolveProvinceCode } from '@/lib/regulations'

describe('costos del asistente desde la calculadora', () => {
  it('detecta preguntas de costos y no otras', () => {
    for (const q of ['¿Cuánto cuesta escriturar en Buenos Aires?', 'Qué impuestos paga el vendedor', 'Cuánto es el sellado', 'honorarios del escribano', 'gastos de la operación']) {
      expect(costIntent(q), q).toBe(true)
    }
    for (const q of ['Me apuran para señar', '¿Qué me falta para avanzar?', 'hola']) {
      expect(costIntent(q), q).toBe(false)
    }
  })

  it('lee la provincia del contexto de pantalla', () => {
    expect(provinceFromContext('Recorrido: compra · Provincia: Córdoba')).toBe('Córdoba')
    expect(provinceFromContext(undefined)).toBeNull()
    expect(provinceFromContext('sin dato')).toBeNull()
  })

  it('para Argentina usa la jurisdicción, la confianza y la fecha de la calculadora', () => {
    const code = resolveProvinceCode('Buenos Aires', 'AR')
    const checklist = generateChecklist(code, 'BUY_PROPERTY', 100_000, 'AR')
    const text = costFacts({ province: 'Buenos Aires', country: 'AR', audience: 'BUY' })
    expect(text).toContain('CALCULADORA DE VARA')
    expect(text).toContain(`Jurisdicción usada: ${checklist.provinceName}.`)
    expect(text).toContain(`Confianza de los datos: ${checklist.dataConfidence}`)
    expect(text).toContain(`Última actualización: ${checklist.lastUpdated}`)
    expect(text).toContain('Comprador')
    expect(text).not.toContain('Vendedor (')
    expect(text).toContain('sellos')
    expect(text).toContain('escribano')
  })

  it('para venta muestra solo la parte vendedora y para ambos las dos', () => {
    expect(costFacts({ province: 'Buenos Aires', country: 'AR', audience: 'SELL' })).toContain('Vendedor (')
    expect(costFacts({ province: 'Buenos Aires', country: 'AR', audience: 'SELL' })).not.toContain('Comprador (')
    const both = costFacts({ province: 'Buenos Aires', country: 'AR', audience: 'BOTH' })
    expect(both).toContain('Comprador (')
    expect(both).toContain('Vendedor (')
  })

  it('para México usa ISAI y notario, nunca sellos ni escribano', () => {
    const text = costFacts({ province: 'Ciudad de México', country: 'MX', audience: 'BUY' })
    expect(text).toContain('ISAI')
    expect(text).toContain('notario')
    expect(text).not.toMatch(/sellos|escribano/)
  })

  it('sin provincia lo avisa y usa la jurisdicción por defecto', () => {
    expect(costFacts({ province: null, country: 'AR', audience: 'BUY' })).toContain('no se informó la provincia')
  })

  it('incluye la regla de no citar otros valores de memoria', () => {
    expect(costFacts({ province: 'Buenos Aires', country: 'AR' })).toContain('usá solo estos valores')
  })

  it('en México el vendedor no paga ISAI: es del comprador, y el ISR queda fuera', () => {
    const sell = costFacts({ province: 'Ciudad de México', country: 'MX', audience: 'SELL' })
    expect(sell).toContain('honorarios del notario')
    expect(sell).toContain('El ISAI lo paga el comprador')
    expect(sell).toContain('ISR del vendedor no está incluido')
    expect(sell).not.toMatch(/Vendedor \(sobre el precio de la propiedad\): ISAI/)
    expect(sell).not.toMatch(/sellos|escribano/)
  })

  it('si la provincia es mexicana el país es México aunque llegue como Argentina', () => {
    const text = costFacts({ province: 'Ciudad de México', country: 'AR', audience: 'BUY' })
    expect(text).toContain('ISAI')
    expect(text).toContain('notario')
    expect(text).not.toMatch(/sellos|escribano/)
  })

  it('una provincia argentina con país México mantiene el país indicado', () => {
    expect(effectiveCountry('Córdoba', 'AR')).toBe('AR')
    expect(effectiveCountry(null, 'MX')).toBe('MX')
    expect(effectiveCountry('Ciudad de México', 'AR')).toBe('MX')
  })
})
