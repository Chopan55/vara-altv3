import type { CountryCode } from '@/types'
import type { JurisdictionPack } from './types'
import { AR_PACK } from './ar'
import { MX_PACK } from './mx'
import { CL_PACK } from './cl'
import { CO_PACK } from './co'

export type { JurisdictionPack } from './types'

const PACKS: Record<string, JurisdictionPack> = {
  AR: AR_PACK,
  MX: MX_PACK,
  CL: CL_PACK,
  CO: CO_PACK,
}

/**
 * Devuelve el pack de jurisdicción para un país.
 * Si el país no tiene pack, cae a AR (mercado original).
 * Cuando se crea un pack nuevo, se registra acá.
 */
export function getJurisdiction(country?: CountryCode | null): JurisdictionPack {
  if (country && PACKS[country]) return PACKS[country]
  return AR_PACK
}

/** Países con pack cargado, en el orden en que se muestran. */
export function listJurisdictions(): JurisdictionPack[] {
  return Object.values(PACKS)
}

export function hasJurisdiction(code: string): code is CountryCode {
  return code in PACKS
}

export { AR_PACK, MX_PACK, CL_PACK, CO_PACK }
