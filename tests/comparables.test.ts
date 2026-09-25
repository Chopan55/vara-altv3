/**
 * Comparables de mercado.
 *
 * Lo que se protege acá: que VARA **no se convierta en un tasador**. La
 * tentación es enorme —con diez avisos y una mediana sale un número que
 * parece autoridad— pero son precios *pedidos*, no de venta, y alguien puede
 * fijar el precio de su casa con eso.
 *
 * Los tests fijan tres cosas: que con pocos avisos no opine, que un aviso
 * incompleto se descarte entero, y que nunca diga cuánto vale una propiedad.
 */

import { describe, it, expect } from 'vitest'
import {
  fromMeliItem, analyzeMarketPosition, meliItemIdFromUrl, MIN_COMPARABLES, MARKET_CAVEAT,
  type Comparable, type MeliItem,
} from '@/lib/comparables/model'

function meli(over: Partial<MeliItem> = {}): MeliItem {
  return {
    id: 'MLA1', title: 'Casa en Pilar', price: 200_000, currency_id: 'USD',
    permalink: 'https://articulo.mercadolibre.com.ar/MLA1',
    attributes: [{ id: 'TOTAL_AREA', value_struct: { number: 100, unit: 'm²' } }],
    address: { neighborhood: 'La Lonja', city_name: 'Pilar' },
    ...over,
  }
}

/** Un comparable con el precio por m² que uno quiera. */
function comp(pricePerM2: number, over: Partial<Comparable> = {}): Comparable {
  return {
    id: `c-${pricePerM2}`, source: 'meli', title: 'Casa',
    price: pricePerM2 * 100, currency: 'USD', surface: 100,
    url: 'https://ejemplo.test', pricePerM2,
    ...over,
  }
}

function many(values: number[]): Comparable[] {
  return values.map((v, i) => comp(v, { id: `c-${i}` }))
}

describe('el id desde el link', () => {
  it('saca el id de un permalink', () => {
    expect(meliItemIdFromUrl('https://articulo.mercadolibre.com.ar/MLA-862376292-casa-_JM'))
      .toBe('MLA862376292')
  })

  it('acepta el formato sin guion', () => {
    expect(meliItemIdFromUrl('https://www.mercadolibre.com.ar/x/p/MLA862376292'))
      .toBe('MLA862376292')
  })

  it('funciona con subdominios de categoria', () => {
    expect(meliItemIdFromUrl('https://casa.mercadolibre.com.ar/MLA-1234567-x-_JM'))
      .toBe('MLA1234567')
  })

  it('un link de otro portal no es de MeLi', () => {
    expect(meliItemIdFromUrl('https://www.zonaprop.com.ar/propiedades/casa-123.html')).toBeNull()
  })

  it('un id suelto sin dominio no alcanza', () => {
    expect(meliItemIdFromUrl('MLA-862376292')).toBeNull()
  })

  it('un link de MeLi sin id devuelve null', () => {
    expect(meliItemIdFromUrl('https://www.mercadolibre.com.ar/ofertas')).toBeNull()
  })
})

describe('leer un aviso de MeLi', () => {
  it('saca precio, superficie y precio por m²', () => {
    const c = fromMeliItem(meli())
    expect(c?.price).toBe(200_000)
    expect(c?.surface).toBe(100)
    expect(c?.pricePerM2).toBe(2_000)
  })

  it('marca de dónde vino', () => {
    expect(fromMeliItem(meli())?.source).toBe('meli')
  })

  it('un aviso sin precio no es un comparable a medias: no es un comparable', () => {
    expect(fromMeliItem(meli({ price: 0 }))).toBeNull()
    expect(fromMeliItem(meli({ price: undefined }))).toBeNull()
  })

  it('sin link no sirve: el usuario tiene que poder ir a verlo', () => {
    expect(fromMeliItem(meli({ permalink: undefined }))).toBeNull()
  })

  it('sin superficie se guarda igual, pero sin precio por m²', () => {
    const c = fromMeliItem(meli({ attributes: [] }))
    expect(c).not.toBeNull()
    expect(c?.pricePerM2).toBeUndefined()
  })

  it('lee la superficie aunque venga como texto', () => {
    const c = fromMeliItem(meli({
      attributes: [{ id: 'TOTAL_AREA', value_name: '120' }],
    }))
    expect(c?.surface).toBe(120)
  })

  it('distingue pesos de dólares', () => {
    expect(fromMeliItem(meli({ currency_id: 'ARS' }))?.currency).toBe('ARS')
  })

  it('cae a la superficie cubierta si no hay total', () => {
    const c = fromMeliItem(meli({
      attributes: [{ id: 'COVERED_AREA', value_struct: { number: 80 } }],
    }))
    expect(c?.surface).toBe(80)
  })
})

describe('cuándo NO opinar', () => {
  it('con menos de cinco avisos no habla de mercado', () => {
    // Con tres, un outlier mueve la mediana entera.
    const r = analyzeMarketPosition(200_000, 100, many([1800, 1900, 2100]))
    expect(r.verdict).toBe('NOT_ENOUGH_DATA')
    expect(r.label).toMatch(/poco/i)
  })

  it('sin ningún aviso lo dice claro', () => {
    const r = analyzeMarketPosition(200_000, 100, [])
    expect(r.verdict).toBe('NOT_ENOUGH_DATA')
    expect(r.sampleSize).toBe(0)
  })

  it('el mínimo es cinco', () => {
    const r = analyzeMarketPosition(200_000, 100, many([1800, 1900, 2000, 2100, 2200]))
    expect(MIN_COMPARABLES).toBe(5)
    expect(r.verdict).not.toBe('NOT_ENOUGH_DATA')
  })

  it('sin superficie propia no compara, aunque haya mercado', () => {
    const r = analyzeMarketPosition(200_000, 0, many([1800, 1900, 2000, 2100, 2200]))
    expect(r.verdict).toBe('NOT_ENOUGH_DATA')
    expect(r.label).toMatch(/superficie/i)
  })

  it('los avisos en otra moneda no se mezclan', () => {
    // Comparar USD contra ARS daría un número sin sentido.
    const mixed = [
      ...many([1800, 1900]),
      ...many([500_000, 520_000, 540_000]).map(c => ({ ...c, currency: 'ARS' as const })),
    ]
    const r = analyzeMarketPosition(200_000, 100, mixed, 'USD')
    expect(r.verdict).toBe('NOT_ENOUGH_DATA')
    expect(r.sampleSize).toBe(2)
  })

  it('un aviso sin precio por m² no cuenta para la muestra', () => {
    const list = [...many([1800, 1900, 2000, 2100]), comp(0, { pricePerM2: undefined })]
    expect(analyzeMarketPosition(200_000, 100, list).verdict).toBe('NOT_ENOUGH_DATA')
  })
})

describe('dónde cae tu precio', () => {
  const market = many([1600, 1800, 2000, 2200, 2400]) // mediana 2000

  it('usa la mediana, no el promedio', () => {
    // Un outlier de 10.000 movería el promedio, no la mediana.
    const conOutlier = many([1600, 1800, 2000, 2200, 10_000])
    expect(analyzeMarketPosition(200_000, 100, conOutlier).medianPricePerM2).toBe(2_000)
  })

  it('en línea cuando está cerca de la mediana', () => {
    const r = analyzeMarketPosition(200_000, 100, market) // 2000/m²
    expect(r.verdict).toBe('WITHIN')
    expect(r.differencePercent).toBe(0)
  })

  it('por encima cuando se pasa del 10%', () => {
    const r = analyzeMarketPosition(250_000, 100, market) // 2500/m²
    expect(r.verdict).toBe('ABOVE')
    expect(r.label).toMatch(/por encima/)
  })

  it('por debajo cuando baja más del 10%', () => {
    const r = analyzeMarketPosition(150_000, 100, market) // 1500/m²
    expect(r.verdict).toBe('BELOW')
    expect(r.label).toMatch(/por debajo/)
  })

  it('una diferencia del 5% sigue siendo "en línea"', () => {
    // Fingir precisión al 1% sobre precios pedidos sería falso.
    const r = analyzeMarketPosition(210_000, 100, market)
    expect(r.verdict).toBe('WITHIN')
  })

  it('informa el rango completo, no solo la mediana', () => {
    const r = analyzeMarketPosition(200_000, 100, market)
    expect(r.minPricePerM2).toBe(1_600)
    expect(r.maxPricePerM2).toBe(2_400)
  })

  it('NUNCA dice cuánto vale la propiedad', () => {
    // Es la línea que no se cruza: esto no es una tasación.
    for (const price of [100_000, 200_000, 400_000]) {
      const r = analyzeMarketPosition(price, 100, market)
      expect(r.label).not.toMatch(/vale|deberías pedir|tasación|valor real/i)
    }
  })

  it('el label siempre aclara que habla de lo publicado', () => {
    const r = analyzeMarketPosition(250_000, 100, market)
    expect(r.label).toMatch(/publica/i)
  })
})

describe('la advertencia', () => {
  it('dice que son precios pedidos, no de venta', () => {
    expect(MARKET_CAVEAT).toMatch(/pedidos/i)
    expect(MARKET_CAVEAT).toMatch(/no.*venta/i)
  })

  it('admite que no sabemos hace cuánto están publicados', () => {
    expect(MARKET_CAVEAT).toMatch(/cuánto/i)
  })
})
