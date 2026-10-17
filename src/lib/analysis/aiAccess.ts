/**
 * Quién puede usar la IA de V3 y cuánto.
 *
 * Gasto externo: solo para emails autorizados (`AI_ALLOWED_EMAILS`, separados
 * por coma) y con tope de uso. Sin autorización el resultado sigue mostrando
 * la conclusión determinística; la IA es un extra, no un requisito.
 */

export function isAiAllowed(email: string | null | undefined, allowList: string | undefined): boolean {
  if (!email || !allowList) return false
  const allowed = allowList.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  return allowed.includes(email.trim().toLowerCase())
}

export interface RateLimiter {
  /** true si el pedido entra; false si superó el tope de la ventana. */
  allow(key: string): boolean
}

export function createRateLimiter(max: number, windowMs: number, now: () => number = Date.now): RateLimiter {
  const hits = new Map<string, number[]>()
  return {
    allow(key) {
      const t = now()
      const recent = (hits.get(key) ?? []).filter(x => t - x < windowMs)
      if (recent.length >= max) {
        hits.set(key, recent)
        return false
      }
      recent.push(t)
      hits.set(key, recent)
      return true
    },
  }
}

export const AI_LIMITS = {
  perUserPerHour: 30,
  /** Tope global por proceso: protege el crédito si algo se descontrola. */
  globalPerDay: 300,
  maxBodyChars: 40_000,
  /** Voz (audio de pago): cada audio cuesta mucho menos que un chat largo, pero se acota igual. */
  speakPerUserPerHour: 40,
  speakGlobalPerDay: 150,
} as const
