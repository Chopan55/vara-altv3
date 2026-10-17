/**
 * Validación del formulario público "Hablá con una persona".
 *
 * Es pura (sin red ni base) para poder probarla. Reglas de la tabla `contact_requests`:
 * name 2–80, email 5–120, message 10–1000. Acá se aplican ANTES de tocar la base.
 */

export const CONTACT_LIMITS = {
  /** Tamaño máximo del cuerpo en caracteres: sobra para el máximo de campos y corta cargas absurdas. */
  maxBodyChars: 4_000,
  nameMin: 2, nameMax: 80,
  emailMin: 5, emailMax: 120,
  messageMin: 10, messageMax: 1000,
  /** Pedidos por IP por hora y totales por día (por instancia del servidor). */
  perIpPerHour: 5,
  globalPerDay: 300,
} as const

export interface ContactInput { name: string; email: string; message: string }

export type ContactCheck =
  | { ok: true; value: ContactInput }
  | { ok: false; error: string }

// Caracteres de control (incluye saltos de línea): no tienen lugar en un nombre ni en un mail.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/
const EMAIL = /^[^\s@,;<>()[\]\\"]+@[^\s@,;<>()[\]\\"]+\.[^\s@,;<>()[\]\\"]{2,}$/

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

export function validateContact(body: unknown): ContactCheck {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Pedido inválido.' }
  const b = body as Record<string, unknown>

  // Solo texto: nada de números, objetos ni listas escondidos en los campos.
  for (const k of ['name', 'email', 'message'] as const) {
    if (typeof b[k] !== 'string') return { ok: false, error: 'Pedido inválido.' }
  }

  const name = (b.name as string).replace(/\s+/g, ' ').trim()
  const email = normalizeEmail(b.email as string)
  const message = (b.message as string).replace(/\r\n/g, '\n').trim()

  if (name.length < CONTACT_LIMITS.nameMin || name.length > CONTACT_LIMITS.nameMax || CONTROL.test(name)) {
    return { ok: false, error: 'Poné tu nombre.' }
  }
  if (email.length < CONTACT_LIMITS.emailMin || email.length > CONTACT_LIMITS.emailMax || CONTROL.test(email) || !EMAIL.test(email)) {
    return { ok: false, error: 'Ese mail no parece válido.' }
  }
  if (message.length < CONTACT_LIMITS.messageMin || message.length > CONTACT_LIMITS.messageMax) {
    return { ok: false, error: 'Contanos un poco más (entre 10 y 1000 caracteres).' }
  }
  return { ok: true, value: { name, email, message } }
}

/** IP del pedido según los encabezados del proxy; "desconocida" si no hay ninguno. */
export function clientIp(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for')
  const first = fwd?.split(',')[0]?.trim()
  return first || headers.get('x-real-ip')?.trim() || 'desconocida'
}
