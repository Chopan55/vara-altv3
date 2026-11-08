/**
 * Límite simple por cliente (ventana deslizante en memoria).
 *
 * Es por instancia del servidor: no reemplaza un límite global, pero corta los
 * bucles y ráfagas de un mismo cliente contra rutas públicas que salen a
 * internet (como la lectura de avisos).
 */

const buckets = new Map<string, number[]>()
const MAX_KEYS = 5000

export function allowRequest(key: string, limit: number, windowMs: number, now: number = Date.now()): boolean {
  const recent = (buckets.get(key) ?? []).filter(t => now - t < windowMs)
  if (recent.length >= limit) {
    buckets.set(key, recent)
    return false
  }
  recent.push(now)
  buckets.set(key, recent)
  if (buckets.size > MAX_KEYS) {
    for (const [k, times] of buckets) if (!times.length || now - times[times.length - 1] >= windowMs) buckets.delete(k)
  }
  return true
}

/** IP del cliente según el proxy de Vercel; "unknown" si no viene. */
export function clientKey(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return fwd || req.headers.get('x-real-ip') || 'unknown'
}

/** Solo para tests. */
export function resetRateLimits(): void {
  buckets.clear()
}
