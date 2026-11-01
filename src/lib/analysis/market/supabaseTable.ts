/**
 * Tabla `market_listings` en Supabase. SOLO servidor.
 *
 * Usa la clave secreta del proyecto: la tabla tiene seguridad por fila activada
 * y ninguna política pública, así que con la clave pública del navegador nadie
 * puede leerla ni escribirla. Los avisos barridos son datos de terceros y no se
 * redistribuyen: solo los lee nuestro servidor para armar el análisis.
 */

import { createClient } from '@supabase/supabase-js'
import type { MarketRow, MarketTable } from './tableStore'

const TABLE = 'market_listings'
const IN_CHUNK = 100
const UPSERT_CHUNK = 200

function chunks<T>(list: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

/** Un error de la base nunca lleva el mensaje del proveedor (puede reflejar la consulta). */
function fail(op: string, error: { code?: string } | null): never {
  throw new Error(`market db: ${op} falló${error?.code ? ` (${error.code})` : ''}`)
}

export function createSupabaseMarketTable(url: string, secretKey: string): MarketTable {
  const db = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })

  return {
    async getByIds(ids) {
      const out: MarketRow[] = []
      for (const part of chunks(ids, IN_CHUNK)) {
        const { data, error } = await db.from(TABLE).select('*').in('id', part)
        if (error) fail('leer', error)
        out.push(...((data ?? []) as MarketRow[]))
      }
      return out
    },

    async upsertRows(rows) {
      for (const part of chunks(rows, UPSERT_CHUNK)) {
        const { error } = await db.from(TABLE).upsert(
          part.map(r => ({ ...r, updated_at: new Date().toISOString() })),
          { onConflict: 'id' },
        )
        if (error) fail('guardar', error)
      }
    },

    async queryZone(zone, limit) {
      // Los valores salen de `norm()` (solo letras, números y espacios): van entre comillas y no pueden romper el filtro.
      const filters = (['city', 'neighborhood', 'community'] as const)
        .filter(k => zone[k])
        .map(k => `${k}.eq."${zone[k]}"`)
      if (filters.length === 0) return []
      const { data, error } = await db
        .from(TABLE)
        .select('*')
        .or(filters.join(','))
        .order('last_seen_at', { ascending: false })
        .limit(limit)
      if (error) fail('consultar', error)
      return (data ?? []) as MarketRow[]
    },

    async summary() {
      const [count, latest] = await Promise.all([
        db.from(TABLE).select('id', { count: 'exact', head: true }),
        db.from(TABLE).select('last_seen_at').order('last_seen_at', { ascending: false }).limit(1),
      ])
      if (count.error) fail('contar', count.error)
      if (latest.error) fail('resumir', latest.error)
      return {
        total: count.count ?? 0,
        lastSeenAt: (latest.data?.[0] as { last_seen_at?: string } | undefined)?.last_seen_at ?? null,
      }
    },
  }
}
