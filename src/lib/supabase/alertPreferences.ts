import { tryCreateClient } from './client'

/**
 * Preferencia del resumen diario por email. La fila es del usuario (RLS) y
 * solo puede escribir `email_digest`: el registro de envíos lo lleva el servidor.
 */

export type AlertPrefState =
  | { status: 'off' | 'on' }
  | { status: 'signed_out' }
  | { status: 'unavailable' }

export async function getEmailDigest(): Promise<AlertPrefState> {
  const supabase = tryCreateClient()
  if (!supabase) return { status: 'unavailable' }
  const { data: u } = await supabase.auth.getUser()
  if (!u.user) return { status: 'signed_out' }
  const { data, error } = await supabase
    .from('alert_preferences')
    .select('email_digest')
    .eq('user_id', u.user.id)
    .maybeSingle()
  // Sin la migración la tabla no existe: no mostramos un interruptor que no guarda.
  if (error) return { status: 'unavailable' }
  return { status: data?.email_digest ? 'on' : 'off' }
}

export async function setEmailDigest(on: boolean): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const { data: u } = await supabase.auth.getUser()
  if (!u.user) return false
  // Sin upsert: el usuario no tiene permiso de escribir user_id en un UPDATE.
  const updated = await supabase
    .from('alert_preferences')
    .update({ email_digest: on })
    .eq('user_id', u.user.id)
    .select('user_id')
  if (updated.error) return false
  if ((updated.data ?? []).length > 0) return true
  const inserted = await supabase.from('alert_preferences').insert({ user_id: u.user.id, email_digest: on })
  return !inserted.error
}
