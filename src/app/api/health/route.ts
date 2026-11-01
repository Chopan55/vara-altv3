export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { resolveAppEnv } from '@/lib/config/env'
import { checkAi, checkDatabase, checkMarket, evaluateHealth } from '@/lib/health'
import { getMarketStore } from '@/lib/analysis/market'

/**
 * ¿Está viva VARA? Pensado para un monitor de disponibilidad externo.
 * 200 si funciona (aunque degradada), 503 si falla algo crítico.
 * Sin login y sin datos sensibles: solo estados y tiempos.
 */
export async function GET() {
  const [database, market] = await Promise.all([checkDatabase(), checkMarket(getMarketStore())])
  const report = evaluateHealth(
    [{ name: 'app', status: 'ok', critical: true }, database, checkAi(), market],
    {
      env: resolveAppEnv(),
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    },
  )
  return NextResponse.json(report, {
    status: report.status === 'down' ? 503 : 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}
