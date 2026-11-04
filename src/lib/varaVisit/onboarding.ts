import { MIN_REFERENCES_REQUIRED, type PartnerOnboardingStep } from '@/types/varaVisit'

export interface OnboardingSnapshot {
  hasProfile: boolean
  homeZoneLabel: string
  serviceCount: number
  referenceCount: number
  certificationStatus: string | null
}

/**
 * Primer paso que le falta completar al partner, para retomar ahí.
 * Identidad y entrevista no cuentan: las resuelve VARA, el partner no puede avanzarlas.
 */
export function resumeStep(s: OnboardingSnapshot): PartnerOnboardingStep {
  if (!s.hasProfile) return 'PERSONAL_DATA'
  if (!s.homeZoneLabel.trim() || s.serviceCount === 0) return 'WORK_ZONE'
  if (s.referenceCount < MIN_REFERENCES_REQUIRED) return 'REFERENCES'
  if (s.certificationStatus !== 'CERTIFIED' && s.certificationStatus !== 'QUIZ_PENDING') return 'TRAINING'
  return 'SUPERVISED_VISITS'
}
