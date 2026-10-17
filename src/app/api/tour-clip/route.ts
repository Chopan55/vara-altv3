export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { requireAiAccess, requireAiAllowed } from '@/lib/api/aiAccess'
import {
  CLIP_SECONDS, DEFAULT_VEO_MODEL, GEMINI_BASE, buildClipPrompt,
  isValidOperationName, parseOperation,
} from '@/lib/tourClip'

/**
 * Clips de recorrido con IA (Google Veo) a partir de una foto.
 *
 *   POST  { imageBase64, mimeType, room }  → { operation }   crea el clip (cuesta plata)
 *   GET   ?op=<operation>                  → { state, message? }
 *   GET   ?op=<operation>&download=1       → el video (mp4), servido desde acá
 *
 * Solo para emails autorizados (VARA_AI_ALLOWED_EMAILS) y con tope diario.
 * La clave de Google (GEMINI_API_KEY) vive solo en el servidor.
 */
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_BASE64 = 8_000_000

function notConfigured() {
  return NextResponse.json({ error: 'El servicio de video todavía no está configurado.' }, { status: 503 })
}

function googleError(status: number) {
  if (status === 401 || status === 403) return NextResponse.json({ error: 'Google rechazó el pedido: revisá que la clave sea válida y que la facturación esté activa.' }, { status: 502 })
  if (status === 429) return NextResponse.json({ error: 'Google pidió esperar un rato. Probá de nuevo en unos minutos.' }, { status: 429 })
  return NextResponse.json({ error: 'No pudimos generar el clip. Probá de nuevo en un rato.' }, { status: 502 })
}

export async function POST(req: NextRequest) {
  const auth = await requireAiAccess('video')
  if (auth.error) return auth.error

  const key = process.env.GEMINI_API_KEY
  if (!key) return notConfigured()

  let imageBase64 = ''
  let mimeType = ''
  let room = ''
  try {
    const body = await req.json()
    imageBase64 = String(body?.imageBase64 ?? '')
    mimeType = String(body?.mimeType ?? '')
    room = typeof body?.room === 'string' ? body.room : ''
  } catch {
    return NextResponse.json({ error: 'No se recibió la foto.' }, { status: 400 })
  }
  if (!imageBase64 || !ALLOWED_MIME.has(mimeType)) return NextResponse.json({ error: 'No se recibió una foto válida.' }, { status: 400 })
  if (imageBase64.length > MAX_BASE64) return NextResponse.json({ error: 'La foto es muy pesada. Probá con otra.' }, { status: 413 })

  const model = process.env.VEO_MODEL || DEFAULT_VEO_MODEL
  if (!/^[A-Za-z0-9._-]+$/.test(model)) return notConfigured()

  let res: Response
  try {
    res = await fetch(`${GEMINI_BASE}/v1beta/models/${model}:predictLongRunning`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt: buildClipPrompt(room), image: { inlineData: { mimeType, data: imageBase64 } } }],
        parameters: { aspectRatio: '16:9', durationSeconds: CLIP_SECONDS, personGeneration: 'allow_adult' },
      }),
    })
  } catch {
    return NextResponse.json({ error: 'No pudimos conectar con el servicio de video.' }, { status: 502 })
  }
  if (!res.ok) {
    console.error('[tour-clip] Google respondió', res.status)
    return googleError(res.status)
  }
  const json = (await res.json().catch(() => ({}))) as { name?: string }
  if (!isValidOperationName(json.name)) return NextResponse.json({ error: 'Google no devolvió un pedido válido.' }, { status: 502 })
  return NextResponse.json({ operation: json.name })
}

export async function GET(req: NextRequest) {
  const auth = await requireAiAllowed()
  if (auth.error) return auth.error

  const key = process.env.GEMINI_API_KEY
  if (!key) return notConfigured()

  const op = req.nextUrl.searchParams.get('op')
  if (!isValidOperationName(op)) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })

  let res: Response
  try {
    res = await fetch(`${GEMINI_BASE}/v1beta/${op}`, { headers: { 'x-goog-api-key': key }, cache: 'no-store' })
  } catch {
    return NextResponse.json({ error: 'No pudimos conectar con el servicio de video.' }, { status: 502 })
  }
  if (!res.ok) return googleError(res.status)

  const status = parseOperation(await res.json().catch(() => ({})))
  if (req.nextUrl.searchParams.get('download') !== '1') {
    return NextResponse.json(status.state === 'failed' ? { state: 'failed', message: status.message } : { state: status.state })
  }

  if (status.state !== 'ready') return NextResponse.json({ error: 'El clip todavía no está listo.' }, { status: 409 })
  let video: Response
  try {
    video = await fetch(status.videoUri, { headers: { 'x-goog-api-key': key }, redirect: 'follow', cache: 'no-store' })
  } catch {
    return NextResponse.json({ error: 'No pudimos bajar el clip.' }, { status: 502 })
  }
  if (!video.ok || !video.body) return NextResponse.json({ error: 'No pudimos bajar el clip.' }, { status: 502 })
  return new Response(video.body, {
    headers: { 'Content-Type': video.headers.get('content-type') ?? 'video/mp4', 'Cache-Control': 'no-store' },
  })
}
