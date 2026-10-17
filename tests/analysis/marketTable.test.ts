import { describe, it, expect } from 'vitest'
import { createTableStore, fromRow, toRow, type MarketRow, type MarketTable } from '@/lib/analysis/market/tableStore'
import { mergeListing } from '@/lib/analysis/market/store'
import { listingFromZonaprop } from '@/lib/analysis/market/zonaprop'
import { NOW } from './fixtures'

/** Tabla en memoria con el mismo contrato que la de Supabase (filtros sobre columnas normalizadas). */
function memoryTable(): MarketTable & { rows: Map<string, MarketRow>; calls: { getByIds: number; upsert: number } } {
  const rows = new Map<string, MarketRow>()
  const calls = { getByIds: 0, upsert: 0 }
  return {
    rows, calls,
    async getByIds(ids) { calls.getByIds++; return ids.map(i => rows.get(i)).filter((r): r is MarketRow => !!r) },
    async upsertRows(list) { calls.upsert++; list.forEach(r => rows.set(r.id, r)) },
    async queryZone(z, limit) {
      return [...rows.values()]
        .filter(r => (z.city && r.city === z.city) || (z.neighborhood && r.neighborhood === z.neighborhood) || (z.community && r.community === z.community))
        .sort((a, b) => b.last_seen_at.localeCompare(a.last_seen_at))
        .slice(0, limit)
    },
    async summary() {
      const all = [...rows.values()]
      return { total: all.length, lastSeenAt: all.map(r => r.last_seen_at).sort().pop() ?? null }
    },
  }
}

const rec = (id: string, over: Record<string, unknown> = {}) => ({
  url: `https://www.zonaprop.com.ar/propiedades/clasificado/t-${id}.html`,
  Title: `Casa en Comunidad Test ${id}`, Precio: 500000, Currency: 'USD', Fecha_de_publicacion: '10/15/26',
  Dimension_terreno: '1000', Dimension_propiedad: '300', Banos: 3, Dormitorios: 4, Tipo: 'Casa',
  Zona2: 'Pilar', Zona3: 'Barrio Test', posting_id: id, estatus: 'online',
  Phone1: '+54 11 5555-0000', Seller_name: 'Inmobiliaria Test', ...over,
})
const listing = (id: string, over: Record<string, unknown> = {}) => listingFromZonaprop(rec(id, over), NOW)!

describe('store de mercado sobre tabla', () => {
  it('guarda avisos nuevos y los cuenta', async () => {
    const t = memoryTable()
    const store = createTableStore(t)
    expect(await store.upsert([listing('1'), listing('2')], NOW)).toEqual({ added: 2, updated: 0, priceChanges: 0 })
    expect(t.rows.size).toBe(2)
  })

  it('un segundo barrido actualiza, conserva la primera vez vista y detecta el cambio de precio', async () => {
    const t = memoryTable()
    const store = createTableStore(t)
    const later = new Date('2026-10-22T12:00:00Z')
    await store.upsert([listing('1')], NOW)
    const stats = await store.upsert([listing('1', { Precio: 470000 })], later)
    expect(stats).toEqual({ added: 0, updated: 1, priceChanges: 1 })

    const row = t.rows.get('zp-1')!
    expect(row.first_seen_at).toBe(NOW.toISOString())
    expect(row.last_seen_at).toBe(later.toISOString())
    expect(row.price_history.map(p => p.price)).toEqual([500000, 470000])
    expect(row.facts.priceChangedAt).toBe(later.toISOString())
  })

  it('un mismo aviso repetido dentro del barrido se guarda una sola vez', async () => {
    const t = memoryTable()
    const store = createTableStore(t)
    expect(await store.upsert([listing('1'), listing('1', { Precio: 480000 })], NOW)).toEqual({ added: 1, updated: 0, priceChanges: 0 })
    expect(t.rows.get('zp-1')!.facts.price).toBe(480000)
  })

  it('consulta por zona sin importar mayúsculas ni tildes', async () => {
    const t = memoryTable()
    const store = createTableStore(t)
    await store.upsert([
      listing('1', { Zona2: 'Pilar' }),
      listing('2', { Zona2: 'Escobar', Zona3: 'Garín' }),
    ], NOW)
    expect((await store.query({ city: 'PILAR' })).map(l => l.id)).toEqual(['zp-1'])
    expect((await store.query({ neighborhood: 'garin' })).map(l => l.id)).toEqual(['zp-2'])
    expect(await store.query({})).toEqual([])
  })

  it('las columnas de zona se guardan normalizadas y el aviso conserva su texto original', async () => {
    const t = memoryTable()
    await createTableStore(t).upsert([listing('1', { Zona2: 'Pilará', Zona3: 'San Sebastián' })], NOW)
    const row = t.rows.get('zp-1')!
    expect(row.city).toBe('pilara')
    expect(row.neighborhood).toBe('san sebastian')
    expect(row.facts.neighborhood).toBe('San Sebastián')
  })

  it('no guarda teléfonos ni datos del vendedor', async () => {
    const t = memoryTable()
    await createTableStore(t).upsert([listing('1')], NOW)
    expect(JSON.stringify([...t.rows.values()])).not.toMatch(/5555|Inmobiliaria Test|Seller|Phone/i)
  })

  it('el resumen informa el total y el último barrido', async () => {
    const store = createTableStore(memoryTable())
    expect(await store.stats()).toEqual({ total: 0, lastSweepAt: null })
    await store.upsert([listing('1')], NOW)
    expect(await store.stats()).toEqual({ total: 1, lastSweepAt: NOW.toISOString() })
  })

  it('un lote vacío no toca la base', async () => {
    const t = memoryTable()
    await createTableStore(t).upsert([], NOW)
    expect(t.calls).toEqual({ getByIds: 0, upsert: 0 })
  })

  it('fila ↔ aviso sin pérdida', () => {
    const { stored } = mergeListing(undefined, listing('1'), NOW)
    expect(fromRow(toRow(stored))).toEqual(stored)
  })
})
