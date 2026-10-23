export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 20

import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createRateLimiter } from '@/lib/analysis/aiAccess'
import { allowedUser } from '@/lib/analysis/aiSession'
import { buildRealtimeSession } from '@/lib/assistant/realtimeSession'
import { sanitizeContextText } from '@/lib/assistant/context'
import { log } from '@/lib/observability/logger'

/**
 * Voz en tiempo real de VARA: entrega al navegador un secreto efímero (vence en 60 s) para abrir la conexión
 * WebRTC con OpenAI. La clave real nunca sale del servidor.
 *
 * Gasta crédito: solo emails autorizados (la misma lista de la voz), con tope por usuario/hora y global/día.
 * El navegador no elige modelo, voz ni reglas: las define `buildRealtimeSession`. Solo aporta el contexto de la operación.
 */

const perUser = createRateLimiter(8, 60 * 60 * 1000)
const global = createRateLimiter(60, 24 * 60 * 60 * 1000)

export async function POST(req: Request) {
  const user = await allowedUser()
  if (!user) return NextResponse.json({ error: 'La voz todavía no está habilitada para tu cuenta.' }, { status: 403 })

  if (!perUser.allow(user.id) || !global.allow('all')) {
    return NextResponse.json({ error: 'Llegaste al tope de voz por ahora. Probá más tarde.' }, { status: 429 })
  }

  // El navegador solo aporta el contexto de la operación (texto acotado y sanitizado); modelo, voz y reglas son del servidor.
  let context: string | null = null
  try {
    const raw = await req.text()
    if (raw.length > 12_000) return NextResponse.json({ error: 'Pedido demasiado grande.' }, { status: 413 })
    context = raw ? sanitizeContextText((JSON.parse(raw) as { context?: unknown }).context) : null
  } catch {
    context = null // sin contexto la voz igual funciona
  }

  try {
    const res = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        // Identificador anónimo del usuario: OpenAI lo asocia al secreto, el navegador no lo manda.
        'OpenAI-Safety-Identifier': createHash('sha256').update(user.id).digest('hex').slice(0, 32),
      },
      body: JSON.stringify(buildRealtimeSession(process.env.OPENAI_REALTIME_MODEL, context)),
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) {
      log.warn('realtime.secret_failed', String(res.status))
      return NextResponse.json({ error: 'No pude iniciar la voz ahora.' }, { status: 502 })
    }
    const data = (await res.json()) as { value?: unknown }
    if (typeof data.value !== 'string' || !data.value) {
      return NextResponse.json({ error: 'No pude iniciar la voz ahora.' }, { status: 502 })
    }
    return NextResponse.json({ value: data.value }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    log.warn('realtime.secret_error', err instanceof Error ? err.message : 'error')
    // Nunca se expone el error del proveedor.
    return NextResponse.json({ error: 'No pude iniciar la voz ahora.' }, { status: 502 })
  }
}
