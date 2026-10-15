export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import {
  BrightDataError, downloadSweep, startSweep, sweepProgress, SWEEP_LIMITS,
} from '@/lib/analysis/market/brightdata'
import { getMarketStore } from '@/lib/analysis/market/store'
import { listingsFromZonaprop } from '@/lib/analysis/market/zonaprop'
import { log } from '@/lib/observability/logger'

/**
 * Barrido de mercado: dos pasos, protegidos por secreto.
 *
 *   POST {action:"start", zones?:[url], limit?:number}   → {snapshotId}
 *   POST {action:"ingest", snapshotId}                   → {status} o estadísticas
 *
 * Gasta créditos de Bright Data, por eso exige `x-sweep-secret`. Zonas por
 * defecto: barrios cerrados de Pilar.
 */

const DEFAULT_ZONES = ['https://www.zonaprop.com.ar/casas-venta-pilar-q-barrio-cerrado.html']

function authorized(req: Request): boolean {
  const secret = process.env.MARKET_SWEEP_SECRET
  const given = req.headers.get('x-sweep-secret') ?? ''
  if (!secret || secret.length < 16) return false
  const a = Buffer.from(secret)
  const b = Buffer.from(given)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  const apiKey = process.env.BRIGHTDATA_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Falta configurar Bright Data.' }, { status: 503 })

  let body: { action?: string; zones?: string[]; limit?: number; snapshotId?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 }) }

  const cfg = { apiKey }
  try {
    if (body.action === 'start') {
      const zones = Array.isArray(body.zones) && body.zones.length ? body.zones : DEFAULT_ZONES
      const started = await startSweep(cfg, { zoneUrls: zones, limitPerZone: body.limit ?? SWEEP_LIMITS.defaultPerZone })
      log.info('market.sweep.started', { zones: started.zones, limit: started.limitPerZone })
      return NextResponse.json(started)
    }

    if (body.action === 'ingest' && body.snapshotId) {
      const progress = await sweepProgress(cfg, body.snapshotId)
      if (progress.status !== 'ready') return NextResponse.json({ status: progress.status })

      const records = await downloadSweep(cfg, body.snapshotId)
      const listings = listingsFromZonaprop(records)
      const stats = await getMarketStore().upsert(listings)
      log.info('market.sweep.ingested', { records: records.length, listings: listings.length, ...stats })
      return NextResponse.json({ status: 'ready', records: records.length, listings: listings.length, ...stats })
    }

    return NextResponse.json({ error: 'Acción desconocida.' }, { status: 400 })
  } catch (err) {
    const status = err instanceof BrightDataError && err.status ? 502 : 400
    log.warn('market.sweep.failed', err instanceof Error ? err.message : 'error')
    return NextResponse.json({ error: err instanceof BrightDataError ? err.message : 'No se pudo completar el barrido.' }, { status })
  }
}
