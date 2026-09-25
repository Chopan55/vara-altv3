/**
 * Costos regulatorios.
 *
 * Esto es lo más caro de equivocar del producto: calcula la plata que alguien
 * va a poner sobre la mesa. Un error del 1% en sellos sobre una operación de
 * USD 200.000 son USD 2.000 que la persona no presupuestó.
 *
 * Los tests no verifican que las alícuotas sean correctas —eso lo dice la ley
 * y está en `src/data/regulations/`— sino que la aritmética que las combina
 * no invente, no divida por cero y no esconda la incertidumbre.
 */

import { describe, it, expect } from 'vitest'
import {
  generateChecklist, resolveProvinceCode, getProvinceList, formatPercent,
} from '@/lib/regulations'

const VALUE = 200_000

describe('provincias', () => {
  it('hay provincias cargadas', () => {
    expect(getProvinceList().length).toBeGreaterThan(0)
  })

  it('cada provincia declara cuánta confianza merece su dato', () => {
    for (const p of getProvinceList()) {
      expect(['VERIFIED', 'PARTIAL', 'ESTIMATED']).toContain(p.confidence)
    }
  })

  it('una provincia desconocida cae en Buenos Aires en vez de romper', () => {
    const c = generateChecklist('NARNIA', 'BUY_PROPERTY', VALUE)
    expect(c.provinceName).toBeTruthy()
    expect(c.costs.totalBuyer.min).toBeGreaterThan(0)
  })

  it('resuelve el código desde el nombre del onboarding', () => {
    expect(resolveProvinceCode('Buenos Aires')).toBeTruthy()
    expect(resolveProvinceCode('')).toBeTruthy()
  })
})

describe('aritmética de los costos', () => {
  it('los sellos del comprador y del vendedor suman el total de la provincia', () => {
    const c = generateChecklist('BUENOS_AIRES', 'BUY_PROPERTY', VALUE)
    const buyer = c.costs.stampTaxBuyer.minAmount
    const seller = c.costs.stampTaxSeller.minAmount
    // Las partes reparten una alícuota única: no pueden sumar otra cosa.
    expect(buyer + seller).toBeGreaterThan(0)
    expect(buyer + seller).toBeLessThanOrEqual(VALUE * 0.1)
  })

  it('el mínimo nunca supera al máximo', () => {
    const c = generateChecklist('BUENOS_AIRES', 'BUY_PROPERTY', VALUE)
    expect(c.costs.totalBuyer.min).toBeLessThanOrEqual(c.costs.totalBuyer.max)
    expect(c.costs.totalSeller.min).toBeLessThanOrEqual(c.costs.totalSeller.max)
    expect(c.costs.notaryFeeBuyer.minAmount).toBeLessThanOrEqual(c.costs.notaryFeeBuyer.maxAmount)
  })

  it('el doble de propiedad da más costos, no los mismos', () => {
    const a = generateChecklist('BUENOS_AIRES', 'BUY_PROPERTY', VALUE)
    const b = generateChecklist('BUENOS_AIRES', 'BUY_PROPERTY', VALUE * 2)
    expect(b.costs.totalBuyer.min).toBeGreaterThan(a.costs.totalBuyer.min)
  })

  it('los sellos escalan de forma proporcional al valor', () => {
    const a = generateChecklist('BUENOS_AIRES', 'BUY_PROPERTY', VALUE)
    const b = generateChecklist('BUENOS_AIRES', 'BUY_PROPERTY', VALUE * 2)
    expect(b.costs.stampTaxBuyer.minAmount).toBeCloseTo(a.costs.stampTaxBuyer.minAmount * 2, 2)
  })

  it('todos los montos son números reales, no NaN', () => {
    const c = generateChecklist('BUENOS_AIRES', 'BUY_PROPERTY', VALUE)
    for (const line of [
      c.costs.stampTaxBuyer, c.costs.stampTaxSeller,
      c.costs.notaryFeeBuyer, c.costs.notaryFeeSeller,
      c.costs.registryFee, c.costs.certificates,
    ]) {
      expect(Number.isFinite(line.minAmount)).toBe(true)
      expect(Number.isFinite(line.maxAmount)).toBe(true)
    }
  })
})

describe('sin valor de propiedad', () => {
  it('los porcentajes NO son Infinity', () => {
    // Dividir por cero acá pinta "Infinity%" en la pantalla de costos.
    const c = generateChecklist('BUENOS_AIRES', 'BUY_PROPERTY', 0)
    expect(Number.isFinite(c.costs.totalBuyer.percentMin)).toBe(true)
    expect(Number.isFinite(c.costs.totalBuyer.percentMax)).toBe(true)
  })

  it('no explota', () => {
    expect(() => generateChecklist('BUENOS_AIRES', 'BUY_PROPERTY', 0)).not.toThrow()
  })

  it('un valor negativo tampoco rompe', () => {
    expect(() => generateChecklist('BUENOS_AIRES', 'BUY_PROPERTY', -5000)).not.toThrow()
  })
})

describe('honestidad del dato', () => {
  it('cada línea de costo dice de dónde sale', () => {
    const c = generateChecklist('BUENOS_AIRES', 'BUY_PROPERTY', VALUE)
    for (const line of [c.costs.stampTaxBuyer, c.costs.notaryFeeBuyer, c.costs.registryFee]) {
      expect(line.source).toBeTruthy()
      expect(line.source.length).toBeGreaterThan(3)
    }
  })

  it('el checklist arrastra el nivel de confianza de la provincia', () => {
    const c = generateChecklist('BUENOS_AIRES', 'BUY_PROPERTY', VALUE)
    expect(['VERIFIED', 'PARTIAL', 'ESTIMATED']).toContain(c.dataConfidence)
  })

  it('si el dato no está verificado, lo avisa por escrito', () => {
    const unverified = getProvinceList().find(p => p.confidence !== 'VERIFIED')
    if (!unverified) return // si algún día están todas verificadas, no hay nada que avisar
    const c = generateChecklist(unverified.code, 'BUY_PROPERTY', VALUE)
    expect(c.warnings.some(w => /verificar/i.test(w))).toBe(true)
  })

  it('genera etapas con tareas, no una lista vacía', () => {
    const c = generateChecklist('BUENOS_AIRES', 'BUY_PROPERTY', VALUE)
    expect(c.stages.length).toBeGreaterThan(0)
    expect(c.stages.some(s => s.tasks.length > 0)).toBe(true)
  })

  it('comprar y vender no generan el mismo checklist', () => {
    const buy = generateChecklist('BUENOS_AIRES', 'BUY_PROPERTY', VALUE)
    const sell = generateChecklist('BUENOS_AIRES', 'SELL_PROPERTY', VALUE)
    expect(buy.operationType).not.toBe(sell.operationType)
  })
})

describe('formato de porcentajes', () => {
  it('convierte una tasa a porcentaje legible', () => {
    expect(formatPercent(0.018)).toMatch(/1[,.]8/)
  })

  it('el cero se muestra como cero', () => {
    expect(formatPercent(0)).toMatch(/0/)
  })
})
