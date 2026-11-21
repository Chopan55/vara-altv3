import { describe, expect, it } from 'vitest'
import { localRequirements } from '@/lib/analysis/localRequirements'

describe('localRequirements', () => {
  it('detecta el partido solo con coincidencia exacta', () => {
    const r = localRequirements('BUENOS_AIRES', 'AR', ['Pilar', 'Del Viso'])
    expect(r?.detected?.name).toBe('Pilar')
    expect(r?.detected?.extraRequirements.length).toBeGreaterThan(0)
  })
  it('no infiere el partido por el nombre de un barrio', () => {
    const r = localRequirements('BUENOS_AIRES', 'AR', ['Nordelta'])
    expect(r?.detected).toBeNull()
    expect(r?.municipalities.map(m => m.name)).toContain('Tigre')
  })
  it('ignora acentos y mayúsculas', () => {
    expect(localRequirements('BUENOS_AIRES', 'AR', ['san isidro'])?.detected?.name).toBe('San Isidro')
  })
})

describe('localRequirements sin jurisdicción', () => {
  it('no muestra municipios si no se conoce la provincia', () => {
    expect(localRequirements(undefined, 'AR', ['Pilar'])).toBeNull()
  })
  it('no usa municipios de otra provincia', () => {
    expect(localRequirements('CORDOBA', 'AR', ['Pilar'])?.detected ?? null).toBeNull()
  })
})
