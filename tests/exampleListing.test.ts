import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { EXAMPLE_LISTING, formatCopiedAt } from '@/data/exampleListing'

describe('ejemplo de la portada', () => {
  it('es un aviso real de un portal, con fecha de copia', () => {
    expect(EXAMPLE_LISTING.url).toMatch(/^https:\/\/www\.(zonaprop\.com\.ar|inmuebles24\.com|argenprop\.com|mercadolibre\.com\.(ar|mx))\//)
    expect(EXAMPLE_LISTING.copiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(formatCopiedAt(EXAMPLE_LISTING.copiedAt)).toBe('22/11/2026')
    expect(EXAMPLE_LISTING.text).toContain('USD')
  })
  it('la portada lo ofrece y la página de análisis lo rotula como ejemplo', () => {
    expect(readFileSync('src/components/home/HeroAnalyze.tsx', 'utf8')).toContain('/analizar?ejemplo=1')
    expect(readFileSync('src/app/analizar/page.tsx', 'utf8')).toContain('Ejemplo con un aviso real')
  })
})
