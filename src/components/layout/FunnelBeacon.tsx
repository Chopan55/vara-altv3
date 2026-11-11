'use client'
import { useEffect } from 'react'
import { trackDailyVisit } from '@/lib/funnel/track'

/** Registra una visita por navegador y por día (para medir quién vuelve). No dibuja nada. */
export function FunnelBeacon() {
  useEffect(() => { trackDailyVisit() }, [])
  return null
}
