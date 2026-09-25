import type { OperationType, Currency } from '@/types'

export type ProvinceCode =
  | 'CABA' | 'BUENOS_AIRES' | 'CORDOBA' | 'SANTA_FE' | 'MENDOZA'
  | 'TUCUMAN' | 'ENTRE_RIOS' | 'SALTA' | 'MISIONES' | 'CHACO'
  | 'CORRIENTES' | 'SANTIAGO_DEL_ESTERO' | 'SAN_JUAN' | 'JUJUY'
  | 'RIO_NEGRO' | 'NEUQUEN' | 'FORMOSA' | 'CHUBUT' | 'SAN_LUIS'
  | 'CATAMARCA' | 'LA_RIOJA' | 'LA_PAMPA' | 'SANTA_CRUZ' | 'TIERRA_DEL_FUEGO'

export type DataConfidence = 'VERIFIED' | 'PARTIAL' | 'ESTIMATED' | 'UNVERIFIED'

export interface StampTaxRule {
  totalRate: number
  buyerShare: number
  sellerShare: number
  base: 'PRICE_OR_FISCAL' | 'VIR' | 'FISCAL_ONLY' | 'PRICE_ONLY'
  virMultiplier?: number
  exemptions: StampTaxExemption[]
  confidence: DataConfidence
  sourceUrl?: string
  notes?: string
}

export interface StampTaxExemption {
  description: string
  condition: string
  maxFiscalValue?: number
}

export interface RegulatoryEntity {
  name: string
  acronym: string
  url?: string
  phone?: string
  address?: string
  role: 'IMPOSITIVO' | 'REGISTRO' | 'COLEGIO_ESCRIBANOS' | 'MUNICIPAL' | 'NACIONAL'
}

export interface NotaryFeeRule {
  minRate: number
  maxRate: number
  buyerShare: number
  sellerShare: number
  vatApplies: boolean
  notes?: string
}

export interface RegistryFeeRule {
  rate?: number
  minimum?: number
  notes?: string
}

export interface RequiredDocument {
  id: string
  name: string
  responsibleParty: 'VENDEDOR' | 'COMPRADOR' | 'ESCRIBANO' | 'AMBOS'
  category: 'IDENTIDAD' | 'DOMINIO' | 'IMPOSITIVO' | 'SERVICIOS' | 'REGISTRAL' | 'LEGAL' | 'UIF'
  isUniversal: boolean
  provinceSpecific?: boolean
  notes?: string
}

export interface KeyMunicipality {
  name: string
  extraRequirements: string[]
  hasTransferTax: boolean
  transferTaxRate?: number
}

export interface ProvinceRegulation {
  code: ProvinceCode
  name: string
  displayName: string
  entities: RegulatoryEntity[]
  stampTax: StampTaxRule
  notaryFee: NotaryFeeRule
  registryFee: RegistryFeeRule
  documents: RequiredDocument[]
  keyMunicipalities: KeyMunicipality[]
  particularities: string[]
  lastUpdated: string
  dataConfidence: DataConfidence
}

export interface RegulatoryChecklist {
  province: ProvinceCode
  provinceName: string
  operationType: OperationType
  stages: ChecklistStage[]
  costs: CostBreakdown
  warnings: string[]
  dataConfidence: DataConfidence
}

export interface ChecklistStage {
  order: number
  name: string
  durationDays: string
  tasks: ChecklistTask[]
}

export interface ChecklistTask {
  id: string
  title: string
  description: string
  responsibleParty: string
  documents: string[]
  estimatedCost?: string
  warnings?: string[]
  isProvinceSpecific?: boolean
}

export interface CostBreakdown {
  currency: Currency
  propertyValue: number
  stampTaxBuyer: CostLine
  stampTaxSeller: CostLine
  notaryFeeBuyer: CostLine
  notaryFeeSeller: CostLine
  registryFee: CostLine
  certificates: CostLine
  totalBuyer: CostRange
  totalSeller: CostRange
  notes: string[]
}

export interface CostLine {
  label: string
  minAmount: number
  maxAmount: number
  currency: Currency
  isEstimate: boolean
  source: string
  notes?: string
}

export interface CostRange {
  min: number
  max: number
  percentMin: number
  percentMax: number
  currency: Currency
}
