/**
 * Lectura de avisos de MercadoLibre por la API oficial.
 *
 * La página del aviso no sirve desde el servidor: MeLi la bloquea y devuelve
 * una página genérica titulada "Mercado Libre" (sin precio ni superficie). La
 * API `/items/{id}` sí responde, con los datos estructurados.
 *
 * Con `MELI_CLIENT_ID` y `MELI_CLIENT_SECRET` (una app gratuita de MeLi) se
 * pide un token de aplicación. Sin ellas se intenta igual sin token: si MeLi
 * lo rechaza, el que llama sigue con el resto de los caminos.
 *
 * Solo servidor: el `client_secret` nunca pasa por el navegador.
 */

import type { ScrapedData } from '@/app/api/scrape-property/route'
import type { MeliItem } from '@/lib/comparables/model'
import { log } from '@/lib/observability/logger'

/** Lo que MeLi dice cuando rechaza (código y mensaje), sin nada de las credenciales. */
async function rejection(res: Response): Promise<string> {
  try {
    const b = (await res.json()) as Record<string, unknown>
    return [b.error, b.code, b.message, b.error_description].filter(x => typeof x === 'string').join(' | ').slice(0, 300)
  } catch { return '' }
}

const TOKEN_URL = 'https://api.mercadolibre.com/oauth/token'
const ITEM_URL = 'https://api.mercadolibre.com/items'

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

interface CachedToken { value: string; expiresAt: number }
let cached: CachedToken | null = null

/** Solo para tests. */
export function resetMeliToken(): void { cached = null }

export function meliConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.MELI_CLIENT_ID && env.MELI_CLIENT_SECRET)
}

export async function getMeliToken(
  env: Record<string, string | undefined> = process.env,
  fetchImpl: FetchLike = fetch,
): Promise<string | null> {
  const clientId = env.MELI_CLIENT_ID
  const clientSecret = env.MELI_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  // Un minuto de margen: un token que vence mientras viaja la request es peor que pedir uno de más.
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.value

  try {
    const res = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
      cache: 'no-store',
    })
    if (!res.ok) {
      log.warn('meli.token.rejected', await rejection(res), { httpStatus: res.status })
      return null
    }
    const data = (await res.json()) as { access_token?: string; expires_in?: number }
    if (!data.access_token) return null
    cached = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 }
    return cached.value
  } catch {
    return null
  }
}

export type MeliFetch =
  | { status: 'ok'; item: MeliItem }
  | { status: 'not_found' }
  | { status: 'rejected'; httpStatus: number }
  | { status: 'error' }

/** Un aviso por id. Con token si está configurado; si no, sin token. */
export async function fetchMeliItem(
  itemId: string,
  opts: { env?: Record<string, string | undefined>; fetchImpl?: FetchLike; signal?: AbortSignal } = {},
): Promise<MeliFetch> {
  const fetchImpl = opts.fetchImpl ?? fetch
  const token = await getMeliToken(opts.env ?? process.env, fetchImpl)
  try {
    const res = await fetchImpl(`${ITEM_URL}/${encodeURIComponent(itemId)}`, {
      headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      cache: 'no-store',
      signal: opts.signal,
    })
    if (res.status === 404) return { status: 'not_found' }
    if (!res.ok) {
      log.warn('meli.item.rejected', await rejection(res), { httpStatus: res.status, withToken: Boolean(token) })
      return { status: 'rejected', httpStatus: res.status }
    }
    return { status: 'ok', item: (await res.json()) as MeliItem }
  } catch (err) {
    log.warn('meli.item.failed', err instanceof Error ? err.message : 'error')
    return { status: 'error' }
  }
}

function attr(item: MeliItem, ids: string[]): number | undefined {
  for (const a of item.attributes ?? []) {
    if (!a.id || !ids.includes(a.id)) continue
    const n = a.value_struct?.number
    if (typeof n === 'number' && isFinite(n) && n > 0) return n
    const parsed = parseFloat((a.value_name ?? '').replace(/\./g, '').replace(',', '.'))
    if (isFinite(parsed) && parsed > 0) return parsed
  }
  return undefined
}

function attrText(item: MeliItem, id: string): string | undefined {
  const a = (item.attributes ?? []).find(x => x.id === id)
  const v = a?.value_name?.trim()
  return v ? v : undefined
}

/** Días entre una fecha ISO y `now`, o undefined si la fecha no sirve. */
function daysSince(iso: string | undefined, now: Date): number | undefined {
  if (!iso) return undefined
  const t = Date.parse(iso)
  if (!isFinite(t)) return undefined
  const d = Math.floor((now.getTime() - t) / 86_400_000)
  return d >= 0 ? d : undefined
}

function money(n: number, currency?: string): string {
  return `${currency === 'ARS' ? '$' : currency ?? 'USD'} ${Math.round(n).toLocaleString('es-AR')}`
}

/**
 * Señales para negociar que salen del aviso mismo: hace cuánto está
 * publicado y si bajó de precio. Van como texto en `features`, que la ficha
 * ya muestra; todo es dato de MeLi, nada estimado.
 */
export function meliSignals(item: MeliItem, now: Date = new Date()): string[] {
  const out: string[] = []
  const days = daysSince(item.start_time ?? item.date_created, now)
  if (days !== undefined) out.push(days === 0 ? 'Publicado hoy en MercadoLibre' : `Publicado hace ${days} día${days === 1 ? '' : 's'} en MercadoLibre`)
  const op = item.original_price
  if (typeof op === 'number' && typeof item.price === 'number' && op > item.price) {
    out.push(`Bajó de precio: de ${money(op, item.currency_id)} a ${money(item.price, item.currency_id)}`)
  }
  return out
}

/** Un item de la API, en el formato del lector de avisos. Solo lo que el aviso trae: nada inventado. */
export function meliItemToScraped(item: MeliItem, now: Date = new Date()): { data: ScrapedData; photos: string[] } {
  const data: ScrapedData = {}
  if (item.title) data.title = item.title
  if (typeof item.price === 'number' && isFinite(item.price) && item.price > 0) {
    data.price = item.price
    if (item.currency_id) data.currency = item.currency_id
  }
  const loc = item.location
  const street = loc?.address_line?.trim()
  if (street) data.address = street
  const neighborhood = loc?.neighborhood?.name ?? item.address?.neighborhood ?? undefined
  if (neighborhood) data.neighborhood = neighborhood
  const city = loc?.city?.name ?? item.address?.city_name ?? undefined
  if (city) data.city = city
  if (loc?.state?.name) data.province = loc.state.name

  const total = attr(item, ['TOTAL_AREA'])
  const covered = attr(item, ['COVERED_AREA'])
  if (total) data.totalM2 = total
  if (covered) data.coveredM2 = covered
  const rooms = attr(item, ['ROOMS'])
  if (rooms) data.rooms = rooms
  const bedrooms = attr(item, ['BEDROOMS'])
  if (bedrooms) data.bedrooms = bedrooms
  const bathrooms = attr(item, ['FULL_BATHROOMS', 'BATHROOMS'])
  if (bathrooms) data.bathrooms = bathrooms
  const expenses = attr(item, ['MAINTENANCE_FEE'])
  if (expenses) data.expenses = expenses
  const type = attrText(item, 'PROPERTY_TYPE')
  if (type) data.propertyType = type

  const features: string[] = []
  const parking = attr(item, ['PARKING_LOTS'])
  if (parking) features.push(`Cocheras: ${parking}`)
  features.push(...meliSignals(item, now))
  if (features.length) data.features = features

  const photos = (item.pictures ?? [])
    .map(p => p.secure_url ?? p.url)
    .filter((u): u is string => typeof u === 'string' && /^https:\/\//.test(u))
    .slice(0, 12)
  return { data, photos }
}

/**
 * ¿MeLi devolvió su página de bloqueo en vez del aviso? Pasa con la lectura
 * directa desde servidores: título genérico o la verificación de cuenta.
 */
export function isMeliBlockPage(html: string): boolean {
  const head = html.slice(0, 20000)
  if (/account-verification|\/gz\/login|suspicious-traffic|captcha/i.test(head)) return true
  const title = head.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim()
  return title !== undefined && /^mercado ?libre(\s*(argentina|m[ée]xico))?$/i.test(title)
}

/**
 * Lo que no viene en el item: la descripción completa, si lo publica una
 * inmobiliaria o una cuenta personal, y cuántas visitas tuvo. Cada pedido es
 * independiente y opcional: si MeLi no lo da, no se muestra.
 */
export async function fetchMeliExtras(
  item: MeliItem,
  opts: { env?: Record<string, string | undefined>; fetchImpl?: FetchLike; timeoutMs?: number } = {},
): Promise<{ description?: string; features: string[] }> {
  const fetchImpl = opts.fetchImpl ?? fetch
  const token = await getMeliToken(opts.env ?? process.env, fetchImpl)
  const headers = { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  const get = async <T>(url: string): Promise<T | null> => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 4000)
    try {
      const res = await fetchImpl(url, { headers, cache: 'no-store', signal: ctrl.signal })
      return res.ok ? ((await res.json()) as T) : null
    } catch { return null } finally { clearTimeout(timer) }
  }
  const id = encodeURIComponent(item.id ?? '')
  const [desc, seller, visits] = await Promise.all([
    item.id ? get<{ plain_text?: string }>(`${ITEM_URL}/${id}/description`) : null,
    item.seller_id ? get<{ user_type?: string; tags?: string[] }>(`https://api.mercadolibre.com/users/${item.seller_id}`) : null,
    item.id ? get<Record<string, number>>(`https://api.mercadolibre.com/visits/items?ids=${id}`) : null,
  ])

  const features: string[] = []
  if (seller) {
    const agency = seller.user_type === 'real_estate_agency' || (seller.tags ?? []).includes('real_estate_agency')
    features.push(agency ? 'Lo publica una inmobiliaria' : 'Lo publica una cuenta personal (no inmobiliaria)')
  }
  const v = item.id && visits ? visits[item.id] : undefined
  if (typeof v === 'number' && v >= 0) features.push(`${v.toLocaleString('es-AR')} visitas en MercadoLibre`)
  const text = desc?.plain_text?.trim()
  return { ...(text ? { description: text.slice(0, 1200) } : {}), features }
}
