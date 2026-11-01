/**
 * Salud de VARA.
 *
 * Responde "¿está viva y funciona lo crítico?". Un componente que falla y es
 * crítico (la base) pone todo en `down`; uno opcional (IA, mercado) solo
 * degrada: no se anuncia "todo bien" si falta algo que importa, ni "todo
 * caído" por algo accesorio.
 *
 * Nunca incluye secretos ni hosts: solo estados y tiempos.
 */

import type { AppEnv } from './config/env'

export type CheckStatus = 'ok' | 'degraded' | 'down' | 'not_configured'

export interface HealthCheck {
  name: string
  status: CheckStatus
  /** Si está caído, VARA no funciona. */
  critical: boolean
  ms?: number
  note?: string
}

export interface HealthReport {
  status: 'ok' | 'degraded' | 'down'
  env: AppEnv
  /** Commit desplegado (7 caracteres), si el entorno lo informa. */
  version: string | null
  checks: HealthCheck[]
  at: string
}

export function evaluateHealth(
  checks: HealthCheck[],
  meta: { env: AppEnv; version: string | null; now?: Date },
): HealthReport {
  const criticalBroken = checks.some(c => c.critical && (c.status === 'down' || c.status === 'not_configured'))
  const anythingOff = checks.some(c => c.status !== 'ok')
  return {
    status: criticalBroken ? 'down' : anythingOff ? 'degraded' : 'ok',
    env: meta.env,
    version: meta.version,
    checks,
    at: (meta.now ?? new Date()).toISOString(),
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

/** La base de datos: el endpoint público de salud de Supabase, con tiempo máximo. */
export async function checkDatabase(
  env: Record<string, string | undefined> = process.env,
  fetchImpl: FetchLike = fetch,
  timeoutMs = 3000,
): Promise<HealthCheck> {
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return { name: 'database', status: 'not_configured', critical: true, note: 'Falta configurar la base.' }

  const started = Date.now()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetchImpl(`${url.replace(/\/+$/, '')}/auth/v1/health`, {
      headers: { apikey: key },
      signal: ctrl.signal,
      cache: 'no-store',
    })
    const ms = Date.now() - started
    return res.ok
      ? { name: 'database', status: 'ok', critical: true, ms }
      : { name: 'database', status: 'down', critical: true, ms, note: `Respondió ${res.status}.` }
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'AbortError'
    return { name: 'database', status: 'down', critical: true, ms: Date.now() - started, note: timedOut ? 'No respondió a tiempo.' : 'No se pudo conectar.' }
  } finally {
    clearTimeout(timer)
  }
}

/** La IA: solo se verifica que esté configurada; llamar al proveedor en cada chequeo costaría plata. */
export function checkAi(env: Record<string, string | undefined> = process.env): HealthCheck {
  return env.OPENAI_API_KEY
    ? { name: 'ai', status: 'ok', critical: false }
    : { name: 'ai', status: 'not_configured', critical: false, note: 'Sin clave de IA: el asistente no está disponible.' }
}

/** Avisos de mercado de V3: sin avisos cargados no hay comparación automática. */
export async function checkMarket(store: { stats(): Promise<{ total: number; lastSweepAt: string | null }> }): Promise<HealthCheck> {
  try {
    const s = await store.stats()
    return s.total > 0
      ? { name: 'market', status: 'ok', critical: false, note: `${s.total} avisos` }
      : { name: 'market', status: 'degraded', critical: false, note: 'Sin avisos de mercado cargados.' }
  } catch {
    return { name: 'market', status: 'down', critical: false, note: 'No se pudo leer el mercado.' }
  }
}
