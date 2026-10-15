export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createRateLimiter } from '@/lib/analysis/aiAccess'
import { getMarketStore } from '@/lib/analysis/market'

/**
 * Avisos de mercado de una zona, ya barridos y guardados.
 *
 * Sin login: VARA se usa sin cuenta. Solo devuelve datos públicos de avisos
 * normalizados; los teléfonos y datos de vendedores nunca se guardan.
 *
 * Son datos de terceros: el análisis necesita los de UNA zona, no el catálogo.
 * Por eso hay un tope de consultas por dirección IP (frena la descarga en
 * bloque) y no se entregan al navegador campos que el análisis no usa.
 * Es un tope por instancia del servidor: reduce el abuso, no lo elimina.
 */
export const MARKET_RATE = { perHour: 40 } as const
const limiter = createRateLimiter(MARKET_RATE.perHour, 60 * 60 * 1000)

function clientKey(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
}

export async function GET(req: Request) {
  if (!limiter.allow(clientKey(req))) {
    return NextResponse.json(
      { error: 'Demasiadas consultas seguidas. Probá de nuevo en un rato.', listings: [], updatedAt: null },
      { status: 429, headers: { 'Retry-After': '3600' } },
    )
  }
  const u = new URL(req.url)
  const clip = (k: string) => u.searchParams.get(k)?.slice(0, 120) || undefined
  const q = { city: clip('city'), neighborhood: clip('neighborhood'), community: clip('community') }

  if (!q.city && !q.neighborhood && !q.community) {
    return NextResponse.json({ listings: [], updatedAt: null })
  }

  try {
    const store = getMarketStore()
    const [found, stats] = await Promise.all([store.query({ ...q, limit: 300 }), store.stats()])
    // Las coordenadas no las usa el análisis: no salen del servidor.
    const listings = found.map(({ lat: _lat, lng: _lng, ...rest }) => rest)
    return NextResponse.json(
      { listings, updatedAt: stats.lastSweepAt },
      { headers: { 'Cache-Control': 'private, max-age=60' } },
    )
  } catch {
    // Sin store disponible el análisis sigue con los demás proveedores.
    return NextResponse.json({ listings: [], updatedAt: null })
  }
}
