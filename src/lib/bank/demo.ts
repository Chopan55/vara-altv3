/**
 * Demo de VARA para bancos — DATOS FICTICIOS, sin base de datos.
 *
 * Reglas que la demo tiene que mostrar (y que los tests aseguran):
 *  - Lo que el cliente busca, analiza y conversa es privado. El banco solo ve los hitos que el cliente autoriza.
 *  - El permiso se otorga por alcance, se puede retirar en cualquier momento y corta el acceso al instante:
 *    también para quien guardó un enlace anterior.
 *  - Cada otorgamiento, lectura, actualización y revocación queda en una auditoría que no copia contenido.
 *  - Nada de scoring, aprobación ni garantía: VARA ordena la información, el banco decide por su circuito.
 */

export type Scope = 'INVITATION_ACCEPTED' | 'PROPERTY_SELECTED'
export type Actor = 'CLIENT' | 'EXECUTIVE'
export type AuditAction =
  | 'INVITATION_ACCEPTED'
  | 'CONSENT_GRANTED'
  | 'MILESTONES_READ'
  | 'STATUS_UPDATED'
  | 'CONSENT_REVOKED'
  | 'ACCESS_DENIED'

export interface DemoProperty { id: string; title: string; zone: string; price: string; ref: string }

export const CASE_REF = 'CASO-DEMO-001'
export const BANK_NAME = 'Banco Ficticio'

export const DEMO_PROPERTIES: readonly DemoProperty[] = [
  { id: 'p1', title: 'Casa 3 ambientes con jardín', zone: 'Pilar, Buenos Aires', price: 'USD 185.000 (ficticio)', ref: 'PROP-A1' },
  { id: 'p2', title: 'Departamento 2 ambientes, balcón', zone: 'Escobar, Buenos Aires', price: 'USD 98.000 (ficticio)', ref: 'PROP-B2' },
]

/** Qué ve exactamente el banco por cada alcance. Es lo que se le muestra al cliente antes de confirmar. */
export const SCOPE_INFO: Record<Scope, { label: string; bankSees: string }> = {
  INVITATION_ACCEPTED: {
    label: 'Invitación aceptada',
    bankSees: 'Que activaste VARA, el código del caso y la fecha.',
  },
  PROPERTY_SELECTED: {
    label: 'Propiedad elegida',
    bankSees: 'La referencia de la propiedad que elegiste compartir y la fecha en que la elegiste.',
  },
}

/** El ejecutivo ve también lo que él mismo registra; se le avisa al cliente antes de confirmar. */
export const EXECUTIVE_NOTE = 'Lo que el ejecutivo registre sobre tu caso (estado, responsable y fecha) también lo ve él.'

export const NEVER_SHARED: readonly string[] = [
  'Tus conversaciones con el asistente y tus borradores',
  'Tus búsquedas, propiedades guardadas y análisis',
  'Tus documentos y ofertas',
  'Cualquier evaluación crediticia: VARA no la hace ni la deduce',
]

/** El permiso queda atado a la propiedad que el cliente eligió al otorgarlo: cambiar de propiedad después no cambia lo compartido. */
export interface Consent { id: string; scopes: Scope[]; propertyId: string | null; grantedAt: string; revokedAt: string | null }
/** Lo registra el ejecutivo bajo un permiso concreto: solo se muestra mientras ese permiso siga vigente. */
export interface NextStep { status: string; owner: string; updatedAt: string; consentId: string }
export interface AuditEvent { id: number; at: string; actor: Actor; action: AuditAction; caseRef: string; scope: string }

export interface DemoState {
  invitationAcceptedAt: string | null
  chosenPropertyId: string | null
  consent: Consent | null
  consentCount: number
  nextStep: NextStep | null
  audit: AuditEvent[]
}

export const initialState = (): DemoState => ({
  invitationAcceptedAt: null,
  chosenPropertyId: null,
  consent: null,
  consentCount: 0,
  nextStep: null,
  audit: [],
})

function log(state: DemoState, at: string, actor: Actor, action: AuditAction, scope: string): DemoState {
  // Solo actor, acción, caso, alcance y hora: nunca el contenido del hito.
  const event: AuditEvent = { id: state.audit.length + 1, at, actor, action, caseRef: CASE_REF, scope }
  return { ...state, audit: [...state.audit, event] }
}

export const isConsentActive = (c: Consent | null): c is Consent => c !== null && c.revokedAt === null

export function acceptInvitation(state: DemoState, at: string): DemoState {
  if (state.invitationAcceptedAt) return state
  return log({ ...state, invitationAcceptedAt: at }, at, 'CLIENT', 'INVITATION_ACCEPTED', 'INVITATION_ACCEPTED')
}

/** Elegir una propiedad es privado hasta que el cliente decide compartirla. */
export function chooseProperty(state: DemoState, propertyId: string): DemoState {
  if (!DEMO_PROPERTIES.some(p => p.id === propertyId)) return state
  return { ...state, chosenPropertyId: propertyId }
}

export type GrantResult = { ok: true; state: DemoState } | { ok: false; state: DemoState; reason: string }

export function grantConsent(state: DemoState, scopes: Scope[], at: string): GrantResult {
  const unique = [...new Set(scopes)]
  if (unique.length === 0) return { ok: false, state, reason: 'Elegí qué querés compartir.' }
  if (!state.invitationAcceptedAt) return { ok: false, state, reason: 'Primero aceptá la invitación.' }
  if (unique.includes('PROPERTY_SELECTED') && !state.chosenPropertyId) {
    return { ok: false, state, reason: 'Para compartir la propiedad elegida, primero elegí una.' }
  }
  if (isConsentActive(state.consent)) return { ok: false, state, reason: 'Ya hay un permiso activo. Retiralo para cambiar el alcance.' }
  const consentCount = state.consentCount + 1
  const propertyId = unique.includes('PROPERTY_SELECTED') ? state.chosenPropertyId : null
  const consent: Consent = { id: `permiso-${consentCount}`, scopes: unique, propertyId, grantedAt: at, revokedAt: null }
  let next: DemoState = { ...state, consent, consentCount }
  next = log(next, at, 'CLIENT', 'CONSENT_GRANTED', unique.join('+'))
  return { ok: true, state: next }
}

export function revokeConsent(state: DemoState, at: string): DemoState {
  if (!isConsentActive(state.consent)) return state
  const scopes = state.consent.scopes.join('+')
  const next: DemoState = { ...state, consent: { ...state.consent, revokedAt: at } }
  return log(next, at, 'CLIENT', 'CONSENT_REVOKED', scopes)
}

export interface BankMilestone { kind: 'INVITATION_ACCEPTED' | 'PROPERTY_SELECTED' | 'NEXT_STEP'; label: string; detail: string; at: string }
export type ExecutiveView =
  | { allowed: true; milestones: BankMilestone[] }
  | { allowed: false; reason: string }

/** El permiso que se presenta tiene que ser el vigente: un enlace anterior no abre nada. */
function permitted(state: DemoState, presentedConsentId: string): state is DemoState & { consent: Consent } {
  return isConsentActive(state.consent) && state.consent.id === presentedConsentId
}

export function readAsExecutive(state: DemoState, presentedConsentId: string, at: string): { state: DemoState; view: ExecutiveView } {
  if (!permitted(state, presentedConsentId)) {
    return {
      state: log(state, at, 'EXECUTIVE', 'ACCESS_DENIED', 'LECTURA'),
      view: { allowed: false, reason: 'El cliente no tiene un permiso activo para este caso. No hay hitos para mostrar.' },
    }
  }
  const { consent } = state
  const milestones: BankMilestone[] = []
  if (consent.scopes.includes('INVITATION_ACCEPTED') && state.invitationAcceptedAt) {
    milestones.push({ kind: 'INVITATION_ACCEPTED', label: SCOPE_INFO.INVITATION_ACCEPTED.label, detail: CASE_REF, at: state.invitationAcceptedAt })
  }
  if (consent.scopes.includes('PROPERTY_SELECTED') && consent.propertyId) {
    const property = DEMO_PROPERTIES.find(p => p.id === consent.propertyId)
    if (property) milestones.push({ kind: 'PROPERTY_SELECTED', label: SCOPE_INFO.PROPERTY_SELECTED.label, detail: `Referencia ${property.ref}`, at: consent.grantedAt })
  }
  if (state.nextStep && state.nextStep.consentId === consent.id) {
    milestones.push({ kind: 'NEXT_STEP', label: 'Próxima gestión', detail: `${state.nextStep.status} · Responsable: ${state.nextStep.owner}`, at: state.nextStep.updatedAt })
  }
  return {
    state: log(state, at, 'EXECUTIVE', 'MILESTONES_READ', consent.scopes.join('+')),
    view: { allowed: true, milestones },
  }
}

const clean = (value: string) => value.replace(/\s+/g, ' ').trim().slice(0, 80)

export type UpdateResult = { ok: true; state: DemoState } | { ok: false; state: DemoState; reason: string }

export function setNextStep(state: DemoState, presentedConsentId: string, input: { status: string; owner: string }, at: string): UpdateResult {
  if (!permitted(state, presentedConsentId)) {
    return { ok: false, state: log(state, at, 'EXECUTIVE', 'ACCESS_DENIED', 'ESCRITURA'), reason: 'Sin permiso activo no se puede registrar nada.' }
  }
  const status = clean(input.status)
  const owner = clean(input.owner)
  if (!status || !owner) return { ok: false, state, reason: 'Completá el estado y el responsable.' }
  const next: DemoState = { ...state, nextStep: { status, owner, updatedAt: at, consentId: state.consent.id } }
  return { ok: true, state: log(next, at, 'EXECUTIVE', 'STATUS_UPDATED', 'NEXT_STEP') }
}
