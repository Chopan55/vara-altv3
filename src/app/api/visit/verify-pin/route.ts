export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { PIN_ERROR_MESSAGES } from '@/lib/varaVisit/session'

/**
 * El partner dice el PIN en la puerta; esto lo verifica.
 *
 * Toda la lógica vive en la base (`verify_visit_pin`): ella valida que quien
 * llama sea el partner asignado, que haya hecho check-in, lleva el contador de
 * intentos y bloquea a los 3 errores. Antes el contador lo mandaba el cliente
 * (`previousAttempts`), y mandando siempre 0 se probaban los 10.000 PIN posibles.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const MESSAGES: Record<string, string> = {
  ...PIN_ERROR_MESSAGES,
  NOT_READY: 'La visita todavía no está confirmada.',
  NOT_CHECKED_IN: 'Primero registrá tu llegada.',
  NO_PIN: 'Esta visita no tiene PIN. Contactá a soporte de VARA.',
}

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Servicio no configurado.' }, { status: 503 })
  }

  const body = await req.json().catch(() => ({})) as { bookingId?: unknown; pin?: unknown }
  const { bookingId, pin } = body
  if (typeof bookingId !== 'string' || !UUID.test(bookingId) || typeof pin !== 'string' || pin.length > 16) {
    return NextResponse.json({ error: 'Parámetros inválidos.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) {
    return NextResponse.json({ error: 'Iniciá sesión para continuar.' }, { status: 401 })
  }

  const { data, error } = await supabase.rpc('verify_visit_pin', { p_booking_id: bookingId, p_pin: pin })

  if (error || !data) {
    // La base rechaza a quien no es el partner asignado. No distinguimos el motivo.
    return NextResponse.json(
      { ok: false, reason: 'FORBIDDEN', message: 'No podés verificar esta visita.' },
      { status: 403 },
    )
  }

  if (data.ok) return NextResponse.json({ ok: true })

  const reason = data.reason ?? 'WRONG_PIN'
  return NextResponse.json({
    ok: false,
    reason,
    message: MESSAGES[reason] ?? 'No se pudo verificar el PIN.',
    attemptsLeft: data.attemptsLeft ?? 0,
  })
}
