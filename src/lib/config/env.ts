/**
 * En qué entorno corre VARA y bajo qué URL.
 *
 * Sirve para dos cosas:
 *  - Etiquetar eventos y métricas: lo de producción no se mezcla con pruebas,
 *    demos ni desarrollo. Las métricas para inversores salen solo de producción.
 *  - No asumir direcciones: la URL base sale de configuración, no de un
 *    `vercel.app` escrito en el código, para poder mudar al dominio propio.
 *
 * Orden de decisión del entorno: `VARA_ENV` explícito → `VERCEL_ENV` →
 * dirección local → desarrollo de Next. Si no se puede saber, devuelve
 * `unknown`: es más honesto que etiquetar mal.
 */

export type AppEnv = 'production' | 'staging' | 'development' | 'unknown'

type Env = Record<string, string | undefined>

const KNOWN: AppEnv[] = ['production', 'staging', 'development']

export function resolveAppEnv(env: Env = process.env, hostname?: string): AppEnv {
  const explicit = (env.VARA_ENV ?? env.NEXT_PUBLIC_VARA_ENV ?? '').toLowerCase() as AppEnv
  if (KNOWN.includes(explicit)) return explicit

  const vercel = env.VERCEL_ENV ?? env.NEXT_PUBLIC_VERCEL_ENV
  if (vercel === 'production') return 'production'
  if (vercel === 'preview') return 'staging'
  if (vercel === 'development') return 'development'

  if (hostname && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(hostname)) return 'development'
  if (env.NODE_ENV === 'development') return 'development'
  return 'unknown'
}

/**
 * Versión para el navegador. Next solo reemplaza `process.env.NEXT_PUBLIC_X`
 * cuando se escribe literal, por eso las lecturas están una por una.
 */
export function clientAppEnv(): AppEnv {
  return resolveAppEnv(
    {
      NEXT_PUBLIC_VARA_ENV: process.env.NEXT_PUBLIC_VARA_ENV,
      NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
      NODE_ENV: process.env.NODE_ENV,
    },
    typeof window !== 'undefined' ? window.location.hostname : undefined,
  )
}

/** URL base pública de la aplicación, sin barra final. null si no hay ninguna configurada. */
export function resolveBaseUrl(env: Env = process.env): string | null {
  const configured = env.APP_BASE_URL ?? env.NEXT_PUBLIC_APP_URL
  const vercelHost = resolveAppEnv(env) === 'production'
    ? env.VERCEL_PROJECT_PRODUCTION_URL ?? env.VERCEL_URL
    : env.VERCEL_URL
  const raw = configured ?? (vercelHost ? `https://${vercelHost}` : undefined)
  if (!raw) return null
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    return `${u.protocol}//${u.host}`
  } catch {
    return null
  }
}
