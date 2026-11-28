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

  it('onboarding requiere una selección antes de continuar en pasos 2 y 3', () => {
    const src = readFileSync(path.join(process.cwd(), 'src/app/onboarding/page.tsx'), 'utf8')
    expect(src).toMatch(/disabled=\{!type\}/)
    expect(src).toMatch(/disabled=\{!province\}/)
    expect(src).toContain('Elegí una provincia para seguir')
    expect(src).toMatch(/setType\(id\)\}/)
    expect(src).toMatch(/setProvince\(p\)\}/)
  })

  it('la entrada no promete lectura de Zonaprop y el resultado identifica el link VARA', () => {
    const entry = readFileSync(path.join(process.cwd(), 'src/components/buy-v3/Entry.tsx'), 'utf8')
    const highlights = readFileSync(path.join(process.cwd(), 'src/components/buy-v3/Highlights.tsx'), 'utf8')
    expect(entry).not.toContain('Funciona con Zonaprop')
    expect(entry).not.toContain('No pude leer el aviso solo')
    expect(entry).not.toContain('⌘A')
    expect(highlights).toContain('Copiar link del análisis VARA')
  })

  it('resultado abre acciones locales y conserva el motivo de la evidencia', () => {
    const result = readFileSync(path.join(process.cwd(), 'src/components/buy-v3/ResultView.tsx'), 'utf8')
    const evidence = readFileSync(path.join(process.cwd(), 'src/components/buy-v3/Evidence.tsx'), 'utf8')
    expect(result).toContain('role="region" aria-labelledby="inline-action-title"')
    expect(result).toContain("setActivePanel('missing')")
    expect(evidence).toContain('Busqué {r.afterDedup}')
    expect(evidence).toContain('ninguno alcanzó el umbral')
  })
})
