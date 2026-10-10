import { describe, it, expect, beforeEach } from 'vitest'
import { EMPTY_PROFILE, loadProfile, saveProfile, summarize } from '@/lib/buyerProfile'

const store = new Map<string, string>()
;(globalThis as { localStorage?: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(), key: () => null, length: 0,
} as Storage

describe('perfil del comprador', () => {
  beforeEach(() => store.clear())

  it('sin datos devuelve el perfil vacío y un resumen vacío', () => {
    expect(loadProfile()).toEqual(EMPTY_PROFILE)
    expect(summarize(loadProfile())).toEqual([])
  })

  it('guarda y recupera, y resume lo imprescindible y lo que descarta', () => {
    saveProfile({ ...EMPTY_PROFILE, zone: 'Pilar', budget: '250000', importance: { garden: 'MUST', quiet: 'DEALBREAKER' } })
    const s = summarize(loadProfile())
    expect(s).toContain('hasta USD 250000')
    expect(s).toContain('Jardín imprescindible')
    expect(s).toContain('sin zona tranquila: descarta')
  })

  it('un JSON roto no rompe la carga', () => {
    store.set('vara_buyer_profile', '{no')
    expect(loadProfile()).toEqual(EMPTY_PROFILE)
  })
})
