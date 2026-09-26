/**
 * Acceso a datos de VARA Visit.
 *
 * Sigue el patrón ya establecido en `operations.ts` y `photos.ts`:
 * `tryCreateClient()` devuelve null sin configuración, y cada función degrada
 * a un valor vacío en vez de tirar. La app tiene que seguir andando sin base.
 *
 * Dos cosas que este archivo NO hace, a propósito:
 *
 * - No expone nunca `partner_contacts` ni `partner_verifications` a una
 *   pantalla de cliente. Los mappers públicos ni siquiera pueden: reciben
 *   `VisitPartnerRow`, que no tiene esos campos.
 *
 * - No confía en la UI para la autorización. RLS es lo que autoriza; acá solo
 *   se pide lo que corresponde. Si una política falla, la consulta vuelve vacía,
 *   no con datos ajenos.
 */

import { tryCreateClient } from './client'
import type {
  VisitPartnerRow, VisitBookingRow, VisitSessionRow, VisitReportRow,
  SafetyIncidentRow, PartnerReferenceRow, PartnerTrainingRow,
  PartnerVerificationRow, VisitServiceTypeDb,
} from './visitRows'
import type {
  PartnerPublicProfile, VisitBooking, VisitSession, VisitReport,
  SafetyIncident, PartnerReference, PartnerTraining, PartnerVerification,
  VisitServiceType, VisitStatus, GeoPoint, PartnerReview, ClientReview,
  SafetyFlag, VisitEventName, ReferenceAnswers, ReportedIssue,
} from '@/types/varaVisit'
import type { Currency } from '@/types'
import { buildVisitCode } from '@/types/varaVisit'
import { generatePin } from '@/lib/varaVisit/session'

// ───────────────────────────── Mappers ─────────────────────────────

/**
 * Fila → perfil público.
 * Las métricas se derivan acá: `rating_sum`/`review_count` se guardan crudos
 * en la base para que sumar una review sea un UPDATE y no un recálculo.
 */
export function rowToPublicProfile(r: VisitPartnerRow): PartnerPublicProfile {
  return {
    id: r.id,
    displayName: r.display_name,
    initials: r.initials,
    photoUrl: r.photo_path,
    bio: r.bio,
    profession: r.profession,
    experienceYears: r.experience_years,
    languages: r.languages ?? [],
    homeZoneLabel: r.home_zone_label,
    coverageZones: r.coverage_zones ?? [],
    maxTravelRadiusKm: r.max_travel_radius_km,
    serviceTypes: (r.service_types ?? []) as VisitServiceType[],
    tier: r.tier,
    status: r.status,
    metrics: {
      totalVisits: r.total_visits,
      completedVisits: r.completed_visits,
      cancelledVisits: r.cancelled_visits,
      // null, no 0: "todavía no sabemos" y "es malo" son cosas distintas.
      punctualityRate: r.completed_visits > 0 ? r.on_time_visits / r.completed_visits : null,
      completionRate: r.total_visits > 0 ? r.completed_visits / r.total_visits : null,
      averageRating: r.review_count > 0 ? r.rating_sum / r.review_count : null,
      reviewCount: r.review_count,
      incidentCount: r.incident_count,
    },
    verifiedIdentity: r.verified_identity,
    verifiedDocument: r.verified_document,
    verifiedPhone: r.verified_phone,
    verifiedEmail: r.verified_email,
    certified: r.certified,
    ratePerVisit: Number(r.rate_per_visit),
    currency: r.currency,
    memberSince: r.created_at,
  }
}

/** Postgres devuelve `time` como HH:MM:SS; la UI trabaja con HH:MM. */
function trimTime(t: string): string {
  return /^\d{1,2}:\d{2}/.exec(t)?.[0] ?? t
}

export function rowToBooking(r: VisitBookingRow): VisitBooking {
  return {
    id: r.id,
    visitCode: r.visit_code,
    requesterUserId: r.requester_user_id,
    propertyId: r.property_id,
    operationId: r.operation_id,
    serviceType: r.service_type as VisitServiceType,
    requestedDate: r.requested_date,
    requestedTime: trimTime(r.requested_time),
    durationMinutes: r.duration_minutes,
    locationLabel: r.location_label,
    instructions: r.instructions,
    accessInstructions: r.access_instructions,
    guestsExpected: r.guests_expected,
    price: Number(r.price),
    currency: r.currency,
    assignmentMode: r.assignment_mode,
    assignedPartnerId: r.assigned_partner_id,
    status: r.status as VisitStatus,
    cancellationReason: r.cancellation_reason,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function geo(lat: number | null, lng: number | null, acc: number | null, at: string | null): GeoPoint | null {
  if (lat === null || lng === null || at === null) return null
  return { lat, lng, accuracyM: acc, capturedAt: at }
}

export function rowToSession(r: VisitSessionRow): VisitSession {
  return {
    id: r.id,
    bookingId: r.booking_id,
    partnerId: r.partner_id,
    checkInAt: r.check_in_at,
    checkInLocation: geo(r.check_in_lat, r.check_in_lng, r.check_in_accuracy_m, r.check_in_at),
    checkOutAt: r.check_out_at,
    checkOutLocation: geo(r.check_out_lat, r.check_out_lng, r.check_out_accuracy_m, r.check_out_at),
    confirmationPinStatus: r.confirmation_pin_status,
    pinAttempts: r.pin_attempts,
    status: r.status,
    durationMinutes: r.duration_minutes,
    checklistState: r.checklist_state ?? {},
  }
}

export function rowToReport(r: VisitReportRow): VisitReport {
  return {
    id: r.id,
    bookingId: r.booking_id,
    partnerId: r.partner_id,
    attendeesCount: r.attendees_count,
    roomsShown: r.rooms_shown ?? [],
    questionsAsked: r.questions_asked ?? [],
    observations: r.observations ?? [],
    issues: (r.issues ?? []) as ReportedIssue[],
    photoPaths: r.photo_paths ?? [],
    checklistResults: r.checklist_results ?? {},
    generatedAt: r.generated_at,
  }
}

// ───────────────────────────── Sesión ─────────────────────────────

async function currentUserId(): Promise<string | null> {
  const supabase = tryCreateClient()
  if (!supabase) return null
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

export async function hasSession(): Promise<boolean> {
  return (await currentUserId()) !== null
}

export type Role = 'CLIENT' | 'PARTNER' | 'ADMIN'

/** Rol del usuario. Sin sesión o sin base, CLIENT: el permiso más bajo. */
export async function getMyRole(): Promise<Role> {
  const supabase = tryCreateClient()
  if (!supabase) return 'CLIENT'
  const uid = await currentUserId()
  if (!uid) return 'CLIENT'
  const { data } = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle()
  return (data?.role as Role) ?? 'CLIENT'
}

// ───────────────────────────── Partners ─────────────────────────────

/**
 * Partners visibles en el marketplace.
 * RLS ya filtra a los ACTIVE; el filtro explícito es defensa en profundidad,
 * no redundancia: si alguien afloja la política, esto sigue de pie.
 */
export async function listActivePartners(serviceType?: VisitServiceType): Promise<PartnerPublicProfile[]> {
  const supabase = tryCreateClient()
  if (!supabase) return []
  let q = supabase.from('visit_partners').select('*').eq('status', 'ACTIVE')
  if (serviceType) q = q.contains('service_types', [serviceType as VisitServiceTypeDb])
  const { data, error } = await q
  if (error || !data) return []
  return data.map(rowToPublicProfile)
}

export async function getPartnerById(id: string): Promise<PartnerPublicProfile | null> {
  const supabase = tryCreateClient()
  if (!supabase) return null
  const { data } = await supabase.from('visit_partners').select('*').eq('id', id).maybeSingle()
  return data ? rowToPublicProfile(data) : null
}

/** El perfil de partner del usuario actual, si tiene uno. */
export async function getMyPartner(): Promise<PartnerPublicProfile | null> {
  const supabase = tryCreateClient()
  if (!supabase) return null
  const uid = await currentUserId()
  if (!uid) return null
  const { data } = await supabase.from('visit_partners').select('*').eq('user_id', uid).maybeSingle()
  return data ? rowToPublicProfile(data) : null
}

export interface PartnerDraft {
  displayName: string
  profession?: string
  bio?: string
  experienceYears?: number
  languages?: string[]
  homeZoneLabel?: string
  coverageZones?: string[]
  maxTravelRadiusKm?: number
  serviceTypes?: VisitServiceType[]
  availability?: Record<string, string[]>
  ratePerVisit?: number
}

function initialsOf(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || '?'
}

/**
 * Crea el perfil de partner y sus tablas satélite.
 *
 * Arranca en DRAFT y IN_PROGRESS: nadie queda habilitado por completar un
 * formulario. La habilitación la da un admin después de verificar.
 */
export async function createMyPartner(d: PartnerDraft): Promise<string | null> {
  const supabase = tryCreateClient()
  if (!supabase) return null
  const uid = await currentUserId()
  if (!uid) return null

  const { data, error } = await supabase
    .from('visit_partners')
    .insert({
      user_id: uid,
      display_name: d.displayName,
      initials: initialsOf(d.displayName),
      profession: d.profession ?? null,
      bio: d.bio ?? null,
      experience_years: d.experienceYears ?? null,
      languages: d.languages ?? [],
      home_zone_label: d.homeZoneLabel ?? '',
      coverage_zones: d.coverageZones ?? [],
      max_travel_radius_km: d.maxTravelRadiusKm ?? 10,
      service_types: (d.serviceTypes ?? []) as VisitServiceTypeDb[],
      availability: d.availability ?? {},
      rate_per_visit: d.ratePerVisit ?? 0,
      status: 'DRAFT',
      onboarding_status: 'IN_PROGRESS',
    })
    .select('id')
    .single()

  if (error || !data) return null

  // El rol cambia recién acá: alguien que empezó el alta ya es partner,
  // aunque todavía no esté aprobado.
  await supabase.from('profiles').update({ role: 'PARTNER' }).eq('id', uid)
  await supabase.from('partner_training').insert({ partner_id: data.id, user_id: uid })
  await supabase.from('partner_contacts').insert({ partner_id: data.id, user_id: uid })

  await track('partner_onboarding_started', { partnerId: data.id })
  return data.id
}

export async function updateMyPartner(partnerId: string, d: Partial<PartnerDraft>): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  // Tipado como la fila, no como Record<string, unknown>: así un nombre de
  // columna mal escrito falla al compilar y no en silencio contra la base.
  const patch: Partial<VisitPartnerRow> = {}
  if (d.displayName !== undefined) { patch.display_name = d.displayName; patch.initials = initialsOf(d.displayName) }
  if (d.profession !== undefined) patch.profession = d.profession
  if (d.bio !== undefined) patch.bio = d.bio
  if (d.experienceYears !== undefined) patch.experience_years = d.experienceYears
  if (d.languages !== undefined) patch.languages = d.languages
  if (d.homeZoneLabel !== undefined) patch.home_zone_label = d.homeZoneLabel
  if (d.coverageZones !== undefined) patch.coverage_zones = d.coverageZones
  if (d.maxTravelRadiusKm !== undefined) patch.max_travel_radius_km = d.maxTravelRadiusKm
  if (d.serviceTypes !== undefined) patch.service_types = d.serviceTypes
  if (d.availability !== undefined) patch.availability = d.availability
  if (d.ratePerVisit !== undefined) patch.rate_per_visit = d.ratePerVisit
  if (Object.keys(patch).length === 0) return true
  const { error } = await supabase.from('visit_partners').update(patch).eq('id', partnerId)
  return !error
}

/** Datos privados del partner. Solo el dueño o admin los obtienen (RLS). */
export async function saveMyContact(
  partnerId: string,
  c: { phone?: string; email?: string; addressLine?: string; addressCity?: string },
): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const uid = await currentUserId()
  if (!uid) return false
  const { error } = await supabase.from('partner_contacts').upsert({
    partner_id: partnerId,
    user_id: uid,
    phone: c.phone ?? null,
    email: c.email ?? null,
    address_line: c.addressLine ?? null,
    address_city: c.addressCity ?? null,
  })
  return !error
}

// ───────────────────── Onboarding: referencias ─────────────────────

function rowToReference(r: PartnerReferenceRow): PartnerReference {
  return {
    id: r.id,
    partnerId: r.partner_id,
    name: r.name,
    relationship: r.relationship,
    contactEmail: r.contact_email,
    contactPhone: r.contact_phone,
    status: r.status,
    requestedAt: r.requested_at,
    respondedAt: r.responded_at,
    answers: (r.answers as ReferenceAnswers | null) ?? null,
  }
}

export async function listMyReferences(partnerId: string): Promise<PartnerReference[]> {
  const supabase = tryCreateClient()
  if (!supabase) return []
  const { data } = await supabase.from('partner_references').select('*')
    .eq('partner_id', partnerId).order('created_at')
  return (data ?? []).map(rowToReference)
}

export async function addReference(
  partnerId: string,
  r: { name: string; relationship: string; contactEmail?: string; contactPhone?: string },
): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const uid = await currentUserId()
  if (!uid) return false
  const { error } = await supabase.from('partner_references').insert({
    partner_id: partnerId,
    user_id: uid,
    name: r.name,
    relationship: r.relationship,
    contact_email: r.contactEmail ?? null,
    contact_phone: r.contactPhone ?? null,
    status: 'PENDING',
  })
  return !error
}

export async function deleteReference(id: string): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const { error } = await supabase.from('partner_references').delete().eq('id', id)
  return !error
}

/**
 * Marca la referencia como solicitada.
 *
 * MANUAL en el piloto: no hay envío automático de mails. Un operador de VARA
 * contacta a la referencia y carga la respuesta. Prometer un mail que nunca
 * sale sería peor que decir que es manual.
 */
export async function markReferenceRequested(id: string): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const { error } = await supabase.from('partner_references')
    .update({ status: 'REQUESTED', requested_at: new Date().toISOString() })
    .eq('id', id)
  return !error
}

// ───────────────────── Onboarding: capacitación ─────────────────────

function rowToTraining(r: PartnerTrainingRow): PartnerTraining {
  return {
    partnerId: r.partner_id,
    modulesCompleted: r.modules_completed ?? [],
    quizScore: r.quiz_score === null ? null : Number(r.quiz_score),
    quizAttempts: r.quiz_attempts,
    certificationStatus: r.certification_status,
    certificationDate: r.certification_date,
    expirationDate: r.expiration_date,
    updatedAt: r.updated_at,
  }
}

export async function getMyTraining(partnerId: string): Promise<PartnerTraining | null> {
  const supabase = tryCreateClient()
  if (!supabase) return null
  const { data } = await supabase.from('partner_training').select('*')
    .eq('partner_id', partnerId).maybeSingle()
  return data ? rowToTraining(data) : null
}

export async function markModuleCompleted(partnerId: string, moduleId: string): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const current = await getMyTraining(partnerId)
  const modules = new Set(current?.modulesCompleted ?? [])
  modules.add(moduleId)
  const { error } = await supabase.from('partner_training').update({
    modules_completed: [...modules],
    certification_status: current?.certificationStatus === 'CERTIFIED' ? 'CERTIFIED' : 'IN_PROGRESS',
  }).eq('partner_id', partnerId)
  return !error
}

/**
 * Guarda el resultado del quiz.
 *
 * Aprobar el quiz marca `certified` en el perfil, pero NO activa al partner:
 * activar requiere entrevista, referencias y visitas supervisadas, y esa
 * decisión es de un admin.
 */
export async function saveQuizResult(
  partnerId: string, score: number, passed: boolean,
): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const current = await getMyTraining(partnerId)
  const attempts = (current?.quizAttempts ?? 0) + 1

  const { error } = await supabase.from('partner_training').update({
    quiz_score: score,
    quiz_attempts: attempts,
    certification_status: passed ? 'CERTIFIED' : 'FAILED',
    certification_date: passed ? new Date().toISOString() : null,
  }).eq('partner_id', partnerId)

  if (!error && passed) {
    await supabase.from('visit_partners').update({ certified: true }).eq('id', partnerId)
    await track('partner_certified', { partnerId })
  }
  return !error
}

// ─────────────────── Verificación (lectura del partner) ───────────────────

export async function getMyVerification(partnerId: string): Promise<PartnerVerification | null> {
  const supabase = tryCreateClient()
  if (!supabase) return null
  const { data } = await supabase.from('partner_verifications').select('*')
    .eq('partner_id', partnerId).maybeSingle()
  if (!data) return null
  const r = data as PartnerVerificationRow
  return {
    partnerId: r.partner_id,
    identityStatus: r.identity_status,
    documentVerificationStatus: r.document_verification_status,
    addressVerificationStatus: r.address_verification_status,
    referenceCheckStatus: r.reference_check_status,
    interviewStatus: r.interview_status,
    trainingStatus: r.training_status,
    supervisedVisitsCompleted: r.supervised_visits_completed,
    riskReviewStatus: r.risk_review_status,
    backgroundEligibilityStatus: r.background_eligibility_status,
    verificationProvider: r.verification_provider,
    verificationDate: r.verification_date,
    expirationDate: r.expiration_date,
    overallStatus: r.overall_status,
    reviewedBy: r.reviewed_by,
    reviewedAt: r.reviewed_at,
    rejectionReason: r.rejection_reason,
    updatedAt: r.updated_at,
  }
}

// ───────────────────────────── Bookings ─────────────────────────────

export interface BookingDraft {
  serviceType: VisitServiceType
  propertyId?: string | null
  operationId?: string | null
  date: string
  time: string
  durationMinutes: number
  locationLabel: string
  instructions?: string
  accessInstructions?: string
  guestsExpected?: number
  price: number
  currency: Currency
  assignmentMode: 'CLIENT_CHOICE' | 'VARA_MATCH'
  chosenPartnerId?: string | null
}

/**
 * Crea la visita.
 *
 * El PIN se genera acá, al crear: el cliente lo tiene desde el momento cero y
 * no depende de que llegue una notificación. El número de secuencia del código
 * sale de Postgres — generarlo en el cliente produciría colisiones con dos
 * personas reservando a la vez.
 */
export async function createBooking(d: BookingDraft): Promise<VisitBooking | null> {
  const supabase = tryCreateClient()
  if (!supabase) return null
  const uid = await currentUserId()
  if (!uid) return null

  const { data: seq } = await supabase.rpc('next_visit_code_seq') as { data: number | null }
  // Si la función todavía no está aplicada, el timestamp sirve: es único en la
  // práctica y no bloquea la reserva. El código sigue siendo legible.
  const sequence = seq ?? Number(String(Date.now()).slice(-6))

  const { data, error } = await supabase
    .from('visit_bookings')
    .insert({
      visit_code: buildVisitCode(d.locationLabel, sequence),
      requester_user_id: uid,
      property_id: d.propertyId ?? null,
      operation_id: d.operationId ?? null,
      service_type: d.serviceType as VisitServiceTypeDb,
      requested_date: d.date,
      requested_time: d.time,
      duration_minutes: d.durationMinutes,
      location_label: d.locationLabel,
      instructions: d.instructions ?? null,
      access_instructions: d.accessInstructions ?? null,
      guests_expected: d.guestsExpected ?? null,
      price: d.price,
      currency: d.currency,
      assignment_mode: d.assignmentMode,
      assigned_partner_id: d.chosenPartnerId ?? null,
      status: d.chosenPartnerId ? 'ASSIGNED' : 'SEARCHING_PARTNER',
      confirmation_pin: generatePin(),
    })
    .select('*')
    .single()

  if (error || !data) return null

  if (d.chosenPartnerId) {
    await supabase.from('visit_assignments').insert({
      booking_id: data.id, partner_id: d.chosenPartnerId,
    })
    await track('visit_assigned', { bookingId: data.id, partnerId: d.chosenPartnerId })
  }
  await track('visit_requested', { bookingId: data.id, props: { serviceType: d.serviceType } })

  return rowToBooking(data)
}

export async function listMyBookings(): Promise<VisitBooking[]> {
  const supabase = tryCreateClient()
  if (!supabase) return []
  const { data } = await supabase.from('visit_bookings').select('*')
    .order('requested_date', { ascending: false })
  return (data ?? []).map(rowToBooking)
}

export async function getBookingByCode(code: string): Promise<VisitBooking | null> {
  const supabase = tryCreateClient()
  if (!supabase) return null
  const { data } = await supabase.from('visit_bookings').select('*')
    .eq('visit_code', code).maybeSingle()
  return data ? rowToBooking(data) : null
}

/** El PIN solo lo puede leer el cliente dueño de la visita (RLS lo garantiza). */
export async function getBookingPin(bookingId: string): Promise<string | null> {
  const supabase = tryCreateClient()
  if (!supabase) return null
  const { data } = await supabase.from('visit_bookings')
    .select('confirmation_pin').eq('id', bookingId).maybeSingle()
  return data?.confirmation_pin ?? null
}

export async function setBookingStatus(
  bookingId: string, status: VisitStatus, reason?: string,
): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const { error } = await supabase.from('visit_bookings')
    .update({ status, cancellation_reason: reason ?? null })
    .eq('id', bookingId)
  return !error
}

/** Visitas asignadas al partner actual. Es la bandeja de su portal. */
export async function listPartnerBookings(partnerId: string): Promise<VisitBooking[]> {
  const supabase = tryCreateClient()
  if (!supabase) return []
  const { data } = await supabase.from('visit_bookings').select('*')
    .eq('assigned_partner_id', partnerId)
    .order('requested_date')
  return (data ?? []).map(rowToBooking)
}

export async function acceptAssignment(bookingId: string, partnerId: string): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  await supabase.from('visit_assignments')
    .update({ accepted_at: new Date().toISOString() })
    .eq('booking_id', bookingId).eq('partner_id', partnerId)
  const ok = await setBookingStatus(bookingId, 'CONFIRMED')
  if (ok) await track('visit_accepted_by_partner', { bookingId, partnerId })
  return ok
}

/**
 * El partner rechaza.
 * La visita vuelve a SEARCHING_PARTNER, no a CANCELLED: un rechazo no es
 * el fin del pedido del cliente.
 */
export async function rejectAssignment(
  bookingId: string, partnerId: string, reason?: string,
): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  await supabase.from('visit_assignments')
    .update({ rejected_at: new Date().toISOString(), rejection_reason: reason ?? null })
    .eq('booking_id', bookingId).eq('partner_id', partnerId)
  const { error } = await supabase.from('visit_bookings')
    .update({ status: 'SEARCHING_PARTNER', assigned_partner_id: null })
    .eq('id', bookingId)
  if (!error) await track('visit_rejected_by_partner', { bookingId, partnerId })
  return !error
}

/** Asignación manual (admin) o automática. */
export async function assignPartner(bookingId: string, partnerId: string): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const { error } = await supabase.from('visit_bookings')
    .update({ assigned_partner_id: partnerId, status: 'ASSIGNED' })
    .eq('id', bookingId)
  if (error) return false
  await supabase.from('visit_assignments').insert({ booking_id: bookingId, partner_id: partnerId })
  await track('visit_assigned', { bookingId, partnerId })
  return true
}

// ───────────────────────────── Sesiones ─────────────────────────────

export async function getSession(bookingId: string): Promise<VisitSession | null> {
  const supabase = tryCreateClient()
  if (!supabase) return null
  const { data } = await supabase.from('visit_sessions').select('*')
    .eq('booking_id', bookingId).maybeSingle()
  return data ? rowToSession(data) : null
}

export async function ensureSession(bookingId: string, partnerId: string): Promise<VisitSession | null> {
  const existing = await getSession(bookingId)
  if (existing) return existing
  const supabase = tryCreateClient()
  if (!supabase) return null
  const { data } = await supabase.from('visit_sessions')
    .insert({ booking_id: bookingId, partner_id: partnerId })
    .select('*').single()
  return data ? rowToSession(data) : null
}

export async function checkIn(
  bookingId: string, partnerId: string, location: GeoPoint | null,
): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const now = new Date().toISOString()
  const { error } = await supabase.from('visit_sessions').update({
    check_in_at: now,
    check_in_lat: location?.lat ?? null,
    check_in_lng: location?.lng ?? null,
    check_in_accuracy_m: location?.accuracyM ?? null,
    status: 'CHECKED_IN',
  }).eq('booking_id', bookingId)
  if (error) return false
  await setBookingStatus(bookingId, 'ARRIVED')
  await track('visit_checked_in', {
    bookingId, partnerId,
    // Nunca guardamos coordenadas en el evento: solo si hubo o no.
    props: { hasLocation: location !== null },
  })
  return true
}

/** Registra el resultado del PIN. La verificación en sí vive en `session.ts`. */
export async function recordPinResult(
  bookingId: string, partnerId: string, ok: boolean, attempts: number,
): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const { error } = await supabase.from('visit_sessions').update({
    confirmation_pin_status: ok ? 'CONFIRMED' : 'FAILED',
    pin_attempts: attempts,
  }).eq('booking_id', bookingId)
  await track(ok ? 'visit_pin_confirmed' : 'visit_pin_failed', { bookingId, partnerId })
  return !error
}

export async function startVisit(bookingId: string): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const { error } = await supabase.from('visit_sessions')
    .update({ status: 'IN_PROGRESS' }).eq('booking_id', bookingId)
  if (error) return false
  return setBookingStatus(bookingId, 'IN_PROGRESS')
}

export async function saveChecklist(
  bookingId: string, state: Record<string, boolean>,
): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const { error } = await supabase.from('visit_sessions')
    .update({ checklist_state: state }).eq('booking_id', bookingId)
  return !error
}

export async function checkOut(
  bookingId: string, partnerId: string, location: GeoPoint | null, minutes: number,
): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const { error } = await supabase.from('visit_sessions').update({
    check_out_at: new Date().toISOString(),
    check_out_lat: location?.lat ?? null,
    check_out_lng: location?.lng ?? null,
    check_out_accuracy_m: location?.accuracyM ?? null,
    status: 'CHECKED_OUT',
    duration_minutes: minutes,
  }).eq('booking_id', bookingId)
  if (error) return false
  await setBookingStatus(bookingId, 'COMPLETED')
  await track('visit_checked_out', { bookingId, partnerId, props: { minutes } })
  await track('visit_completed', { bookingId, partnerId })
  return true
}

// ───────────────────────────── Reportes ─────────────────────────────

export async function getReport(bookingId: string): Promise<VisitReport | null> {
  const supabase = tryCreateClient()
  if (!supabase) return null
  const { data } = await supabase.from('visit_reports').select('*')
    .eq('booking_id', bookingId).maybeSingle()
  return data ? rowToReport(data) : null
}

export async function submitReport(
  bookingId: string,
  partnerId: string,
  r: Omit<VisitReport, 'id' | 'bookingId' | 'partnerId' | 'generatedAt'>,
): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const { error } = await supabase.from('visit_reports').upsert({
    booking_id: bookingId,
    partner_id: partnerId,
    attendees_count: r.attendeesCount,
    rooms_shown: r.roomsShown,
    questions_asked: r.questionsAsked,
    observations: r.observations,
    issues: r.issues,
    photo_paths: r.photoPaths,
    checklist_results: r.checklistResults,
  })
  if (!error) await track('visit_report_submitted', { bookingId, partnerId })
  return !error
}

/** Reportes de las visitas de una propiedad. Alimenta a VARA AI. */
export async function listReportsForProperty(propertyId: string): Promise<VisitReport[]> {
  const supabase = tryCreateClient()
  if (!supabase) return []
  const { data: bookings } = await supabase.from('visit_bookings')
    .select('id').eq('property_id', propertyId)
  const ids = (bookings ?? []).map(b => b.id)
  if (ids.length === 0) return []
  const { data } = await supabase.from('visit_reports').select('*').in('booking_id', ids)
  return (data ?? []).map(rowToReport)
}

// ───────────────────────────── Reviews ─────────────────────────────

export async function submitPartnerReview(
  r: Omit<PartnerReview, 'id' | 'createdAt'>,
): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const { error } = await supabase.from('partner_reviews').insert({
    booking_id: r.bookingId,
    reviewer_user_id: r.reviewerUserId,
    partner_id: r.partnerId,
    punctuality: r.punctuality,
    professionalism: r.professionalism,
    communication: r.communication,
    knowledge: r.knowledge,
    report_quality: r.reportQuality,
    overall_rating: r.overallRating,
    comment: r.comment,
  })
  if (error) return false

  // Acumulado: sumar una review es un UPDATE, no un recálculo de toda la tabla.
  const p = await getPartnerById(r.partnerId)
  if (p) {
    await supabase.from('visit_partners').update({
      rating_sum: (p.metrics.averageRating ?? 0) * p.metrics.reviewCount + r.overallRating,
      review_count: p.metrics.reviewCount + 1,
    }).eq('id', r.partnerId)
    await supabase.rpc('recompute_partner_tier', { p_partner_id: r.partnerId })
  }
  await track('visit_reviewed_by_client', { bookingId: r.bookingId, partnerId: r.partnerId })
  return true
}

function flagToCategory(flag: SafetyFlag): SafetyIncident['category'] {
  switch (flag) {
    case 'DIFFERENT_PERSON': return 'IDENTITY'
    case 'MORE_PEOPLE': return 'SAFETY'
    case 'INAPPROPRIATE_CONDUCT': return 'CONDUCT'
    case 'UNSAFE_SITUATION': return 'SAFETY'
    case 'ACCESS_PROBLEM': return 'ACCESS'
    default: return 'OTHER'
  }
}

/**
 * Review del partner sobre el cliente.
 * Los `privateSafetyFlags` NO se publican: si hay alguno, se abre un incidente.
 */
export async function submitClientReview(
  r: Omit<ClientReview, 'id' | 'createdAt'>,
): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const { error } = await supabase.from('client_reviews').insert({
    booking_id: r.bookingId,
    partner_id: r.partnerId,
    client_user_id: r.clientUserId,
    punctuality: r.punctuality,
    respect: r.respect,
    communication: r.communication,
    private_safety_flags: r.privateSafetyFlags,
    comment: r.comment,
  })
  if (error) return false

  if (r.privateSafetyFlags.length > 0) {
    await reportIncident({
      bookingId: r.bookingId,
      reportedUserId: r.clientUserId,
      category: flagToCategory(r.privateSafetyFlags[0]),
      severity: 'LEVEL_2_REVIEW',
      description: `Flags de seguridad marcados por el partner: ${r.privateSafetyFlags.join(', ')}`,
      location: null,
    })
  }
  await track('visit_reviewed_by_partner', { bookingId: r.bookingId, partnerId: r.partnerId })
  return true
}

export async function listPartnerReviews(partnerId: string): Promise<PartnerReview[]> {
  const supabase = tryCreateClient()
  if (!supabase) return []
  const { data } = await supabase.from('partner_reviews').select('*')
    .eq('partner_id', partnerId).order('created_at', { ascending: false })
  return (data ?? []).map(r => ({
    id: r.id,
    bookingId: r.booking_id,
    reviewerUserId: r.reviewer_user_id,
    partnerId: r.partner_id,
    punctuality: r.punctuality,
    professionalism: r.professionalism,
    communication: r.communication,
    knowledge: r.knowledge,
    reportQuality: r.report_quality,
    overallRating: r.overall_rating,
    comment: r.comment,
    createdAt: r.created_at,
  }))
}

// ───────────────────────── Trust & Safety ─────────────────────────

export async function reportIncident(i: {
  bookingId?: string | null
  reportedUserId?: string | null
  category: SafetyIncident['category']
  severity: SafetyIncident['severity']
  description: string
  location: GeoPoint | null
}): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const uid = await currentUserId()
  if (!uid) return false

  const { error } = await supabase.from('safety_incidents').insert({
    booking_id: i.bookingId ?? null,
    reported_by_user_id: uid,
    reported_user_id: i.reportedUserId ?? null,
    category: i.category,
    severity: i.severity,
    description: i.description,
    context_lat: i.location?.lat ?? null,
    context_lng: i.location?.lng ?? null,
    context_accuracy_m: i.location?.accuracyM ?? null,
  })
  if (error) return false

  if (i.bookingId) await setBookingStatus(i.bookingId, 'INCIDENT_REVIEW')
  await track('visit_incident_reported', {
    bookingId: i.bookingId ?? undefined,
    props: { category: i.category, severity: i.severity },
  })
  return true
}

function rowToIncident(r: SafetyIncidentRow): SafetyIncident {
  return {
    id: r.id,
    bookingId: r.booking_id,
    reportedByUserId: r.reported_by_user_id,
    reportedUserId: r.reported_user_id,
    category: r.category,
    severity: r.severity,
    description: r.description,
    contextLocation: geo(r.context_lat, r.context_lng, r.context_accuracy_m, r.created_at),
    status: r.status,
    createdAt: r.created_at,
    reviewedAt: r.reviewed_at,
    reviewedBy: r.reviewed_by,
    resolution: r.resolution,
  }
}

/** Solo admin obtiene filas ajenas: lo garantiza RLS, no este código. */
export async function listIncidents(): Promise<SafetyIncident[]> {
  const supabase = tryCreateClient()
  if (!supabase) return []
  const { data } = await supabase.from('safety_incidents').select('*')
    .order('created_at', { ascending: false })
  return (data ?? []).map(rowToIncident)
}

// ───────────────────────── Lista de espera ─────────────────────────

/** Lo que ofrecemos cuando no hay nadie, en vez de inventar un partner. */
export async function requestCoverage(
  zoneLabel: string, serviceType?: VisitServiceType, note?: string,
): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const uid = await currentUserId()
  if (!uid) return false
  const { error } = await supabase.from('coverage_requests').insert({
    user_id: uid,
    zone_label: zoneLabel,
    service_type: (serviceType ?? null) as VisitServiceTypeDb | null,
    note: note ?? null,
  })
  if (!error) await track('coverage_requested', { props: { zone: zoneLabel } })
  return !error
}

// ───────────────────────── Instrumentación ─────────────────────────

/**
 * Registra un evento.
 *
 * Nunca falla hacia afuera: si la instrumentación rompe, la visita sigue.
 * Y nunca guarda PII ni instrucciones de acceso — solo lo medible.
 */
export async function track(
  name: VisitEventName,
  o: { bookingId?: string; partnerId?: string; props?: Record<string, unknown> } = {},
): Promise<void> {
  try {
    const supabase = tryCreateClient()
    if (!supabase) return
    const uid = await currentUserId()
    await supabase.from('visit_events').insert({
      name,
      user_id: uid,
      booking_id: o.bookingId ?? null,
      partner_id: o.partnerId ?? null,
      props: o.props ?? {},
    })
  } catch {
    // Una métrica perdida no puede romper una visita en curso.
  }
}
