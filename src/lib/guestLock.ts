/**
 * Un solo migrador a la vez para lo que creó el invitado (operaciones y propiedades).
 *
 * - Entre pestañas: Web Locks, si el navegador los tiene.
 * - Dentro de la página (y como respaldo sin Web Locks): una cola de promesas.
 * - singleFlight: varias llamadas simultáneas comparten UNA ejecución en vez de correr una detrás de otra.
 *
 * Los Web Locks no son reentrantes: quien ya está dentro del lock no debe volver a pedirlo.
 */

const LOCK_NAME = 'vara-guest-migration'

type LockManagerLike = { request: <R>(name: string, cb: () => Promise<R>) => Promise<R> }

let queue: Promise<unknown> = Promise.resolve()

export function withGuestMigrationLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? (navigator as { locks?: LockManagerLike }).locks : undefined
  if (locks) return locks.request(LOCK_NAME, fn)
  const run = queue.then(fn, fn)
  queue = run.catch(() => undefined)
  return run
}

/**
 * Import perezoso y compartido: las llamadas simultáneas esperan UNA sola carga del módulo en vez de disparar
 * un import() cada una. Si la carga falla no queda cacheada.
 */
export function lazyModule<T>(load: () => Promise<T>): () => Promise<T> {
  let p: Promise<T> | null = null
  return () => (p ??= load().catch(err => { p = null; throw err }))
}

export function singleFlight<T>(fn: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | null = null
  return () => (inFlight ??= fn().finally(() => { inFlight = null }))
}
