import { NextResponse } from 'next/server'
import { requireAuth, type AuthError, type AuthResult } from '@/lib/api/requireAuth'

/**
 * Acceso a las funciones de IA que cuestan plata (OpenAI).
 *
 * Mientras se prueba, solo pueden usarlas los emails listados en la variable de
 * entorno VARA_AI_ALLOWED_EMAILS (separados por coma). Sin la variable, nadie las
 * usa. Además hay un tope diario por usuario y por tipo de uso.
 *
 * El tope vive en memoria de cada instancia del servidor: sirve para frenar un
 * abuso evidente, no es contabilidad exacta. El tope real de gasto es el límite
 * mensual que se fija en el panel de OpenAI.
 */
export type AiBucket = 'image' | 'text' | 'video'

/** Video: cada clip cuesta plata real, por eso el tope es bajo. */
export const DAILY_LIMITS: Record<AiBucket, number> = { image: 10, text: 100, video: 10 }

export function parseAllowed(raw: string | undefined): string[] {
  return (raw ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
}

export function isAiAllowed(email: string | undefined, raw: string | undefined = process.env.VARA_AI_ALLOWED_EMAILS): boolean {
  if (!email) return false
  return parseAllowed(raw).includes(email.trim().toLowerCase())
}

const usage = new Map<string, number>()

/** Cuenta un uso y dice si todavía entra en el tope del día. */
export function withinDailyCap(
  userId: string, bucket: AiBucket, now: number = Date.now(),
  limits: Record<AiBucket, number> = DAILY_LIMITS, store: Map<string, number> = usage,
): boolean {
  const day = new Date(now).toISOString().slice(0, 10)
  const key = `${day}|${bucket}|${userId}`
  const used = store.get(key) ?? 0
  if (used >= limits[bucket]) return false
  store.set(key, used + 1)
  for (const k of store.keys()) if (!k.startsWith(day)) store.delete(k)
  return true
}

/** Solo verifica sesión y email autorizado, sin contar contra el tope. Para consultar el estado de algo ya pedido. */
export async function requireAiAllowed(): Promise<AuthResult | AuthError> {
  const auth = await requireAuth()
  if (auth.error) return auth
  if (!isAiAllowed(auth.email)) {
    return { error: NextResponse.json({ error: 'Esta función de IA está en prueba y todavía no está habilitada para tu cuenta.' }, { status: 403 }) }
  }
  return auth
}

export async function requireAiAccess(bucket: AiBucket): Promise<AuthResult | AuthError> {
  const auth = await requireAuth()
  if (auth.error) return auth
  if (!isAiAllowed(auth.email)) {
    return { error: NextResponse.json({ error: 'Esta función de IA está en prueba y todavía no está habilitada para tu cuenta.' }, { status: 403 }) }
  }
  if (!withinDailyCap(auth.userId, bucket)) {
    return { error: NextResponse.json({ error: 'Llegaste al límite diario de pruebas. Mañana se renueva.' }, { status: 429 }) }
  }
  return auth
}
