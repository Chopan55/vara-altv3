import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { extractPages } from '@/lib/documents/extractPdf'
import { readWithCitations } from '@/lib/documents/readCited'

const pdf = (name: string) => new Uint8Array(readFileSync(join(__dirname, 'fixtures', name)))

describe('lector de PDF real (documentos ficticios, sin red)', () => {
  it('extrae el texto página por página', async () => {
    const pages = await extractPages(pdf('escritura-ficticia.pdf'))
    expect(pages).toHaveLength(2)
    expect(pages[0]).toContain('DNI 20.123.456')
    expect(pages[1]).toContain('hipoteca en primer grado')
  })

  it('de punta a punta: un dato verdadero se cita con su página y uno inventado se descarta', async () => {
    const pages = await extractPages(pdf('escritura-ficticia.pdf'))
    const complete = vi.fn(async () => JSON.stringify({ findings: [
      { kind: 'mortgage', text: 'Hipoteca a favor del Banco Ejemplo', page: 1, quote: 'Se constituye hipoteca en primer grado a favor del Banco Ejemplo por USD 80.000' },
      { kind: 'embargo', text: 'Embargo', page: 2, quote: 'embargo trabado por el juzgado civil numero cuatro' },
    ] }))
    const { summary, usedModel } = await readWithCitations(pages, complete)
    expect(usedModel).toBe(true)
    expect(summary.findings).toEqual([expect.objectContaining({ kind: 'mortgage', page: 2 })]) // la página mal declarada se corrige
    expect(summary.discarded).toBe(1)
    const sent = (complete.mock.calls[0] as unknown as [string, string])[1]
    expect(sent).toContain('[Página 1]')
    expect(sent).toContain('[Página 2]')
  })

  it('un escaneo (sin texto) no llega al modelo y queda como no legible', async () => {
    const pages = await extractPages(pdf('escaneo-ficticio.pdf'))
    const complete = vi.fn()
    const { summary, usedModel } = await readWithCitations(pages, complete)
    expect(complete).not.toHaveBeenCalled()
    expect(usedModel).toBe(false)
    expect(summary.coverage).toBe('unreadable')
  })

  it('un archivo que no es PDF falla de forma controlada', async () => {
    await expect(extractPages(new TextEncoder().encode('esto no es un pdf'))).rejects.toThrow()
  })
})
