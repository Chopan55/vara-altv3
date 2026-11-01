/**
 * Qué store de mercado usa esta instancia.
 *
 * Con la clave secreta de Supabase configurada, la base de datos (producción
 * y staging): los avisos persisten y no dependen de ninguna computadora. Sin
 * ella, el archivo local, que solo sirve para desarrollo: en Vercel el disco
 * no persiste y el mercado aparecería vacío (el chequeo de salud lo marca).
 */

import path from 'node:path'
import { createFileStore, type MarketStore } from './store'
import { createSupabaseMarketTable } from './supabaseTable'
import { createTableStore } from './tableStore'

export type MarketBackend = 'supabase' | 'file'

function secretKey(): string | undefined {
  return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
}

export function marketBackend(): MarketBackend {
  return process.env.NEXT_PUBLIC_SUPABASE_URL && secretKey() ? 'supabase' : 'file'
}

let shared: MarketStore | null = null

export function getMarketStore(): MarketStore {
  shared ??= marketBackend() === 'supabase'
    ? createTableStore(createSupabaseMarketTable(process.env.NEXT_PUBLIC_SUPABASE_URL as string, secretKey() as string))
    : createFileStore(process.env.MARKET_DATA_DIR ?? path.join(process.cwd(), '.data', 'market'))
  return shared
}
