'use client'
import { useState, useEffect, useCallback } from 'react'

export interface VaraState {
  userName: string
  journeyType: string
  province: string
  propertyUrl: string
  onboardingDone: boolean
  operationId: string
  dismissedGuidanceIds: string[]
  loaded: boolean
}

export interface VaraStateActions {
  setPropertyUrl: (url: string) => void
  dismissGuidance: (id: string) => void
  resetGuidance: () => void
  setOperationId: (id: string) => void
}

const DEFAULTS: VaraState = {
  userName: '',
  journeyType: '',
  province: '',
  propertyUrl: '',
  onboardingDone: false,
  operationId: '',
  dismissedGuidanceIds: [],
  loaded: false,
}

function readFromStorage(): VaraState {
  try {
    const raw = localStorage.getItem('vara_dismissed_guidance')
    return {
      userName: localStorage.getItem('vara_user_name') || '',
      journeyType: localStorage.getItem('vara_journey_type') || '',
      province: localStorage.getItem('vara_province') || '',
      propertyUrl: localStorage.getItem('vara_property_url') || '',
      onboardingDone: localStorage.getItem('vara_onboarding_done') === '1',
      operationId: localStorage.getItem('vara_operation_id') || '',
      dismissedGuidanceIds: raw ? (JSON.parse(raw) as string[]) : [],
      loaded: true,
    }
  } catch {
    return { ...DEFAULTS, loaded: true }
  }
}

export function useVaraState(): VaraState & VaraStateActions {
  const [state, setState] = useState<VaraState>(DEFAULTS)

  useEffect(() => {
    setState(readFromStorage())

    // Con sesión, el nombre de la cuenta manda sobre el que quedó en este navegador.
    // Si no, alguien que se registra con un nombre sigue viendo el de un onboarding anterior.
    let alive = true
    import('@/lib/supabase/operations')
      .then(({ fetchProfileName }) => fetchProfileName())
      .then(name => {
        if (!alive || !name) return
        try { localStorage.setItem('vara_user_name', name) } catch {}
        setState(s => (s.userName === name ? s : { ...s, userName: name }))
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  const setPropertyUrl = useCallback((url: string) => {
    try { localStorage.setItem('vara_property_url', url) } catch {}
    setState(s => ({ ...s, propertyUrl: url }))
  }, [])

  const dismissGuidance = useCallback((id: string) => {
    setState(s => {
      if (s.dismissedGuidanceIds.includes(id)) return s
      const next = [...s.dismissedGuidanceIds, id]
      try { localStorage.setItem('vara_dismissed_guidance', JSON.stringify(next)) } catch {}
      return { ...s, dismissedGuidanceIds: next }
    })
  }, [])

  const resetGuidance = useCallback(() => {
    try { localStorage.removeItem('vara_dismissed_guidance') } catch {}
    setState(s => ({ ...s, dismissedGuidanceIds: [] }))
  }, [])

  const setOperationId = useCallback((id: string) => {
    try { localStorage.setItem('vara_operation_id', id) } catch {}
    setState(s => ({ ...s, operationId: id }))
  }, [])

  return { ...state, setPropertyUrl, dismissGuidance, resetGuidance, setOperationId }
}
