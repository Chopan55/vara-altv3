import { afterEach, describe, expect, it, vi } from 'vitest'

const copyText = vi.fn()
vi.mock('@/components/buy-v3/format', () => ({ copyText: (t: string) => copyText(t) }))

import { SHARE_NOTE, shareText } from '@/lib/shareText'

const setNav = (share?: (d: { text: string }) => Promise<void>) => vi.stubGlobal('navigator', share ? { share } : {})

afterEach(() => { vi.unstubAllGlobals(); copyText.mockReset() })

describe('shareText', () => {
  it('usa el menú del sistema cuando existe', async () => {
    setNav(async () => {})
    expect(await shareText('hola')).toBe('shared')
    expect(copyText).not.toHaveBeenCalled()
  })
  it('si la persona cancela, no copia nada a escondidas', async () => {
    setNav(async () => { throw new DOMException('x', 'AbortError') })
    expect(await shareText('hola')).toBe('cancelled')
    expect(copyText).not.toHaveBeenCalled()
  })
  it('sin menú copia, y si copiar falla informa failed', async () => {
    setNav(undefined)
    copyText.mockResolvedValueOnce(true)
    expect(await shareText('hola')).toBe('copied')
    copyText.mockResolvedValueOnce(false)
    expect(await shareText('hola')).toBe('failed')
    expect(SHARE_NOTE.failed).toMatch(/Copiar/)
  })
  it('un error real del menú cae a copiar', async () => {
    setNav(async () => { throw new Error('boom') })
    copyText.mockResolvedValueOnce(true)
    expect(await shareText('hola')).toBe('copied')
  })
})
