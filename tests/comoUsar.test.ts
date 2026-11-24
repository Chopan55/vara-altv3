import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'

const page = readFileSync('src/app/como-usar/page.tsx', 'utf8')

describe('manual «Cómo usar VARA»', () => {
  it('nombra botones que existen en la app', () => {
    const where: Record<string, string> = {
      'Ver cuánto sale': 'src/components/home/HeroAnalyze.tsx',
      'Guardar análisis como PDF': 'src/components/buy-v3/ResultView.tsx',
      'Preparar mi compra': 'src/components/buy-v3/ResultView.tsx',
      'Empezar mi operación': 'src/app/onboarding/page.tsx',
      'Pedir una visita': 'src/app/vara-visit/page.tsx',
      'Explicámelo simple': 'src/components/operation/NextStepAgent.tsx',
      'Empezar una venta': 'src/app/preparar-venta/page.tsx',
    }
    for (const [label, file] of Object.entries(where)) {
      expect(page).toContain(label)
      expect(existsSync(file) && readFileSync(file, 'utf8').includes(label), `${label} en ${file}`).toBe(true)
    }
  })
  it('se llega desde la portada y desde Ayuda, y no promete garantía', () => {
    expect(readFileSync('src/app/page.tsx', 'utf8')).toContain('/como-usar')
    expect(readFileSync('src/app/guia/page.tsx', 'utf8')).toContain('/como-usar')
    expect(page).not.toMatch(/garant/i)
  })
})
