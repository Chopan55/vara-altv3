import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Refresca el token de sesión en cada request.
 * Sin esto la sesión se corta sola cuando expira el access token.
 * No hace nada si Supabase todavía no está configurado.
 *
 * Migrado de middleware.ts → proxy.ts (Next.js 16: middleware está deprecado).
 * Ver: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  // Supabase renombró la clave pública a PUBLISHABLE_KEY; aceptamos ambos nombres.
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !anonKey) return NextResponse.next()

  let response = NextResponse.next({ request })

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(toSet) {
        // Paso 1: actualizar cookies en el request para que route handlers las lean.
        for (const { name, value } of toSet) {
          request.cookies.set(name, value)
        }
        // Paso 2: recrear la response con el request actualizado y copiar las cookies
        // en Set-Cookie para que el browser actualice su cookie store.
        // Ambos pasos son obligatorios: sin el paso 1 los server components no ven el
        // token nuevo; sin el paso 2 el browser sigue con el token viejo y la sesión
        // aparece como expirada en el siguiente tab o recarga.
        response = NextResponse.next({ request })
        for (const { name, value, options } of toSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // Dispara el refresh del token contra el servidor de Supabase.
  // getUser() valida el JWT y rota el refresh token si está cerca de expirar.
  // No reemplazar por getSession() (no valida contra el servidor) ni por getClaims()
  // (solo decodifica el JWT local, no lo rota).
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    // Todo menos estáticos e imágenes.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
