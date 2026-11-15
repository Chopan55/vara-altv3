export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { allowRequest, clientKey } from '@/lib/api/rateLimit'
import { cronAuthorized } from '@/lib/cron/auth'
import { pingDatabase } from '@/lib/keepalive'
import { log } from '@/lib/observability/logger'

/**
 * Ping diario a la base (Vercel Cron) para que Supabase no la pause por
 * inactividad. Ver `src/lib/keepalive.ts`.
 *
 * A diferencia de los otros crons, no queda cerrado sin CRON_SECRET: no gasta
 * créditos, no envía nada y no devuelve datos, y tiene que correr aunque falte
 * configurar el resto. Si el secreto existe, se exige. El límite por cliente
 * evita que alguien lo use para cargar la base.
 */
export async function GET(req: Request) {
  if (process.env.CRON_SECRET && !cronAuthorized(req)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }
  if (!allowRequest(`keepalive:${clientKey(req)}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Demasiados pedidos.' }, { status: 429 })
  }

  const result = await pingDatabase()
  if (result.status === 'ok') {
    log.info('db.keepalive.ok', { ms: result.ms })
    // Una línea por día en los logs de Vercel: es la única prueba de que el
    // cron corrió (el logger no imprime los info).
    console.info('[db.keepalive.ok]', { ms: result.ms })
  } else {
    log.warn('db.keepalive.failed', result.note, { status: result.status })
  }

  const status = result.status === 'ok' ? 200 : result.status === 'not_configured' ? 503 : 502
  return NextResponse.json(result, { status, headers: { 'cache-control': 'no-store' } })
}
