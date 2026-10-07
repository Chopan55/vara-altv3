import type { GuaranteeType, AdjustmentIndex, RentalCountry, RentalCurrency, RentalJurisdiction, RentalJurisdictionPack } from '../types'
import { AR_CABA_PACK } from './ar-caba'
import { MX_CDMX_PACK } from './mx-cdmx'

/** Registro de jurisdicciones. Para sumar una, crear su pack y registrarlo acá. */
export const PACKS: Record<RentalJurisdiction, RentalJurisdictionPack> = {
  AR_CABA: AR_CABA_PACK,
  MX_CDMX: MX_CDMX_PACK,
}

export const DEFAULT_JURISDICTION: Record<RentalCountry, RentalJurisdiction> = {
  AR: 'AR_CABA',
  MX: 'MX_CDMX',
}

/** null si el valor no es una jurisdicción conocida (los datos pueden venir de un formulario). */
export function getPack(jurisdiction: string): RentalJurisdictionPack | null {
  return Object.prototype.hasOwnProperty.call(PACKS, jurisdiction) ? PACKS[jurisdiction as RentalJurisdiction] : null
}

export interface JurisdictionOption {
  jurisdiction: RentalJurisdiction
  country: RentalCountry
  label: string
  localCurrency: RentalCurrency
  applicableGuarantees: GuaranteeType[]
  adjustmentIndexes: AdjustmentIndex[]
}

/** Lo que necesita la UI para armar sus selectores, sin ver las reglas. */
export const RENTAL_JURISDICTIONS: JurisdictionOption[] = Object.values(PACKS).map(p => ({
  jurisdiction: p.jurisdiction,
  country: p.country,
  label: p.label,
  localCurrency: p.localCurrency,
  applicableGuarantees: p.applicableGuarantees,
  adjustmentIndexes: p.adjustmentIndexes,
}))
