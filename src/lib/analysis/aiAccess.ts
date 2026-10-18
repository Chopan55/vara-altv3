/**
 * Cuánto puede usar la IA de V3.
 *
 * Quién puede usarla se decide en `lib/ai/allowlist` (única lista: `AI_ALLOWED_EMAILS`).
 * Sin autorización el resultado sigue mostrando la conclusión determinística; la IA es un
 * extra, no un requisito.
 */

export { isAiAllowed } from '@/lib/ai/allowlist'

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
