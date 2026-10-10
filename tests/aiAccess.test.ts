import { describe, it, expect } from 'vitest'
import { isAiAllowed, parseAllowed, withinDailyCap } from '@/lib/api/aiAccess'

describe('acceso a IA', () => {
  it('sin variable configurada nadie entra', () => {
    expect(isAiAllowed('yo@x.com', undefined)).toBe(false)
    expect(isAiAllowed('yo@x.com', '')).toBe(false)
  })

  it('solo entran los emails de la lista, sin importar mayúsculas ni espacios', () => {
    const raw = ' Yo@X.com , otra@y.com '
    expect(parseAllowed(raw)).toEqual(['yo@x.com', 'otra@y.com'])
    expect(isAiAllowed('yo@x.com', raw)).toBe(true)
    expect(isAiAllowed('YO@x.com', raw)).toBe(true)
    expect(isAiAllowed('intruso@z.com', raw)).toBe(false)
    expect(isAiAllowed(undefined, raw)).toBe(false)
  })

  it('el tope diario corta al llegar al límite y se renueva al día siguiente', () => {
    const store = new Map<string, number>()
    const limits = { image: 2, text: 5 }
    const d1 = Date.parse('2026-10-11T12:00:00Z')
    expect(withinDailyCap('u1', 'image', d1, limits, store)).toBe(true)
    expect(withinDailyCap('u1', 'image', d1, limits, store)).toBe(true)
    expect(withinDailyCap('u1', 'image', d1, limits, store)).toBe(false)
    expect(withinDailyCap('u2', 'image', d1, limits, store)).toBe(true)
    expect(withinDailyCap('u1', 'text', d1, limits, store)).toBe(true)
    expect(withinDailyCap('u1', 'image', Date.parse('2026-10-12T09:00:00Z'), limits, store)).toBe(true)
  })
})
