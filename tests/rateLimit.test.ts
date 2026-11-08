import { describe, it, expect, beforeEach } from 'vitest'
import { allowRequest, clientKey, resetRateLimits } from '@/lib/api/rateLimit'

describe('límite por cliente', () => {
  beforeEach(() => resetRateLimits())

  it('deja pasar hasta el límite y corta el resto dentro de la ventana', () => {
    const t = 1_000_000
    for (let i = 0; i < 3; i++) expect(allowRequest('a', 3, 60_000, t + i)).toBe(true)
    expect(allowRequest('a', 3, 60_000, t + 10)).toBe(false)
    expect(allowRequest('b', 3, 60_000, t + 10)).toBe(true)
  })

  it('pasada la ventana vuelve a dejar pasar', () => {
    const t = 1_000_000
    for (let i = 0; i < 3; i++) allowRequest('a', 3, 60_000, t)
    expect(allowRequest('a', 3, 60_000, t + 60_001)).toBe(true)
  })

  it('identifica al cliente por la IP que pasa el proxy', () => {
    expect(clientKey(new Request('http://x', { headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' } }))).toBe('1.2.3.4')
    expect(clientKey(new Request('http://x'))).toBe('unknown')
  })
})
