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
