export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import {
  BrightDataError, brightDataListingStatus, startBrightDataListing,
  isBrightDataLiveEnabled,
  type BrightDataPlan,
} from '@/lib/analysis/market/brightdata'

type Plan = BrightDataPlan

function plan(value: unknown): Plan {
  return value === 'free' || value === 'plan' ? value : 'anonymous'
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as { url?: unknown; plan?: unknown }
    const url = typeof body.url === 'string' ? body.url.trim() : ''
    if (!url) return NextResponse.json({ error: 'Falta el link del aviso.' }, { status: 400 })
    const apiKey = process.env.BRIGHTDATA_API_KEY
    if (isBrightDataLiveEnabled() && !apiKey) return NextResponse.json({ error: 'Bright Data no está configurado.' }, { status: 503 })
    const result = await startBrightDataListing({ apiKey: apiKey ?? '' }, url, plan(body.plan))
    if (result.state === 'disabled') return NextResponse.json(result)
    return NextResponse.json(result)
  } catch (error) {
    const status = error instanceof BrightDataError && error.status ? error.status : 400
    return NextResponse.json({ error: error instanceof BrightDataError ? error.message : 'No se pudo iniciar la lectura.' }, { status })
  }
}

export async function GET(req: Request) {
  const jobId = new URL(req.url).searchParams.get('jobId') ?? ''
  if (!jobId) return NextResponse.json({ error: 'Falta el id de lectura.' }, { status: 400 })
  const apiKey = process.env.BRIGHTDATA_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Bright Data no está configurado.' }, { status: 503 })
  try {
    return NextResponse.json(await brightDataListingStatus({ apiKey }, jobId))
  } catch (error) {
    const status = error instanceof BrightDataError && error.status ? error.status : 502
    return NextResponse.json({ error: error instanceof BrightDataError ? error.message : 'No se pudo consultar el progreso.' }, { status })
  }
}
