import { describe, it, expect } from 'vitest'

/**
 * Prueba de humo: cada pantalla de la app se puede importar y exporta un
 * componente. Atrapa errores de importación, de sintaxis o de código que se ejecuta
 * al cargar el módulo, sin necesidad de abrir un navegador ni una sesión.
 */
const pages = import.meta.glob('/src/app/**/page.tsx')

describe('rutas de la app', () => {
  it('hay pantallas para probar', () => {
    expect(Object.keys(pages).length).toBeGreaterThan(20)
  })

  for (const [path, load] of Object.entries(pages)) {
    // Importar una pantalla grande (p. ej. /analizar) tarda 3 s en la suite completa y a veces pasa los 5 s por defecto.
    it(`carga ${path.replace('/src/app', '') || '/'}`, async () => {
      const mod = (await load()) as { default?: unknown }
      expect(typeof mod.default).toBe('function')
    }, 30_000)
  }
})
