/**
 * Quién puede usar las funciones de IA que cuestan plata (OpenAI, Gemini/Veo). ÚNICA fuente de verdad.
 *
 * Variable de entorno canónica (solo servidor, nunca `NEXT_PUBLIC_*`): `AI_ALLOWED_EMAILS`,
 * emails separados por coma. Si falta o está vacía, NADIE puede usar la IA (falla cerrado).
 *
 * La usan tanto el chat y la voz de V3 (`lib/analysis/aiAccess`) como las rutas heredadas
 * (`lib/api/aiAccess`). No hay otra lista de permiso en el código.
 */

export const AI_ALLOWLIST_ENV = 'AI_ALLOWED_EMAILS'

export function parseAllowed(raw: string | undefined): string[] {
  return (raw ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
}

/** `raw` solo se pasa en tests; en producción se lee `AI_ALLOWED_EMAILS` en el momento de la consulta. */
export function isAiAllowed(
  email: string | null | undefined,
  raw: string | undefined = process.env[AI_ALLOWLIST_ENV],
): boolean {
  if (!email) return false
  return parseAllowed(raw).includes(email.trim().toLowerCase())
}
