/**
 * Embudo de producto: visita → analiza → crea operación → vuelve → invita.
 *
 * Sin datos personales: un identificador al azar por navegador, el nombre del
 * paso y datos técnicos cortos (de dónde llegó, país). Va a la función
 * `track_event` de la base; si no hay base configurada, no hace nada. Nunca
 * rompe el producto: cualquier error se ignora.
 */

import { clientAppEnv } from '@/lib/config/env'
import { tryCreateClient } from '@/lib/supabase/client'

export type FunnelStep =
  | 'visit' | 'analyze_start' | 'analyze_done' | 'share' | 'shared_view'
  | 'operation_created' | 'invite_sent'

export type FunnelProps = Record<string, string | number | boolean | null>

const ANON_KEY = 'vara_anon_id'
const LAST_VISIT_KEY = 'vara_last_visit_day'

/** De dónde llega alguien: solo valores cortos y conocidos, nunca texto libre. */
const KNOWN_REFS = new Set(['share', 'wa', 'ig', 'fb', 'li', 'x', 'email', 'google', 'ads'])

function randomId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  } catch { /* sin crypto: sigue abajo */ }
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function anonId(): string | null {
  try {
    let id = localStorage.getItem(ANON_KEY)
    if (!id || !UUID.test(id)) {
      id = randomId()
      localStorage.setItem(ANON_KEY, id)
    }
    return id
  } catch {
    return null
  }
}

/** Limpia las props: claves y valores cortos, sin nada que parezca un dato personal. */
export function cleanProps(props: FunnelProps = {}): FunnelProps {
  const out: FunnelProps = {}
  for (const [k, v] of Object.entries(props).slice(0, 10)) {
    if (!/^[a-z_]{1,30}$/.test(k)) continue
    if (typeof v === 'string') {
      if (v.includes('@') || /\d{6,}/.test(v)) continue
      out[k] = v.slice(0, 40)
    } else if (typeof v === 'number') {
      if (Number.isFinite(v)) out[k] = v
    } else if (typeof v === 'boolean' || v === null) {
      out[k] = v
    }
  }
  return out
}

/** Origen declarado en el link (`?ref=` o `?utm_source=`), si es uno conocido. */
export function refFromSearch(search: string): string | null {
  try {
    const q = new URLSearchParams(search)
    const raw = (q.get('ref') ?? q.get('utm_source') ?? '').toLowerCase().trim()
    if (raw === 'whatsapp') return 'wa'
    return KNOWN_REFS.has(raw) ? raw : null
  } catch {
    return null
  }
}

export function trackFunnel(step: FunnelStep, props?: FunnelProps): void {
  if (typeof window === 'undefined') return
  try {
    const anon = anonId()
    const supabase = tryCreateClient()
    if (!anon || !supabase) return
    void supabase.rpc('track_event', {
      p_anon: anon,
      p_name: step,
      p_env: clientAppEnv(),
      p_path: window.location.pathname.slice(0, 200),
      p_props: cleanProps(props),
    }).then(() => undefined, () => undefined)
  } catch { /* la medición nunca rompe el producto */ }
}

/** Una visita por navegador y por día: sirve para medir quién vuelve. */
export function trackDailyVisit(now: Date = new Date()): boolean {
  try {
    const day = now.toISOString().slice(0, 10)
    if (localStorage.getItem(LAST_VISIT_KEY) === day) return false
    localStorage.setItem(LAST_VISIT_KEY, day)
    const ref = refFromSearch(window.location.search)
    trackFunnel('visit', ref ? { ref } : {})
    return true
  } catch {
    return false
  }
}
