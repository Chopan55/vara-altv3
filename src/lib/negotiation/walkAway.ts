import { parseAmount } from './chain'

/**
 * El límite privado (precio de reserva) nunca sale en una respuesta de la IA.
 *
 * El prompt ya lo pide, pero una instrucción no es una garantía: esto revisa la
 * respuesta en el servidor y reemplaza cualquier monto que coincida con el límite.
 */

// La moneda trae su propio espacio; el número termina en dígito (no se lleva el punto final de la oración).
const MONEY = /(?:(?:USD|U\$S|US\$|ARS|\$)\s?)?\d(?:[\d.,]*\d)?(?:\s?(?:mil|millones?|k|K|M)\b)?/g

function tokenValue(token: string): number | null {
  const n = parseAmount(token)
  if (n === null) return null
  if (/(?:mil|k|K)\s*$/.test(token)) return n * 1_000
  if (/(?:M|millones?)\s*$/.test(token)) return n * 1_000_000
  return n
}

/** Montos de al menos 1.000 escritos en el límite ("no más de USD 130.000" → [130000]). */
export function walkAwayAmounts(walkAway: string): number[] {
  return (walkAway.match(MONEY) ?? [])
    .map(tokenValue)
    .filter((n): n is number => n !== null && n >= 1_000)
}

const matches = (n: number, targets: number[]) => targets.some(t => Math.abs(n - t) / t < 0.005)

function scrubText(text: string, targets: number[]): string {
  return text.replace(MONEY, token => {
    const n = tokenValue(token)
    return n !== null && matches(n, targets) ? '[tu límite privado]' : token
  })
}

/** Recorre toda la respuesta (strings, listas y objetos) y tapa el límite donde aparezca. */
export function scrubWalkAway<T>(value: T, walkAway?: string): T {
  const targets = walkAway ? walkAwayAmounts(walkAway) : []
  if (targets.length === 0) return value
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return scrubText(v, targets)
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]))
    return v
  }
  return walk(value) as T
}
