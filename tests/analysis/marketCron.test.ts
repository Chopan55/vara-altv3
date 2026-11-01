import { describe, it, expect } from 'vitest'
import { decideCronAction, listSweeps, type SweepSummary } from '@/lib/analysis/market/brightdata'

const NOW = new Date('2026-10-16T12:00:00Z')
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString()
const sweep = (id: string, status: string, d: number): SweepSummary => ({ id, status, createdAt: daysAgo(d) })

describe('barrido semanal: qué hace cada corrida', () => {
  it('sin ningún barrido, inicia uno', () => {
    expect(decideCronAction([], NOW)).toEqual({ action: 'start' })
  })

  it('con un barrido de hace más de 7 días, inicia otro', () => {
    expect(decideCronAction([sweep('sd_a', 'ready', 8)], NOW)).toEqual({ action: 'start' })
  })

  it('si el último falló, vuelve a iniciar', () => {
    expect(decideCronAction([sweep('sd_a', 'failed', 1)], NOW)).toEqual({ action: 'start' })
  })

  it('si el último sigue en curso, espera sin gastar crédito', () => {
    expect(decideCronAction([sweep('sd_a', 'running', 0.1)], NOW)).toEqual({ action: 'wait', snapshotId: 'sd_a' })
  })

  it('si el último terminó hace menos de 2 días, lo ingresa', () => {
    expect(decideCronAction([sweep('sd_a', 'ready', 1)], NOW)).toEqual({ action: 'ingest', snapshotId: 'sd_a' })
  })

  it('si terminó hace 2 a 6 días y ya se ingresó, no hace nada (no gasta)', () => {
    expect(decideCronAction([sweep('sd_a', 'ready', 4)], NOW)).toEqual({ action: 'idle' })
  })

  it('una fecha ilegible cuenta como "sin barrido reciente"', () => {
    expect(decideCronAction([{ id: 'sd_a', status: 'ready', createdAt: 'basura' }], NOW)).toEqual({ action: 'start' })
  })
})

describe('listado de barridos de Bright Data', () => {
  const fakeFetch = (body: unknown, ok = true) =>
    async () => ({ ok, status: ok ? 200 : 500, json: async () => body }) as unknown as Response

  it('ordena del más nuevo al más viejo y descarta filas inválidas', async () => {
    const out = await listSweeps({
      apiKey: 'k',
      fetchImpl: fakeFetch([
        { id: 'sd_old', status: 'ready', created: daysAgo(5) },
        { id: 'sd_new', status: 'running', created: daysAgo(0.5) },
        { id: 'no-valido', status: 'ready', created: daysAgo(1) },
        null,
      ]),
    })
    expect(out.map(s => s.id)).toEqual(['sd_new', 'sd_old'])
  })

  it('si Bright Data responde error, falla sin filtrar la clave', async () => {
    let message = ''
    try {
      await listSweeps({ apiKey: 'secreta-123', fetchImpl: fakeFetch({}, false) })
    } catch (e) {
      message = (e as Error).message
    }
    expect(message).toMatch(/respondió 500/)
    expect(message).not.toContain('secreta-123')
  })
})
