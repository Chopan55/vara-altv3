/**
 * Store de avisos de mercado.
 *
 * Guarda cada aviso con la primera vez que lo vimos y su historial de precio.
 * Los portales no dan fecha de publicación confiable: la frescura y los
 * cambios de precio los medimos nosotros comparando barridos.
 *
 * Hoy es un archivo local (`.data/market`, ignorado por git) para desarrollo y
 * staging. Producción necesita la tabla de `supabase/migrations/…market_listings`
 * detrás de la misma interfaz `MarketStore`; no se aplicó porque todavía no
 * está confirmado cuál Supabase es el de producción.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { norm } from '../normalize'
import type { ListingFacts } from '../types'

export interface StoredListing {
  facts: ListingFacts
  firstSeenAt: string
  lastSeenAt: string
  priceHistory: { at: string; price: number; currency: 'USD' | 'ARS' }[]
}

export interface ZoneQuery {
  city?: string
  neighborhood?: string
  community?: string
  limit?: number
}

export interface UpsertStats { added: number; updated: number; priceChanges: number }

export interface MarketStore {
  upsert(listings: ListingFacts[], at?: Date): Promise<UpsertStats>
  query(q: ZoneQuery): Promise<ListingFacts[]>
  stats(): Promise<{ total: number; lastSweepAt: string | null }>
}

/** Pura: combina el aviso nuevo con lo que ya sabíamos. */
export function mergeListing(prev: StoredListing | undefined, next: ListingFacts, at: Date): { stored: StoredListing; priceChanged: boolean } {
  const iso = at.toISOString()
  if (!prev) {
    return {
      priceChanged: false,
      stored: {
        facts: next,
        firstSeenAt: iso,
        lastSeenAt: iso,
        priceHistory: next.price && next.currency ? [{ at: iso, price: next.price, currency: next.currency }] : [],
      },
    }
  }

  const last = prev.priceHistory[prev.priceHistory.length - 1]
  const priceChanged = !!(next.price && next.currency && (!last || last.price !== next.price || last.currency !== next.currency))
    && prev.priceHistory.length > 0
  const history = next.price && next.currency && (!last || last.price !== next.price || last.currency !== next.currency)
    ? [...prev.priceHistory, { at: iso, price: next.price, currency: next.currency }].slice(-20)
    : prev.priceHistory

  return {
    priceChanged,
    stored: {
      facts: {
        ...next,
        // Si el precio cambió entre barridos, esa es la fecha de actividad más confiable que tenemos.
        priceChangedAt: priceChanged ? iso : prev.facts.priceChangedAt,
      },
      firstSeenAt: prev.firstSeenAt,
      lastSeenAt: iso,
      priceHistory: history,
    },
  }
}

const eq = (a?: string, b?: string) => !!a && !!b && norm(a) === norm(b)

export function matchesZone(l: ListingFacts, q: ZoneQuery): boolean {
  if (!q.city && !q.neighborhood && !q.community) return false
  return eq(l.community, q.community) || eq(l.neighborhood, q.neighborhood) || eq(l.city, q.city)
}

interface FileShape { lastSweepAt: string | null; listings: Record<string, StoredListing> }

export function createFileStore(dir: string): MarketStore {
  const file = path.join(dir, 'listings.json')

  async function read(): Promise<FileShape> {
    try {
      const parsed = JSON.parse(await fs.readFile(file, 'utf8')) as FileShape
      return parsed && parsed.listings ? parsed : { lastSweepAt: null, listings: {} }
    } catch {
      return { lastSweepAt: null, listings: {} }
    }
  }

  async function write(data: FileShape): Promise<void> {
    await fs.mkdir(dir, { recursive: true })
    const tmp = `${file}.${process.pid}.tmp`
    await fs.writeFile(tmp, JSON.stringify(data), 'utf8')
    await fs.rename(tmp, file)
  }

  return {
    async upsert(listings, at = new Date()) {
      const data = await read()
      const stats: UpsertStats = { added: 0, updated: 0, priceChanges: 0 }
      for (const l of listings) {
        const prev = data.listings[l.id]
        const { stored, priceChanged } = mergeListing(prev, l, at)
        data.listings[l.id] = stored
        if (prev) stats.updated++
        else stats.added++
        if (priceChanged) stats.priceChanges++
      }
      data.lastSweepAt = at.toISOString()
      await write(data)
      return stats
    },

    async query(q) {
      const data = await read()
      return Object.values(data.listings)
        .map(s => s.facts)
        .filter(l => matchesZone(l, q))
        .sort((a, b) => (b.lastUpdatedAt ?? b.observedAt).localeCompare(a.lastUpdatedAt ?? a.observedAt))
        .slice(0, q.limit ?? 300)
    },

    async stats() {
      const data = await read()
      return { total: Object.keys(data.listings).length, lastSweepAt: data.lastSweepAt }
    },
  }
}

let shared: MarketStore | null = null
export function getMarketStore(): MarketStore {
  shared ??= createFileStore(process.env.MARKET_DATA_DIR ?? path.join(process.cwd(), '.data', 'market'))
  return shared
}
