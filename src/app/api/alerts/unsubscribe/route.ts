export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isUuid } from '@/lib/api/v1Auth'

/**
 * Baja con un clic desde el email. No pide sesión: el token solo sirve para
 * apagar el resumen de su dueño (función `alerts_unsubscribe`, SECURITY DEFINER).
 * GET desde el link; POST para clientes de correo con "List-Unsubscribe-Post".
 */

async function unsubscribe(token: string | null): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!token || !isUuid(token) || !url || !anon) return false
  const db = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await db.rpc('alerts_unsubscribe', { p_token: token })
  return !error && data === true
}

export async function GET(req: Request) {
  const ok = await unsubscribe(new URL(req.url).searchParams.get('token'))
  return NextResponse.redirect(new URL(`/configuracion?alertas=${ok ? 'baja' : 'error'}`, req.url), 303)
}

export async function POST(req: Request) {
  const ok = await unsubscribe(new URL(req.url).searchParams.get('token'))
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 })
}
