/**
 * Tipos de la base. Espejo de supabase/migrations/20260919000000_initial_schema.sql
 *
 * Con el proyecto ya creado se pueden regenerar con:
 *   npx supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts
 */

import type * as V from './visitRows'

export type OperationTypeDb = 'BUY_PROPERTY' | 'SELL_PROPERTY' | 'LAND_PURCHASE' | 'COMMERCIAL_PROPERTY'
export type OperationStatusDb = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'DRAFT'
export type TaskStatusDb = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'NOT_APPLICABLE'
export type TaskPriorityDb = 'HIGH' | 'MEDIUM' | 'LOW'
export type DocumentStatusDb = 'PENDING' | 'RECEIVED' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED'
export type DocumentCategoryDb =
  | 'ESCRITURA' | 'PLANOS' | 'INFORMES' | 'IMPUESTOS' | 'EXPENSAS' | 'SERVICIOS'
  | 'CERTIFICADOS' | 'CONTRATOS' | 'RESERVA' | 'TASACIONES' | 'OTROS'
export type PropertyTypeDb = 'HOUSE' | 'APARTMENT' | 'PH' | 'LAND' | 'GARAGE' | 'LOCAL' | 'OFFICE' | 'FIELD' | 'DEVELOPMENT_UNIT' | 'INDUSTRIAL' | 'OTHER'
export type CurrencyDb = 'USD' | 'ARS' | 'MXN' | 'CLP' | 'COP' | 'BRL' | 'PEN' | 'UYU' | 'PYG'
// ISO 3166-1 alpha-2
export type CountryCodeDb = 'AR' | 'MX' | 'CL' | 'CO' | 'PE' | 'BR' | 'UY' | 'PY'
export type RiskSeverityDb = 'HIGH' | 'MEDIUM' | 'LOW'
export type RiskCategoryDb = 'DOCUMENTAL' | 'DOMINIAL' | 'FISCAL' | 'LEGAL' | 'FINANCIERO' | 'OPERATIVO'
export type PropertySourceDb = 'IMPORTED' | 'MANUAL'
export type VisitStatusDb = 'PENDIENTE' | 'CONFIRMADA' | 'RECHAZADA' | 'REALIZADA'
export type PublishStatusDb = 'SOLICITADO' | 'EN_PROCESO' | 'PUBLICADO' | 'RECHAZADO'
export type RelationTypeDb =
  | 'SALE_FUNDS_PURCHASE' | 'SALE_MUST_CLOSE_BEFORE_PURCHASE'
  | 'PURCHASE_DEPENDS_ON_SALE' | 'SAME_MOVE' | 'USER_LINKED'

export type ProfileRow = {
  id: string
  full_name: string | null
  /** Agregada por 20260921000000_vara_visit.sql. Default 'CLIENT'. */
  role: V.UserRoleDb
  province: string | null
  country: CountryCodeDb | null
  phone: string | null
  onboarded: boolean
  created_at: string
  updated_at: string
}

export type CandidateStatusDb =
  | 'ANALYZING' | 'FAVORITE' | 'VISITED' | 'DISCARDED' | 'PROMOTED'

export type PropertyRow = {
  id: string
  user_id: string
  source: PropertySourceDb
  source_url: string | null
  portal: string | null
  title: string
  type: PropertyTypeDb
  price: number | null
  currency: CurrencyDb
  address: string | null
  neighborhood: string | null
  city: string | null
  province: string | null
  country: CountryCodeDb | null
  surface_total: number | null
  surface_covered: number | null
  rooms: number | null
  bedrooms: number | null
  bathrooms: number | null
  garage: boolean
  description: string | null
  features: string[]
  expenses: number | null
  age_years: number | null
  remote_images: string[]
  // Decision Center: una propiedad en evaluacion NO es todavia una operacion.
  candidate_status: CandidateStatusDb
  promoted_operation_id: string | null
  promoted_at: string | null
  user_notes: string | null
  discard_reason: string | null
  created_at: string
  updated_at: string
}

export type PropertyPhotoRow = {
  id: string
  user_id: string
  property_id: string | null
  storage_path: string
  label: string
  is_cover: boolean
  position: number
  created_at: string
}

export type OperationRow = {
  id: string
  user_id: string
  property_id: string | null
  type: OperationTypeDb
  status: OperationStatusDb
  title: string
  subtitle: string | null
  province: string
  province_code: string
  country: CountryCodeDb | null
  locale: string | null
  city: string | null
  current_stage_key: string | null
  stages_state: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type OperationTaskRow = {
  id: string
  user_id: string
  operation_id: string
  stage_key: string
  task_key: string
  title: string
  description: string | null
  why: string | null
  status: TaskStatusDb
  priority: TaskPriorityDb
  notes: string | null
  due_date: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type ParticipantRoleDb =
  | 'NOTARY' | 'BROKER' | 'ACCOUNTANT' | 'LAWYER'
  | 'APPRAISER' | 'COUNTERPARTY' | 'BANK' | 'OTHER'

/** Datos de contacto de terceros. Solo los ve quien los carga. */
export type OperationParticipantRow = {
  id: string
  user_id: string
  operation_id: string
  name: string
  role: ParticipantRoleDb
  email: string | null
  phone: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type ActivityKindDb =
  | 'OPERATION_CREATED' | 'DOCUMENT_REQUESTED' | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_STATUS_CHANGED' | 'DOCUMENT_REMOVED' | 'OFFER_CREATED'
  | 'OFFER_SENT' | 'OFFER_STATUS_CHANGED' | 'PROPERTY_PROMOTED' | 'NOTE_ADDED'

/** Append-only: solo se lee. Los triggers de la base son quienes escriben. */
export type ActivityEventRow = {
  id: string
  user_id: string
  operation_id: string
  kind: ActivityKindDb
  summary: string
  detail: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export type OfferStatusDb =
  | 'DRAFT' | 'SENT' | 'COUNTERED' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN' | 'EXPIRED'

export type OfferPartyDb = 'BUYER' | 'SELLER'

/** Una oferta. `amount` llega como number desde numeric(14,2). */
export type OfferRow = {
  id: string
  user_id: string
  operation_id: string
  property_id: string | null
  parent_offer_id: string | null
  party: OfferPartyDb
  status: OfferStatusDb
  amount: number
  currency: string
  conditions: string[]
  valid_until: string | null
  message: string | null
  response_note: string | null
  responded_at: string | null
  created_at: string
  updated_at: string
}

export type OperationDocumentRow = {
  id: string
  user_id: string
  operation_id: string
  task_id: string | null
  name: string
  category: DocumentCategoryDb
  status: DocumentStatusDb
  storage_path: string | null
  version: number
  notes: string | null
  document_date: string | null
  created_at: string
  updated_at: string
}

export type OperationRiskRow = {
  id: string
  user_id: string
  operation_id: string
  severity: RiskSeverityDb
  category: RiskCategoryDb
  label: string
  detail: string | null
  evidence: string | null
  recommendation: string | null
  resolved: boolean
  created_at: string
}

export type OperationRelationRow = {
  id: string
  user_id: string
  from_operation_id: string
  to_operation_id: string
  type: RelationTypeDb
  metadata: Record<string, unknown>
  created_at: string
}

export type VisitRequestRow = {
  id: string
  user_id: string
  property_id: string | null
  buyer_name: string
  buyer_phone: string | null
  buyer_email: string | null
  visit_date: string
  visit_time: string | null
  message: string | null
  status: VisitStatusDb
  agent: string | null
  created_at: string
  updated_at: string
}

export type PublishRequestRow = {
  id: string
  user_id: string
  property_id: string
  portal: string
  status: PublishStatusDb
  listing_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

/**
 * Al insertar solo son obligatorias las columnas NOT NULL sin default.
 * El resto las completa Postgres.
 */
type Insert<T, Req extends keyof T> = Pick<T, Req> & Partial<Omit<T, Req>>

/** Supabase exige Row/Insert/Update/Relationships en cada tabla. Sin Relationships infiere `never`. */
type Tbl<R, Req extends keyof R> = {
  Row: R
  Insert: Insert<R, Req>
  Update: Partial<R>
  Relationships: []
}

export type Database = {
  public: {
    // Supabase exige estas cuatro claves aunque estén vacías: sin ellas
    // el cliente no infiere los tipos de insert/update.
    Views: Record<never, never>
    /** Funciones RPC declaradas en las migraciones. Sin esto, `.rpc()` infiere `never`. */
    Functions: {
      next_visit_code_seq: { Args: Record<string, never>; Returns: number }
      recompute_partner_tier: { Args: { p_partner_id: string }; Returns: undefined }
    }
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
    Tables: {
      profiles: Tbl<ProfileRow, 'id'>
      properties: Tbl<PropertyRow, 'user_id'>
      property_photos: Tbl<PropertyPhotoRow, 'user_id' | 'storage_path'>
      operations: Tbl<OperationRow, 'user_id' | 'type'>
      operation_tasks: Tbl<OperationTaskRow, 'user_id' | 'operation_id' | 'stage_key' | 'task_key' | 'title'>
      operation_documents: Tbl<OperationDocumentRow, 'user_id' | 'operation_id' | 'name'>
      offers: Tbl<OfferRow, 'user_id' | 'operation_id' | 'amount'>
      activity_events: Tbl<ActivityEventRow, 'user_id' | 'operation_id' | 'kind' | 'summary'>
      operation_participants: Tbl<OperationParticipantRow, 'user_id' | 'operation_id' | 'name'>
      operation_risks: Tbl<OperationRiskRow, 'user_id' | 'operation_id' | 'severity' | 'category' | 'label'>
      operation_relations: Tbl<OperationRelationRow, 'user_id' | 'from_operation_id' | 'to_operation_id' | 'type'>
      visit_requests: Tbl<VisitRequestRow, 'user_id' | 'buyer_name' | 'visit_date'>
      publish_requests: Tbl<PublishRequestRow, 'user_id' | 'property_id' | 'portal'>

      // ── VARA Visit ── (filas en ./visitRows.ts)
      visit_partners: Tbl<V.VisitPartnerRow, 'user_id' | 'display_name' | 'initials'>
      partner_contacts: Tbl<V.PartnerContactRow, 'partner_id' | 'user_id'>
      partner_verifications: Tbl<V.PartnerVerificationRow, 'partner_id' | 'user_id'>
      partner_references: Tbl<V.PartnerReferenceRow, 'partner_id' | 'user_id' | 'name' | 'relationship'>
      partner_training: Tbl<V.PartnerTrainingRow, 'partner_id' | 'user_id'>
      visit_bookings: Tbl<V.VisitBookingRow,
        'visit_code' | 'requester_user_id' | 'service_type'
        | 'requested_date' | 'requested_time' | 'location_label'>
      visit_assignments: Tbl<V.VisitAssignmentRow, 'booking_id' | 'partner_id'>
      visit_sessions: Tbl<V.VisitSessionRow, 'booking_id' | 'partner_id'>
      visit_reports: Tbl<V.VisitReportRow, 'booking_id' | 'partner_id'>
      partner_reviews: Tbl<V.PartnerReviewRow,
        'booking_id' | 'reviewer_user_id' | 'partner_id' | 'punctuality'
        | 'professionalism' | 'communication' | 'knowledge' | 'report_quality' | 'overall_rating'>
      client_reviews: Tbl<V.ClientReviewRow,
        'booking_id' | 'partner_id' | 'client_user_id'
        | 'punctuality' | 'respect' | 'communication'>
      safety_incidents: Tbl<V.SafetyIncidentRow, 'reported_by_user_id' | 'category' | 'description'>
      coverage_requests: Tbl<V.CoverageRequestRow, 'user_id' | 'zone_label'>
      visit_events: Tbl<V.VisitEventRow, 'name'>
    }
  }
}
