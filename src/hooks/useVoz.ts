'use client'
import { useCountryPreference } from '@/hooks/useCountryPreference'
import { voz } from '@/lib/i18n/voz'

/** Elige el texto según el país de la persona (el de su última operación o el que eligió). */
export function useVoz() {
  const { country } = useCountryPreference()
  return <T,>(ar: T, mx: T): T => voz(country, ar, mx)
}
