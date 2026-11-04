'use client'
import { useCallback } from 'react'
import { useBrowserState } from '@/hooks/useHydrated'
import type { CountryCode } from '@/types'
import { hasJurisdiction } from '@/lib/jurisdiction'

/**
 * País por defecto de la persona: el de su última operación creada o el que
 * eligió en Configuración. Misma clave que escribe el onboarding, así las dos
 * pantallas no se contradicen. Cada operación guarda su propio país aparte.
 */
const LS_KEY = 'vara_country'
const LEGACY_KEY = 'vara_country_pref'

export const SUPPORTED_COUNTRIES: {
  code: CountryCode
  name: string
  flag: string
  currency: string
}[] = [
  { code: 'AR', name: 'Argentina', flag: '🇦🇷', currency: 'USD / ARS' },
  { code: 'MX', name: 'México', flag: '🇲🇽', currency: 'MXN / USD' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱', currency: 'CLP / USD' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴', currency: 'COP / USD' },
]

export function parseCountryPref(v: string | null): CountryCode {
  return v && hasJurisdiction(v) ? v : 'AR'
}

function readPref(): CountryCode {
  if (typeof localStorage === 'undefined') return 'AR'
  try {
    return parseCountryPref(localStorage.getItem(LS_KEY) ?? localStorage.getItem(LEGACY_KEY))
  } catch {
    return 'AR'
  }
}

export function useCountryPreference() {
  const [country, setCountryState] = useBrowserState<CountryCode>(readPref, 'AR')

  const setCountry = useCallback((code: CountryCode) => {
    try {
      localStorage.setItem(LS_KEY, code)
    } catch {}
    setCountryState(code)
  }, [setCountryState])

  return { country, setCountry }
}

/** Países en los que hoy se puede crear una operación (tienen motor de costos). */
export const OPERABLE_COUNTRIES: CountryCode[] = ['AR', 'MX']
