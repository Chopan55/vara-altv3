import { describe, expect, it } from 'vitest'
import {
  CASE_REF, DEMO_PROPERTIES, acceptInvitation, chooseProperty, grantConsent, initialState, isConsentActive,
  readAsExecutive, revokeConsent, setNextStep, type DemoState, type Scope,
} from '@/lib/bank/demo'

const T = (n: number) => `2026-12-01T10:0${n}:00.000Z`

function ready(scopes: Scope[] = ['INVITATION_ACCEPTED', 'PROPERTY_SELECTED']): DemoState {
  let s = acceptInvitation(initialState(), T(0))
  s = chooseProperty(s, 'p1')
  const r = grantConsent(s, scopes, T(1))
  if (!r.ok) throw new Error(r.reason)
  return r.state
}

describe('demo para bancos: consentimiento', () => {
  it('sin consentimiento el banco no ve nada, aunque el cliente ya haya elegido una propiedad', () => {
    let s = acceptInvitation(initialState(), T(0))
    s = chooseProperty(s, 'p1')
    const { view } = readAsExecutive(s, 'permiso-1', T(1))
    expect(view.allowed).toBe(false)
  })

  it('exige aceptar la invitación, elegir una propiedad para compartirla y no permite alcances vacíos', () => {
    expect(grantConsent(initialState(), ['INVITATION_ACCEPTED'], T(0)).ok).toBe(false)
    const accepted = acceptInvitation(initialState(), T(0))
    expect(grantConsent(accepted, ['PROPERTY_SELECTED'], T(1)).ok).toBe(false)
    expect(grantConsent(accepted, [], T(1)).ok).toBe(false)
    expect(grantConsent(accepted, ['INVITATION_ACCEPTED'], T(1)).ok).toBe(true)
  })

  it('el banco ve solo los alcances autorizados', () => {
    const s = ready(['INVITATION_ACCEPTED'])
    const { view } = readAsExecutive(s, 'permiso-1', T(2))
    expect(view.allowed && view.milestones.map(m => m.kind)).toEqual(['INVITATION_ACCEPTED'])
  })

  it('al compartir la propiedad ve la referencia y nunca el título, la zona ni el precio', () => {
    const { view } = readAsExecutive(ready(), 'permiso-1', T(2))
    expect(view.allowed).toBe(true)
    const text = JSON.stringify(view)
    expect(text).toContain(DEMO_PROPERTIES[0].ref)
    expect(text).not.toContain(DEMO_PROPERTIES[0].title)
    expect(text).not.toContain(DEMO_PROPERTIES[0].zone)
    expect(text).not.toContain('185.000')
  })

  it('no admite un segundo permiso mientras haya uno activo', () => {
    const s = ready()
    expect(grantConsent(s, ['INVITATION_ACCEPTED'], T(3)).ok).toBe(false)
  })
})

describe('demo para bancos: revocación', () => {
  it('retirar el permiso corta la lectura y la escritura del ejecutivo en el acto', () => {
    let s = ready()
    const written = setNextStep(s, 'permiso-1', { status: 'Tasación a coordinar', owner: 'Equipo de tasación' }, T(2))
    expect(written.ok).toBe(true)
    if (written.ok) s = written.state
    s = revokeConsent(s, T(3))
    expect(isConsentActive(s.consent)).toBe(false)
    expect(readAsExecutive(s, 'permiso-1', T(4)).view.allowed).toBe(false)
    expect(setNextStep(s, 'permiso-1', { status: 'Otro', owner: 'Otro' }, T(5)).ok).toBe(false)
  })

  it('un enlace anterior no abre nada, ni siquiera después de otorgar un permiso nuevo', () => {
    let s = revokeConsent(ready(), T(2))
    const again = grantConsent(s, ['INVITATION_ACCEPTED'], T(3))
    expect(again.ok).toBe(true)
    if (again.ok) s = again.state
    expect(readAsExecutive(s, 'permiso-1', T(4)).view.allowed).toBe(false)
    expect(readAsExecutive(s, 'permiso-2', T(4)).view.allowed).toBe(true)
  })

  it('retirar sin permiso activo no hace nada ni ensucia la auditoría', () => {
    const s = initialState()
    expect(revokeConsent(s, T(1))).toBe(s)
  })
})

describe('demo para bancos: auditoría y escritura', () => {
  it('registra otorgamiento, lectura, actualización, denegación y revocación, en orden y con ids crecientes', () => {
    let s = ready()
    s = readAsExecutive(s, 'permiso-1', T(2)).state
    const w = setNextStep(s, 'permiso-1', { status: 'Tasación a coordinar', owner: 'Equipo de tasación' }, T(3))
    if (w.ok) s = w.state
    s = revokeConsent(s, T(4))
    s = readAsExecutive(s, 'permiso-1', T(5)).state
    expect(s.audit.map(e => e.action)).toEqual([
      'INVITATION_ACCEPTED', 'CONSENT_GRANTED', 'MILESTONES_READ', 'STATUS_UPDATED', 'CONSENT_REVOKED', 'ACCESS_DENIED',
    ])
    expect(s.audit.map(e => e.id)).toEqual([1, 2, 3, 4, 5, 6])
    expect(s.audit.every(e => e.caseRef === CASE_REF)).toBe(true)
  })

  it('la auditoría nunca copia el contenido de los hitos', () => {
    let s = ready()
    const w = setNextStep(s, 'permiso-1', { status: 'Tasación a coordinar', owner: 'Equipo de tasación' }, T(2))
    if (w.ok) s = w.state
    const text = JSON.stringify(s.audit)
    for (const secret of ['Tasación a coordinar', 'Equipo de tasación', DEMO_PROPERTIES[0].ref, DEMO_PROPERTIES[0].title]) {
      expect(text).not.toContain(secret)
    }
  })

  it('limpia y limita lo que escribe el ejecutivo y exige estado y responsable', () => {
    const s = ready()
    const r = setNextStep(s, 'permiso-1', { status: `  ${'a'.repeat(200)}  `, owner: 'Ana\n  Pérez' }, T(2))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.state.nextStep?.status.length).toBe(80)
      expect(r.state.nextStep?.owner).toBe('Ana Pérez')
    }
    expect(setNextStep(s, 'permiso-1', { status: '', owner: 'x' }, T(2)).ok).toBe(false)
  })
})

describe('demo para bancos: el alcance y la propiedad quedan atados al permiso', () => {
  it('con permiso solo de invitación, el ejecutivo ve su propia gestión registrada pero ninguna propiedad', () => {
    let s = ready(['INVITATION_ACCEPTED'])
    const w = setNextStep(s, 'permiso-1', { status: 'Tasación a coordinar', owner: 'Equipo' }, T(2))
    if (w.ok) s = w.state
    const { view } = readAsExecutive(s, 'permiso-1', T(3))
    const kinds = view.allowed ? view.milestones.map(m => m.kind) : []
    expect(kinds).toContain('NEXT_STEP')
    expect(kinds).not.toContain('PROPERTY_SELECTED')
  })

  it('cambiar de propiedad después de consentir no cambia la que ve el banco', () => {
    let s = ready()
    s = chooseProperty(s, 'p2')
    const { view } = readAsExecutive(s, 'permiso-1', T(2))
    const text = JSON.stringify(view)
    expect(text).toContain(DEMO_PROPERTIES[0].ref)
    expect(text).not.toContain(DEMO_PROPERTIES[1].ref)
  })

  it('un permiso solo de invitación no comparte ninguna propiedad aunque haya una elegida', () => {
    const s = ready(['INVITATION_ACCEPTED'])
    expect(s.consent?.propertyId).toBeNull()
    expect(JSON.stringify(readAsExecutive(s, 'permiso-1', T(2)).view)).not.toContain(DEMO_PROPERTIES[0].ref)
  })

  it('una próxima gestión de un permiso anterior no aparece bajo el permiso nuevo', () => {
    let s = ready()
    const w = setNextStep(s, 'permiso-1', { status: 'Tasación a coordinar', owner: 'Equipo' }, T(2))
    if (w.ok) s = w.state
    s = revokeConsent(s, T(3))
    const again = grantConsent(chooseProperty(s, 'p2'), ['PROPERTY_SELECTED'], T(4))
    expect(again.ok).toBe(true)
    if (again.ok) s = again.state
    const { view } = readAsExecutive(s, 'permiso-2', T(5))
    const text = JSON.stringify(view)
    expect(text).toContain(DEMO_PROPERTIES[1].ref)
    expect(text).not.toContain('Tasación a coordinar')
  })

  it('una escritura denegada deja la próxima gestión como estaba', () => {
    let s = ready()
    const w = setNextStep(s, 'permiso-1', { status: 'Primero', owner: 'Ana' }, T(2))
    if (w.ok) s = w.state
    s = revokeConsent(s, T(3))
    const denied = setNextStep(s, 'permiso-1', { status: 'Segundo', owner: 'Beto' }, T(4))
    expect(denied.ok).toBe(false)
    expect(denied.state.nextStep?.status).toBe('Primero')
  })

  it('una lectura denegada no devuelve ningún hito aunque exista una próxima gestión', () => {
    let s = ready()
    const w = setNextStep(s, 'permiso-1', { status: 'Primero', owner: 'Ana' }, T(2))
    if (w.ok) s = w.state
    s = revokeConsent(s, T(3))
    const { view } = readAsExecutive(s, 'permiso-1', T(4))
    expect(view).toEqual({ allowed: false, reason: expect.any(String) })
  })
})
