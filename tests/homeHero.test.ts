import { describe, it, expect } from 'vitest'
import { normalizeListingUrl } from '@/components/home/HeroAnalyze'

describe('caja "pegá el link" de la home', () => {
  it('acepta links con o sin https://', () => {
    expect(normalizeListingUrl('https://www.zonaprop.com.ar/propiedades/x.html')).toBe('https://www.zonaprop.com.ar/propiedades/x.html')
    expect(normalizeListingUrl('  inmuebles24.com/propiedades/y.html ')).toBe('https://inmuebles24.com/propiedades/y.html')
  })
  it('rechaza lo que no es un link', () => {
    expect(normalizeListingUrl('')).toBeNull()
    expect(normalizeListingUrl('casa en pilar')).toBeNull()
    expect(normalizeListingUrl('hola')).toBeNull()
  })
})
