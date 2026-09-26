import { useMemo } from 'react'
import type { CountryCode } from '@/types'
import { getJurisdiction, type JurisdictionPack } from '@/lib/jurisdiction'

/**
 * Devuelve el JurisdictionPack para el país dado.
 * Si country es undefined/null, usa AR (mercado original).
 *
 * Uso:
 *   const j = useJurisdiction(transaction.country)
 *   <span>{j.subdivisionLabel}</span>
 *   <span>{j.professionalLabels.CLOSING_PROFESSIONAL}</span>
 */
export function useJurisdiction(country?: CountryCode | null): JurisdictionPack {
  return useMemo(() => getJurisdiction(country), [country])
}
