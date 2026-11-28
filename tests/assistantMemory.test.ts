import { describe, expect, it } from 'vitest'
import { addAssistantMemory, deleteAssistantMemory, readAssistantMemories, readAssistantMemoryEnabled, writeAssistantMemoryEnabled } from '@/lib/assistant/memory'

function storage() {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value), removeItem: (key: string) => void values.delete(key) }
}

describe('memoria editable del asistente', () => {
  it('está apagada por defecto y se puede prender/apagar', () => {
    const s = storage()
    expect(readAssistantMemoryEnabled(s)).toBe(false)
    writeAssistantMemoryEnabled(true, s)
    expect(readAssistantMemoryEnabled(s)).toBe(true)
    writeAssistantMemoryEnabled(false, s)
    expect(readAssistantMemoryEnabled(s)).toBe(false)
  })

  it('permite ver, agregar y borrar recuerdos locales', () => {
    const s = storage()
    const memories = addAssistantMemory(' Prefiero que me expliques los costos en dólares. ', s)
    expect(readAssistantMemories(s)[0].text).toContain('dólares')
    expect(deleteAssistantMemory(memories[0].id, s)).toEqual([])
  })

  it('limita el texto y no crea recuerdos vacíos', () => {
    const s = storage()
    expect(addAssistantMemory('   ', s)).toEqual([])
    expect(addAssistantMemory('a'.repeat(500), s)[0].text).toHaveLength(240)
  })
})
