/**
 * Mantener despierta la base de datos.
 *
 * Supabase pausa los proyectos del plan Free que pasan una semana sin
 * actividad de base de datos. Si le pasa a producción, la app deja de
 * funcionar hasta que alguien la reactiva a mano desde el panel. Un cron
 * diario hace una consulta real y mínima para que la base registre actividad.
 *
 * La consulta pide una fila de `profiles` con la clave pública: RLS no deja
 * ver ninguna (devuelve una lista vacía), pero Postgres ejecuta la consulta.
 * No lee datos de nadie, no escribe y no usa claves secretas.
 *
 * Es una protección, no una garantía: Supabase no publica cuánta actividad
 * alcanza. Lo único que asegura que no se pause es un plan pago.
 */

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export interface KeepaliveResult {
  status: 'ok' | 'failed' | 'not_configured'
  ms?: number
  note?: string
}

/** Lo que se consulta: una fila de una tabla que existe desde el esquema inicial. */
export const KEEPALIVE_QUERY = '/rest/v1/profiles?select=id&limit=1'

export async function pingDatabase(
  env: Record<string, string | undefined> = process.env,
  fetchImpl: FetchLike = fetch,
  timeoutMs = 5000,
): Promise<KeepaliveResult> {
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return { status: 'not_configured', note: 'Falta configurar la base.' }

  const started = Date.now()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    // Los mismos dos headers que manda supabase-js sin sesión: sirven con la
    // clave anon de siempre y con la publicable nueva.
    const res = await fetchImpl(`${url.replace(/\/+$/, '')}${KEEPALIVE_QUERY}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: ctrl.signal,
      cache: 'no-store',
    })
    const ms = Date.now() - started
    return res.ok ? { status: 'ok', ms } : { status: 'failed', ms, note: `Respondió ${res.status}.` }
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'AbortError'
    return { status: 'failed', ms: Date.now() - started, note: timedOut ? 'No respondió a tiempo.' : 'No se pudo conectar.' }
  } finally {
    clearTimeout(timer)
  }
}
