import { timingSafeEqual } from 'node:crypto'

/**
 * Vercel Cron manda `Authorization: Bearer <CRON_SECRET>`. Sin secreto (o con
 * uno corto) nadie pasa: un cron mal configurado queda cerrado, no abierto.
 */
export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret || secret.length < 16) return false
  const a = Buffer.from(`Bearer ${secret}`)
  const b = Buffer.from(req.headers.get('authorization') ?? '')
  return a.length === b.length && timingSafeEqual(a, b)
}
