import { describe, it, expect } from 'vitest'
import { getJurisdiction, listJurisdictions, hasJurisdiction, CL_PACK, CO_PACK, AR_PACK } from '@/lib/jurisdiction'
import { PROVINCE_MAP } from '@/data/regulations/provinces'
import { parseCountryPref } from '@/hooks/useCountryPreference'

const ROLES = ['CLOSING_PROFESSIONAL', 'LEGAL_ADVISOR', 'SURVEYOR', 'APPRAISER', 'INSPECTOR', 'BROKER', 'FIELD_AGENT', 'OTHER'] as const

describe('jurisdiction packs', () => {
  it('registra AR, MX, CL y CO', () => {
    expect(listJurisdictions().map(p => p.countryCode)).toEqual(['AR', 'MX', 'CL', 'CO'])
  })

  it('cada pack tiene todas las etiquetas de rol y su moneda local aceptada', () => {
    for (const p of listJurisdictions()) {
      for (const r of ROLES) expect(p.professionalLabels[r], `${p.countryCode}.${r}`).toBeTruthy()
      expect(p.acceptedCurrencies).toContain(p.localCurrency)
    }
  })

  it('Chile y Colombia están en validación y sin motor de costos', () => {
    for (const p of [CL_PACK, CO_PACK]) {
      expect(p.readiness).toBe('validation')
      expect(p.hasCostEngine).toBe(false)
      expect(p.readinessNote).toMatch(/validar/)
    }
  })

  it('un pack que dice tener motor de costos tiene datos reales para su jurisdicción default', () => {
    for (const p of listJurisdictions().filter(x => x.hasCostEngine)) {
      expect(PROVINCE_MAP[p.defaultProvinceCode], p.countryCode).toBeDefined()
    }
  })

  it('un pack sin motor de costos no apunta a datos de otro país', () => {
    for (const p of listJurisdictions().filter(x => !x.hasCostEngine)) {
      expect(PROVINCE_MAP[p.defaultProvinceCode], p.countryCode).toBeUndefined()
    }
  })

  it('solo Argentina está activa', () => {
    expect(listJurisdictions().filter(p => p.readiness === 'active').map(p => p.countryCode)).toEqual(['AR'])
  })

  it('un país sin pack cae a Argentina', () => {
    expect(getJurisdiction('PE')).toBe(AR_PACK)
    expect(getJurisdiction(null)).toBe(AR_PACK)
    expect(hasJurisdiction('PE')).toBe(false)
    expect(hasJurisdiction('CL')).toBe(true)
  })

  it('la preferencia guardada acepta solo países con pack', () => {
    expect(parseCountryPref('CO')).toBe('CO')
    expect(parseCountryPref('PE')).toBe('AR')
    expect(parseCountryPref('<script>')).toBe('AR')
    expect(parseCountryPref(null)).toBe('AR')
  })
})
