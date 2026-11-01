'use client'
import { useState, useCallback, useEffect } from 'react'
import type { CountryCode } from '@/types'

const LS_KEY = 'vara_country_pref'

export const SUPPORTED_COUNTRIES: {
  code: CountryCode
  name: string
  flag: string
  currency: string
}[] = [
  { code: 'AR', name: 'Argentina', flag: '🇦🇷', currency: 'USD / ARS' },
  { code: 'MX', name: 'México', flag: '🇲🇽', currency: 'MXN / USD' },
]

function readPref(): CountryCode {
  if (typeof localStorage === 'undefined') return 'AR'
  try {
    const v = localStorage.getItem(LS_KEY)
    return v === 'AR' || v === 'MX' ? v : 'AR'
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
