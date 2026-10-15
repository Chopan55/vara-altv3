export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { sanitizeBrief } from '@/lib/analysis/brief'
import { explainAnalysis, openAiModelClient, sanitizeMessages } from '@/lib/analysis/explain'
import { AI_LIMITS, createRateLimiter, isAiAllowed } from '@/lib/analysis/aiAccess'
import { log } from '@/lib/observability/logger'

/**
 * Explica un análisis con IA. Autorización SIEMPRE en el servidor:
 * sesión real + email en AI_ALLOWED_EMAILS. Nunca se confía en lo que diga el cliente.
 */

const perUser = createRateLimiter(AI_LIMITS.perUserPerHour, 60 * 60 * 1000)
const global = createRateLimiter(AI_LIMITS.globalPerDay, 24 * 60 * 60 * 1000)

async function sessionEmail(): Promise<{ id: string; email: string } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return null
  try {
    const store = await cookies()
    const supabase = createServerClient(url, key, { cookies: { getAll: () => store.getAll(), setAll: () => {} } })
    const { data: { user } } = await supabase.auth.getUser()
    return user?.email ? { id: user.id, email: user.email } : null
  } catch {
    return null
  }
}

async function allowedUser() {
  if (!process.env.OPENAI_API_KEY) return null
  const user = await sessionEmail()
  return user && isAiAllowed(user.email, process.env.AI_ALLOWED_EMAILS) ? user : null
}

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
