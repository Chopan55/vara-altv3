export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getMarketStore } from '@/lib/analysis/market'

/**
 * Avisos de mercado de una zona, ya barridos y guardados.
 *
 * Sin login: VARA se usa sin cuenta. Solo devuelve datos públicos de avisos
 * normalizados; los teléfonos y datos de vendedores nunca se guardan.
 */
export async function GET(req: Request) {
  const u = new URL(req.url)
  const clip = (k: string) => u.searchParams.get(k)?.slice(0, 120) || undefined
  const q = { city: clip('city'), neighborhood: clip('neighborhood'), community: clip('community') }

  if (!q.city && !q.neighborhood && !q.community) {
    return NextResponse.json({ listings: [], updatedAt: null })
  }

  try {
    const store = getMarketStore()
    const [listings, stats] = await Promise.all([store.query({ ...q, limit: 300 }), store.stats()])
    return NextResponse.json(
      { listings, updatedAt: stats.lastSweepAt },
      { headers: { 'Cache-Control': 'private, max-age=60' } },
    )
  } catch {
    // Sin store disponible el análisis sigue con los demás proveedores.
    return NextResponse.json({ listings: [], updatedAt: null })
  }
}
