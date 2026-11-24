import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { EXAMPLE_LISTING, EXAMPLES, exampleById, formatCopiedAt } from '@/data/exampleListing'

describe('ejemplo de la portada', () => {
  it('es un aviso real de un portal, con fecha de copia', () => {
    expect(EXAMPLE_LISTING.url).toMatch(/^https:\/\/www\.(zonaprop\.com\.ar|inmuebles24\.com|argenprop\.com|mercadolibre\.com\.(ar|mx))\//)
    expect(EXAMPLE_LISTING.copiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(formatCopiedAt(EXAMPLE_LISTING.copiedAt)).toBe('22/11/2026')
    expect(EXAMPLE_LISTING.text).toContain('USD')
    expect(EXAMPLE_LISTING.text.trim().length).toBeGreaterThan(150)
    expect(EXAMPLE_LISTING.comparables.length).toBeGreaterThanOrEqual(3)
    for (const c of EXAMPLE_LISTING.comparables) {
      expect(c.url).toMatch(/^https:\/\/www\.zonaprop\.com\.ar\/propiedades\/clasificado\//)
      expect(c.text).toContain('USD')
      // La API usa el texto (y no intenta leer el portal) solo si tiene más de 150 caracteres.
      expect(c.text.trim().length).toBeGreaterThan(150)
    }
  })
  it('la portada lo ofrece y la página de análisis lo rotula como ejemplo', () => {
    expect(readFileSync('src/components/home/HeroAnalyze.tsx', 'utf8')).toContain('/analizar?ejemplo=1')
    expect(readFileSync('src/app/analizar/page.tsx', 'utf8')).toContain('Ejemplo con avisos reales')
  })
  it('los tres casos reales: avisos de portales, con fecha y textos que la API usa sin leer el portal', () => {
    expect(EXAMPLES.map(e => e.id)).toEqual(['palermo', 'vicente-lopez', 'cdmx'])
    for (const e of EXAMPLES) {
      expect(e.url).toMatch(/^https:\/\/www\.(zonaprop\.com\.ar|inmuebles24\.com)\/propiedades\/clasificado\//)
      expect(e.text.trim().length).toBeGreaterThan(150)
      expect(e.comparables.length).toBeGreaterThanOrEqual(4)
      for (const c of e.comparables) expect(c.text.trim().length).toBeGreaterThan(150)
    }
    expect(exampleById('1')).toBe(EXAMPLE_LISTING)
    expect(exampleById('cdmx')?.portal).toBe('Inmuebles24')
    expect(exampleById('nada')).toBeNull()
  })
})

describe('ubicación de los ejemplos', () => {
  it('sale de la primera línea del aviso', async () => {
    const { exampleLocation, EXAMPLES } = await import('@/data/exampleListing')
    expect(exampleLocation('Departamento en venta en Olivos, Vicente López, GBA Norte. X.')).toEqual({ neighborhood: 'Olivos', city: 'Vicente López' })
    expect(exampleLocation('Departamento en venta en Las Cañitas, Palermo, Capital Federal. X.')).toEqual({ neighborhood: 'Palermo', city: 'Capital Federal' })
    expect(exampleLocation('Departamento en venta en Nápoles, Benito Juárez, Ciudad de México. X.')).toEqual({ neighborhood: 'Nápoles', city: 'Ciudad de México' })
    for (const e of EXAMPLES) {
      expect(exampleLocation(e.text).city, e.id).toBeTruthy()
      for (const c of e.comparables) expect(exampleLocation(c.text).city, c.url).toBeTruthy()
    }
  })
})
