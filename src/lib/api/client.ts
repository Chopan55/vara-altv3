/**
 * Utilidades para llamar a nuestras propias rutas /api desde el navegador sin que
 * el usuario vea mensajes técnicos. Si el servidor devuelve una página de error
 * (timeout, límite de tamaño) en vez de JSON, antes salía "Unexpected token…".
 */
export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = 'ApiError' }
}

/** Lee el JSON de la respuesta; si no es JSON devuelve un objeto vacío en vez de romper. */
export async function safeJson<T extends object = Record<string, unknown>>(res: Response): Promise<Partial<T>> {
  try { return (await res.json()) as Partial<T> } catch { return {} }
}

/** Mensaje en lenguaje humano para un error HTTP. Usa el del servidor solo si es un texto corto y legible. */
export function apiErrorMessage(status: number, serverMessage?: unknown): string {
  if (typeof serverMessage === 'string' && serverMessage.trim() && serverMessage.length < 220 && !/<|\{|Unexpected|stack|at \w+\./i.test(serverMessage)) return serverMessage
  if (status === 401) return 'Ingresá a tu cuenta para usar esta función.'
  if (status === 403) return 'Esta función no está habilitada para tu cuenta todavía.'
  if (status === 413) return 'El archivo es muy pesado. Probá con uno más liviano.'
  if (status === 429) return 'Llegaste al límite por ahora. Probá de nuevo más tarde.'
  if (status === 504 || status === 408) return 'Tardó demasiado en responder. No se perdió nada: probá de nuevo.'
  return 'No pudimos completar la acción. No se perdió nada: probá de nuevo en un rato.'
}

/** Texto para mostrar al usuario ante cualquier error capturado: solo los nuestros pasan; el resto se traduce. */
export function userFacingError(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback
}
