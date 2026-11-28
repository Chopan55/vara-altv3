import { describe, it, expect } from 'vitest'
import { canAnalyzePastedText, parseAmount, parseListingText } from '@/lib/scrape/parseText'

describe('montos', () => {
  it('lee separadores de Argentina y de México', () => {
    expect(parseAmount('185.000')).toBe(185000)
    expect(parseAmount('4,500,000')).toBe(4500000)
    expect(parseAmount('1.234,56')).toBe(1234.56)
    expect(parseAmount('95,5')).toBe(95.5)
    expect(parseAmount('abc')).toBeUndefined()
  })
})

describe('aviso de Argentina pegado como texto', () => {
  const zonaprop = `Casa en venta en Pilar, barrio cerrado Los Robles
USD 385.000
Expensas $ 180.000
4 ambientes · 3 dormitorios · 2 baños
250 m² totales · 180 m² cubiertos`

  it('saca precio, moneda, superficies y ambientes', () => {
    const d = parseListingText(zonaprop)
    expect(d).toMatchObject({
      price: 385000, currency: 'USD', expenses: 180000,
      rooms: 4, bedrooms: 3, bathrooms: 2, totalM2: 250, coveredM2: 180,
      title: 'Casa en venta en Pilar, barrio cerrado Los Robles',
    })
  })

  it('acepta un encabezado corto con tipo, precio y superficie', () => {
    expect(canAnalyzePastedText('Casa · 260m² · 5 ambientes · 2 cocheras / Venta USD 520.000')).toBe(true)
  })

  it('distingue texto incompleto aunque tenga texto del portal', () => {
    expect(canAnalyzePastedText('Conocé más sobre esta propiedad · Cantidad de plantas · Cobertura de cochera')).toBe(false)
  })

  it('nunca toma las expensas como precio', () => {
    const d = parseListingText('Departamento 2 ambientes en Palermo\nExpensas $ 95.000\nConsultar precio')
    expect(d.price).toBeUndefined()
    expect(d.expenses).toBe(95000)
  })

  it('U$S y US$ son dólares, no pesos', () => {
    expect(parseListingText('Casa\nU$S 120.000').currency).toBe('USD')
    expect(parseListingText('Casa\nUS$ 120.000')).toMatchObject({ price: 120000, currency: 'USD' })
  })

  it('un precio en pesos argentinos queda en ARS', () => {
    expect(parseListingText('PH en Caballito\n$ 150.000.000')).toMatchObject({ price: 150000000, currency: 'ARS' })
  })
})

describe('aviso de México pegado como texto', () => {
  it('pesos mexicanos, recámaras y cuota de mantenimiento', () => {
    const d = parseListingText(`Departamento en venta en Polanco, Miguel Hidalgo
$4,500,000 MXN
Mantenimiento $3,500
2 recámaras · 2 baños
95 m² construidos`, { mx: true })
    expect(d).toMatchObject({ price: 4500000, currency: 'MXN', expenses: 3500, bedrooms: 2, bathrooms: 2, coveredM2: 95 })
  })

  it('si el aviso está en dólares, gana USD', () => {
    expect(parseListingText('Casa en Tulum\nUSD 350,000\n3 recámaras', { mx: true })).toMatchObject({ price: 350000, currency: 'USD' })
  })

  it('sin datos no inventa nada', () => {
    const d = parseListingText('Hermosa propiedad, consultar', { mx: true })
    expect(d.price).toBeUndefined()
    expect(d.totalM2).toBeUndefined()
    expect(d.bedrooms).toBeUndefined()
  })
})

describe('texto del lector de páginas', () => {
  it('no usa "Title:" ni la URL como título', () => {
    const d = parseListingText('Title: Casa en Tigre con muelle\nURL Source: https://x.test/1\n\nUSD 250.000')
    expect(d.title).toBe('Casa en Tigre con muelle')
    expect(d.price).toBe(250000)
  })
})

describe('casos borde', () => {
  it('un número de la línea anterior no se pega a la moneda', () => {
    expect(parseListingText('Casa en Tigre\nURL Source: https://x.test/1\nUSD 250.000')).toMatchObject({ price: 250000, currency: 'USD' })
  })
  it('una línea que es solo el precio no es el título', () => {
    expect(parseListingText('Casa\nUSD 250.000').title).toBeUndefined()
  })
})

describe('precio al final de una oración', () => {
  it('lee «USD 149.000.» con el punto final', async () => {
    const { parseAmount, parseListingText } = await import('@/lib/scrape/parseText')
    expect(parseAmount('149.000.')).toBe(149000)
    expect(parseAmount('3,390,000.')).toBe(3390000)
    const r = parseListingText('Departamento en venta en Palermo.\nVenta. Departamento. USD 149.000. Expensas $ 200.000.\n48 m² totales.')
    expect(r.price).toBe(149000)
    expect(r.currency).toBe('USD')
  })
  it('los ejemplos de la portada se leen sin IA', async () => {
    const { parseListingText } = await import('@/lib/scrape/parseText')
    const { EXAMPLES } = await import('@/data/exampleListing')
    for (const e of EXAMPLES) {
      const mx = e.id === 'cdmx'
      expect(parseListingText(e.text, { mx }).price, e.id).toBeGreaterThan(0)
      for (const c of e.comparables) expect(parseListingText(c.text, { mx }).price, c.url).toBeGreaterThan(0)
    }
  })
})
