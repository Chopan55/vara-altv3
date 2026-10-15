/**
 * Contrato canónico del análisis de una propiedad.
 *
 * Es la única fuente de inteligencia de VARA Buy: el resultado, el dashboard,
 * la comparación, el NBA y la IA leen de acá. Ninguna pantalla recalcula nada.
 *
 * Separación que no se negocia:
 *   HECHOS        lo que dice el aviso (con procedencia)
 *   INFERENCIAS   lo que se deduce de hechos (marcado INFERRED)
 *   ESTIMACIONES  rangos con supuestos explícitos (costos)
 *   RECOMENDACIÓN conclusión y próxima acción, derivadas de lo anterior
 *   DESCONOCIDO   UNKNOWN se queda UNKNOWN: no se rellena
 *
 * Ningún número sale de un LLM. La IA puede redactar sobre estos campos; no
 * puede cambiarlos.
 */

export const ANALYSIS_VERSION = '3.0.0'

// ───────────────────────── Hechos con procedencia ─────────────────────────

export type FieldStatus = 'CONFIRMED' | 'EXTRACTED' | 'INFERRED' | 'UNKNOWN'

export type ExtractionMethod =
  | 'json-ld' | 'meta' | 'reader' | 'ai' | 'paste' | 'meli-api' | 'user' | 'derived'

export interface Provenance {
  source: string                    // "Zonaprop", "MercadoLibre", "usuario"
  method: ExtractionMethod
  url?: string
  /** ISO 8601. */
  observedAt: string
}

export interface Field<T> {
  value: T | null
  status: FieldStatus
  provenance?: Provenance
  /** 0–1. Solo cuando el método lo justifica (p. ej. IA < API oficial). */
  confidence?: number
}

export type PropertyKind = 'house' | 'apartment' | 'ph' | 'lot' | 'other'
export type PropertyCondition = 'new' | 'excellent' | 'good' | 'to_refresh' | 'to_renovate'
export type CommunityType = 'gated' | 'building' | 'development'
export type ListingStatus = 'active' | 'removed' | 'unknown'

/** Origen del precio. Nunca se mezclan en un mismo cálculo. */
export type PriceProvenance = 'ASKING_PRICE' | 'CLOSED_TRANSACTION_PRICE' | 'UNKNOWN'

/**
 * Lo que sabemos de un aviso, ya normalizado. Lo comparten la propiedad que
 * evalúa la persona y los avisos con los que se la compara: por eso se pueden
 * puntuar con las mismas reglas.
 */
export interface ListingFacts {
  id: string
  url?: string
  source: string
  title?: string
  country: string
  city?: string
  neighborhood?: string
  microzone?: string
  /** Barrio cerrado, edificio o desarrollo. Si existe, es el primer filtro. */
  community?: string
  communityType?: CommunityType
  address?: string
  lat?: number
  lng?: number

  kind?: PropertyKind
  price?: number
  currency?: 'USD' | 'ARS'
  priceProvenance: PriceProvenance

  bedrooms?: number
  bathrooms?: number
  coveredArea?: number
  totalArea?: number
  landArea?: number
  parking?: number
  ageYears?: number
  condition?: PropertyCondition
  pool?: boolean
  amenities?: string[]
  expenses?: number
  orientation?: string

  publishedAt?: string
  lastUpdatedAt?: string
  priceChangedAt?: string
  status: ListingStatus
  /** Cuándo lo vimos. Es lo único de fecha que siempre tenemos. */
  observedAt: string

  photoHashes?: string[]
  description?: string
}

type FactKeys = Exclude<keyof ListingFacts, 'id' | 'url' | 'source' | 'country' | 'priceProvenance' | 'status' | 'observedAt'>

export interface SubjectProperty {
  id: string
  url: string
  source: string
  country: string
  priceProvenance: PriceProvenance
  fields: { [K in FactKeys]?: Field<NonNullable<ListingFacts[K]>> }
  photos: string[]
}

export interface ExtractionQuality {
  /** 0–1: proporción de campos clave presentes. */
  completeness: number
  present: string[]
  missing: string[]
  /** Método con el que se obtuvo la mayor parte de los datos. */
  method: ExtractionMethod | 'none'
  warnings: string[]
}

// ───────────────────────── Comparables ─────────────────────────

export type SearchScope =
  | 'SAME_COMMUNITY' | 'SAME_MICROZONE' | 'NEIGHBORHOOD' | 'CITY' | 'EQUIVALENT_ZONE'

export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT'

export interface FreshnessInfo {
  /** Días desde la mejor fecha conocida; null si no hay ninguna. */
  ageDays: number | null
  basis: 'PRICE_CHANGE' | 'LAST_UPDATE' | 'PUBLICATION' | 'OBSERVED' | 'UNKNOWN'
  /** 0–1. Multiplica el peso del aviso. */
  weight: number
  stale: boolean
  note?: string
}

export interface ScoredComparable {
  listing: ListingFacts
  scope: SearchScope
  /** 0–100. */
  similarityScore: number
  similarityReasons: string[]
  importantDifferences: string[]
  missingComparisonFields: string[]
  freshness: FreshnessInfo
  /** Peso final en el precio: similitud × frescura × completitud. */
  weight: number
  /** Ids de avisos que se fusionaron en este por ser la misma propiedad. */
  mergedDuplicateIds: string[]
  /** true cuando no se pudo descartar que el fusionado sea otra propiedad. */
  duplicateUncertain: boolean
}

export interface RetrievalSummary {
  searchScope: SearchScope
  searchExpansionReason: string | null
  scopesTried: SearchScope[]
  candidatesFound: number
  afterDedup: number
  duplicatesMerged: number
  providers: { name: string; ok: boolean; count: number; reason?: string }[]
}

export interface ComparableEvidence {
  retrieval: RetrievalSummary
  matches: ScoredComparable[]
  /** Cuántos pasan el umbral de "realmente comparables". */
  strongMatches: number
  methodology: string
  geographicScope: SearchScope
  evidenceQuality: Confidence
}

// ───────────────────────── Precio ─────────────────────────

export interface PriceBand {
  low: number
  high: number
  median: number
  currency: 'USD' | 'ARS'
  basis: PriceProvenance
  method: string
  sampleSize: number
}

export type PricePosition = 'BELOW' | 'WITHIN' | 'ABOVE' | 'UNKNOWN'

export interface PricePositioning {
  subjectAskingPrice: { amount: number; currency: 'USD' | 'ARS' } | null
  comparableListingRange: PriceBand | null
  position: PricePosition
  /** Diferencia % del precio pedido contra la mediana ponderada. null si no hay base. */
  differencePct: number | null
  confidence: Confidence
  confidenceReasons: string[]
  /** Frase lista para mostrar. Nunca dice "valor de mercado". */
  interpretation: string
}

// ───────────────────────── Fit con la persona ─────────────────────────

export type Importance =
  | 'MUST_HAVE' | 'IMPORTANT' | 'NICE_TO_HAVE' | 'NOT_IMPORTANT' | 'DEAL_BREAKER'

export type CriterionKey =
  | 'budget' | 'location' | 'bedrooms' | 'bathrooms' | 'coveredArea' | 'landArea'
  | 'parking' | 'pool' | 'garden' | 'study' | 'maxAge' | 'kind'

export interface PreferenceRule {
  key: CriterionKey
  importance: Importance
  /** Valor objetivo: mínimo, máximo o texto, según el criterio. */
  target?: number | string | boolean
}

export interface UserPreferences {
  rules: PreferenceRule[]
  budgetCurrency?: 'USD' | 'ARS'
}

export type FitStatus = 'MATCH' | 'MISMATCH' | 'UNKNOWN'

export interface FitItem {
  key: CriterionKey
  label: string
  importance: Importance
  status: FitStatus
  detail: string
}

export interface UserFit {
  state: 'NO_PROFILE' | 'EVALUATED'
  items: FitItem[]
  /** 0–100 o null si no hay perfil. Se explica en scoreExplanation. */
  score: number | null
  scoreExplanation: string
  dealBreakerHit: boolean
  dealBreakers: string[]
}

// ───────────────────────── Faltantes, riesgos, costos ─────────────────────────

export interface MissingItem {
  field: string
  label: string
  impact: 'HIGH' | 'MEDIUM' | 'LOW'
  why: string
}

export interface MissingInformation {
  items: MissingItem[]
  /** Mensaje listo para copiar. Nunca se envía solo. */
  draftMessage: string | null
}

export interface PriorityRisk {
  id: string
  title: string
  reason: string
  evidence: string[]
  impact: 'HIGH' | 'MEDIUM' | 'LOW'
  nextAction?: string
}

export type CostKind = 'KNOWN' | 'ESTIMATED' | 'NOT_INCLUDED'

export interface CostLine {
  id: string
  label: string
  kind: CostKind
  min: number | null
  max: number | null
  currency: 'USD' | 'ARS'
  basis: string
}

export interface TransactionCost {
  jurisdiction: string
  lines: CostLine[]
  /** Rango de plata total necesaria (precio + costos incluidos). null si falta el precio. */
  totalRange: { min: number; max: number; currency: 'USD' | 'ARS' } | null
  notIncluded: string[]
  assumptions: string[]
}

// ───────────────────────── Conclusión y acción ─────────────────────────

export type Verdict = 'PROMISING' | 'CAUTION' | 'WEAK' | 'UNDETERMINED'

export interface Conclusion {
  verdict: Verdict
  /** Una oración. Es lo primero que se lee. */
  headline: string
  why: string
  price: string
  unknown: string
  next: string
  /** Campos del análisis de los que sale cada afirmación. */
  basedOn: string[]
}

export type NbaType =
  | 'GET_MISSING_INFORMATION' | 'COMPARE' | 'VISIT' | 'VERIFY_DOCUMENT'
  | 'SAVE' | 'DISCARD' | 'PREPARE_OFFER' | 'PROFESSIONAL_REVIEW' | 'ADD_COMPARABLES'

export interface NextBestAction {
  type: NbaType
  label: string
  reason: string
  /** Máximo dos, de menor peso visual. */
  secondary: { type: NbaType; label: string }[]
  /** Qué bloquea avanzar, si algo. Si hay bloqueos, no se muestra "todo al día". */
  blockers: string[]
}

// ───────────────────────── Trazabilidad ─────────────────────────

export interface ProvenanceEntry {
  /** Ruta del dato dentro del análisis, p. ej. "pricePositioning.differencePct". */
  path: string
  kind: 'FACT' | 'INFERENCE' | 'ESTIMATE' | 'RECOMMENDATION'
  derivedFrom: string[]
  note?: string
}

export interface StageTimings {
  /** Milisegundos desde el inicio; null si la etapa no ocurrió. */
  timeToPropertyMs: number | null
  timeToFirstValueMs: number | null
  timeToComparablesMs: number | null
  timeToConclusionMs: number | null
  steps: { name: string; ms: number; ok: boolean; note?: string }[]
}

export interface PropertyAnalysis {
  subjectProperty: SubjectProperty
  extractionQuality: ExtractionQuality
  userFit: UserFit
  comparableEvidence: ComparableEvidence
  pricePositioning: PricePositioning
  missingInformation: MissingInformation
  prioritizedRisks: PriorityRisk[]
  estimatedTransactionCost: TransactionCost
  conclusion: Conclusion
  nextBestAction: NextBestAction
  provenance: ProvenanceEntry[]
  timings: StageTimings
  /** ISO 8601. */
  generatedAt: string
  version: typeof ANALYSIS_VERSION
}
