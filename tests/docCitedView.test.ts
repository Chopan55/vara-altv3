import { describe, expect, it } from 'vitest'
import type { CitedSummary } from '@/lib/documents/citations'
import { CITED_DISCLAIMER, groupFindings, summaryNotices } from '@/lib/documents/citedView'

const base: CitedSummary = { coverage: 'full', pageCount: 3, pagesRead: 3, findings: [], discarded: 0 }
const f = (kind: CitedSummary['findings'][number]['kind'], page = 1) => ({ kind, page, quote: 'frase textual del documento aquí' })

describe('vista del lector con citas', () => {
  it('agrupa por tipo y no muestra grupos vacíos', () => {
    const g = groupFindings({ ...base, findings: [f('mortgage'), f('embargo', 2), f('holder'), f('surface')] })
    expect(g.map(x => x.title)).toEqual(['El documento menciona cargas', 'Titulares y partes', 'Datos del inmueble'])
    expect(g[0].findings).toHaveLength(2)
  })

  it('sin hallazgos NUNCA dice que está limpio: dice que no prueba ausencia', () => {
    const n = summaryNotices(base).join(' ')
    expect(n).toContain('no prueba que no existan')
    expect(n).not.toMatch(/sin cargas|en regla|libre de/i)
  })

  it('un PDF escaneado se avisa como no legible y no agrega nada más', () => {
    const n = summaryNotices({ ...base, coverage: 'unreadable', pagesRead: 0 })
    expect(n).toHaveLength(1)
    expect(n[0]).toContain('No pude leer texto')
    expect(n[0]).toContain('no quiere decir que esté todo en orden')
  })

  it('cobertura parcial dice cuántas páginas se leyeron', () => {
    expect(summaryNotices({ ...base, coverage: 'partial', pagesRead: 2, pageCount: 9, findings: [f('holder')] })[0]).toBe('Leí las primeras 2 de 9 páginas. Lo que está después no se analizó.')
  })

  it('avisa cuánto se descartó por no poder comprobarlo', () => {
    expect(summaryNotices({ ...base, findings: [f('holder')], discarded: 1 })).toEqual(['Descarté 1 dato que no pude comprobar en el texto del documento.'])
    expect(summaryNotices({ ...base, findings: [f('holder')], discarded: 3 })[0]).toContain('3 datos')
  })

  it('el cartel final no promete garantía ni reemplaza al escribano', () => {
    expect(CITED_DISCLAIMER).toContain('no reemplaza a tu escribano ni da garantía')
    expect(CITED_DISCLAIMER).toContain('no prueba que sean ciertas ni que estén vigentes')
  })
})
