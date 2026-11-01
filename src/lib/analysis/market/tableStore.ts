/**
 * Store de mercado sobre una tabla (producción y staging).
 *
 * La lógica de negocio (primera vez visto, historial de precio, qué es una
 * zona) es la misma que la del store de archivo y vive en `store.ts`. Acá solo
 * se traduce a filas. La tabla concreta (`MarketTable`) se inyecta: Supabase en
 * la nube y una versión en memoria en los tests.
 *
 * Las columnas de zona (`city`, `neighborhood`, `community`) se guardan
 * normalizadas (sin tildes ni mayúsculas) para poder indexar y filtrar; el
 * aviso completo, con su texto original, va en `facts`.
 */

import { norm } from '../normalize'
import type { ListingFacts } from '../types'
import {
  matchesZone, mergeListing,
  type MarketStore, type StoredListing, type UpsertStats, type ZoneQuery,
} from './store'

export interface MarketRow {
  id: string
  source: string
  country: string
  city: string | null
  neighborhood: string | null
  community: string | null
  facts: ListingFacts
  first_seen_at: string
  last_seen_at: string
  price_history: StoredListing['priceHistory']
}

export interface MarketTable {
  getByIds(ids: string[]): Promise<MarketRow[]>
  upsertRows(rows: MarketRow[]): Promise<void>
  /** Avisos de cualquiera de las zonas dadas (valores ya normalizados). */
  queryZone(zone: { city?: string; neighborhood?: string; community?: string }, limit: number): Promise<MarketRow[]>
  summary(): Promise<{ total: number; lastSeenAt: string | null }>
}

const col = (v?: string): string | null => (v ? norm(v) || null : null)

export function toRow(s: StoredListing): MarketRow {
  const f = s.facts
  return {
    id: f.id,
    source: f.source,
    country: f.country,
    city: col(f.city),
    neighborhood: col(f.neighborhood),
    community: col(f.community),
    facts: f,
    first_seen_at: s.firstSeenAt,
    last_seen_at: s.lastSeenAt,
    price_history: s.priceHistory,
  }
}

export function fromRow(r: MarketRow): StoredListing {
  return { facts: r.facts, firstSeenAt: r.first_seen_at, lastSeenAt: r.last_seen_at, priceHistory: r.price_history ?? [] }
}

export function createTableStore(table: MarketTable): MarketStore {
  return {
    async upsert(listings, at = new Date()): Promise<UpsertStats> {
      const stats: UpsertStats = { added: 0, updated: 0, priceChanges: 0 }
      if (listings.length === 0) return stats

      // Si un mismo aviso viene dos veces en el barrido, vale el último.
      const unique = [...new Map(listings.map(l => [l.id, l])).values()]
      const existing = new Map((await table.getByIds(unique.map(l => l.id))).map(r => [r.id, fromRow(r)]))

      const rows: MarketRow[] = []
      for (const l of unique) {
        const prev = existing.get(l.id)
        const { stored, priceChanged } = mergeListing(prev, l, at)
        rows.push(toRow(stored))
        if (prev) stats.updated++
        else stats.added++
        if (priceChanged) stats.priceChanges++
      }
      await table.upsertRows(rows)
      return stats
    },

    async query(q: ZoneQuery) {
      const zone = { city: col(q.city) ?? undefined, neighborhood: col(q.neighborhood) ?? undefined, community: col(q.community) ?? undefined }
      if (!zone.city && !zone.neighborhood && !zone.community) return []
      const limit = q.limit ?? 300
      const rows = await table.queryZone(zone, limit)
      return rows
        .map(r => r.facts)
        .filter(l => matchesZone(l, q))
        .sort((a, b) => (b.lastUpdatedAt ?? b.observedAt).localeCompare(a.lastUpdatedAt ?? a.observedAt))
        .slice(0, limit)
    },

    async stats() {
      const s = await table.summary()
      return { total: s.total, lastSweepAt: s.lastSeenAt }
    },
  }
}
