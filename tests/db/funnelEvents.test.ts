/**
 * Embudo de producto contra Postgres real (PGlite).
 *
 * Lo que tiene que valer siempre: cualquiera registra un paso válido, nadie
 * lee la tabla directo, los nombres raros se rechazan, el registro tiene tope
 * por hora y los totales solo los ve un ADMIN.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest'
import { createDb, as, asSystem, asAnon, newUser, makeAdmin, rejects, type Db } from './harness'

vi.setConfig({ testTimeout: 30_000 })

let db: Db

beforeAll(async () => {
  db = await createDb(['20261108000000_funnel_events.sql'])
}, 120_000)

const uuid = async (): Promise<string> => {
  await asSystem(db)
  return (await db.query<{ id: string }>(`select gen_random_uuid() as id`)).rows[0].id
}

async function track(anon: string, name: string, env = 'production', props: object = {}) {
  await db.query(`select track_event($1, $2, $3, '/x', $4::jsonb)`, [anon, name, env, JSON.stringify(props)])
}

async function count(anon: string): Promise<number> {
  await asSystem(db)
  return Number((await db.query<{ n: string }>(`select count(*) as n from funnel_events where anon_id = $1`, [anon])).rows[0].n)
}

describe('funnel_events', () => {
  it('anónimo y con sesión registran pasos válidos', async () => {
    const a = await uuid()
    await asAnon(db)
    await track(a, 'visit', 'production', { ref: 'share' })
    const u = await newUser(db, 'funnel')
    await as(db, u)
    await track(a, 'analyze_done')
    expect(await count(a)).toBe(2)
  })

  it('nadie lee ni escribe la tabla directo', async () => {
    await asAnon(db)
    await rejects(db.query(`select * from funnel_events`))
    const u = await newUser(db, 'reader')
    await as(db, u)
    await rejects(db.query(`select * from funnel_events`))
    await rejects(db.query(`insert into funnel_events (anon_id, name) values (gen_random_uuid(), 'visit')`))
  })

  it('rechaza nombres que no están en la lista y props demasiado grandes', async () => {
    const a = await uuid()
    await asAnon(db)
    await rejects(track(a, 'drop table'))
    await rejects(track(a, 'visit', 'production', { x: 'y'.repeat(2000) }))
    await rejects(track(a, 'visit', 'otro-entorno'))
  })

  it('corta en 300 eventos por hora por navegador', async () => {
    const a = await uuid()
    await asSystem(db)
    await db.query(`insert into funnel_events (anon_id, name, env) select $1, 'visit', 'production' from generate_series(1, 300)`, [a])
    await asAnon(db)
    await track(a, 'analyze_done')
    expect(await count(a)).toBe(300)
  })

  it('los totales solo los ve un ADMIN y cuentan solo producción', async () => {
    const admin = await newUser(db, 'admin')
    await makeAdmin(db, admin)
    const user = await newUser(db, 'user')
    const before = async () => {
      await as(db, admin)
      return (await db.query<{ funnel_summary: Record<string, number> }>(`select funnel_summary(30)`)).rows[0].funnel_summary
    }
    const base = await before()

    const a = await uuid()
    await asAnon(db)
    await track(a, 'visit', 'production', { ref: 'share' })
    await track(a, 'analyze_done')
    await track(a, 'operation_created')
    await track(a, 'visit', 'development')
    const b = await uuid()
    await track(b, 'visit', 'staging')

    const after = await before()
    expect(after.visitors - base.visitors).toBe(1)
    expect(after.analyzed - base.analyzed).toBe(1)
    expect(after.operations - base.operations).toBe(1)
    expect(after.from_share - base.from_share).toBe(1)

    await as(db, user)
    await rejects(db.query(`select funnel_summary(30)`), /forbidden/)
    await asAnon(db)
    await rejects(db.query(`select funnel_summary(30)`))
  })

  it('cuenta quién volvió otro día dentro de su primera semana', async () => {
    const admin = await newUser(db, 'admin2')
    await makeAdmin(db, admin)
    await as(db, admin)
    const base = (await db.query<{ funnel_summary: Record<string, number> }>(`select funnel_summary(60)`)).rows[0].funnel_summary

    const back = await uuid()
    const gone = await uuid()
    await asSystem(db)
    await db.query(
      `insert into funnel_events (anon_id, name, env, created_at) values
         ($1, 'visit', 'production', now() - interval '20 days'),
         ($1, 'visit', 'production', now() - interval '17 days'),
         ($2, 'visit', 'production', now() - interval '20 days')`, [back, gone])

    await as(db, admin)
    const s = (await db.query<{ funnel_summary: Record<string, number> }>(`select funnel_summary(60)`)).rows[0].funnel_summary
    expect(s.cohort_7d - base.cohort_7d).toBe(2)
    expect(s.returned_7d - base.returned_7d).toBe(1)
  })
})
