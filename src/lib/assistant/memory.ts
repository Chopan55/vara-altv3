export interface AssistantMemory {
  id: string
  text: string
  createdAt: string
}

/**
 * La memoria es deliberadamente local: nunca escribe Supabase ni otra base real.
 * Se guarda POR CUENTA (`scope` = id del usuario): en un navegador compartido, la
 * persona siguiente no ve ni envía los recuerdos de la anterior. Sin cuenta
 * identificada no hay memoria.
 */
export const ASSISTANT_MEMORY_PREFIX = 'vara_assistant_memory'
export const ASSISTANT_MEMORY_MAX_ITEMS = 20
export const ASSISTANT_MEMORY_MAX_CHARS = 240

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type Scope = string | null | undefined

export const assistantMemoryKey = (scope: string) => `${ASSISTANT_MEMORY_PREFIX}_v1:${scope}`
export const assistantMemoryEnabledKey = (scope: string) => `${ASSISTANT_MEMORY_PREFIX}_enabled_v1:${scope}`

function safeStorage(): StorageLike | undefined {
  try { return typeof localStorage === 'undefined' ? undefined : localStorage } catch { return undefined }
}

export function cleanMemoryText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, ASSISTANT_MEMORY_MAX_CHARS)
}

/**
 * Detecta lo que NO debe guardarse: claves, números largos (documentos, tarjetas, CBU)
 * y palabras de credenciales. La memoria viaja al proveedor de IA en cada chat.
 */
export function isSensitiveMemory(text: string): boolean {
  return /\d[\d .-]{6,}\d/.test(text)
    || /\b(clave|contrase(?:ñ|n)a|password|pin|cvv|token|dni|cuil|cuit|cbu|cvu|tarjeta)\b/i.test(text)
}

export function readAssistantMemoryEnabled(scope: Scope, storage: StorageLike | undefined = safeStorage()): boolean {
  if (!scope) return false
  try { return storage?.getItem(assistantMemoryEnabledKey(scope)) === '1' } catch { return false }
}

export function writeAssistantMemoryEnabled(scope: Scope, enabled: boolean, storage: StorageLike | undefined = safeStorage()): void {
  if (!scope) return
  try {
    if (enabled) storage?.setItem(assistantMemoryEnabledKey(scope), '1')
    else storage?.removeItem(assistantMemoryEnabledKey(scope))
  } catch {}
}

/** Lee y normaliza: descarta lo inválido, recorta el texto y respeta los topes. */
export function readAssistantMemories(scope: Scope, storage: StorageLike | undefined = safeStorage()): AssistantMemory[] {
  if (!scope) return []
  try {
    const parsed = JSON.parse(storage?.getItem(assistantMemoryKey(scope)) ?? '[]') as unknown
    if (!Array.isArray(parsed)) return []
    const out: AssistantMemory[] = []
    for (const item of parsed.slice(0, ASSISTANT_MEMORY_MAX_ITEMS * 2)) {
      if (!item || typeof item !== 'object') continue
      const { id, text, createdAt } = item as Partial<AssistantMemory>
      if (typeof id !== 'string' || typeof text !== 'string' || !id || id.length > 64) continue
      const clean = cleanMemoryText(text)
      if (!clean || isSensitiveMemory(clean)) continue
      out.push({ id, text: clean, createdAt: typeof createdAt === 'string' ? createdAt.slice(0, 40) : '' })
      if (out.length === ASSISTANT_MEMORY_MAX_ITEMS) break
    }
    return out
  } catch { return [] }
}

export function writeAssistantMemories(scope: Scope, memories: AssistantMemory[], storage: StorageLike | undefined = safeStorage()): void {
  if (!scope) return
  try { storage?.setItem(assistantMemoryKey(scope), JSON.stringify(memories.slice(0, ASSISTANT_MEMORY_MAX_ITEMS))) } catch {}
}

export type AddMemoryResult = { memories: AssistantMemory[]; rejected?: 'vacio' | 'sensible' | 'sin-cuenta' }

export function addAssistantMemory(scope: Scope, text: string, storage: StorageLike | undefined = safeStorage()): AddMemoryResult {
  if (!scope) return { memories: [], rejected: 'sin-cuenta' }
  const current = readAssistantMemories(scope, storage)
  const clean = cleanMemoryText(text)
  if (!clean) return { memories: current, rejected: 'vacio' }
  if (isSensitiveMemory(clean)) return { memories: current, rejected: 'sensible' }
  const next = [{
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: clean,
    createdAt: new Date().toISOString(),
  }, ...current].slice(0, ASSISTANT_MEMORY_MAX_ITEMS)
  writeAssistantMemories(scope, next, storage)
  return { memories: next }
}

export function deleteAssistantMemory(scope: Scope, id: string, storage: StorageLike | undefined = safeStorage()): AssistantMemory[] {
  const next = readAssistantMemories(scope, storage).filter(memory => memory.id !== id)
  writeAssistantMemories(scope, next, storage)
  return next
}

/** «Borrar toda la memoria»: quita los recuerdos de esta cuenta. */
export function clearAssistantMemories(scope: Scope, storage: StorageLike | undefined = safeStorage()): void {
  if (!scope) return
  try { storage?.removeItem(assistantMemoryKey(scope)) } catch {}
}

/** Al cerrar sesión: quita la memoria de TODAS las cuentas de este navegador. */
export function clearAllAssistantMemories(storage: Storage | undefined = safeStorage() as Storage | undefined): void {
  try {
    if (!storage) return
    const keys: string[] = []
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (key && key.startsWith(ASSISTANT_MEMORY_PREFIX)) keys.push(key)
    }
    keys.forEach(key => storage.removeItem(key))
  } catch {}
}

export const ASSISTANT_MEMORY_MAX_TOTAL_CHARS = 2000

/**
 * Lado servidor: lo que llega en `assistantMemory` es contenido NO confiable.
 * Se recorta la lista ANTES de procesarla, se aceptan solo textos, se quitan los
 * delimitadores que usa el prompt y se descartan los sensibles.
 */
export function sanitizeAssistantMemoryInput(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const out: string[] = []
  let total = 0
  for (const item of input.slice(0, ASSISTANT_MEMORY_MAX_ITEMS)) {
    if (typeof item !== 'string') continue
    const clean = cleanMemoryText(item.slice(0, ASSISTANT_MEMORY_MAX_CHARS * 2).replace(/<<<|>>>/g, ' '))
    if (!clean || isSensitiveMemory(clean)) continue
    if (total + clean.length > ASSISTANT_MEMORY_MAX_TOTAL_CHARS) break
    out.push(clean)
    total += clean.length
  }
  return out
}
