/**
 * Alta de Visit Partner de punta a punta, contra Postgres real (PGlite).
 *
 * Recorre el camino legítimo con las mismas escrituras que hace la app
 * (src/lib/supabase/visits.ts y visitsAdmin.ts), en orden, hasta que el
 * partner aparece en el marketplace. La suite adversaria vive en visitSecurity.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest'
import { createDb, as, asSystem, newUser, makeAdmin, type Db } from './harness'

vi.setConfig({ testTimeout: 30_000 })

let db: Db

beforeAll(async () => {
  db = await createDb()
}, 120_000)

async function contactOf(partnerId: string) {
  await asSystem(db)
  const r = await db.query<{ phone: string | null; email: string | null; address_line: string | null }>(
    `select phone, email, address_line from partner_contacts where partner_id = $1`, [partnerId])
  return r.rows[0]
}

describe('alta de Visit Partner, camino feliz', () => {
  it('de cuenta nueva a partner activo visible en el marketplace', async () => {
    const u = await newUser(db, 'candidato')
    const admin = await newUser(db, 'admin'); await makeAdmin(db, admin)
    const client = await newUser(db, 'cliente')

    // 1. Datos personales (createMyPartner + saveMyContact)
    await as(db, u)
    const created = await db.query<{ id: string; status: string }>(
      `insert into visit_partners
         (user_id, display_name, initials, profession, home_zone_label, coverage_zones,
          max_travel_radius_km, service_types, availability, rate_per_visit, status, onboarding_status)
       values ($1, 'Ana Pérez', 'AP', 'Corredora', '', '{}', 10, '{}', '{}', 0, 'DRAFT', 'IN_PROGRESS')
       returning id, status`, [u])
    const partnerId = created.rows[0].id
    expect(created.rows[0].status).toBe('DRAFT')
    await db.query(`insert into partner_training (partner_id, user_id) values ($1, $2)`, [partnerId, u])
    await db.query(`insert into partner_contacts (partner_id, user_id) values ($1, $2)`, [partnerId, u])
    await db.query(
      `insert into partner_contacts (partner_id, user_id, phone, email) values ($1, $2, '11 5555 0000', 'ana@test.local')
       on conflict (partner_id) do update set phone = excluded.phone, email = excluded.email`, [partnerId, u])

    // 2. Zona, servicios y precio (updateMyPartner)
    await db.query(
      `update visit_partners set home_zone_label = 'Pilar', coverage_zones = '{Del Viso}',
         service_types = '{SHOW_PROPERTY,ACCOMPANY_VISIT}', rate_per_visit = 30 where id = $1`, [partnerId])

    // 4. Referencias (addReference)
    for (const name of ['Juan', 'Marta']) {
      await db.query(
        `insert into partner_references (partner_id, user_id, name, relationship, contact_phone, status)
         values ($1, $2, $3, 'Colega', '11 4444', 'PENDING')`, [partnerId, u, name])
    }

    // 6. Capacitación y examen (markModuleCompleted + saveQuizResult)
    await db.query(
      `update partner_training set modules_completed = '{m1,m2}', certification_status = 'IN_PROGRESS' where partner_id = $1`, [partnerId])
    await db.query(
      `update partner_training set quiz_score = 0.9, quiz_attempts = 1, certification_status = 'QUIZ_PENDING' where partner_id = $1`, [partnerId])

    // Lo que hace VARA: referencias, certificación, identidad, entrevista y supervisadas.
    await as(db, admin)
    await db.query(`update partner_references set status = 'VERIFIED', responded_at = now() where partner_id = $1`, [partnerId])
    await db.query(
      `update partner_training set certification_status = 'CERTIFIED', certification_date = now() where partner_id = $1`, [partnerId])
    await db.query(
      `insert into partner_verifications (partner_id, user_id, identity_status, reference_check_status, interview_status, supervised_visits_completed)
       values ($1, $2, 'VERIFIED', 'VERIFIED', 'VERIFIED', 3)
       on conflict (partner_id) do update set identity_status = excluded.identity_status,
         reference_check_status = excluded.reference_check_status, interview_status = excluded.interview_status,
         supervised_visits_completed = excluded.supervised_visits_completed`, [partnerId, u])
    await db.query(`update visit_partners set verified_identity = true where id = $1`, [partnerId])

    const approved = await db.query<{ r: { ok: boolean; missing?: string[] } }>(
      `select public.admin_approve_partner($1) as r`, [partnerId])
    expect(approved.rows[0].r).toMatchObject({ ok: true })

    // Lo que ve un cliente en el marketplace (listActivePartners)
    await as(db, client)
    const market = await db.query<{ id: string; display_name: string }>(
      `select id, display_name from visit_partners where status = 'ACTIVE' and service_types @> '{ACCOMPANY_VISIT}'`)
    expect(market.rows.map(r => r.id)).toContain(partnerId)
    // Y no ve sus datos de contacto.
    const leaked = await db.query(`select * from partner_contacts where partner_id = $1`, [partnerId])
    expect(leaked.rows).toHaveLength(0)
  })

  it('volver a guardar los datos personales no borra el contacto ni el domicilio', async () => {
    const u = await newUser(db, 'candidato')
    await as(db, u)
    const r = await db.query<{ id: string }>(
      `insert into visit_partners (user_id, display_name, initials) values ($1, 'Leo Gómez', 'LG') returning id`, [u])
    const partnerId = r.rows[0].id
    await db.query(
      `insert into partner_contacts (partner_id, user_id, phone, email, address_line)
       values ($1, $2, '11 1111', 'leo@test.local', 'Calle Falsa 123')`, [partnerId, u])

    // saveMyContact con contactPatch: solo las columnas que vinieron.
    await db.query(
      `insert into partner_contacts (partner_id, user_id, phone, email) values ($1, $2, '11 2222', 'leo@test.local')
       on conflict (partner_id) do update set phone = excluded.phone, email = excluded.email`, [partnerId, u])

    expect(await contactOf(partnerId)).toEqual({ phone: '11 2222', email: 'leo@test.local', address_line: 'Calle Falsa 123' })
  })
})
