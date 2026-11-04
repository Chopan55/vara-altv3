/**
 * API pública: claves y webhooks firmados, contra Postgres real (PGlite + pgcrypto).
 * `net.http_post` se reemplaza por una función que guarda el envío, para poder
 * verificar desde afuera lo que recibiría el endpoint.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest'
import { createHash, createHmac } from 'node:crypto'
import { createDb, as, asSystem, asAnon, newUser, rejects, type Db } from './harness'

vi.setConfig({ testTimeout: 30_000 })

let db: Db
const sha = (s: string) => createHash('sha256').update(s).digest('hex')

beforeAll(async () => {
  db = await createDb(['20260924000000_property_candidates.sql', '20260925000000_offers.sql', '20260926000000_activity_ledger.sql', '20261105000002_public_api.sql'])
  await asSystem(db)
  await db.exec(`
    create schema net;
    create table net.sent (url text, body jsonb, headers jsonb);
    create function net.http_post(url text, body jsonb, headers jsonb) returns bigint
      language sql as $$ insert into net.sent values (url, body, headers); select 1::bigint $$;
  `)
}, 120_000)

async function newOperation(owner: string) {
  await as(db, owner)
  return (await db.query<{ id: string }>(
    `insert into operations (user_id, type, title) values ($1, 'SELL_PROPERTY', 'Casa en Pilar') returning id`, [owner])).rows[0].id
}

async function addKey(owner: string, plain: string) {
  await as(db, owner)
  await db.query(`insert into api_keys (user_id, name, prefix, key_hash) values ($1, 'CRM', $2, $3)`,
    [owner, plain.slice(0, 14), sha(plain)])
}

describe('claves de API', () => {
  it('una clave válida lista solo las operaciones de su dueño, también sin sesión', async () => {
    const owner = await newUser(db, 'owner')
    const other = await newUser(db, 'other')
    const op = await newOperation(owner)
    await newOperation(other)
    await addKey(owner, 'vara_live_aaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    await asAnon(db)
    const list = (await db.query<{ r: { id: string }[] }>(
      `select public.api_list_operations($1) as r`, [sha('vara_live_aaaaaaaaaaaaaaaaaaaaaaaaaaaa')])).rows[0].r
    expect(list.map(o => o.id)).toEqual([op])
    const one = (await db.query<{ r: { title: string } }>(`select public.api_get_operation($1, $2) as r`,
      [sha('vara_live_aaaaaaaaaaaaaaaaaaaaaaaaaaaa'), op])).rows[0].r
    expect(one.title).toBe('Casa en Pilar')
  })

  it('clave inexistente o revocada no da nada; una operación ajena tampoco', async () => {
    const owner = await newUser(db, 'owner')
    const other = await newUser(db, 'other')
    const foreign = await newOperation(other)
    await addKey(owner, 'vara_live_bbbbbbbbbbbbbbbbbbbbbbbbbbbb')
    await asAnon(db)
    expect((await db.query<{ r: unknown }>(`select public.api_list_operations($1) as r`, [sha('nope')])).rows[0].r).toBeNull()
    expect((await db.query<{ r: unknown }>(`select public.api_get_operation($1, $2) as r`,
      [sha('vara_live_bbbbbbbbbbbbbbbbbbbbbbbbbbbb'), foreign])).rows[0].r).toBeNull()
    await as(db, owner)
    await db.query(`update api_keys set revoked_at = now() where user_id = $1`, [owner])
    await asAnon(db)
    expect((await db.query<{ r: unknown }>(`select public.api_list_operations($1) as r`,
      [sha('vara_live_bbbbbbbbbbbbbbbbbbbbbbbbbbbb')])).rows[0].r).toBeNull()
  })

  it('desde la app una clave no se puede cambiar ni des-revocar, y un tercero no la ve', async () => {
    const owner = await newUser(db, 'owner')
    const third = await newUser(db, 'third')
    await addKey(owner, 'vara_live_cccccccccccccccccccccccccccc')
    await as(db, owner)
    await rejects(db.query(`update api_keys set key_hash = $2 where user_id = $1`, [owner, sha('x')]), /renombrar o revocar/)
    await db.query(`update api_keys set revoked_at = now() where user_id = $1`, [owner])
    await rejects(db.query(`update api_keys set revoked_at = null where user_id = $1`, [owner]), /renombrar o revocar/)
    await as(db, third)
    expect((await db.query(`select * from api_keys where user_id = $1`, [owner])).rows).toHaveLength(0)
    await rejects(db.query(`select api_key_owner($1)`, [sha('x')]))
  })
})

describe('webhooks', () => {
  async function event(owner: string, op: string, kind: string) {
    await asSystem(db)
    await db.query(`insert into activity_events (user_id, operation_id, kind, summary) values ($1, $2, $3, 'Se subió la escritura')`,
      [owner, op, kind])
  }
  async function sent() {
    await asSystem(db)
    return (await db.query<{ url: string; body: unknown; headers: Record<string, string> }>(`select * from net.sent`)).rows
  }

  it('envía el evento firmado y la firma verifica con el secreto', async () => {
    await asSystem(db); await db.query('delete from net.sent')
    const owner = await newUser(db, 'owner')
    const op = await newOperation(owner)
    const secret = 'x'.repeat(40)
    await as(db, owner)
    await db.query(`insert into webhook_endpoints (user_id, url, secret, events) values ($1, 'https://crm.example.com/hook', $2, '{DOCUMENT_UPLOADED}')`,
      [owner, secret])
    await event(owner, op, 'DOCUMENT_UPLOADED')
    await event(owner, op, 'NOTE_ADDED')
    const out = await sent()
    expect(out).toHaveLength(1)
    expect(out[0].url).toBe('https://crm.example.com/hook')
    expect(out[0].headers['X-Vara-Event']).toBe('DOCUMENT_UPLOADED')
    // Lo que recibe el endpoint es el jsonb serializado: se verifica sobre ese texto.
    await asSystem(db)
    const text = (await db.query<{ t: string }>(`select body::text as t from net.sent`)).rows[0].t
    expect(out[0].headers['X-Vara-Signature']).toBe('sha256=' + createHmac('sha256', secret).update(text).digest('hex'))
    expect(JSON.parse(text)).toMatchObject({ event: 'DOCUMENT_UPLOADED', operation_id: op })
  })

  it('no envía a endpoints revocados ni de otro usuario; solo https', async () => {
    await asSystem(db); await db.query('delete from net.sent')
    const owner = await newUser(db, 'owner')
    const other = await newUser(db, 'other')
    const op = await newOperation(owner)
    await as(db, other)
    await db.query(`insert into webhook_endpoints (user_id, url, secret) values ($1, 'https://other.example.com', $2)`, [other, 'y'.repeat(40)])
    await rejects(db.query(`insert into webhook_endpoints (user_id, url, secret) values ($1, 'http://inseguro.com', $2)`, [other, 'y'.repeat(40)]))
    await as(db, owner)
    await db.query(`insert into webhook_endpoints (user_id, url, secret, revoked_at) values ($1, 'https://revocado.example.com', $2, now())`, [owner, 'z'.repeat(40)])
    await event(owner, op, 'OFFER_CREATED')
    expect(await sent()).toHaveLength(0)
  })

  it('sin pg_net, registrar actividad sigue funcionando', async () => {
    const owner = await newUser(db, 'owner')
    const op = await newOperation(owner)
    await asSystem(db)
    await db.exec('alter function net.http_post(text, jsonb, jsonb) rename to http_post_off')
    await event(owner, op, 'NOTE_ADDED')
    await db.exec('alter function net.http_post_off(text, jsonb, jsonb) rename to http_post')
    const n = (await db.query<{ n: number }>(`select count(*)::int as n from activity_events where operation_id = $1 and kind = 'NOTE_ADDED'`, [op])).rows[0].n
    expect(n).toBe(1)
  })
})
