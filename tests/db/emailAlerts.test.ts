/**
 * Preferencias de alertas por email, contra Postgres real (PGlite).
 *
 * Lo que tiene que valer siempre: cada uno ve y cambia solo su fila; nadie
 * escribe el registro de envíos ni elige su token; la baja por token funciona
 * sin sesión y solo apaga la fila de ese token.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest'
import { createDb, as, asSystem, asAnon, newUser, rejects, type Db } from './harness'

vi.setConfig({ testTimeout: 30_000 })

let db: Db

beforeAll(async () => {
  db = await createDb(['20261106000000_email_alerts.sql'])
}, 120_000)

async function optIn(uid: string) {
  await as(db, uid)
  await db.query(`insert into alert_preferences (user_id, email_digest) values ($1, true)`, [uid])
}

async function tokenOf(uid: string): Promise<string> {
  await asSystem(db)
  return (await db.query<{ unsubscribe_token: string }>(
    `select unsubscribe_token from alert_preferences where user_id = $1`, [uid])).rows[0].unsubscribe_token
}

describe('alert_preferences', () => {
  it('cada usuario activa y apaga su propio resumen', async () => {
    const u = await newUser(db, 'a')
    await optIn(u)
    await db.query(`update alert_preferences set email_digest = false where user_id = $1`, [u])
    const r = await db.query<{ email_digest: boolean }>(`select email_digest from alert_preferences`)
    expect(r.rows).toEqual([{ email_digest: false }])
  })

  it('nadie ve ni toca la fila de otro', async () => {
    const owner = await newUser(db, 'owner')
    const other = await newUser(db, 'other')
    await optIn(owner)
    await as(db, other)
    expect((await db.query(`select * from alert_preferences where user_id = $1`, [owner])).rows).toHaveLength(0)
    await db.query(`update alert_preferences set email_digest = false where user_id = $1`, [owner])
    await rejects(db.query(`insert into alert_preferences (user_id, email_digest) values ($1, true)`, [owner]))
    await asSystem(db)
    const r = await db.query<{ email_digest: boolean }>(`select email_digest from alert_preferences where user_id = $1`, [owner])
    expect(r.rows[0].email_digest).toBe(true)
  })

  it('el usuario no puede escribir el registro de envíos ni su token', async () => {
    const u = await newUser(db, 'tamper')
    await optIn(u)
    await as(db, u)
    await rejects(db.query(`update alert_preferences set last_sent_at = now() where user_id = $1`, [u]))
    await rejects(db.query(`update alert_preferences set unsubscribe_token = gen_random_uuid() where user_id = $1`, [u]))
  })

  it('anon no lee preferencias', async () => {
    await asAnon(db)
    await rejects(db.query(`select * from alert_preferences`))
  })

  it('la baja por token funciona sin sesión y solo afecta a esa fila', async () => {
    const a = await newUser(db, 'unsub-a')
    const b = await newUser(db, 'unsub-b')
    await optIn(a)
    await optIn(b)
    const token = await tokenOf(a)
    await asAnon(db)
    const ok = await db.query<{ alerts_unsubscribe: boolean }>(`select alerts_unsubscribe($1)`, [token])
    expect(ok.rows[0].alerts_unsubscribe).toBe(true)
    const bad = await db.query<{ alerts_unsubscribe: boolean }>(`select alerts_unsubscribe(gen_random_uuid())`)
    expect(bad.rows[0].alerts_unsubscribe).toBe(false)
    await asSystem(db)
    const rows = await db.query<{ user_id: string; email_digest: boolean }>(
      `select user_id, email_digest from alert_preferences where user_id in ($1, $2)`, [a, b])
    const byId = Object.fromEntries(rows.rows.map(r => [r.user_id, r.email_digest]))
    expect(byId[a]).toBe(false)
    expect(byId[b]).toBe(true)
  })
})
