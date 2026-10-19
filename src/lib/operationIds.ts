/**
 * Ids de operación. Las operaciones que crea un invitado usan un UUID v4: es el mismo tipo que
 * `operations.id` en Supabase, así que al crear la cuenta se suben CON ese id y no cambia nada
 * (ni la selección, ni el estado de las tareas, ni los links). Reintentar la subida no duplica.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(id: unknown): id is string {
  return typeof id === 'string' && UUID_RE.test(id)
}

export function newOperationId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (c?.randomUUID) return c.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = Math.floor(Math.random() * 16)
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}
