import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { useBrowserState, useBrowserValue, useHydrated } from '@/hooks/useHydrated'

/*
 * En el servidor (y durante la hidratación) estos hooks devuelven el valor por
 * defecto y NO tocan el navegador: es lo que evita que el HTML del servidor y
 * el del cliente difieran (error #418). La lectura en el navegador se prueba
 * en la prueba de pantallas con Playwright.
 */
describe('useHydrated / useBrowserState en el servidor', () => {
  it('useHydrated es false en el servidor', () => {
    function Probe() { return createElement('span', null, String(useHydrated())) }
    expect(renderToString(createElement(Probe))).toContain('false')
  })

  it('useBrowserState usa el valor por defecto y no llama a read()', () => {
    const read = vi.fn(() => 'del navegador')
    function Probe() {
      const [v] = useBrowserState(read, 'por defecto')
      return createElement('span', null, v)
    }
    const html = renderToString(createElement(Probe))
    expect(html).toContain('por defecto')
    expect(read).not.toHaveBeenCalled()
  })

  it('useBrowserValue tampoco lee en el servidor', () => {
    const read = vi.fn(() => 42)
    function Probe() { return createElement('span', null, String(useBrowserValue(read, 0))) }
    expect(renderToString(createElement(Probe))).toContain('0')
    expect(read).not.toHaveBeenCalled()
  })
})
