/**
 * Reglas del journey de entrada a VARA (lógica pura, sin React ni red).
 *
 *  - Usuario existente:  Home → Entrar → /login → /dashboard
 *  - Usuario nuevo:      Home → Empezar → /onboarding → crear/guardar operación → autenticación cuando corresponda
 *  - Ya autenticado en /login: se redirige, no se le vuelve a mostrar el formulario
 *  - Visit Partners: entran por /partner/entrar y terminan en /partner
 */

export const ENTRY = {
  login: '/login',
  start: '/onboarding',
  dashboard: '/dashboard',
  partnerHome: '/partner',
  partnerLogin: '/partner/entrar',
} as const

export type EntryAudience = 'client' | 'partner'

/** Pantallas de entrada: mandar ahí a quien ya entró (o volver a ellas) sería un loop. */
const LOGIN_PATHS: readonly string[] = [ENTRY.login, ENTRY.partnerLogin]

/**
 * Destino seguro después de entrar. Un `next` externo, protocol-relative (`//`), con barra
 * invertida, o que vuelve a una pantalla de login mandaría al usuario a un dominio ajeno o a un loop.
 */
export function safeNext(raw: string | null | undefined, fallback: string = ENTRY.dashboard): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return fallback
  const path = raw.split(/[?#]/)[0].replace(/\/+$/, '')
  if (LOGIN_PATHS.includes(path)) return fallback
  return raw
}

/** A dónde va cada público después de autenticarse, salvo que traiga un `next` seguro. */
export function postLoginTarget(audience: EntryAudience, nextParam: string | null | undefined): string {
  return safeNext(nextParam, audience === 'partner' ? ENTRY.partnerHome : ENTRY.dashboard)
}

/** /login con sesión válida: devuelve el destino al que redirigir. Sin sesión devuelve null (se muestra el formulario). */
export function loginRedirect(isAuthenticated: boolean, nextParam: string | null | undefined): string | null {
  return isAuthenticated ? postLoginTarget('client', nextParam) : null
}
