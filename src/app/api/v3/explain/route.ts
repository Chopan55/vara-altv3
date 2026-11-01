export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { sanitizeBrief } from '@/lib/analysis/brief'
import { explainAnalysis, openAiModelClient, sanitizeMessages } from '@/lib/analysis/explain'
import { AI_LIMITS, createRateLimiter } from '@/lib/analysis/aiAccess'
import { allowedUser } from '@/lib/analysis/aiSession'
import { log } from '@/lib/observability/logger'

/**
 * Explica un análisis con IA. Autorización SIEMPRE en el servidor:
 * sesión real + email en AI_ALLOWED_EMAILS. Nunca se confía en lo que diga el cliente.
 */

const perUser = createRateLimiter(AI_LIMITS.perUserPerHour, 60 * 60 * 1000)
const global = createRateLimiter(AI_LIMITS.globalPerDay, 24 * 60 * 60 * 1000)

/** La pantalla pregunta primero si la IA está disponible para no mostrar un botón roto. */
export async function GET() {
  return NextResponse.json({ enabled: !!(await allowedUser()) })
}

export async function POST(req: Request) {
  const user = await allowedUser()
  if (!user) return NextResponse.json({ error: 'La IA todavía no está habilitada para tu cuenta.' }, { status: 403 })

  if (!perUser.allow(user.id) || !global.allow('all')) {
    return NextResponse.json({ error: 'Llegaste al tope de consultas por ahora. Probá más tarde.' }, { status: 429 })
  }

  let body: { brief?: unknown; messages?: unknown }
  try {
    const text = await req.text()
    if (text.length > AI_LIMITS.maxBodyChars) return NextResponse.json({ error: 'Pedido demasiado grande.' }, { status: 413 })
    body = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  }

  const brief = sanitizeBrief(body.brief)
  const messages = sanitizeMessages(body.messages)
  if (!brief || messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const result = await explainAnalysis(openAiModelClient(openai as never), brief, messages)
    if (!result.grounded) log.warn('explain.ungrounded', 'respuesta descartada', { numbers: result.ungrounded.length })
    return NextResponse.json({ reply: result.reply, grounded: result.grounded })
  } catch (err) {
    log.error('explain.failed', err)
    // Nunca se expone el error del proveedor.
    return NextResponse.json({ error: 'No pude responder ahora. Intentá de nuevo en un momento.' }, { status: 502 })
  }
}
