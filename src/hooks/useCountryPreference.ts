'use client'
import { useState, useCallback, useEffect } from 'react'
import type { CountryCode } from '@/types'
import { hasJurisdiction } from '@/lib/jurisdiction'

const LS_KEY = 'vara_country_pref'

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
    return parseCountryPref(localStorage.getItem(LS_KEY))
  } catch {
    return 'AR'
  }
}

export function useCountryPreference() {
  const [country, setCountryState] = useState<CountryCode>('AR')

  useEffect(() => {
    setCountryState(readPref())
  }, [])

  const setCountry = useCallback((code: CountryCode) => {
    try {
      localStorage.setItem(LS_KEY, code)
    } catch {}
    setCountryState(code)
  }, [])

  return { country, setCountry }
}
