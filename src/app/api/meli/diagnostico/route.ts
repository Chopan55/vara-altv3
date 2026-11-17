export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { allowRequest, clientKey } from '@/lib/api/rateLimit'
import { meliItemIdFromUrl } from '@/lib/comparables/model'
import { cleanCredential, credentialShape, meliConfigured } from '@/lib/meli/api'

/**
 * Diagnóstico de la conexión con MercadoLibre: ¿se consigue el token de
 * aplicación? ¿MeLi devuelve el aviso, con y sin token? Devuelve solo códigos
 * HTTP y los mensajes de error de MeLi; nunca las credenciales ni el token.
 */
async function probe(url: string, init?: RequestInit) {
  try {
    const res = await fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(8000) })
    let detail = ''
    try {
      const b = (await res.json()) as Record<string, unknown>
      detail = res.ok
        ? ['id', 'title', 'status'].map(k => (typeof b[k] === 'string' ? `${k}=${b[k]}` : '')).filter(Boolean).join(' ')
        : [b.error, b.code, b.message, b.error_description].filter(x => typeof x === 'string').join(' | ')
    } catch { /* sin cuerpo JSON */ }
    return { status: res.status, detail: detail.slice(0, 200) }
  } catch (err) {
    return { status: 0, detail: err instanceof Error ? err.message : 'error' }
  }
}

export async function GET(req: Request) {
  if (!allowRequest(`meli-diag:${clientKey(req)}`, 10, 10 * 60_000)) {
    return NextResponse.json({ error: 'Demasiados pedidos.' }, { status: 429 })
  }
  const raw = new URL(req.url).searchParams.get('aviso') ?? ''
  const itemId = meliItemIdFromUrl(raw) ?? (/^MLA\d{6,}$/.test(raw) ? raw : null)

  let tokenStatus = 0, tokenDetail = '', token: string | null = null
  if (meliConfigured()) {
    try {
      const res = await fetch('https://api.mercadolibre.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: cleanCredential(process.env.MELI_CLIENT_ID),
          client_secret: cleanCredential(process.env.MELI_CLIENT_SECRET),
        }),
        cache: 'no-store', signal: AbortSignal.timeout(8000),
      })
      tokenStatus = res.status
      const b = (await res.json().catch(() => ({}))) as Record<string, unknown>
      if (res.ok && typeof b.access_token === 'string') token = b.access_token
      else tokenDetail = [b.error, b.message, b.error_description].filter(x => typeof x === 'string').join(' | ').slice(0, 200)
    } catch (err) {
      tokenDetail = err instanceof Error ? err.message : 'error'
    }
  }

  const result: Record<string, unknown> = {
    credenciales: meliConfigured() ? 'cargadas' : 'faltan',
    // Solo la forma: largo y si traían basura. Nunca el valor.
    clientId: credentialShape(process.env.MELI_CLIENT_ID),
    clientSecret: { ...credentialShape(process.env.MELI_CLIENT_SECRET), digitsOnly: undefined },
    token: { status: tokenStatus, ok: Boolean(token), detail: tokenDetail },
  }
  if (itemId) {
    result.aviso = itemId
    result.sinToken = await probe(`https://api.mercadolibre.com/items/${itemId}`)
    if (token) result.conToken = await probe(`https://api.mercadolibre.com/items/${itemId}`, { headers: { Authorization: `Bearer ${token}` } })
    if (token) result.sitio = await probe('https://api.mercadolibre.com/sites/MLA', { headers: { Authorization: `Bearer ${token}` } })
  }
  return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } })
}
