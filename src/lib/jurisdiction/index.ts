import type { CountryCode } from '@/types'
import type { JurisdictionPack } from './types'
import { AR_PACK } from './ar'
import { MX_PACK } from './mx'

export type { JurisdictionPack } from './types'

const PACKS: Record<string, JurisdictionPack> = {
  AR: AR_PACK,
  MX: MX_PACK,
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

export { AR_PACK, MX_PACK }
