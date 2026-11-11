/**
 * Quién puede usar las funciones de IA que cuestan plata (OpenAI, Gemini/Veo). ÚNICA fuente de verdad.
 *
 * Variable de entorno canónica (solo servidor, nunca `NEXT_PUBLIC_*`): `AI_ALLOWED_EMAILS`,
 * emails separados por coma. Si falta o está vacía, NADIE puede usar la IA (falla cerrado).
 *
 * Nombre anterior: `VARA_AI_ALLOWED_EMAILS`. Producción la tiene cargada con ese nombre y el dueño
 * decidió no renombrarla en Vercel (11/11/2026). Se lee SOLO si la canónica no existe: si están las
 * dos manda la canónica, nunca se suman. Sigue habiendo una sola lista.
 *
 * La usan tanto el chat y la voz de V3 (`lib/analysis/aiAccess`) como las rutas heredadas
 * (`lib/api/aiAccess`). No hay otra lista de permiso en el código.
 */

export const AI_ALLOWLIST_ENV = 'AI_ALLOWED_EMAILS'
export const AI_ALLOWLIST_ENV_LEGACY = 'VARA_AI_ALLOWED_EMAILS'

/** La lista vigente: la canónica si existe (aunque esté vacía: falla cerrado), si no, la del nombre anterior. */
export function allowlistFromEnv(env: Record<string, string | undefined> = process.env): string | undefined {
  const canonical = env[AI_ALLOWLIST_ENV]
  return canonical !== undefined ? canonical : env[AI_ALLOWLIST_ENV_LEGACY]
}

export function parseAllowed(raw: string | undefined): string[] {
  return (raw ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
}

/** `raw` solo se pasa en tests; en producción se lee la lista vigente en el momento de la consulta. */
export function isAiAllowed(
  email: string | null | undefined,
  raw: string | undefined = allowlistFromEnv(),
): boolean {
  if (!email) return false
  return parseAllowed(raw).includes(email.trim().toLowerCase())
}
