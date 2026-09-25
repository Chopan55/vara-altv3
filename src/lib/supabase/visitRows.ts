/**
 * Filas de las tablas de VARA Visit.
 * Espejo de supabase/migrations/20260921000000_vara_visit.sql
 *
 * Archivo aparte de `types.ts` por tamaño, no por arquitectura: `Database`
 * las importa y las registra igual que al resto.
 *
 * Los tres planos del partner son TRES tipos distintos a propósito.
 * RLS filtra filas, no columnas: si el teléfono estuviera en
 * `VisitPartnerRow`, ninguna política podría esconderlo.
 *
 * Como en `types.ts`, las filas se declaran con `type` y no con `interface`:
 * una interface no tiene index signature implícita y Supabase la infiere como `never`.
 */

import type { CurrencyDb } from './types'

export type UserRoleDb = 'CLIENT' | 'PARTNER' | 'ADMIN'
export type VisitServiceTypeDb = 'SHOW_PROPERTY' | 'ACCOMPANY_VISIT'
export type PartnerStatusDb =
  | 'DRAFT' | 'PENDING_APPROVAL' | 'ACTIVE'
  | 'PAUSED_BY_PARTNER' | 'SUSPENDED' | 'DEACTIVATED'
export type PartnerTierDb = 'TRAINEE' | 'VERIFIED' | 'PRO' | 'EXPERT' | 'ELITE'
export type PartnerOnboardingStatusDb =
  'NOT_STARTED' | 'IN_PROGRESS' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED'
export type VerificationStatusDb =
  'NOT_STARTED' | 'SUBMITTED' | 'IN_REVIEW' | 'VERIFIED' | 'REJECTED' | 'EXPIRED'
export type BackgroundEligibilityStatusDb =
  | 'NOT_REQUESTED' | 'PENDING_REVIEW'
  | 'VERIFIED_BY_AUTHORIZED_PROCESS' | 'REJECTED' | 'EXPIRED'
export type ReferenceStatusDb = 'PENDING' | 'REQUESTED' | 'RESPONDED' | 'VERIFIED' | 'FAILED'
export type CertificationStatusDb =
  'NOT_STARTED' | 'IN_PROGRESS' | 'QUIZ_PENDING' | 'FAILED' | 'CERTIFIED' | 'EXPIRED'
export type VaraVisitStatusDb =
  | 'REQUESTED' | 'SEARCHING_PARTNER' | 'ASSIGNED' | 'CONFIRMED' | 'PARTNER_EN_ROUTE'
  | 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'INCIDENT_REVIEW'
export type AssignmentModeDb = 'CLIENT_CHOICE' | 'VARA_MATCH'
export type PinStatusDb = 'NOT_REQUIRED' | 'PENDING' | 'CONFIRMED' | 'FAILED'
export type SessionStatusDb =
  'NOT_STARTED' | 'CHECKED_IN' | 'IN_PROGRESS' | 'CHECKED_OUT' | 'ABORTED'
export type IncidentSeverityDb = 'LEVEL_1_MINOR' | 'LEVEL_2_REVIEW' | 'LEVEL_3_CRITICAL'
export type IncidentCategoryDb =
  | 'SAFETY' | 'IDENTITY' | 'PROPERTY_DAMAGE' | 'CONDUCT'
  | 'NO_SHOW' | 'ACCESS' | 'PRIVACY' | 'OTHER'
export type IncidentStatusDb = 'OPEN' | 'IN_REVIEW' | 'ACTION_TAKEN' | 'CLOSED' | 'DISMISSED'

/** PLANO PÚBLICO. Sin teléfono, sin domicilio, sin documento. */
export type VisitPartnerRow = {
  id: string
  user_id: string
  display_name: string
  initials: string
  photo_path: string | null
  bio: string | null
  profession: string | null
  experience_years: number | null
  languages: string[]
  home_zone_label: string
  coverage_zones: string[]
  max_travel_radius_km: number
  service_types: VisitServiceTypeDb[]
  availability: Record<string, string[]>
  rate_per_visit: number
  currency: CurrencyDb
  status: PartnerStatusDb
  tier: PartnerTierDb
  onboarding_status: PartnerOnboardingStatusDb
  verified_identity: boolean
  verified_document: boolean
  verified_phone: boolean
  verified_email: boolean
  certified: boolean
  total_visits: number
  completed_visits: number
  cancelled_visits: number
  on_time_visits: number
  rating_sum: number
  review_count: number
  incident_count: number
  created_at: string
  updated_at: string
}

/** PLANO PRIVADO. Tabla aparte porque RLS no filtra columnas. */
export type PartnerContactRow = {
  partner_id: string
  user_id: string
  phone: string | null
  email: string | null
  address_line: string | null
  address_city: string | null
  updated_at: string
}

/** PLANO COMPLIANCE. El partner lee lo suyo; solo admin escribe. */
export type PartnerVerificationRow = {
  partner_id: string
  user_id: string
  identity_status: VerificationStatusDb
  document_verification_status: VerificationStatusDb
  address_verification_status: VerificationStatusDb
  reference_check_status: VerificationStatusDb
  interview_status: VerificationStatusDb
  training_status: VerificationStatusDb
  supervised_visits_completed: number
  risk_review_status: VerificationStatusDb
  /** LEGAL REVIEW REQUIRED — ARGENTINA DATA PRIVACY. Solo el estado. */
  background_eligibility_status: BackgroundEligibilityStatusDb
  verification_provider: string | null
  verification_date: string | null
  expiration_date: string | null
  overall_status: PartnerOnboardingStatusDb
  reviewed_by: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  updated_at: string
}

export type PartnerReferenceRow = {
  id: string
  partner_id: string
  user_id: string
  name: string
  relationship: string
  contact_email: string | null
  contact_phone: string | null
  status: ReferenceStatusDb
  requested_at: string | null
  responded_at: string | null
  answers: Record<string, unknown> | null
  created_at: string
}

export type PartnerTrainingRow = {
  partner_id: string
  user_id: string
  modules_completed: string[]
  quiz_score: number | null
  quiz_attempts: number
  certification_status: CertificationStatusDb
  certification_date: string | null
  expiration_date: string | null
  updated_at: string
}

export type VisitBookingRow = {
  id: string
  visit_code: string
  requester_user_id: string
  property_id: string | null
  operation_id: string | null
  service_type: VisitServiceTypeDb
  /** YYYY-MM-DD */
  requested_date: string
  /** HH:MM:SS que devuelve Postgres para `time`. */
  requested_time: string
  duration_minutes: number
  location_label: string
  instructions: string | null
  /** Sensible: solo el partner asignado y confirmado, o admin. */
  access_instructions: string | null
  guests_expected: number | null
  price: number
  currency: CurrencyDb
  assignment_mode: AssignmentModeDb
  assigned_partner_id: string | null
  status: VaraVisitStatusDb
  confirmation_pin: string | null
  cancellation_reason: string | null
  created_at: string
  updated_at: string
}

export type VisitAssignmentRow = {
  id: string
  booking_id: string
  partner_id: string
  assigned_at: string
  accepted_at: string | null
  rejected_at: string | null
  rejection_reason: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
}

export type VisitSessionRow = {
  id: string
  booking_id: string
  partner_id: string
  check_in_at: string | null
  check_in_lat: number | null
  check_in_lng: number | null
  check_in_accuracy_m: number | null
  check_out_at: string | null
  check_out_lat: number | null
  check_out_lng: number | null
  check_out_accuracy_m: number | null
  confirmation_pin_status: PinStatusDb
  pin_attempts: number
  status: SessionStatusDb
  duration_minutes: number | null
  checklist_state: Record<string, boolean>
  created_at: string
  updated_at: string
}

export type VisitReportRow = {
  id: string
  booking_id: string
  partner_id: string
  attendees_count: number
  rooms_shown: string[]
  questions_asked: string[]
  observations: string[]
  issues: unknown[]
  photo_paths: string[]
  checklist_results: Record<string, boolean>
  generated_at: string
}

export type PartnerReviewRow = {
  id: string
  booking_id: string
  reviewer_user_id: string
  partner_id: string
  punctuality: number
  professionalism: number
  communication: number
  knowledge: number
  report_quality: number
  overall_rating: number
  comment: string | null
  created_at: string
}

export type ClientReviewRow = {
  id: string
  booking_id: string
  partner_id: string
  client_user_id: string
  punctuality: number
  respect: number
  communication: number
  /** Nunca se publican. Van a Trust & Safety. */
  private_safety_flags: string[]
  comment: string | null
  created_at: string
}

export type SafetyIncidentRow = {
  id: string
  booking_id: string | null
  reported_by_user_id: string
  reported_user_id: string | null
  category: IncidentCategoryDb
  severity: IncidentSeverityDb
  description: string
  context_lat: number | null
  context_lng: number | null
  context_accuracy_m: number | null
  status: IncidentStatusDb
  created_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  resolution: string | null
}

export type CoverageRequestRow = {
  id: string
  user_id: string
  zone_label: string
  service_type: VisitServiceTypeDb | null
  note: string | null
  notified: boolean
  created_at: string
}

export type VisitEventRow = {
  id: number
  name: string
  user_id: string | null
  booking_id: string | null
  partner_id: string | null
  props: Record<string, unknown>
  created_at: string
}
