/**
 * VARA Visit — modelo de dominio.
 *
 * Regla que organiza todo este archivo: los datos de una persona viven en TRES
 * planos separados, y nunca se mezclan en un mismo objeto.
 *
 *   PUBLIC      → lo que ve cualquier cliente en el marketplace.
 *   PRIVATE     → lo que se revela recién con una asignación confirmada (teléfono).
 *   COMPLIANCE  → verificación, documentos, antecedentes. Solo admin.
 *
 * Si un campo sensible aparece en un objeto público, es un bug de privacidad,
 * no un detalle de UI. El tipo es la barrera.
 *
 * Reemplaza a `src/types/visitTypes.ts`, que mezclaba los tres planos y traía
 * personas de demostración. Ver VARA_VISIT_AUDIT.md §1.1.
 */

// ─────────────────────────────── Roles ───────────────────────────────

export type UserRole = 'CLIENT' | 'PARTNER' | 'ADMIN'

// ────────────────────────── Servicio y zona ──────────────────────────

export type VisitServiceType =
  /** El propietario contrata a alguien para mostrar su propiedad. */
  | 'SHOW_PROPERTY'
  /** El comprador contrata a alguien que lo acompañe a conocer una propiedad. */
  | 'ACCOMPANY_VISIT'

export const SERVICE_LABELS: Record<VisitServiceType, string> = {
  SHOW_PROPERTY: 'Mostrar mi propiedad',
  ACCOMPANY_VISIT: 'Acompañarme a una visita',
}

export const SERVICE_DESCRIPTIONS: Record<VisitServiceType, string> = {
  SHOW_PROPERTY: 'Un Visit Partner muestra tu propiedad a interesados y te deja un reporte.',
  ACCOMPANY_VISIT: 'Un Visit Partner te acompaña, sigue un checklist y te deja un reporte.',
}

/** Disponibilidad del servicio en una zona. Se calcula, no se hardcodea. */
export type ZoneCoverage =
  | 'AVAILABLE'        // hay partners activos que cubren la zona
  | 'LIMITED'          // hay, pero pocos o sin disponibilidad en la fecha pedida
  | 'WAITLIST'         // no hay nadie; se puede anotar en lista de espera
  | 'PAUSED'           // VARA desactivó la zona a propósito

export const ZONE_COVERAGE_LABELS: Record<ZoneCoverage, string> = {
  AVAILABLE: 'Disponible',
  LIMITED: 'Cobertura limitada',
  WAITLIST: 'Lista de espera',
  PAUSED: 'Pausado por VARA',
}

// ───────────────────── Partner: onboarding y estado ─────────────────────

/**
 * Nadie queda habilitado por haber subido documentos.
 * El orden es intencional y cada paso desbloquea el siguiente.
 */
export type PartnerOnboardingStep =
  | 'PERSONAL_DATA'
  | 'WORK_ZONE'
  | 'IDENTITY'
  | 'REFERENCES'
  | 'INTERVIEW'
  | 'TRAINING'
  | 'SUPERVISED_VISITS'

export const ONBOARDING_STEPS: PartnerOnboardingStep[] = [
  'PERSONAL_DATA', 'WORK_ZONE', 'IDENTITY', 'REFERENCES',
  'INTERVIEW', 'TRAINING', 'SUPERVISED_VISITS',
]

export const ONBOARDING_STEP_LABELS: Record<PartnerOnboardingStep, string> = {
  PERSONAL_DATA: 'Datos personales',
  WORK_ZONE: 'Zona de trabajo',
  IDENTITY: 'Identidad',
  REFERENCES: 'Referencias',
  INTERVIEW: 'Entrevista',
  TRAINING: 'Capacitación',
  SUPERVISED_VISITS: 'Visitas supervisadas',
}

export type PartnerOnboardingStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'PENDING_REVIEW'   // el partner terminó su parte, falta que VARA revise
  | 'APPROVED'
  | 'REJECTED'

/**
 * Estado operativo. Separado del onboarding a propósito:
 * un partner aprobado puede estar suspendido por un incidente.
 */
export type PartnerStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'ACTIVE'
  | 'PAUSED_BY_PARTNER'
  | 'SUSPENDED'        // decisión de Trust & Safety
  | 'DEACTIVATED'

export const PARTNER_STATUS_LABELS: Record<PartnerStatus, string> = {
  DRAFT: 'Borrador',
  PENDING_APPROVAL: 'Pendiente de aprobación',
  ACTIVE: 'Activo',
  PAUSED_BY_PARTNER: 'En pausa',
  SUSPENDED: 'Suspendido',
  DEACTIVATED: 'Dado de baja',
}

/** Solo ACTIVE puede recibir visitas. Se chequea en el matching, no en la UI. */
export function canReceiveVisits(status: PartnerStatus): boolean {
  return status === 'ACTIVE'
}

/**
 * Niveles con criterios publicados. No es un score opaco:
 * cada nivel tiene condiciones verificables que se muestran al usuario.
 */
export type PartnerTier = 'TRAINEE' | 'VERIFIED' | 'PRO' | 'EXPERT' | 'ELITE'

export interface TierCriteria {
  tier: PartnerTier
  label: string
  /** Se muestran tal cual al cliente. Si no se puede explicar, no va. */
  requirements: string[]
  minCompletedVisits: number
  minAverageRating: number | null
  minPunctualityRate: number | null
  maxIncidents: number | null
}

export const TIER_CRITERIA: TierCriteria[] = [
  {
    tier: 'TRAINEE',
    label: 'En formación',
    requirements: ['Identidad verificada', 'Capacitación aprobada', 'Hace visitas acompañado'],
    minCompletedVisits: 0, minAverageRating: null, minPunctualityRate: null, maxIncidents: null,
  },
  {
    tier: 'VERIFIED',
    label: 'VARA Verified',
    requirements: ['Identidad verificada', '2 referencias comprobadas', 'Entrevista aprobada',
                   'Capacitación aprobada', '3 visitas supervisadas'],
    minCompletedVisits: 3, minAverageRating: null, minPunctualityRate: null, maxIncidents: 0,
  },
  {
    tier: 'PRO',
    label: 'VARA Pro',
    requirements: ['Todo lo de VARA Verified', '25 visitas completadas',
                   'Calificación promedio 4.5 o más', '90% de puntualidad', 'Sin incidentes graves'],
    minCompletedVisits: 25, minAverageRating: 4.5, minPunctualityRate: 0.90, maxIncidents: 0,
  },
  {
    tier: 'EXPERT',
    label: 'VARA Expert',
    requirements: ['Todo lo de VARA Pro', '100 visitas completadas',
                   'Calificación promedio 4.7 o más', '95% de puntualidad'],
    minCompletedVisits: 100, minAverageRating: 4.7, minPunctualityRate: 0.95, maxIncidents: 0,
  },
  {
    tier: 'ELITE',
    label: 'VARA Elite',
    requirements: ['Todo lo de VARA Expert', '300 visitas completadas',
                   'Calificación promedio 4.85 o más', '98% de puntualidad',
                   'Revisión anual de VARA aprobada'],
    minCompletedVisits: 300, minAverageRating: 4.85, minPunctualityRate: 0.98, maxIncidents: 0,
  },
]

export function tierLabel(tier: PartnerTier): string {
  return TIER_CRITERIA.find(t => t.tier === tier)?.label ?? tier
}

// ───────────────────────── Partner: los tres planos ─────────────────────────

/** Métricas crudas. Se muestran tal cual; no se combinan en un número único. */
export interface PartnerMetrics {
  totalVisits: number
  completedVisits: number
  cancelledVisits: number
  /** 0–1. null cuando todavía no hay visitas suficientes para que signifique algo. */
  punctualityRate: number | null
  completionRate: number | null
  averageRating: number | null
  reviewCount: number
  incidentCount: number
}

export const EMPTY_METRICS: PartnerMetrics = {
  totalVisits: 0, completedVisits: 0, cancelledVisits: 0,
  punctualityRate: null, completionRate: null, averageRating: null,
  reviewCount: 0, incidentCount: 0,
}

/**
 * PLANO PÚBLICO. Es lo único que puede viajar al marketplace.
 * No tiene teléfono, ni email, ni domicilio, ni documento. A propósito.
 */
export interface PartnerPublicProfile {
  id: string
  displayName: string
  initials: string
  photoUrl: string | null
  bio: string | null
  profession: string | null
  experienceYears: number | null
  languages: string[]
  /** Zona aproximada, nunca el domicilio. Ej: "Pilar, Buenos Aires". */
  homeZoneLabel: string
  coverageZones: string[]
  maxTravelRadiusKm: number
  serviceTypes: VisitServiceType[]
  tier: PartnerTier
  status: PartnerStatus
  metrics: PartnerMetrics
  /** Verificaciones como booleanos. El documento en sí nunca sale del plano compliance. */
  verifiedIdentity: boolean
  verifiedDocument: boolean
  verifiedPhone: boolean
  verifiedEmail: boolean
  certified: boolean
  ratePerVisit: number
  currency: VisitCurrency
  memberSince: string
}

/** PLANO PRIVADO. Se revela recién con una asignación confirmada, de ambos lados. */
export interface PartnerContactInfo {
  partnerId: string
  phone: string | null
  email: string | null
}

export type VerificationStatus =
  | 'NOT_STARTED'
  | 'SUBMITTED'
  | 'IN_REVIEW'
  | 'VERIFIED'
  | 'REJECTED'
  | 'EXPIRED'

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  NOT_STARTED: 'Sin iniciar',
  SUBMITTED: 'Enviado',
  IN_REVIEW: 'En revisión',
  VERIFIED: 'Verificado',
  REJECTED: 'Rechazado',
  EXPIRED: 'Vencido',
}

/**
 * Antecedentes penales.
 *
 * LEGAL REVIEW REQUIRED — ARGENTINA DATA PRIVACY (Ley 25.326)
 * Guardamos ÚNICAMENTE el estado de elegibilidad, el proveedor que lo verificó y
 * las fechas. No se almacena el certificado, ni su contenido, ni ningún detalle.
 * Cambiar esto requiere aprobación legal explícita y base legal documentada.
 */
export type BackgroundEligibilityStatus =
  | 'NOT_REQUESTED'
  | 'PENDING_REVIEW'
  | 'VERIFIED_BY_AUTHORIZED_PROCESS'
  | 'REJECTED'
  | 'EXPIRED'

/**
 * PLANO COMPLIANCE. Solo admin. Nunca se serializa hacia el cliente.
 * Las políticas RLS de esta tabla son las más restrictivas del esquema.
 */
export interface PartnerVerification {
  partnerId: string
  identityStatus: VerificationStatus
  documentVerificationStatus: VerificationStatus
  addressVerificationStatus: VerificationStatus
  referenceCheckStatus: VerificationStatus
  interviewStatus: VerificationStatus
  trainingStatus: VerificationStatus
  supervisedVisitsCompleted: number
  riskReviewStatus: VerificationStatus
  /** Ver nota legal arriba. */
  backgroundEligibilityStatus: BackgroundEligibilityStatus
  verificationProvider: string | null
  verificationDate: string | null
  expirationDate: string | null
  overallStatus: PartnerOnboardingStatus
  reviewedBy: string | null
  reviewedAt: string | null
  rejectionReason: string | null
  updatedAt: string
}

/** Referencia laboral/personal. El contacto es dato privado. */
export type ReferenceStatus = 'PENDING' | 'REQUESTED' | 'RESPONDED' | 'VERIFIED' | 'FAILED'

export interface ReferenceAnswers {
  knownForMonths: number | null
  isResponsible: boolean | null
  isPunctual: boolean | null
  wouldTrustPropertyAccess: boolean | null
  wouldWorkAgain: boolean | null
  comment: string | null
}

export interface PartnerReference {
  id: string
  partnerId: string
  name: string
  relationship: string
  contactEmail: string | null
  contactPhone: string | null
  status: ReferenceStatus
  requestedAt: string | null
  respondedAt: string | null
  /** Respuestas al cuestionario. Ver REFERENCE_QUESTIONS. */
  answers: ReferenceAnswers | null
}

export const REFERENCE_QUESTIONS = [
  { key: 'knownForMonths', question: '¿Hace cuánto conocés a esta persona?', type: 'months' },
  { key: 'isResponsible', question: '¿La considerás responsable?', type: 'boolean' },
  { key: 'isPunctual', question: '¿Es puntual?', type: 'boolean' },
  { key: 'wouldTrustPropertyAccess', question: '¿Le confiarías el acceso a una propiedad?', type: 'boolean' },
  { key: 'wouldWorkAgain', question: '¿Volverías a trabajar con ella?', type: 'boolean' },
] as const

export const MIN_REFERENCES_REQUIRED = 2

// ──────────────────────────── Capacitación ────────────────────────────

export interface TrainingModule {
  id: string
  order: number
  title: string
  summary: string
  /** Puntos que el partner tiene que poder aplicar, no solo leer. */
  keyPoints: string[]
}

export type CertificationStatus =
  | 'NOT_STARTED' | 'IN_PROGRESS' | 'QUIZ_PENDING'
  | 'FAILED' | 'CERTIFIED' | 'EXPIRED'

export interface PartnerTraining {
  partnerId: string
  modulesCompleted: string[]
  quizScore: number | null
  quizAttempts: number
  certificationStatus: CertificationStatus
  certificationDate: string | null
  expirationDate: string | null
  updatedAt: string
}

/** 85% sobre 20 preguntas. Configurable en un solo lugar. */
export const QUIZ_PASSING_SCORE = 0.85
export const QUIZ_QUESTION_COUNT = 20
export const MAX_QUIZ_ATTEMPTS = 3

// ───────────────────────────── Booking ─────────────────────────────

export type VisitCurrency = 'USD' | 'ARS' | 'MXN' | 'CLP' | 'COP' | 'BRL' | 'PEN' | 'UYU' | 'PYG'

/**
 * Ciclo de vida de una visita. Cada estado corresponde a un hecho verificable,
 * no a una sensación. `ARRIVED` significa que hubo check-in con timestamp.
 */
export type VisitStatus =
  | 'REQUESTED'
  | 'SEARCHING_PARTNER'
  | 'ASSIGNED'
  | 'CONFIRMED'
  | 'PARTNER_EN_ROUTE'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'INCIDENT_REVIEW'

export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  REQUESTED: 'Solicitada',
  SEARCHING_PARTNER: 'Buscando Visit Partner',
  ASSIGNED: 'Partner asignado',
  CONFIRMED: 'Confirmada',
  PARTNER_EN_ROUTE: 'Partner en camino',
  ARRIVED: 'Partner en la propiedad',
  IN_PROGRESS: 'Visita en curso',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  INCIDENT_REVIEW: 'En revisión',
}

/** Estados en los que la visita todavía puede pasar algo. */
export const ACTIVE_VISIT_STATUSES: VisitStatus[] = [
  'REQUESTED', 'SEARCHING_PARTNER', 'ASSIGNED', 'CONFIRMED',
  'PARTNER_EN_ROUTE', 'ARRIVED', 'IN_PROGRESS',
]

/**
 * Transiciones permitidas. Una máquina de estados explícita evita que un bug
 * de UI deje una visita en un estado imposible (por ejemplo, completada sin check-in).
 */
export const ALLOWED_TRANSITIONS: Record<VisitStatus, VisitStatus[]> = {
  REQUESTED: ['SEARCHING_PARTNER', 'ASSIGNED', 'CANCELLED'],
  SEARCHING_PARTNER: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['CONFIRMED', 'SEARCHING_PARTNER', 'CANCELLED'],
  CONFIRMED: ['PARTNER_EN_ROUTE', 'ARRIVED', 'CANCELLED', 'INCIDENT_REVIEW'],
  PARTNER_EN_ROUTE: ['ARRIVED', 'CANCELLED', 'INCIDENT_REVIEW'],
  ARRIVED: ['IN_PROGRESS', 'CANCELLED', 'INCIDENT_REVIEW'],
  IN_PROGRESS: ['COMPLETED', 'INCIDENT_REVIEW'],
  COMPLETED: ['INCIDENT_REVIEW'],
  CANCELLED: [],
  INCIDENT_REVIEW: ['COMPLETED', 'CANCELLED'],
}

export function canTransition(from: VisitStatus, to: VisitStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}

export type AssignmentMode = 'CLIENT_CHOICE' | 'VARA_MATCH'

export interface VisitBooking {
  id: string
  /** Legible por humanos: VIS-AR-PIL-000238. Es el que se dice por teléfono. */
  visitCode: string
  requesterUserId: string
  propertyId: string | null
  operationId: string | null
  serviceType: VisitServiceType
  /** ISO date (YYYY-MM-DD) en zona local del inmueble. */
  requestedDate: string
  /** HH:MM 24h. */
  requestedTime: string
  durationMinutes: number
  /** Dirección/zona donde ocurre. Se guarda para trazabilidad. */
  locationLabel: string
  /** Qué mostrar, qué destacar. Visible para el partner asignado. */
  instructions: string | null
  /** Cómo entrar. Dato sensible: solo el partner asignado y confirmado. */
  accessInstructions: string | null
  guestsExpected: number | null
  price: number
  currency: VisitCurrency
  assignmentMode: AssignmentMode
  assignedPartnerId: string | null
  status: VisitStatus
  cancellationReason: string | null
  createdAt: string
  updatedAt: string
}

export interface VisitAssignment {
  id: string
  bookingId: string
  partnerId: string
  assignedAt: string
  acceptedAt: string | null
  rejectedAt: string | null
  rejectionReason: string | null
  cancelledAt: string | null
  cancellationReason: string | null
}

// ──────────────────── Sesión: check-in, PIN, check-out ────────────────────

export type PinStatus = 'NOT_REQUIRED' | 'PENDING' | 'CONFIRMED' | 'FAILED'

export interface GeoPoint {
  lat: number
  lng: number
  /** Metros. El navegador la reporta; sirve para saber cuánto confiar. */
  accuracyM: number | null
  capturedAt: string
}

export type SessionStatus = 'NOT_STARTED' | 'CHECKED_IN' | 'IN_PROGRESS' | 'CHECKED_OUT' | 'ABORTED'

export interface VisitSession {
  id: string
  bookingId: string
  partnerId: string
  checkInAt: string | null
  checkInLocation: GeoPoint | null
  checkOutAt: string | null
  checkOutLocation: GeoPoint | null
  /** PIN de 4 dígitos que tiene el cliente. Sin confirmación no arranca la visita. */
  confirmationPinStatus: PinStatus
  pinAttempts: number
  status: SessionStatus
  durationMinutes: number | null
  /** Progreso del checklist durante la visita. */
  checklistState: Record<string, boolean>
}

export const MAX_PIN_ATTEMPTS = 3
export const PIN_LENGTH = 4

/** Checklist de Visit Mode. Hechos verificables, no impresiones. */
export interface VisitModeChecklistItem {
  id: string
  label: string
  /** Solo aplica a uno de los dos servicios, o a ambos si es null. */
  onlyFor: VisitServiceType | null
  required: boolean
}

export const VISIT_MODE_CHECKLIST: VisitModeChecklistItem[] = [
  { id: 'identity', label: 'Identidad del visitante confirmada', onlyFor: 'SHOW_PROPERTY', required: true },
  { id: 'access', label: 'Acceso a la propiedad realizado', onlyFor: null, required: true },
  { id: 'rooms', label: 'Ambientes recorridos', onlyFor: null, required: true },
  { id: 'questions', label: 'Preguntas registradas', onlyFor: null, required: false },
  { id: 'observations', label: 'Observaciones cargadas', onlyFor: null, required: true },
  { id: 'closed', label: 'Propiedad cerrada correctamente', onlyFor: 'SHOW_PROPERTY', required: true },
]

export function checklistFor(serviceType: VisitServiceType): VisitModeChecklistItem[] {
  return VISIT_MODE_CHECKLIST.filter(i => i.onlyFor === null || i.onlyFor === serviceType)
}

// ───────────────────────────── Reporte ─────────────────────────────

export interface ReportedIssue {
  id: string
  category: 'PROPERTY_CONDITION' | 'ACCESS' | 'SAFETY' | 'SCHEDULING' | 'OTHER'
  description: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
}

export const ISSUE_CATEGORY_LABELS: Record<ReportedIssue['category'], string> = {
  PROPERTY_CONDITION: 'Estado de la propiedad',
  ACCESS: 'Acceso',
  SAFETY: 'Seguridad',
  SCHEDULING: 'Coordinación',
  OTHER: 'Otro',
}

/**
 * El reporte registra HECHOS.
 *
 * MAL: "Los compradores estaban desesperados."
 * BIEN: "Preguntaron dos veces cuál era el plazo mínimo para reservar."
 *
 * La interpretación la hace VARA AI después, sobre hechos. Si el partner
 * interpreta, VARA razona sobre una opinión y se equivoca con confianza.
 */
export interface VisitReport {
  id: string
  bookingId: string
  partnerId: string
  attendeesCount: number
  roomsShown: string[]
  /** Textual, como se preguntó. */
  questionsAsked: string[]
  /** Observables: humedad, ruido, estado. Nada de estados de ánimo. */
  observations: string[]
  issues: ReportedIssue[]
  photoPaths: string[]
  checklistResults: Record<string, boolean>
  generatedAt: string
}

// ───────────────────────────── Reviews ─────────────────────────────

/** 1–5 en cada dimensión. Se muestran separadas; no hay promedio oculto. */
export interface PartnerReview {
  id: string
  bookingId: string
  reviewerUserId: string
  partnerId: string
  punctuality: number
  professionalism: number
  communication: number
  knowledge: number
  reportQuality: number
  overallRating: number
  comment: string | null
  createdAt: string
}

export const PARTNER_REVIEW_DIMENSIONS = [
  { key: 'punctuality', label: 'Puntualidad' },
  { key: 'professionalism', label: 'Profesionalismo' },
  { key: 'communication', label: 'Comunicación' },
  { key: 'knowledge', label: 'Conocimiento' },
  { key: 'reportQuality', label: 'Calidad del reporte' },
] as const

export const CLIENT_REVIEW_DIMENSIONS = [
  { key: 'punctuality', label: 'Puntualidad' },
  { key: 'respect', label: 'Respeto' },
  { key: 'communication', label: 'Comunicación' },
] as const

/**
 * Flags privados. NUNCA se publican ni afectan el rating visible.
 * Van directo a Trust & Safety.
 */
export type SafetyFlag =
  | 'DIFFERENT_PERSON'      // vino alguien distinto al registrado
  | 'MORE_PEOPLE'           // más personas de las informadas
  | 'INAPPROPRIATE_CONDUCT'
  | 'UNSAFE_SITUATION'
  | 'ACCESS_PROBLEM'
  | 'OTHER'

export const SAFETY_FLAG_LABELS: Record<SafetyFlag, string> = {
  DIFFERENT_PERSON: 'Vino una persona distinta a la registrada',
  MORE_PEOPLE: 'Había más personas de las informadas',
  INAPPROPRIATE_CONDUCT: 'Conducta inapropiada',
  UNSAFE_SITUATION: 'Situación insegura',
  ACCESS_PROBLEM: 'Problema con el acceso',
  OTHER: 'Otro',
}

export interface ClientReview {
  id: string
  bookingId: string
  partnerId: string
  clientUserId: string
  punctuality: number
  respect: number
  communication: number
  /** No se publica. Dispara revisión de Trust & Safety. */
  privateSafetyFlags: SafetyFlag[]
  comment: string | null
  createdAt: string
}

// ───────────────────────── Trust & Safety ─────────────────────────

export type IncidentSeverity = 'LEVEL_1_MINOR' | 'LEVEL_2_REVIEW' | 'LEVEL_3_CRITICAL'

export const INCIDENT_SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  LEVEL_1_MINOR: 'Menor',
  LEVEL_2_REVIEW: 'Requiere revisión',
  LEVEL_3_CRITICAL: 'Crítico',
}

export type IncidentCategory =
  | 'SAFETY' | 'IDENTITY' | 'PROPERTY_DAMAGE' | 'CONDUCT'
  | 'NO_SHOW' | 'ACCESS' | 'PRIVACY' | 'OTHER'

export const INCIDENT_CATEGORY_LABELS: Record<IncidentCategory, string> = {
  SAFETY: 'Seguridad de una persona',
  IDENTITY: 'Identidad',
  PROPERTY_DAMAGE: 'Daño a la propiedad',
  CONDUCT: 'Conducta',
  NO_SHOW: 'No se presentó',
  ACCESS: 'Acceso',
  PRIVACY: 'Privacidad',
  OTHER: 'Otro',
}

export type IncidentStatus = 'OPEN' | 'IN_REVIEW' | 'ACTION_TAKEN' | 'CLOSED' | 'DISMISSED'

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  OPEN: 'Abierto',
  IN_REVIEW: 'En revisión',
  ACTION_TAKEN: 'Con acción tomada',
  CLOSED: 'Cerrado',
  DISMISSED: 'Desestimado',
}

export interface SafetyIncident {
  id: string
  bookingId: string | null
  reportedByUserId: string
  /** A quién se refiere el reporte. Puede ser null si es sobre la situación. */
  reportedUserId: string | null
  category: IncidentCategory
  severity: IncidentSeverity
  description: string
  /** Contexto capturado automáticamente al reportar. */
  contextLocation: GeoPoint | null
  status: IncidentStatus
  createdAt: string
  reviewedAt: string | null
  reviewedBy: string | null
  resolution: string | null
}

/**
 * Un incidente crítico suspende preventivamente. La decisión de reactivar
 * es humana y queda registrada. Automatizamos el freno, no la absolución.
 */
export function shouldAutoSuspend(severity: IncidentSeverity): boolean {
  return severity === 'LEVEL_3_CRITICAL'
}

/**
 * Números de emergencia de Argentina. Se MUESTRAN; VARA nunca llama por su cuenta.
 * Llamar automáticamente a un servicio público por una señal de la app sería
 * peor que no hacer nada: genera falsos positivos con consecuencias reales.
 */
export const EMERGENCY_NUMBERS = [
  { label: 'Emergencias', number: '911' },
  { label: 'Bomberos', number: '100' },
  { label: 'Emergencias médicas (SAME)', number: '107' },
] as const

// ──────────────────────────── Precios ────────────────────────────

/**
 * Configuración central. Nada de precios sueltos en componentes.
 * Las bandas acotan lo que un partner puede cobrar; VARA define el rango.
 */
export interface PriceBand {
  durationMinutes: number
  minPrice: number
  maxPrice: number
  defaultPrice: number
  currency: VisitCurrency
}

export const PRICE_BANDS: PriceBand[] = [
  { durationMinutes: 30, minPrice: 25, maxPrice: 35, defaultPrice: 30, currency: 'USD' },
  { durationMinutes: 60, minPrice: 35, maxPrice: 50, defaultPrice: 42, currency: 'USD' },
  { durationMinutes: 90, minPrice: 50, maxPrice: 70, defaultPrice: 58, currency: 'USD' },
]

export interface PriceSurcharge {
  id: string
  label: string
  description: string
  /** Multiplicador sobre el precio base. 1.2 = +20%. */
  multiplier: number
}

export const PRICE_SURCHARGES: PriceSurcharge[] = [
  { id: 'urgency', label: 'Urgencia', description: 'Visita pedida con menos de 24 horas.', multiplier: 1.20 },
  { id: 'off_hours', label: 'Horario especial', description: 'Antes de las 9 o después de las 19.', multiplier: 1.15 },
  { id: 'distance', label: 'Distancia', description: 'Más de 15 km desde la zona del partner.', multiplier: 1.10 },
]

/** Política de cancelación. Se muestra antes de contratar, no en letra chica. */
export const CANCELLATION_POLICY = {
  freeUntilHoursBefore: 24,
  lateCancellationChargeRate: 0.5,
  text: 'Cancelás sin costo hasta 24 horas antes. Después, se cobra el 50%.',
} as const

export function bandFor(durationMinutes: number): PriceBand {
  return PRICE_BANDS.find(b => b.durationMinutes === durationMinutes) ?? PRICE_BANDS[0]
}

/** Precio final = base del partner × suplementos aplicables. Redondeado al entero. */
export function computePrice(basePrice: number, surchargeIds: string[]): number {
  const factor = surchargeIds.reduce((acc, id) => {
    const s = PRICE_SURCHARGES.find(x => x.id === id)
    return s ? acc * s.multiplier : acc
  }, 1)
  return Math.round(basePrice * factor)
}

// ──────────────────────── Código de visita ────────────────────────

/**
 * VIS-AR-PIL-000238
 *   VIS · país · zona (3 letras) · secuencia
 * Es lo que una persona dice por teléfono cuando algo pasa.
 */
export function buildVisitCode(zoneLabel: string, sequence: number): string {
  const zone = zoneLabel
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .slice(0, 3)
    .padEnd(3, 'X')
  return `VIS-AR-${zone}-${String(sequence).padStart(6, '0')}`
}

// ──────────────────────────── Métricas ────────────────────────────

/** Eventos instrumentados. Nombres estables: se miden en el tiempo. */
export type VisitEventName =
  | 'visit_requested'
  | 'visit_partner_searched'
  | 'visit_assigned'
  | 'visit_accepted_by_partner'
  | 'visit_rejected_by_partner'
  | 'visit_confirmed'
  | 'visit_cancelled_by_client'
  | 'visit_cancelled_by_partner'
  | 'visit_checked_in'
  | 'visit_pin_confirmed'
  | 'visit_pin_failed'
  | 'visit_checked_out'
  | 'visit_completed'
  | 'visit_report_submitted'
  | 'visit_reviewed_by_client'
  | 'visit_reviewed_by_partner'
  | 'visit_incident_reported'
  | 'partner_onboarding_started'
  | 'partner_onboarding_step_completed'
  | 'partner_certified'
  | 'partner_approved'
  | 'partner_suspended'
  | 'coverage_requested'

export interface VisitEvent {
  name: VisitEventName
  at: string
  bookingId?: string
  partnerId?: string
  /** Solo datos no sensibles. Nunca PII ni instrucciones de acceso. */
  props?: Record<string, string | number | boolean | null>
}
