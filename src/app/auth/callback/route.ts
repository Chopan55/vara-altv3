import { NextResponse, type NextRequest } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'

/**
 * Destino del link de confirmación que Supabase manda por mail.
 * Cambia el `code` por una sesión y deja al usuario adentro.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/onboarding'
  const errorDescription = searchParams.get('error_description')

  if (errorDescription) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorDescription)}`)
  }

  if (!code || !isSupabaseConfigured) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Link inválido o vencido.')}`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent('No pudimos validar el link. Pedí uno nuevo.')}`
    )
  }

  // `next` solo puede ser una ruta interna: evita redirigir a un dominio ajeno.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/onboarding'
  return NextResponse.redirect(`${origin}${safeNext}`)
}
