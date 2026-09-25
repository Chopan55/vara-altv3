/**
 * Saber qué falla.
 *
 * Hoy el producto tiene 11 `console.error` sueltos y 52 `catch {}` vacíos.
 * Cuando algo se rompe en el navegador de otra persona, no queda rastro.
 *
 * Tres decisiones:
 *
 * 1. **No inventamos un servicio de monitoreo.** No hay Sentry contratado, así
 *    que esto no finge mandar nada a ningún lado. Guarda los últimos eventos
 *    en memoria y los escribe en consola. Si mañana hay un endpoint, se
 *    enchufa en `setSink` sin tocar los sitios que loguean.
 *
 * 2. **Nunca se loguea el dato de la persona.** El contexto pasa por una lista
 *    blanca de claves. Una dirección, un monto o un nombre en un log es una
 *    filtración esperando el momento, y los logs terminan en lugares que uno
 *    no controla.
 *
 * 3. **Loguear no puede romper.** Si el sink falla, se traga el error. Un
 *    logger que tira una excepción convierte un bug chico en una pantalla
 *    en blanco.
 */

export type LogLevel = 'info' | 'warn' | 'error'

export interface LogEntry {
  level: LogLevel
  /** Identificador estable del evento: "document.upload.failed". */
  event: string
  message?: string
  context: Record<string, string | number | boolean>
  at: number
}

/**
 * Lo único que se puede adjuntar a un log.
 *
 * Es una lista blanca, no una negra: si mañana alguien agrega un campo nuevo
 * con datos sensibles, queda afuera por omisión en vez de entrar por descuido.
 */
const ALLOWED_CONTEXT_KEYS = new Set([
  'operationId', 'documentId', 'offerId', 'propertyId', 'candidateId',
  'status', 'from', 'to', 'kind', 'category', 'route', 'version',
  'code', 'httpStatus', 'durationMs', 'count', 'bytes', 'retry',
])

export function redactContext(
  raw: Record<string, unknown> | undefined,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}
  if (!raw) return out

  for (const [k, v] of Object.entries(raw)) {
    if (!ALLOWED_CONTEXT_KEYS.has(k)) continue
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v
    }
  }
  return out
}

/**
 * Un mensaje de error sirve; un stack completo del navegador de otra persona
 * no agrega nada que podamos accionar y suele arrastrar rutas y datos.
 */
export function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return 'Error desconocido'
}

/** Últimos eventos, para diagnosticar sin depender de la consola. */
const RING_SIZE = 50
const ring: LogEntry[] = []

type Sink = (entry: LogEntry) => void
let sink: Sink | null = null

/** Enchufa un destino externo. Sin esto, los logs viven solo en memoria. */
export function setSink(fn: Sink | null): void {
  sink = fn
}

export function recentLogs(): LogEntry[] {
  return [...ring]
}

export function clearLogs(): void {
  ring.length = 0
}

function push(entry: LogEntry): void {
  ring.push(entry)
  if (ring.length > RING_SIZE) ring.shift()

  try {
    if (sink) sink(entry)
  } catch {
    // Un logger que explota convierte un bug chico en una pantalla en blanco.
  }
}

function emit(
  level: LogLevel,
  event: string,
  message?: string,
  context?: Record<string, unknown>,
): LogEntry {
  const entry: LogEntry = {
    level,
    event,
    message,
    context: redactContext(context),
    at: Date.now(),
  }
  push(entry)

  // En consola solo lo que hay que mirar. Un info por cada acción sería ruido.
  if (level !== 'info' && typeof console !== 'undefined') {
    const fn = level === 'error' ? console.error : console.warn
    fn(`[${event}]`, message ?? '', entry.context)
  }

  return entry
}

export const log = {
  info: (event: string, context?: Record<string, unknown>) =>
    emit('info', event, undefined, context),

  warn: (event: string, message?: string, context?: Record<string, unknown>) =>
    emit('warn', event, message, context),

  /** Para un `catch`: toma el error tal cual venga y le saca el mensaje. */
  error: (event: string, err: unknown, context?: Record<string, unknown>) =>
    emit('error', event, messageOf(err), context),
}
