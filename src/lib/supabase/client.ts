'use client'
import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

export type VaraClient = SupabaseClient<Database, 'public'>

/**
 * Cliente de Supabase para el navegador.
 * La anon key es pública por diseño: lo que protege los datos es RLS, no la key.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
// Supabase renombró la clave pública a PUBLISHABLE_KEY; aceptamos ambos nombres.
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

/** true cuando el proyecto está configurado. Permite convivir con el modo localStorage. */
export const isSupabaseConfigured = Boolean(url && anonKey)

let cached: VaraClient | null = null

export function createClient(): VaraClient {
  if (!url || !anonKey) {
    throw new Error(
      'Supabase no está configurado. Falta NEXT_PUBLIC_SUPABASE_URL o la clave pública ' +
      '(NEXT_PUBLIC_SUPABASE_ANON_KEY o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).'
    )
  }
  cached ??= createBrowserClient<Database>(url, anonKey)
  return cached
}

/** Devuelve null en vez de tirar, para pantallas que todavía funcionan sin base. */
export function tryCreateClient(): VaraClient | null {
  return isSupabaseConfigured ? createClient() : null
}
