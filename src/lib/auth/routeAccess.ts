/** Rutas de marketing, documentación y entrada que no exponen datos de cuenta. */
const PUBLIC_EXACT = new Set([
  '/',
  '/login',
  '/onboarding',
  '/analizar',
  '/como-usar',
  '/labs',
  '/planes',
  '/vara-visit',
  '/partner/entrar',
  '/auth/callback',
  '/auth/nueva-clave',
])

/** Rutas con un código o flujo propio que no usan la cuenta principal. */
const PUBLIC_PREFIXES = ['/visit/']

/** Demo y producto operativo sí requieren una sesión válida. */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix))
}
