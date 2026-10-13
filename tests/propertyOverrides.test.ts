import { describe, it, expect, beforeEach } from 'vitest'
import { applyOverrides, parseCount, saveOverride } from '@/lib/propertyOverrides'
import type { Property } from '@/types'

const mem: Record<string, string> = {}
beforeEach(() => {
  for (const k of Object.keys(mem)) delete mem[k]
  ;(globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (k in mem ? mem[k] : null),
    setItem: (k: string, v: string) => { mem[k] = v },
    removeItem: (k: string) => { delete mem[k] },
    clear: () => {}, key: () => null, length: 0,
  } as Storage
})

const base = { id: 'imported-1', bedrooms: 0, bathrooms: 7, surface: 1279, garage: false } as Property

describe('correcciones manuales de una propiedad', () => {
  it('lo que la persona escribe manda sobre lo que trajo el aviso', () => {
    saveOverride('imported-1', { bedrooms: 6 })
    const p = applyOverrides(base)
    expect(p.bedrooms).toBe(6)
    expect(p.bathrooms).toBe(7)
  })

  it('no toca otras propiedades', () => {
    saveOverride('imported-1', { bedrooms: 6 })
    expect(applyOverrides({ ...base, id: 'imported-2' }).bedrooms).toBe(0)
  })

  it('acumula correcciones sucesivas', () => {
    saveOverride('imported-1', { bedrooms: 6 })
    saveOverride('imported-1', { garage: true })
    const p = applyOverrides(base)
    expect(p.bedrooms).toBe(6)
    expect(p.garage).toBe(true)
  })

  it('sin correcciones devuelve la propiedad tal cual', () => {
    expect(applyOverrides(base)).toBe(base)
  })

  it('interpreta lo que escribe la persona', () => {
    expect(parseCount('4')).toBe(4)
    expect(parseCount(' 87,5 ')).toBe(87.5)
    expect(parseCount('')).toBeUndefined()
    expect(parseCount('abc')).toBeUndefined()
  })
})
