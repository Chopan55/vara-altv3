import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(n => {
    const f = path.join(dir, n)
    return statSync(f).isDirectory() ? walk(f) : /\.tsx$/.test(n) ? [f] : []
  })
}
const files = walk(path.join(process.cwd(), 'src'))

describe('guardas de uso', () => {
  it('el logo (que ya es un link) nunca va dentro de otro link: rompe la hidratación', () => {
    const bad = files.filter(f => /<Link[^>]*>\s*<VaraLogo/.test(readFileSync(f, 'utf8')))
    expect(bad).toEqual([])
  })

  it('el simulador de financiamiento no muestra tasas de bancos ni calcula costos de cierre por su cuenta', () => {
    const src = readFileSync(path.join(process.cwd(), 'src/components/money/FinanciamientoPanel.tsx'), 'utf8')
    expect(src).not.toMatch(/Banco Naci[oó]n|Santander|BBVA|Banco Provincia/)
    expect(src).not.toMatch(/0\.035|3\.5%/)
    expect(src).not.toMatch(/USD\/ARS|fmtARS/)
  })

  it('el menú principal tiene cinco destinos fijos (los mismos de la barra del celular) y Labs no está ahí', () => {
    const src = readFileSync(path.join(process.cwd(), 'src/components/layout/AppShell.tsx'), 'utf8')
    const block = src.slice(src.indexOf('function getPrimaryNav'), src.indexOf('function getBuyTools'))
    expect([...block.matchAll(/label: '([^']+)'/g)].map(m => m[1])).toEqual(['Inicio', 'Mi operación', 'Dinero', 'Documentos', 'Ayuda'])
    expect(block).not.toContain('vara-labs')
    expect(src).toMatch(/function MobileTabBar[\s\S]*getPrimaryNav\(operationId\)/)
  })

  it('los botones de volver que son solo un ícono tienen nombre', () => {
    const bad = files.filter(f => /<Link href="[^"]+" className="[^"]*text-slate-400 hover:text-slate-700[^"]*">\s*<ArrowLeft/.test(readFileSync(f, 'utf8')))
    expect(bad).toEqual([])
  })
})
