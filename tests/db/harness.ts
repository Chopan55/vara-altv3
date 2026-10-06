/**
 * Harness para probar la seguridad de VARA Visit contra un Postgres REAL.
 *
 * Usa PGlite (Postgres en memoria): no toca ninguna base de Supabase y no
 * necesita Docker. Emula lo mínimo de Supabase que las migraciones usan:
 * los roles anon/authenticated, `auth.users`, `auth.uid()` y los privilegios
 * por defecto sobre el esquema public.
 *
 * Qué NO prueba: PostgREST ni el JWT. Prueba lo que importa para seguridad:
 * que RLS, los triggers y las funciones SECURITY DEFINER se comporten bien
 * cuando la llamada viene como `authenticated` con un `sub` dado.
 */

import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect } from 'vitest'

export type Db = PGlite

const MIGRATIONS = [
  '20260919000000_initial_schema.sql',
  '20260921000000_vara_visit.sql',
  '20261005000000_visit_hardening.sql',
]

const SUPABASE_STUB = `
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
`

export async function createDb(): Promise<Db> {
  const db = new PGlite()
  await db.exec(SUPABASE_STUB)
  for (const file of MIGRATIONS) {
    const sql = readFileSync(join(process.cwd(), 'supabase', 'migrations', file), 'utf8')
    try {
      await db.exec(sql)
    } catch (e) {
      throw new Error(`Falló la migración ${file}: ${(e as Error).message}`)
    }
  }
  return db
}

/** Pasa a actuar como un usuario logueado (rol authenticated, sub = uid). */
export async function as(db: Db, uid: string): Promise<void> {
  await db.exec('reset role')
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid])
  await db.exec('set role authenticated')
}

export async function asAnon(db: Db): Promise<void> {
  await db.exec('reset role')
  await db.query(`select set_config('request.jwt.claim.sub', '', false)`)
  await db.exec('set role anon')
}

/** Vuelve a ser el dueño (SQL Editor / service role): no pasa por las guardas. */
export async function asSystem(db: Db): Promise<void> {
  await db.exec('reset role')
  await db.query(`select set_config('request.jwt.claim.sub', '', false)`)
}

export async function rejects(p: Promise<unknown>, pattern?: RegExp): Promise<void> {
  let err: unknown = null
  try {
    await p
  } catch (e) {
    err = e
  }
  expect(err, 'la operación debería haber fallado').not.toBeNull()
  if (pattern) expect((err as Error).message).toMatch(pattern)
}

let counter = 0
const uniq = () => `${Date.now().toString(36)}${(counter++).toString(36)}`

export async function newUser(db: Db, label = 'user'): Promise<string> {
  await asSystem(db)
  const r = await db.query<{ id: string }>(
    `insert into auth.users (email) values ($1) returning id`,
    [`${label}-${uniq()}@test.local`],
  )
  return r.rows[0].id
}

export async function makeAdmin(db: Db, uid: string): Promise<void> {
  await asSystem(db)
  await db.query(`update profiles set role = 'ADMIN' where id = $1`, [uid])
}

export async function roleOf(db: Db, uid: string): Promise<string> {
  await asSystem(db)
  const r = await db.query<{ role: string }>(`select role from profiles where id = $1`, [uid])
  return r.rows[0].role
}

/** Crea un partner como sistema. `active` lo deja listo para recibir visitas. */
export async function newPartner(
  db: Db, userId: string, opts: { active?: boolean } = {},
): Promise<string> {
  await asSystem(db)
  const active = opts.active ?? true
  const r = await db.query<{ id: string }>(
    `insert into visit_partners
       (user_id, display_name, initials, status, verified_identity, certified, home_zone_label, coverage_zones, service_types)
     values ($1, 'Partner Test', 'PT', $2, $3, $3, 'Pilar', '{Pilar}', '{SHOW_PROPERTY}')
     returning id`,
    [userId, active ? 'ACTIVE' : 'DRAFT', active],
  )
  const id = r.rows[0].id
  await db.query(`insert into partner_training (partner_id, user_id) values ($1, $2)`, [id, userId])
  return id
}

/** Crea una reserva como el cliente (pasa por las guardas, como en producción). */
export async function newBooking(
  db: Db, requesterId: string, partnerId: string | null,
): Promise<string> {
  await as(db, requesterId)
  const r = await db.query<{ id: string }>(
    `insert into visit_bookings
       (visit_code, requester_user_id, service_type, requested_date, requested_time,
        duration_minutes, location_label, price, currency, assignment_mode, assigned_partner_id, status)
     values ($1, $2, 'SHOW_PROPERTY', '2026-12-01', '15:00', 60, 'Pilar', 42, 'USD', 'VARA_MATCH', $3, $4)
     returning id`,
    [`VIS-AR-PIL-${uniq()}`, requesterId, partnerId, partnerId ? 'ASSIGNED' : 'SEARCHING_PARTNER'],
  )
  return r.rows[0].id
}

/** El PIN real de la reserva, leído como sistema (los tests necesitan conocerlo). */
export async function pinOf(db: Db, bookingId: string): Promise<string> {
  await asSystem(db)
  const r = await db.query<{ pin: string }>(`select pin from visit_pins where booking_id = $1`, [bookingId])
  return r.rows[0].pin
}

export function wrongPin(real: string): string {
  return real === '0000' ? '1111' : '0000'
}
