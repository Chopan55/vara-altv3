import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { generateApiKey, isApiKey, sha256Hex, API_KEY_PREFIX } from '@/lib/apiKeys'

describe('claves de API', () => {
  it('genera claves con formato y únicas', () => {
    const a = generateApiKey()
    const b = generateApiKey()
    expect(a.startsWith(API_KEY_PREFIX)).toBe(true)
    expect(isApiKey(a)).toBe(true)
    expect(a).not.toBe(b)
    expect(isApiKey('vara_live_corta')).toBe(false)
    expect(isApiKey('eyJhbGciOi...')).toBe(false)
  })

  it('el hash del navegador coincide con el del servidor (Node)', async () => {
    const k = generateApiKey()
    expect(await sha256Hex(k)).toBe(createHash('sha256').update(k).digest('hex'))
  })
})
