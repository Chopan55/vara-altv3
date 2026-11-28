export interface AssistantMemory {
  id: string
  text: string
  createdAt: string
}

/** La memoria es deliberadamente local: nunca escribe Supabase ni otra base real. */
export const ASSISTANT_MEMORY_KEY = 'vara_assistant_memory_v1'
export const ASSISTANT_MEMORY_ENABLED_KEY = 'vara_assistant_memory_enabled_v1'

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function safeStorage(): StorageLike | undefined {
  try { return typeof localStorage === 'undefined' ? undefined : localStorage } catch { return undefined }
}

export function readAssistantMemoryEnabled(storage: StorageLike | undefined = safeStorage()): boolean {
  try { return storage?.getItem(ASSISTANT_MEMORY_ENABLED_KEY) === '1' } catch { return false }
}

export function writeAssistantMemoryEnabled(enabled: boolean, storage: StorageLike | undefined = safeStorage()): void {
  try {
    if (enabled) storage?.setItem(ASSISTANT_MEMORY_ENABLED_KEY, '1')
    else storage?.removeItem(ASSISTANT_MEMORY_ENABLED_KEY)
  } catch {}
}

export function readAssistantMemories(storage: StorageLike | undefined = safeStorage()): AssistantMemory[] {
  try {
    const parsed = JSON.parse(storage?.getItem(ASSISTANT_MEMORY_KEY) ?? '[]') as unknown
    return Array.isArray(parsed)
      ? parsed.filter((memory): memory is AssistantMemory => Boolean(
        memory && typeof memory === 'object' &&
        typeof (memory as AssistantMemory).id === 'string' &&
        typeof (memory as AssistantMemory).text === 'string',
      )).slice(0, 20)
      : []
  } catch { return [] }
}

export function writeAssistantMemories(memories: AssistantMemory[], storage: StorageLike | undefined = safeStorage()): void {
  try { storage?.setItem(ASSISTANT_MEMORY_KEY, JSON.stringify(memories.slice(0, 20))) } catch {}
}

export function addAssistantMemory(text: string, storage: StorageLike | undefined = safeStorage()): AssistantMemory[] {
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, 240)
  if (!clean) return readAssistantMemories(storage)
  const next = [{
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: clean,
    createdAt: new Date().toISOString(),
  }, ...readAssistantMemories(storage)]
  writeAssistantMemories(next, storage)
  return next
}

export function deleteAssistantMemory(id: string, storage: StorageLike | undefined = safeStorage()): AssistantMemory[] {
  const next = readAssistantMemories(storage).filter(memory => memory.id !== id)
  writeAssistantMemories(next, storage)
  return next
}
