export type OperationType = 'BUY_PROPERTY' | 'SELL_PROPERTY' | 'RENT_PROPERTY' | 'LAND_PURCHASE' | 'COMMERCIAL_PROPERTY'
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'NOT_APPLICABLE'
export type DocumentStatus = 'PENDING' | 'RECEIVED' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED'
export type PropertyType = 'HOUSE' | 'APARTMENT' | 'PH' | 'LAND' | 'GARAGE' | 'LOCAL' | 'OFFICE' | 'FIELD'
export type Currency = 'USD' | 'ARS'
export type SourceType = 'SOURCE_OFFICIAL' | 'SOURCE_PROFESSIONAL' | 'SOURCE_SECONDARY' | 'SOURCE_UNVERIFIED'
export type DocumentCategory = 'ESCRITURA' | 'PLANOS' | 'INFORMES' | 'IMPUESTOS' | 'EXPENSAS' | 'SERVICIOS' | 'CERTIFICADOS' | 'CONTRATOS' | 'RESERVA' | 'TASACIONES' | 'OTROS'
export type ProfessionalSpecialty = 'ESCRIBANO' | 'ABOGADO' | 'AGRIMENSOR' | 'TASADOR' | 'GESTOR' | 'ARQUITECTO' | 'CONTADOR' | 'ADMINISTRADOR'

export interface TransactionStage {
  id: string
  key: string
  label: string
  description: string
  order: number
  status: 'COMPLETED' | 'CURRENT' | 'UPCOMING' | 'BLOCKED'
  tasks: Task[]
}

export interface Task {
  id: string
  title: string
  description: string
  why: string
  status: TaskStatus
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  responsibleRole: string
  documentsRequired: string[]
  professionalType?: string
  estimatedCost?: string
  notes?: string
  warnings?: string[]
  recommendations?: string[]
  blockedBy?: string[]
  stageId: string
}

export interface Property {
  id: string
  type: PropertyType
  operationType: 'sale' | 'rent'
  price: number
  currency: Currency
  title: string
  address: string
  neighborhood: string
  city: string
  province: string
  surface: number
  coveredSurface?: number
  rooms: number
  bedrooms: number
  bathrooms: number
  garage: boolean
  description: string
  images: string[]
  features: string[]
  expenses?: number
  ageYears?: number
  isMock?: true
  score?: number
}

export interface Document {
  id: string
  name: string
  category: DocumentCategory
  status: DocumentStatus
  date?: string
  uploadedBy?: string
  transactionId: string
  taskId?: string
  version: number
  notes?: string
}

export interface Professional {
  id: string
  name: string
  specialty: ProfessionalSpecialty
  firm?: string
  city: string
  province: string
  description: string
  experience: number
  rating: number
  reviewCount: number
  priceRange: string
  availability: 'AVAILABLE' | 'BUSY' | 'UNAVAILABLE'
  isMock: true
  tags: string[]
}

export type RiskSeverity = 'HIGH' | 'MEDIUM' | 'LOW'
export type RiskCategory = 'DOCUMENTAL' | 'DOMINIAL' | 'FISCAL' | 'LEGAL' | 'FINANCIERO' | 'OPERATIVO'

export interface Risk {
  id: string
  severity: RiskSeverity
  category: RiskCategory
  label: string
  detail: string
  evidence?: string
  recommendation?: string
}

export interface Transaction {
  id: string
  type: OperationType
  title: string
  subtitle: string
  userId: string
  propertyId?: string
  property?: Property
  stages: TransactionStage[]
  currentStageId: string
  progress: number
  province: string
  provinceCode: string
  city: string
  participants: Participant[]
  documents: Document[]
  costs: CostEstimate[]
  timeline: TimelineEvent[]
  risks?: Risk[]
  createdAt: string
  updatedAt: string
}

export interface Participant {
  id: string
  name: string
  role: string
  email?: string
  phone?: string
}

export interface CostEstimate {
  id: string
  label: string
  category: string
  minAmount: number
  maxAmount: number
  currency: Currency
  isEstimate: true
  source: string
  notes?: string
}

export interface TimelineEvent {
  id: string
  date: string
  title: string
  description?: string
  type: 'TASK_COMPLETED' | 'DOCUMENT_ADDED' | 'STAGE_CHANGED' | 'PROFESSIONAL_ADDED' | 'NOTE' | 'SYSTEM'
  actor?: string
}

export interface VisitChecklistItem {
  id: string
  section: string
  label: string
  checked: boolean
  note?: string
}

export type OperationRelationType =
  | 'SALE_FUNDS_PURCHASE'
  | 'SALE_MUST_CLOSE_BEFORE_PURCHASE'
  | 'PURCHASE_DEPENDS_ON_SALE'
  | 'SAME_MOVE'
  | 'USER_LINKED'

export interface OperationRelation {
  id: string
  fromOperationId: string
  toOperationId: string
  type: OperationRelationType
  metadata?: Record<string, unknown>
}

export interface PropertyCandidate {
  propertyId: string
  score?: number
  notes?: string
  url?: string
  addedAt: string
}

export interface UserOperationSummary {
  id: string
  type: 'BUY' | 'SELL'
  title: string
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'DRAFT'
  progress: number
  province: string
  city: string
  propertyId?: string
  candidates?: PropertyCandidate[]
  createdAt: string
}
