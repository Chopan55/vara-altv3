/**
 * Operaciones de administración de VARA Visit.
 *
 * Archivo separado de `visits.ts` a propósito: la frontera es explícita.
 * Todo lo de acá solo funciona con rol ADMIN — y eso lo garantiza RLS, no
 * este código. Si un cliente importara este módulo, cada consulta volvería
 * vacía y cada escritura fallaría.
 *
 * La separación además sirve de documentación: mirando los imports de una
 * pantalla se sabe si toca datos de compliance.
 */

import { tryCreateClient } from './client'
import type {
  SafetyIncidentRow, PartnerReferenceRow, CoverageRequestRow,
} from './visitRows'
import type {
  PartnerPublicProfile, PartnerVerification, SafetyIncident,
  PartnerStatus, VerificationStatus, IncidentStatus, VisitBooking,
} from '@/types/varaVisit'
import { rowToPublicProfile, rowToBooking } from './visits'

/** Todos los partners, en cualquier estado. Un cliente solo ve los ACTIVE. */
export async function adminListPartners(): Promise<PartnerPublicProfile[]> {
  const supabase = tryCreateClient()
  if (!supabase) return []
  const { data } = await supabase.from('visit_partners').select('*')
    .order('created_at', { ascending: false })
  return (data ?? []).map(rowToPublicProfile)
}

export async function adminSetPartnerStatus(
  partnerId: string, status: PartnerStatus,
): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const { error } = await supabase.from('visit_partners')
    .update({ status }).eq('id', partnerId)
  return !error
}

/**
 * Crea o actualiza la ficha de verificación.
 *
 * Los booleanos del perfil público (`verified_identity`, etc.) se derivan de
 * acá: son un espejo para que el marketplace no tenga que leer compliance.
 * Si se actualizaran por separado podrían divergir, y un badge que miente es
 * peor que no tener badge.
 */
export async function adminUpsertVerification(
  partnerId: string,
  userId: string,
  patch: Partial<{
    identityStatus: VerificationStatus
    documentVerificationStatus: VerificationStatus
    addressVerificationStatus: VerificationStatus
    referenceCheckStatus: VerificationStatus
    interviewStatus: VerificationStatus
    riskReviewStatus: VerificationStatus
    supervisedVisitsCompleted: number
    rejectionReason: string | null
  }>,
): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const { data: me } = await supabase.auth.getUser()

  const { error } = await supabase.from('partner_verifications').upsert({
    partner_id: partnerId,
    user_id: userId,
    reviewed_by: me.user?.id ?? null,
    reviewed_at: new Date().toISOString(),
    ...(patch.identityStatus ? { identity_status: patch.identityStatus } : {}),
    ...(patch.documentVerificationStatus
      ? { document_verification_status: patch.documentVerificationStatus } : {}),
    ...(patch.addressVerificationStatus
      ? { address_verification_status: patch.addressVerificationStatus } : {}),
    ...(patch.referenceCheckStatus
      ? { reference_check_status: patch.referenceCheckStatus } : {}),
    ...(patch.interviewStatus ? { interview_status: patch.interviewStatus } : {}),
    ...(patch.riskReviewStatus ? { risk_review_status: patch.riskReviewStatus } : {}),
    ...(patch.supervisedVisitsCompleted !== undefined
      ? { supervised_visits_completed: patch.supervisedVisitsCompleted } : {}),
    ...(patch.rejectionReason !== undefined
      ? { rejection_reason: patch.rejectionReason } : {}),
  })
  if (error) return false

  // Espejo al perfil público, para que el badge no pueda divergir del compliance.
  if (patch.identityStatus || patch.documentVerificationStatus) {
    await supabase.from('visit_partners').update({
      ...(patch.identityStatus
        ? { verified_identity: patch.identityStatus === 'VERIFIED' } : {}),
      ...(patch.documentVerificationStatus
        ? { verified_document: patch.documentVerificationStatus === 'VERIFIED' } : {}),
    }).eq('id', partnerId)
  }
  return true
}

/**
 * Aprobación final: el partner pasa a ACTIVE.
 *
 * Se chequea contra el estado real, no contra lo que el admin cree. Si falta
 * identidad o certificación, no se activa — ni siquiera manualmente. Ese es
 * el punto de tener un proceso.
 */
export async function adminApprovePartner(partnerId: string): Promise<
  { ok: true } | { ok: false; missing: string[] }
> {
  const supabase = tryCreateClient()
  if (!supabase) return { ok: false, missing: ['Sin conexión a la base'] }

  const { data: p } = await supabase.from('visit_partners').select('*')
    .eq('id', partnerId).maybeSingle()
  if (!p) return { ok: false, missing: ['No existe el partner'] }

  const { data: v } = await supabase.from('partner_verifications').select('*')
    .eq('partner_id', partnerId).maybeSingle()

  const missing: string[] = []
  if (!p.verified_identity) missing.push('Identidad verificada')
  if (!p.certified) missing.push('Capacitación aprobada')
  if (v?.reference_check_status !== 'VERIFIED') missing.push('Referencias verificadas')
  if (v?.interview_status !== 'VERIFIED') missing.push('Entrevista aprobada')
  if ((v?.supervised_visits_completed ?? 0) < 3) missing.push('3 visitas supervisadas')

  if (missing.length > 0) return { ok: false, missing }

  await supabase.from('visit_partners')
    .update({ status: 'ACTIVE', onboarding_status: 'APPROVED' })
    .eq('id', partnerId)
  await supabase.from('partner_verifications')
    .update({ overall_status: 'APPROVED' })
    .eq('partner_id', partnerId)
  await supabase.rpc('recompute_partner_tier', { p_partner_id: partnerId })
  return { ok: true }
}

export async function adminGetVerification(partnerId: string): Promise<PartnerVerification | null> {
  const supabase = tryCreateClient()
  if (!supabase) return null
  const { data: r } = await supabase.from('partner_verifications').select('*')
    .eq('partner_id', partnerId).maybeSingle()
  if (!r) return null
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

export async function adminListReferences(partnerId: string): Promise<PartnerReferenceRow[]> {
  const supabase = tryCreateClient()
  if (!supabase) return []
  const { data } = await supabase.from('partner_references').select('*')
    .eq('partner_id', partnerId).order('created_at')
  return data ?? []
}

export async function adminSetReferenceStatus(
  referenceId: string, status: 'VERIFIED' | 'FAILED',
): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const { error } = await supabase.from('partner_references')
    .update({ status, responded_at: new Date().toISOString() })
    .eq('id', referenceId)
  return !error
}

// ───────────────────────── Incidentes ─────────────────────────

function rowToIncident(r: SafetyIncidentRow): SafetyIncident {
  return {
    id: r.id,
    bookingId: r.booking_id,
    reportedByUserId: r.reported_by_user_id,
    reportedUserId: r.reported_user_id,
    category: r.category,
    severity: r.severity,
    description: r.description,
    contextLocation: r.context_lat !== null && r.context_lng !== null
      ? {
          lat: r.context_lat, lng: r.context_lng,
          accuracyM: r.context_accuracy_m, capturedAt: r.created_at,
        }
      : null,
    status: r.status,
    createdAt: r.created_at,
    reviewedAt: r.reviewed_at,
    reviewedBy: r.reviewed_by,
    resolution: r.resolution,
  }
}

export async function adminListIncidents(): Promise<SafetyIncident[]> {
  const supabase = tryCreateClient()
  if (!supabase) return []
  const { data } = await supabase.from('safety_incidents').select('*')
    .order('created_at', { ascending: false })
  return (data ?? []).map(rowToIncident)
}

export async function adminResolveIncident(
  incidentId: string, status: IncidentStatus, resolution: string,
): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const { data: me } = await supabase.auth.getUser()
  const { error } = await supabase.from('safety_incidents').update({
    status,
    resolution,
    reviewed_at: new Date().toISOString(),
    reviewed_by: me.user?.id ?? null,
  }).eq('id', incidentId)
  return !error
}

// ───────────────────── Visitas y cobertura ─────────────────────

/** Visitas sin partner. Es la cola de asignación manual del piloto. */
export async function adminListUnassigned(): Promise<VisitBooking[]> {
  const supabase = tryCreateClient()
  if (!supabase) return []
  const { data } = await supabase.from('visit_bookings').select('*')
    .in('status', ['REQUESTED', 'SEARCHING_PARTNER'])
    .order('requested_date')
  return (data ?? []).map(rowToBooking)
}

export async function adminListAllBookings(): Promise<VisitBooking[]> {
  const supabase = tryCreateClient()
  if (!supabase) return []
  const { data } = await supabase.from('visit_bookings').select('*')
    .order('created_at', { ascending: false })
  return (data ?? []).map(rowToBooking)
}

/** Dónde nos están pidiendo cobertura. Define a qué zona ir a buscar partners. */
export async function adminListCoverageRequests(): Promise<CoverageRequestRow[]> {
  const supabase = tryCreateClient()
  if (!supabase) return []
  const { data } = await supabase.from('coverage_requests').select('*')
    .order('created_at', { ascending: false })
  return data ?? []
}
