import { describe, it, expect } from 'vitest'
import { resumeStep, type OnboardingSnapshot } from '@/lib/varaVisit/onboarding'
import { contactPatch } from '@/lib/supabase/visits'

const base: OnboardingSnapshot = {
  hasProfile: true, homeZoneLabel: 'Pilar', serviceCount: 1, referenceCount: 2, certificationStatus: 'CERTIFIED',
}

describe('resumeStep', () => {
  it('sin perfil arranca en datos personales', () => {
    expect(resumeStep({ ...base, hasProfile: false })).toBe('PERSONAL_DATA')
  })
  it('sin zona o sin servicios vuelve a zona de trabajo', () => {
    expect(resumeStep({ ...base, homeZoneLabel: '  ' })).toBe('WORK_ZONE')
    expect(resumeStep({ ...base, serviceCount: 0 })).toBe('WORK_ZONE')
  })
  it('con menos referencias que el mínimo vuelve a referencias', () => {
    expect(resumeStep({ ...base, referenceCount: 1 })).toBe('REFERENCES')
  })
  it('sin examen aprobado vuelve a capacitación', () => {
    expect(resumeStep({ ...base, certificationStatus: null })).toBe('TRAINING')
    expect(resumeStep({ ...base, certificationStatus: 'FAILED' })).toBe('TRAINING')
  })
  it('con el examen aprobado (aunque VARA no lo haya confirmado) pasa a supervisadas', () => {
    expect(resumeStep({ ...base, certificationStatus: 'QUIZ_PENDING' })).toBe('SUPERVISED_VISITS')
    expect(resumeStep(base)).toBe('SUPERVISED_VISITS')
  })
})

describe('contactPatch', () => {
  it('no manda los campos que no vinieron, así el upsert no los borra', () => {
    expect(contactPatch({ phone: '11 5555', email: 'a@b.c' })).toEqual({ phone: '11 5555', email: 'a@b.c' })
    expect(contactPatch({})).toEqual({})
  })
  it('respeta un vacío explícito: el partner puede borrar su teléfono', () => {
    expect(contactPatch({ phone: '' })).toEqual({ phone: '' })
  })
  it('mapea el domicilio a sus columnas', () => {
    expect(contactPatch({ addressLine: 'Calle 1', addressCity: 'Pilar' }))
      .toEqual({ address_line: 'Calle 1', address_city: 'Pilar' })
  })
})
