import { describe, it, expect } from 'vitest'
import { generateChecklist, countryOfProvince, MX_CODES } from '@/lib/regulations'
import { taskDefsFor } from '@/lib/supabase/sellerTasks'
import { findKnowledge, knowledgeFor, STAGES_BY_COUNTRY } from '@/data/knowledge'
import { participantRoleLabel } from '@/lib/participants/roles'
import { toSummary, type StoredOperation } from '@/lib/userOperations'
import type { ProvinceCode } from '@/data/regulations/types'

/** Palabras que solo existen en una operación argentina. */
const AR_ONLY = /\b(DNI|CUIT|CUIL|UIF|escriban[oa]|Escriban[oa]|[Bb]oleto|[Ss]ellos|ITI|ARS|expensas|inhibici[oó]n|seña)\b/
const text = (x: unknown) => JSON.stringify(x)

describe('México de punta a punta', () => {
  it('un estado de México arma el checklist mexicano aunque no se pase el país', () => {
    for (const code of MX_CODES) {
      const cl = generateChecklist(code as ProvinceCode, 'BUY_PROPERTY', 200_000)
      expect(text(cl.stages), code).not.toMatch(AR_ONLY)
      expect(cl.stages.map(s => s.name)).toEqual(STAGES_BY_COUNTRY.MX)
      expect(text(cl.costs)).toMatch(/ISAI/)
      expect(text(cl.costs)).not.toMatch(/Sellos|escribano|ARS/)
    }
  })

  it('Argentina sigue igual', () => {
    const cl = generateChecklist('CABA', 'BUY_PROPERTY', 200_000, 'AR')
    expect(cl.stages.map(s => s.name)).toEqual(STAGES_BY_COUNTRY.AR)
    expect(text(cl.stages)).toMatch(/DNI/)
    expect(text(cl.stages)).not.toMatch(/ISAI|INE|CURP|notario/)
  })

  it('las tareas del plan son mexicanas y conservan las claves (no se pierde el avance)', () => {
    for (const type of ['BUY', 'SELL'] as const) {
      const mx = taskDefsFor(type, 'MX'), ar = taskDefsFor(type, 'AR')
      // Lo que ve la persona; la clave interna ('boleto') se mantiene a propósito.
      expect(text(mx.map(d => [d.title, d.description]))).not.toMatch(AR_ONLY)
      expect(mx.map(d => d.key)).toEqual(ar.map(d => d.key))
    }
  })

  it('la guía y el asistente solo usan material del país', () => {
    expect(knowledgeFor('MX').length).toBeGreaterThanOrEqual(8)
    expect(text(knowledgeFor('MX'))).not.toMatch(AR_ONLY)
    expect(findKnowledge('cuánto es el impuesto de sellos', undefined, 4, 'MX').every(e => e.country === 'MX')).toBe(true)
    expect(findKnowledge('apartado', undefined, 4, 'MX')[0]?.id).toBe('mx-apartado')
    expect(findKnowledge('seña', undefined, 4, 'AR')[0]?.id).toBe('sena')
  })

  it('cada etapa mexicana de la guía existe en el checklist', () => {
    for (const e of knowledgeFor('MX')) if (e.stage) expect(STAGES_BY_COUNTRY.MX).toContain(e.stage)
  })

  it('roles con nombre local', () => {
    expect(participantRoleLabel('NOTARY', 'MX')).toBe('Notario/a')
    expect(participantRoleLabel('NOTARY', 'AR')).toBe('Escribano/a')
    expect(participantRoleLabel('NOTARY')).toBe('Escribano/a')
  })

  it('el país se deduce de la jurisdicción', () => {
    expect(countryOfProvince('Ciudad de México')).toBe('MX')
    expect(countryOfProvince('CDMX')).toBe('MX')
    expect(countryOfProvince('CABA')).toBe('AR')
    expect(countryOfProvince(null)).toBe('AR')
  })

  it('el resumen de una operación conserva el país (antes se perdía y todo salía como Argentina)', () => {
    const op = { id: 'x', type: 'BUY', title: 'Mi compra', status: 'ACTIVE', progress: 0, province: 'Ciudad de México',
      provinceCode: 'CDMX', city: '', country: 'MX', createdAt: Date.now() } as unknown as StoredOperation
    expect(toSummary(op).country).toBe('MX')
  })
})

describe('costos de México como rango honesto', () => {
  it('el ISAI se muestra como rango y nunca como verificado', () => {
    for (const code of MX_CODES) {
      const cl = generateChecklist(code as ProvinceCode, 'BUY_PROPERTY', 100_000)
      expect(cl.costs.stampTaxBuyer.maxAmount, code).toBeGreaterThan(cl.costs.stampTaxBuyer.minAmount)
      expect(cl.costs.totalBuyer.max).toBeGreaterThanOrEqual(cl.costs.totalBuyer.min)
      expect(cl.dataConfidence, code).not.toBe('VERIFIED')
    }
  })

  it('una provincia argentina con tasa única sigue dando un solo valor', () => {
    const cl = generateChecklist('CABA', 'BUY_PROPERTY', 100_000, 'AR')
    expect(cl.costs.stampTaxBuyer.maxAmount).toBe(cl.costs.stampTaxBuyer.minAmount)
  })
})

describe('requisitos mexicanos que no pueden faltar', () => {
  it('el checklist incluye antilavado, extranjeros, aviso preventivo y casa habitación', () => {
    const t = text(generateChecklist('CDMX' as ProvinceCode, 'BUY_PROPERTY', 200_000).stages)
    for (const must of ['antilavado', 'efectivo', 'fideicomiso', 'Relaciones Exteriores', 'Aviso preventivo', 'casa habitación', 'libertad de gravamen', 'Avalúo', 'INE', 'RFC', 'CURP'])
      expect(t, must).toContain(must)
  })

  it('el aviso preventivo va antes de la firma y el ISR en la firma', () => {
    const st = generateChecklist('CDMX' as ProvinceCode, 'BUY_PROPERTY', 200_000).stages
    const stageOf = (id: string) => st.find(s => s.tasks.some(t => t.id === id))?.name
    expect(stageOf('mxn-1b')).toBe('Certificados y avalúo')
    expect(stageOf('mxn-4')).toBe('Firma ante notario')
  })
})
