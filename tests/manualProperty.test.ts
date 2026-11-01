import { describe, it, expect } from 'vitest'
import { EMPTY_MANUAL, buildManualData, canSubmitManual, manualToResult, missingManual } from '@/lib/manualProperty'

describe('carga manual de propiedad', () => {
  it('sin datos no se puede sumar', () => {
    expect(canSubmitManual(buildManualData(EMPTY_MANUAL))).toBe(false)
  })

  it('solo informa lo que se escribió y limpia los números', () => {
    const d = buildManualData({ ...EMPTY_MANUAL, price: ' 250.000 ', city: 'Pilar', totalM2: '400 m2', bedrooms: '0' })
    expect(d).toEqual({ price: 250000, currency: 'USD', city: 'Pilar', totalM2: 400 })
    expect(canSubmitManual(d)).toBe(true)
  })

  it('dice qué datos clave faltan', () => {
    expect(missingManual(buildManualData({ ...EMPTY_MANUAL, city: 'Pilar' }))).toEqual(['precio', 'superficie', 'ambientes'])
    expect(missingManual(buildManualData({ ...EMPTY_MANUAL, price: '1', totalM2: '1', city: 'x', rooms: '3' }))).toEqual([])
  })

  it('produce el mismo resultado que una importación', () => {
    const r = manualToResult({ ...EMPTY_MANUAL, price: '100000', address: 'Calle 1' })
    expect(r.status).toBe('success')
    expect(r.photos).toEqual([])
    expect(r.missingFields).toContain('superficie')
  })
})
