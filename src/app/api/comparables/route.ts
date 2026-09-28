export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import {
  fromMeliItem, meliItemIdFromUrl,
  type Comparable, type MeliItem,
} from '@/lib/comparables/model'
import { log } from '@/lib/observability/logger'

/**
 * Lee un aviso de MercadoLibre por su link.
 *
 * Por qué NO hay búsqueda acá, aunque sería lo obvio: MeLi cerró
 * `/sites/MLA/search`. Devuelve 403 con un token de aplicación válido, con
 * cualquier combinación de parámetros. Está medido, no supuesto — el mismo
 * token resuelve sitio, categorías y usuario sin problema.
 *
 * Lo que sí quedó abierto es `/items/{id}`: responde 404 "not found" ante un
 * id inexistente, no 403. Así que el camino real es el mismo que con
 * Zonaprop — la persona pega el link del aviso que le interesa. La ventaja
 * frente a scrapear HTML es grande: los datos vienen de la API oficial,
 * estructurados y sin adivinar.
 *
 * Corre en el servidor porque el `client_secret` no puede pasar por el
 * navegador. Por eso las variables no llevan prefijo `NEXT_PUBLIC_`.
 */

export const runtime = 'nodejs'

const TOKEN_URL = 'https://api.mercadolibre.com/oauth/token'
const ITEM_URL = 'https://api.mercadolibre.com/items'

interface CachedToken { value: string; expiresAt: number }
let cached: CachedToken | null = null

async function getToken(): Promise<string | null> {
  const clientId = process.env.MELI_CLIENT_ID
  const clientSecret = process.env.MELI_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  // Un minuto de margen: un token que vence mientras viaja la request es peor
  // que pedir uno de más.
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.value

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
    cache: 'no-store',
  })

  if (!res.ok) return null
  const data = (await res.json()) as { access_token?: string; expires_in?: number }
  if (!data.access_token) return null

  cached = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  }
  return cached.value
}

export interface ComparablesResponse {
  status: 'ok' | 'not_configured' | 'not_found' | 'not_meli' | 'error'
  comparable?: Comparable
  /** Mensaje listo para mostrar. */
  message?: string
}

export async function POST(req: Request): Promise<NextResponse<ComparablesResponse>> {
  let body: { url?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ status: 'error', message: 'Pedido inválido.' })
  }

  const url = (body.url ?? '').trim()
  const itemId = meliItemIdFromUrl(url)
  if (!itemId) {
    // No es de MeLi: lo lee el otro camino, el que pega el texto del aviso.
    return NextResponse.json({
      status: 'not_meli',
      message: 'Ese link no es de MercadoLibre.',
    })
  }

  const token = await getToken()
  if (!token) {
    return NextResponse.json({
      status: 'not_configured',
      message: 'Falta configurar el acceso a MercadoLibre.',
    })
  }

  try {
    const res = await fetch(`${ITEM_URL}/${itemId}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })

    if (res.status === 404) {
      return NextResponse.json({
        status: 'not_found',
        message: 'Ese aviso ya no existe o fue dado de baja.',
      })
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      log.warn('comparables.meli.rejected', detail.slice(0, 200), { httpStatus: res.status })
      return NextResponse.json({
        status: 'error',
        message: `MercadoLibre no devolvió el aviso (${res.status}).`,
      })
    }

    const item = (await res.json()) as MeliItem
    const comparable = fromMeliItem(item)
    if (!comparable) {
      return NextResponse.json({
        status: 'error',
        message: 'Ese aviso no tiene precio, así que no sirve para comparar.',
      })
    }

    return NextResponse.json({ status: 'ok', comparable })
  } catch {
    return NextResponse.json({
      status: 'error',
      message: 'No pudimos conectarnos con MercadoLibre.',
    })
  }
}
