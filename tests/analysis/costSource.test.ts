import { describe, expect, it } from 'vitest'
import { describeCostSource, formatAsOf } from '@/lib/analysis/costSource'
import { AR_COST_PROVIDER } from '@/lib/analysis/costProviders/ar'

describe('describeCostSource', () => {
  it('distingue aviso, norma, organismo y estimación', () => {
    expect(describeCostSource('Aviso').kind).toBe('AVISO')
    const norma = describeCostSource('https://www.arba.gov.ar/archivos/Publicaciones/leyimpositiva2026.pdf')
    expect(norma.kind).toBe('NORMA')
    expect(norma.url).toContain('arba.gov.ar')
    expect(norma.label).toContain('arba.gov.ar')
    const org = describeCostSource('https://colescba.org.ar')
    expect(org.kind).toBe('ORGANISMO')
    expect(describeCostSource('Estimado promedio').kind).toBe('ESTIMACION')
    expect(describeCostSource('').kind).toBe('ESTIMACION')
  })
  it('no convierte en enlace algo que no es http(s)', () => {
    const s = describeCostSource('javascript:alert(1)')
    expect(s.url).toBeUndefined()
  })
  it('formatea la fecha del catálogo', () => {
    expect(formatAsOf('2026-09-13')).toBe('13/09/2026')
    expect(formatAsOf('basura')).toBeNull()
    expect(formatAsOf(undefined)).toBeNull()
  })
  it('el costo de Buenos Aires trae la fecha de revisión del catálogo', () => {
    const c = AR_COST_PROVIDER.estimate({ price: 300000, currency: 'USD', provinceCode: 'BUENOS_AIRES' } as never)
    expect(c.dataAsOf).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
