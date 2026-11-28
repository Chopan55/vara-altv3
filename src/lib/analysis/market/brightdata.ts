/**
 * Cliente de Bright Data para el barrido de Zonaprop. SOLO servidor.
 *
 * Es asíncrono a propósito: un barrido tarda más de un minuto, así que se
 * separa en dos pasos (iniciar y recolectar) y no se hace nunca dentro de un
 * análisis de usuario. Los análisis leen del store, que es instantáneo.
 *
 * Protege el crédito: tope de registros por zona y por barrido. La clave sale
 * de `BRIGHTDATA_API_KEY` y nunca se incluye en errores ni en logs.
 */

import type { ZonapropRecord } from './zonaprop'
import { isPlausiblePrice } from '../priceIntelligence'
import type { ListingCurrency } from '../types'
import type { ScrapedData } from '@/app/api/scrape-property/route'

const BASE = 'https://api.brightdata.com/datasets/v3'

/** Scraper "Zonaprop Argentina - Properties Listing" (collect by URL / discover by domain). */
export const ZONAPROP_DATASET_ID = 'gd_lfsbhfgo2bglgrecm6'

export const SWEEP_LIMITS = {
  maxPerZone: 500,
  maxTotal: 1000,
  defaultPerZone: 100,
} as const

export class BrightDataError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
    this.name = 'BrightDataError'
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export interface BrightDataConfig {
  apiKey: string
  fetchImpl?: FetchLike
}

/** Lectura individual por URL. Está apagada si la variable no vale exactamente `true`. */
export const isBrightDataLiveEnabled = () => process.env.VARA_BRIGHTDATA_LIVE_ENABLED === 'true'

export type BrightDataPlan = 'anonymous' | 'free' | 'plan'
export type ListingReadState = 'disabled' | 'cached' | 'starting' | 'running' | 'ready' | 'failed' | 'expired'

export interface BrightDataMappedListing {
  data: ScrapedData
  photos: string[]
  warnings: string[]
}

interface ListingJob { url: string; listingId: string; snapshotId: string; createdAt: number }
interface Quota { day: string; dayCount: number; month: string; monthCount: number }
interface ListingCacheEntry { listing: BrightDataMappedListing; expiresAt: number }

export const LISTING_CACHE_TTL_MS = 24 * 60 * 60 * 1000

// No hay almacenamiento persistente confirmado para este flujo. Es deliberadamente
// limitado a la instancia y se pierde al reiniciar; no reemplaza una base real.
const listingCache = new Map<string, ListingCacheEntry>()
const listingJobs = new Map<string, ListingJob>()
const listingQuota = new Map<string, Quota>()

export function resetBrightDataListingMemory(): void {
  listingCache.clear(); listingJobs.clear(); listingQuota.clear()
}

export function brightDataListingId(rawUrl: string): string {
  const url = new URL(rawUrl)
  return url.pathname.replace(/\/+$/, '').split('/').filter(Boolean).pop() ?? url.pathname
}

export function brightDataQuotaLimit(plan: BrightDataPlan): number {
  return plan === 'anonymous' ? 3 : plan === 'free' ? 20 : 100
}

function quotaKey(plan: BrightDataPlan): string { return plan }

export function canStartBrightDataListing(plan: BrightDataPlan, now = new Date()): boolean {
  const day = now.toISOString().slice(0, 10)
  const month = now.toISOString().slice(0, 7)
  const key = quotaKey(plan)
  const old = listingQuota.get(key)
  const dayCount = old?.day === day ? old.dayCount : 0
  const monthCount = old?.month === month ? old.monthCount : 0
  const globalDailyLimit = Math.max(1, Number(process.env.VARA_BRIGHTDATA_GLOBAL_DAILY_LIMIT ?? 100) || 100)
  const globalDaily = [...listingQuota.values()].reduce((n, q) => n + (q.day === day ? q.dayCount : 0), 0)
  const monthLimited = plan !== 'anonymous' && monthCount >= brightDataQuotaLimit(plan)
  if (dayCount >= brightDataQuotaLimit(plan) || monthLimited || globalDaily >= globalDailyLimit) return false
  listingQuota.set(key, { day, dayCount: dayCount + 1, month, monthCount: monthCount + (plan === 'anonymous' ? 0 : 1) })
  return true
}

function numberValue(...values: unknown[]): number | undefined {
  const value = values.find(v => typeof v === 'number' || (typeof v === 'string' && v.trim()))
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : undefined
  if (typeof value !== 'string') return undefined
  const cleaned = value.replace(/[^\d.,]/g, '')
  if (!cleaned) return undefined
  const normalized = cleaned.includes('.') && cleaned.includes(',')
    ? cleaned.lastIndexOf('.') > cleaned.lastIndexOf(',') ? cleaned.replace(/,/g, '') : cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned.replace(/[.,](?=\d{3}(?:\D|$))/g, '').replace(',', '.')
  const n = Number(normalized)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function textValue(...values: unknown[]): string | undefined {
  const value = values.find(v => typeof v === 'string' && v.trim())
  return typeof value === 'string' ? value.trim() : undefined
}

/** Evita retener teléfonos, emails y campos de vendedor que Bright Data pueda devolver. */
function redactContacts(value: string | undefined): string | undefined {
  return value?.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[contacto omitido]')
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, '[teléfono omitido]')
    .slice(0, 6000)
}

function safeText(...values: unknown[]): string | undefined {
  return redactContacts(textValue(...values))
}

function textNumber(value: string): number | undefined { return numberValue(value) }

/** Mapea los nombres reales del dataset y valida superficies contra la descripción. */
export function mapBrightDataRecord(record: Record<string, unknown>): BrightDataMappedListing {
  const title = safeText(record.Title, record.title)
  const description = safeText(record.Description, record.description)
  const terrain = numberValue(record.Dimension_terreno)
  const property = numberValue(record.Dimension_propiedad)
  const sourceText = `${title ?? ''} ${description ?? ''}`
  const explicit = sourceText.match(/(?:casa|propiedad|vivienda)[^\d]{0,40}(\d[\d.,]*)\s*m[²2][^\d]{0,50}(?:sobre|en)\s+(?:un\s+)?lote[^\d]{0,20}(\d[\d.,]*)\s*m[²2]/i)
  const coveredM2 = explicit ? textNumber(explicit[1]) : property
  const lotM2 = explicit ? textNumber(explicit[2]) : terrain
  const warnings: string[] = []
  if (explicit || (terrain !== undefined && property !== undefined && terrain > property * 3)) {
    warnings.push('La superficie de terreno y propiedad podría estar invertida; revisá la descripción y confirmá los m².')
  }
  if (record.expenses !== undefined || record.Expenses !== undefined) {
    warnings.push('Las expensas provienen del aviso y quedan a confirmar; no son un dato verificado.')
  }
  const rawPhotos = [record.Imagenes, record.images, record.Images].flatMap(value => Array.isArray(value) ? value : typeof value === 'string' ? [value] : [])
  const photos = rawPhotos.filter((value): value is string => typeof value === 'string' && /^https?:\/\//.test(value)).slice(0, 12)
  const neighborhood = safeText(record.Zona, record.Zona2, record.Zona3)
  // «Consultar precio» llega como USD 1: no es un precio de venta, no se afirma.
  const rawPrice = numberValue(record.Precio, record.price)
  const rawCurrency = safeText(record.Currency, record.currency)
  const pricePlausible = rawPrice !== undefined && isPlausiblePrice(rawPrice, rawCurrency as ListingCurrency | undefined)
  if (rawPrice !== undefined && !pricePlausible) warnings.push('El aviso no informa un precio de venta claro (figura «consultar»); queda a confirmar.')
  return {
    data: {
      title, description, price: pricePlausible ? rawPrice : undefined, currency: pricePlausible ? rawCurrency : undefined,
      address: safeText(record.address, record.Address), neighborhood,
      propertyType: safeText(record.Tipo, record.type), totalM2: coveredM2, coveredM2, lotM2,
      rooms: numberValue(record.Ambientes, record.rooms), bedrooms: numberValue(record.Dormitorios, record.bedrooms),
      bathrooms: numberValue(record.Banos, record.Bathrooms), expenses: numberValue(record.expenses, record.Expenses),
      features: [safeText(record.Nueva_usada)].filter((v): v is string => !!v),
    }, photos, warnings,
  }
}

function validListingUrl(rawUrl: string): URL {
  const url = new URL(rawUrl)
  if (
    url.protocol !== 'https:' ||
    !['zonaprop.com.ar', 'www.zonaprop.com.ar'].includes(url.hostname.toLowerCase()) ||
    url.username || url.password || url.port ||
    !/^\/propiedades\/.+-\d+\.html$/i.test(url.pathname)
  ) throw new BrightDataError('Solo se pueden leer links HTTPS de avisos de zonaprop.com.ar.')
  return url
}

export async function startBrightDataListing(cfg: BrightDataConfig, rawUrl: string, plan: BrightDataPlan = 'anonymous'):
  Promise<{ state: ListingReadState; listingId: string; jobId?: string; data?: BrightDataMappedListing }> {
  if (!isBrightDataLiveEnabled()) return { state: 'disabled', listingId: brightDataListingId(rawUrl) }
  const url = validListingUrl(rawUrl)
  const listingId = brightDataListingId(url.toString())
  const cached = listingCache.get(listingId)
  if (cached && cached.expiresAt > Date.now()) return { state: 'cached', listingId, data: cached.listing }
  if (cached) listingCache.delete(listingId)
  if (!canStartBrightDataListing(plan)) throw new BrightDataError('Se alcanzó el tope de lecturas de Bright Data. Pegá el encabezado del aviso para seguir.', 429)
  const qs = new URLSearchParams({ dataset_id: ZONAPROP_DATASET_ID, include_errors: 'true' })
  const response = await call(cfg, `/trigger?${qs}`, { method: 'POST', body: JSON.stringify([{ url: url.toString() }]) })
  const body = await response.json() as { snapshot_id?: string }
  if (!body.snapshot_id || !/^sd_[A-Za-z0-9]+$/.test(body.snapshot_id)) throw new BrightDataError('Bright Data no devolvió un id de lectura.')
  const jobId = `bd_${Math.random().toString(36).slice(2, 12)}`
  listingJobs.set(jobId, { url: url.toString(), listingId, snapshotId: body.snapshot_id, createdAt: Date.now() })
  return { state: 'starting', listingId, jobId }
}

export async function brightDataListingStatus(cfg: BrightDataConfig, jobId: string): Promise<{ state: ListingReadState; progress?: SweepProgress; data?: BrightDataMappedListing }> {
  const job = listingJobs.get(jobId)
  if (!job || Date.now() - job.createdAt > 10 * 60_000) return { state: 'expired' }
  const progress = await sweepProgress(cfg, job.snapshotId)
  if (progress.status === 'failed') return { state: 'failed', progress }
  if (progress.status !== 'ready') return { state: 'running', progress }
  const records = await downloadSweep(cfg, job.snapshotId)
  const raw = records.find(record => typeof record === 'object' && record !== null) as Record<string, unknown> | undefined
  if (!raw) return { state: 'failed', progress }
  const mapped = mapBrightDataRecord(raw)
  listingCache.set(job.listingId, { listing: mapped, expiresAt: Date.now() + LISTING_CACHE_TTL_MS })
  listingJobs.delete(jobId)
  return { state: 'ready', progress, data: mapped }
}

export interface StartSweepInput {
  zoneUrls: string[]
  limitPerZone?: number
}

export function clampSweep(input: StartSweepInput): { zoneUrls: string[]; limitPerZone: number } {
  const zones = [...new Set(input.zoneUrls.map(u => u.trim()).filter(Boolean))]
  if (zones.length === 0) throw new BrightDataError('Falta al menos una zona para el barrido.')
  for (const z of zones) {
    if (!/^https:\/\/(www\.)?zonaprop\.com\.ar\//.test(z)) {
      throw new BrightDataError('Solo se pueden barrer links de zonaprop.com.ar.')
    }
  }
  const limit = Math.max(1, Math.min(SWEEP_LIMITS.maxPerZone, Math.floor(input.limitPerZone ?? SWEEP_LIMITS.defaultPerZone)))
  if (zones.length * limit > SWEEP_LIMITS.maxTotal) {
    throw new BrightDataError(`El barrido pasa el tope de ${SWEEP_LIMITS.maxTotal} registros: bajá zonas o límite.`)
  }
  return { zoneUrls: zones, limitPerZone: limit }
}

async function call(cfg: BrightDataConfig, path: string, init: RequestInit = {}): Promise<Response> {
  const f = cfg.fetchImpl ?? fetch
  const res = await f(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    // Nunca se reenvía el cuerpo: puede reflejar la solicitud.
    throw new BrightDataError(`Bright Data respondió ${res.status}.`, res.status)
  }
  return res
}

/** Inicia el barrido y devuelve el id del snapshot. */
export async function startSweep(cfg: BrightDataConfig, input: StartSweepInput): Promise<{ snapshotId: string; zones: number; limitPerZone: number }> {
  const { zoneUrls, limitPerZone } = clampSweep(input)
  const qs = new URLSearchParams({
    dataset_id: ZONAPROP_DATASET_ID,
    include_errors: 'true',
    type: 'discover_new',
    discover_by: 'domain',
    limit_per_input: String(limitPerZone),
  })
  const res = await call(cfg, `/trigger?${qs}`, {
    method: 'POST',
    body: JSON.stringify(zoneUrls.map(url => ({ url }))),
  })
  const json = (await res.json()) as { snapshot_id?: string }
  if (!json.snapshot_id) throw new BrightDataError('Bright Data no devolvió un id de barrido.')
  return { snapshotId: json.snapshot_id, zones: zoneUrls.length, limitPerZone }
}

export type SweepProgress =
  | { status: 'running' | 'starting' | 'building' }
  | { status: 'ready'; records: number; errors: number }
  | { status: 'failed' }

export async function sweepProgress(cfg: BrightDataConfig, snapshotId: string): Promise<SweepProgress> {
  if (!/^sd_[A-Za-z0-9]+$/.test(snapshotId)) throw new BrightDataError('Id de barrido inválido.')
  const res = await call(cfg, `/progress/${snapshotId}`)
  const j = (await res.json()) as { status?: string; records?: number; errors?: number }
  if (j.status === 'ready') return { status: 'ready', records: j.records ?? 0, errors: j.errors ?? 0 }
  if (j.status === 'failed') return { status: 'failed' }
  return { status: j.status === 'starting' || j.status === 'building' ? j.status : 'running' }
}

export interface SweepSummary {
  id: string
  status: string
  createdAt: string
}

/** Barridos ya hechos del dataset de Zonaprop, del más nuevo al más viejo. */
export async function listSweeps(cfg: BrightDataConfig): Promise<SweepSummary[]> {
  const res = await call(cfg, `/snapshots?dataset_id=${ZONAPROP_DATASET_ID}`)
  const json = (await res.json()) as unknown
  const rows = Array.isArray(json) ? json : []
  return rows
    .filter((r): r is { id: string; status: string; created: string } =>
      !!r && typeof r.id === 'string' && /^sd_[A-Za-z0-9]+$/.test(r.id) && typeof r.created === 'string')
    .map(r => ({ id: r.id, status: String(r.status), createdAt: r.created }))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

export type CronDecision =
  | { action: 'start' }
  | { action: 'ingest'; snapshotId: string }
  | { action: 'wait'; snapshotId: string }
  | { action: 'idle' }

/**
 * Qué hace la corrida programada, sin guardar estado: el ingreso es idempotente
 * (upsert por aviso), así que alcanza mirar el último barrido.
 *  - sin barrido en los últimos `everyDays` días, o el último falló → iniciar uno;
 *  - el último está en curso → esperar;
 *  - el último está listo y tiene menos de 2 días → ingresarlo (repetirlo no duplica);
 *  - el último está listo y es más viejo → nada que hacer hasta que toque el próximo.
 */
export function decideCronAction(sweeps: SweepSummary[], now: Date, everyDays = 7): CronDecision {
  const latest = sweeps[0]
  const ageDays = latest ? (now.getTime() - Date.parse(latest.createdAt)) / 86_400_000 : Infinity
  if (!latest || !Number.isFinite(ageDays) || ageDays >= everyDays) return { action: 'start' }
  if (latest.status === 'failed') return { action: 'start' }
  if (latest.status !== 'ready') return { action: 'wait', snapshotId: latest.id }
  return ageDays < 2 ? { action: 'ingest', snapshotId: latest.id } : { action: 'idle' }
}

export async function downloadSweep(cfg: BrightDataConfig, snapshotId: string): Promise<ZonapropRecord[]> {
  if (!/^sd_[A-Za-z0-9]+$/.test(snapshotId)) throw new BrightDataError('Id de barrido inválido.')
  const res = await call(cfg, `/snapshot/${snapshotId}?format=json`)
  const data = (await res.json()) as unknown
  return Array.isArray(data) ? (data as ZonapropRecord[]) : []
}
