import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { verifyPin, PIN_ERROR_MESSAGES } from '@/lib/varaVisit/session'

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !anonKey) {
    return NextResponse.json({ error: 'Servicio no configurado.' }, { status: 503 })
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(url, anonKey, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  })

  const body = await req.json().catch(() => ({})) as {
    bookingId?: string
    pin?: string
    previousAttempts?: number
  }

  const { bookingId, pin, previousAttempts = 0 } = body
  if (!bookingId || typeof pin !== 'string') {
    return NextResponse.json({ error: 'Parámetros inválidos.' }, { status: 400 })
  }

  // Read PIN server-side — never sent to the client
  const { data, error } = await supabase
    .from('visit_bookings')
    .select('confirmation_pin')
    .eq('id', bookingId)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: 'Reserva no encontrada.' }, { status: 404 })
  }

  const result = verifyPin(data.confirmation_pin, pin, previousAttempts)

  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      reason: result.reason,
      message: PIN_ERROR_MESSAGES[result.reason],
      attemptsLeft: result.attemptsLeft,
    })
  }

  return NextResponse.json({ ok: true })
}
