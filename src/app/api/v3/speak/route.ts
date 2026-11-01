export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { AI_LIMITS, createRateLimiter } from '@/lib/analysis/aiAccess'
import { allowedUser } from '@/lib/analysis/aiSession'
import { SPEECH_INSTRUCTIONS, sanitizeSpeechText } from '@/lib/analysis/speech'
import { log } from '@/lib/observability/logger'

/**
 * Voz de VARA: convierte una respuesta del chat en audio (OpenAI).
 * Gasta crédito: solo emails autorizados, con tope por usuario/hora y global/día,
 * y con un largo máximo por audio. Devuelve MP3.
 */

const perUser = createRateLimiter(AI_LIMITS.speakPerUserPerHour, 60 * 60 * 1000)
const global = createRateLimiter(AI_LIMITS.speakGlobalPerDay, 24 * 60 * 60 * 1000)

/** Modelo con tono ajustable; si no está disponible para la cuenta, el básico. */
const MODELS = ['gpt-4o-mini-tts', 'tts-1'] as const
const VOICE = 'coral'

export async function POST(req: Request) {
  const user = await allowedUser()
  if (!user) return NextResponse.json({ error: 'La voz todavía no está habilitada para tu cuenta.' }, { status: 403 })

  if (!perUser.allow(user.id) || !global.allow('all')) {
    return NextResponse.json({ error: 'Llegaste al tope de voz por ahora. Probá más tarde.' }, { status: 429 })
  }

  let text: string | null
  try {
    const raw = await req.text()
    if (raw.length > 4_000) return NextResponse.json({ error: 'Pedido demasiado grande.' }, { status: 413 })
    text = sanitizeSpeechText((JSON.parse(raw) as { text?: unknown }).text)
  } catch {
    return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  }
  if (!text) return NextResponse.json({ error: 'No hay nada para leer.' }, { status: 400 })

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  for (const model of MODELS) {
    try {
      const res = await openai.audio.speech.create({
        model,
        voice: VOICE,
        input: text,
        response_format: 'mp3',
        ...(model === 'gpt-4o-mini-tts' ? { instructions: SPEECH_INSTRUCTIONS } : {}),
      })
      const audio = await res.arrayBuffer()
      return new Response(audio, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' } })
    } catch (err) {
      log.warn('speak.model_failed', model, { reason: err instanceof Error ? err.message : 'error' })
    }
  }
  // Nunca se expone el error del proveedor.
  return NextResponse.json({ error: 'No pude generar la voz ahora.' }, { status: 502 })
}
