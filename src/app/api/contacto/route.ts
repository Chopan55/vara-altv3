import { NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'

/**
 * "Hablá con una persona" de la portada. Es público a propósito: guarda un pedido
 * de contacto y nada más. La tabla solo admite INSERT (ver la migración); leerla
 * es cosa del dueño del proyecto desde el panel.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  }

  // Campo trampa completo = bot. Respondemos OK para no darle pistas.
  if (typeof body.website === 'string' && body.website.length > 0) return NextResponse.json({ ok: true })

  const name = String(body.name ?? '').trim()
  const email = String(body.email ?? '').trim()
  const message = String(body.message ?? '').trim()
  if (name.length < 2 || name.length > 80) return NextResponse.json({ error: 'Poné tu nombre.' }, { status: 400 })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) return NextResponse.json({ error: 'Ese mail no parece válido.' }, { status: 400 })
  if (message.length < 10 || message.length > 1000) return NextResponse.json({ error: 'Contanos un poco más (entre 10 y 1000 caracteres).' }, { status: 400 })

  if (!isSupabaseConfigured) return NextResponse.json({ error: 'El contacto todavía no está disponible.' }, { status: 503 })

  const supabase = await createClient()
  const { error } = await supabase.from('contact_requests').insert({ name, email, message })
  if (error) return NextResponse.json({ error: 'No pudimos guardar tu mensaje. Probá de nuevo en un rato.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
