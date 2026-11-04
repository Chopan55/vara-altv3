/**
 * Claves de la API pública. Formato: vara_live_<32 caracteres>.
 * La clave en texto plano existe una sola vez (al crearla); se guarda su SHA-256.
 */

export const API_KEY_PREFIX = 'vara_live_'
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

export function randomToken(length: number): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  // 256 % 62 introduce un sesgo mínimo; para un secreto de 32+ caracteres es irrelevante.
  return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('')
}

export function generateApiKey(): string {
  return API_KEY_PREFIX + randomToken(32)
}

export function isApiKey(token: string): boolean {
  return token.startsWith(API_KEY_PREFIX) && token.length === API_KEY_PREFIX.length + 32
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
}
