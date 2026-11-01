import { NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { createRateLimiter } from '@/lib/analysis/aiAccess'
import { CONTACT_LIMITS, clientIp, validateContact } from '@/lib/contact'
import { log } from '@/lib/observability/logger'

/**
 * "Hablá con una persona" de la portada. Es público a propósito: guarda un pedido
 * de contacto y nada más. La tabla solo admite INSERT (ver la migración); leerla
 * es cosa del dueño del proyecto desde el panel.
 *
 * Protecciones: tope de tamaño del cuerpo, validación estricta de tipos y largos, mail
 * normalizado, campo trampa, tope de pedidos por IP y por día (en memoria de cada instancia:
 * frena abusos evidentes, no es contabilidad exacta). No envía mails (no hay relay abierto)
 * y no registra nombre, mail ni mensaje en los logs.
 */

const perIp = createRateLimiter(CONTACT_LIMITS.perIpPerHour, 60 * 60 * 1000)
const global = createRateLimiter(CONTACT_LIMITS.globalPerDay, 24 * 60 * 60 * 1000)

export async function POST(req: Request) {
  if (!perIp.allow(clientIp(req.headers)) || !global.allow('all')) {
    log.warn('contacto.rate_limited', 'tope de pedidos')
    return NextResponse.json({ error: 'Recibimos muchos pedidos. Probá de nuevo más tarde.' }, { status: 429 })
  }

  let body: unknown
  try {
    const raw = await req.text()
    if (raw.length > CONTACT_LIMITS.maxBodyChars) return NextResponse.json({ error: 'Pedido demasiado grande.' }, { status: 413 })
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  }

  // Campo trampa completo = bot. Respondemos OK para no darle pistas.
  if (body && typeof body === 'object' && typeof (body as { website?: unknown }).website === 'string' && (body as { website: string }).website.length > 0) {
    return NextResponse.json({ ok: true })
  }

  const check = validateContact(body)
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 })

  if (!isSupabaseConfigured) return NextResponse.json({ error: 'El contacto todavía no está disponible.' }, { status: 503 })

  const supabase = await createClient()
  const { error } = await supabase.from('contact_requests').insert(check.value)
  if (error) {
    log.warn('contacto.save_failed', 'no se pudo guardar') // sin datos de la persona
    return NextResponse.json({ error: 'No pudimos guardar tu mensaje. Probá de nuevo en un rato.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
