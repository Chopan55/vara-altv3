export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import {
  BrightDataError, decideCronAction, downloadSweep, listSweeps, startSweep, sweepProgress,
} from '@/lib/analysis/market/brightdata'
import { getMarketStore } from '@/lib/analysis/market'
import { listingsFromZonaprop } from '@/lib/analysis/market/zonaprop'
import { log } from '@/lib/observability/logger'

/**
 * Barrido semanal automático (Vercel Cron, una vez por día).
 *
 * No guarda estado: cada corrida mira el último barrido de Bright Data y decide
 * (ver `decideCronAction`). Gasta créditos, por eso está APAGADO salvo que existan
 * `MARKET_CRON_ENABLED=1` y `CRON_SECRET`. Vercel manda `Authorization: Bearer <CRON_SECRET>`.
 */

const ZONES = ['https://www.zonaprop.com.ar/casas-venta-pilar-q-barrio-cerrado.html']
const LIMIT_PER_ZONE = 100

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret || secret.length < 16) return false
  const a = Buffer.from(`Bearer ${secret}`)
  const b = Buffer.from(req.headers.get('authorization') ?? '')
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function GET(req: Request) {
  if (process.env.MARKET_CRON_ENABLED !== '1') return NextResponse.json({ status: 'disabled' })
  if (!authorized(req)) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  const apiKey = process.env.BRIGHTDATA_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Falta configurar Bright Data.' }, { status: 503 })
  const cfg = { apiKey }

  try {
    const decision = decideCronAction(await listSweeps(cfg), new Date())

    if (decision.action === 'start') {
      const started = await startSweep(cfg, { zoneUrls: ZONES, limitPerZone: LIMIT_PER_ZONE })
      log.info('market.cron.started', { zones: started.zones, limit: started.limitPerZone })
      return NextResponse.json({ action: 'start', snapshotId: started.snapshotId })
    }

    if (decision.action === 'ingest') {
      const progress = await sweepProgress(cfg, decision.snapshotId)
      if (progress.status !== 'ready') return NextResponse.json({ action: 'wait', status: progress.status })
      const listings = listingsFromZonaprop(await downloadSweep(cfg, decision.snapshotId))
      const stats = await getMarketStore().upsert(listings)
      log.info('market.cron.ingested', { listings: listings.length, ...stats })
      return NextResponse.json({ action: 'ingest', listings: listings.length, ...stats })
    }

    return NextResponse.json({ action: decision.action })
  } catch (err) {
    log.warn('market.cron.failed', err instanceof Error ? err.message : 'error')
    return NextResponse.json(
      { error: err instanceof BrightDataError ? err.message : 'No se pudo completar la corrida.' },
      { status: 502 },
    )
  }
}
