import { describe, it, expect, vi, afterEach } from 'vitest'

describe('interruptores de rollback', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })

  it('las novedades arrancan encendidas', async () => {
    const { isEnabled } = await import('@/lib/flags')
    expect(isEnabled('conversationalEntry')).toBe(true)
    expect(isEnabled('groupedMenu')).toBe(true)
    expect(isEnabled('journeyTools')).toBe(true)
  })

  it('NEXT_PUBLIC_FLAGS_OFF apaga solo lo indicado', async () => {
    vi.stubEnv('NEXT_PUBLIC_FLAGS_OFF', 'groupedMenu, journeyTools')
    vi.resetModules()
    const { isEnabled } = await import('@/lib/flags')
    expect(isEnabled('groupedMenu')).toBe(false)
    expect(isEnabled('journeyTools')).toBe(false)
    expect(isEnabled('conversationalEntry')).toBe(true)
  })

  it('lo experimental sigue apagado por defecto', async () => {
    const { isEnabled } = await import('@/lib/flags')
    expect(isEnabled('publicApi')).toBe(false)
  })
})
