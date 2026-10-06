/**
 * Suite ADVERSARIA de VARA Visit.
 *
 * Cada test intenta romper el sistema como lo haría un usuario malicioso con la
 * clave pública de Supabase, y verifica que la base lo impida. Corre contra un
 * Postgres real en memoria (PGlite), no contra mocks: lo que se prueba es RLS,
 * triggers y funciones SECURITY DEFINER de verdad.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest'
import {
  createDb, as, asSystem, asAnon, newUser, makeAdmin, roleOf, newPartner, newBooking,
  pinOf, wrongPin, rejects, type Db,
} from './harness'

vi.setConfig({ testTimeout: 30_000 })

let db: Db

beforeAll(async () => {
  db = await createDb()
}, 120_000)

// ───────────────────────────── Escenarios ─────────────────────────────

interface Scenario { client: string; partnerUser: string; partnerId: string; booking: string }

/** Reserva ASSIGNED a un partner ACTIVE. */
async function assigned(): Promise<Scenario> {
  const client = await newUser(db, 'client')
  const partnerUser = await newUser(db, 'partner')
  const partnerId = await newPartner(db, partnerUser)
  const booking = await newBooking(db, client, partnerId)
  return { client, partnerUser, partnerId, booking }
}

/** El partner acepta. */
async function confirmed(): Promise<Scenario> {
  const s = await assigned()
  await as(db, s.partnerUser)
  await db.query(`update visit_bookings set status = 'CONFIRMED' where id = $1`, [s.booking])
  return s
}

/** El partner abre la sesión y hace check-in. */
async function checkedIn(): Promise<Scenario> {
  const s = await confirmed()
  await as(db, s.partnerUser)
  await db.query(`insert into visit_sessions (booking_id, partner_id) values ($1, $2)`, [s.booking, s.partnerId])
  await db.query(`update visit_sessions set status = 'CHECKED_IN' where booking_id = $1`, [s.booking])
  await db.query(`update visit_bookings set status = 'ARRIVED' where id = $1`, [s.booking])
  return s
}

async function verify(partnerUser: string, booking: string, pin: string) {
  await as(db, partnerUser)
  const r = await db.query<{ r: { ok: boolean; reason?: string; attemptsLeft?: number } }>(
    `select public.verify_visit_pin($1, $2) as r`, [booking, pin])
  return r.rows[0].r
}

/** Visita completa de punta a punta, por el camino legítimo. */
async function completed(): Promise<Scenario> {
  const s = await checkedIn()
  const pin = await pinOf(db, s.booking)
  expect((await verify(s.partnerUser, s.booking, pin)).ok).toBe(true)
  await as(db, s.partnerUser)
  await db.query(`update visit_sessions set status = 'IN_PROGRESS' where booking_id = $1`, [s.booking])
  await db.query(`update visit_bookings set status = 'IN_PROGRESS' where id = $1`, [s.booking])
  await db.query(`update visit_sessions set status = 'CHECKED_OUT' where booking_id = $1`, [s.booking])
  await db.query(`update visit_bookings set status = 'COMPLETED' where id = $1`, [s.booking])
  return s
}

async function insertBooking(uid: string, partnerId: string | null, status: string) {
  await as(db, uid)
  return db.query(
    `insert into visit_bookings
       (visit_code, requester_user_id, service_type, requested_date, requested_time, location_label,
        price, assigned_partner_id, status)
     values ($1, $2, 'SHOW_PROPERTY', '2026-12-01', '15:00', 'Pilar', 42, $3, $4)`,
    [`VIS-X-${Math.random().toString(36).slice(2, 8)}`, uid, partnerId, status])
}

async function updateAs(uid: string, sql: string, params: unknown[]) {
  await as(db, uid)
  return db.query(sql, params)
}

// ───────────────────────────── Humo ─────────────────────────────

describe('migraciones', () => {
  it('cargan completas y crean las piezas de seguridad', async () => {
    await asSystem(db)
    const r = await db.query<{ n: string }>(
      `select count(*)::text as n from information_schema.tables
        where table_schema = 'public' and table_name in ('visit_pins', 'audit_events')`)
    expect(r.rows[0].n).toBe('2')
  })

  it('confirmation_pin ya no existe en visit_bookings', async () => {
    await asSystem(db)
    const r = await db.query(
      `select 1 from information_schema.columns
        where table_name = 'visit_bookings' and column_name = 'confirmation_pin'`)
    expect(r.rows).toHaveLength(0)
  })
})

// ─────────────────────── 1. Escalada de privilegios ───────────────────────

describe('escalada de privilegios', () => {
  it('un usuario nuevo arranca como CLIENT', async () => {
    const u = await newUser(db)
    expect(await roleOf(db, u)).toBe('CLIENT')
  })

  it('un usuario NO puede hacerse ADMIN', async () => {
    const u = await newUser(db)
    await rejects(updateAs(u, `update profiles set role = 'ADMIN' where id = $1`, [u]), /proceso interno/)
    expect(await roleOf(db, u)).toBe('CLIENT')
  })

  it('un usuario NO puede hacerse PARTNER por su cuenta', async () => {
    const u = await newUser(db)
    await rejects(updateAs(u, `update profiles set role = 'PARTNER' where id = $1`, [u]), /proceso interno/)
    expect(await roleOf(db, u)).toBe('CLIENT')
  })

  it('un ADMIN tampoco cambia roles desde la API', async () => {
    const a = await newUser(db, 'admin')
    await makeAdmin(db, a)
    await rejects(updateAs(a, `update profiles set role = 'CLIENT' where id = $1`, [a]), /proceso interno/)
  })

  it('crear un perfil de partner lo hace PARTNER (lo decide la base) y fuerza valores seguros', async () => {
    const u = await newUser(db)
    await as(db, u)
    const r = await db.query<{
      status: string; tier: string; verified_identity: boolean; certified: boolean;
      rating_sum: string; review_count: number
    }>(
      `insert into visit_partners
         (user_id, display_name, initials, status, tier, verified_identity, certified, rating_sum, review_count)
       values ($1, 'Mal Actor', 'MA', 'ACTIVE', 'ELITE', true, true, 500, 100)
       returning status, tier, verified_identity, certified, rating_sum, review_count`, [u])
    const row = r.rows[0]
    expect(row.status).toBe('DRAFT')
    expect(row.tier).toBe('TRAINEE')
    expect(row.verified_identity).toBe(false)
    expect(row.certified).toBe(false)
    expect(Number(row.rating_sum)).toBe(0)
    expect(row.review_count).toBe(0)
    expect(await roleOf(db, u)).toBe('PARTNER')
  })
})

// ─────────────────────── 2. Un partner no se autoverifica ───────────────────────

describe('autoverificación del partner', () => {
  it('puede editar su perfil', async () => {
    const u = await newUser(db)
    await newPartner(db, u, { active: false })
    const r = await updateAs(u, `update visit_partners set bio = 'Hola' where user_id = $1`, [u])
    expect(r.affectedRows).toBe(1)
  })

  it('NO puede activarse, verificarse, subir de nivel ni tocar su reputación', async () => {
    const u = await newUser(db)
    await newPartner(db, u, { active: false })
    await rejects(updateAs(u, `update visit_partners set status = 'ACTIVE' where user_id = $1`, [u]), /no permitida/)
    await rejects(updateAs(u, `update visit_partners set verified_identity = true where user_id = $1`, [u]), /no las edita/)
    await rejects(updateAs(u, `update visit_partners set certified = true where user_id = $1`, [u]), /no las edita/)
    await rejects(updateAs(u, `update visit_partners set tier = 'ELITE' where user_id = $1`, [u]), /no las edita/)
    await rejects(updateAs(u, `update visit_partners set rating_sum = 999, review_count = 200 where user_id = $1`, [u]), /no las edita/)
    await rejects(updateAs(u, `update visit_partners set onboarding_status = 'APPROVED' where user_id = $1`, [u]), /resuelve VARA/)
  })

  it('puede pedir revisión (DRAFT → PENDING_APPROVAL)', async () => {
    const u = await newUser(db)
    await newPartner(db, u, { active: false })
    const r = await updateAs(u, `update visit_partners set status = 'PENDING_APPROVAL' where user_id = $1`, [u])
    expect(r.affectedRows).toBe(1)
  })

  it('puede pausarse y reanudar, pero no salir de una suspensión', async () => {
    const u = await newUser(db)
    await newPartner(db, u)
    expect((await updateAs(u, `update visit_partners set status = 'PAUSED_BY_PARTNER' where user_id = $1`, [u])).affectedRows).toBe(1)
    expect((await updateAs(u, `update visit_partners set status = 'ACTIVE' where user_id = $1`, [u])).affectedRows).toBe(1)

    await asSystem(db)
    await db.query(`update visit_partners set status = 'SUSPENDED' where user_id = $1`, [u])
    await rejects(updateAs(u, `update visit_partners set status = 'ACTIVE' where user_id = $1`, [u]), /no permitida/)
  })

  it('NO puede certificarse en la capacitación; un admin sí, y queda espejado', async () => {
    const u = await newUser(db)
    const partnerId = await newPartner(db, u, { active: false })
    await rejects(updateAs(u, `update partner_training set certification_status = 'CERTIFIED' where partner_id = $1`, [partnerId]), /decisión de VARA/)
    await rejects(updateAs(u, `update partner_training set certification_date = now() where partner_id = $1`, [partnerId]), /fija VARA/)
    expect((await updateAs(u, `update partner_training set certification_status = 'IN_PROGRESS' where partner_id = $1`, [partnerId])).affectedRows).toBe(1)

    const admin = await newUser(db, 'admin')
    await makeAdmin(db, admin)
    await updateAs(admin,
      `update partner_training set certification_status = 'CERTIFIED', certification_date = now() where partner_id = $1`, [partnerId])
    await asSystem(db)
    const r = await db.query<{ certified: boolean }>(`select certified from visit_partners where id = $1`, [partnerId])
    expect(r.rows[0].certified).toBe(true)

    await rejects(updateAs(u, `update partner_training set certification_status = 'IN_PROGRESS' where partner_id = $1`, [partnerId]), /vigente/)
  })

  it('NO puede verificar sus propias referencias ni cargar referencias a otro partner', async () => {
    const u = await newUser(db)
    const partnerId = await newPartner(db, u, { active: false })
    await as(db, u)
    const ins = await db.query<{ id: string; status: string }>(
      `insert into partner_references (partner_id, user_id, name, relationship, status)
       values ($1, $2, 'Ana', 'amiga', 'VERIFIED') returning id, status`, [partnerId, u])
    expect(ins.rows[0].status).toBe('PENDING')
    const refId = ins.rows[0].id

    await rejects(updateAs(u, `update partner_references set status = 'VERIFIED' where id = $1`, [refId]), /resuelve VARA/)
    await rejects(updateAs(u, `update partner_references set answers = '{"isResponsible":true}' where id = $1`, [refId]), /carga VARA/)
    expect((await updateAs(u, `update partner_references set status = 'REQUESTED' where id = $1`, [refId])).affectedRows).toBe(1)

    const attacker = await newUser(db, 'attacker')
    await rejects(updateAs(attacker,
      `insert into partner_references (partner_id, user_id, name, relationship) values ($1, $2, 'Falso', 'x')`,
      [partnerId, attacker]), /no es tuyo/)
    await rejects(updateAs(attacker,
      `insert into partner_contacts (partner_id, user_id, phone) values ($1, $2, '111')`,
      [partnerId, attacker]), /no es tuyo/)
  })
})

describe('aprobación de partners', () => {
  it('un no-admin no puede aprobar', async () => {
    const u = await newUser(db)
    const partnerId = await newPartner(db, u, { active: false })
    await rejects(updateAs(u, `select public.admin_approve_partner($1)`, [partnerId]), /forbidden/)
  })

  it('un admin no puede activar a mano un partner nuevo: debe pasar por admin_approve_partner', async () => {
    const admin = await newUser(db, 'admin'); await makeAdmin(db, admin)
    const u = await newUser(db)
    const partnerId = await newPartner(db, u, { active: false })
    await rejects(updateAs(admin, `update visit_partners set status = 'ACTIVE' where id = $1`, [partnerId]), /admin_approve_partner/)
  })

  it('rechaza si faltan requisitos y aprueba cuando están todos', async () => {
    const admin = await newUser(db, 'admin'); await makeAdmin(db, admin)
    const u = await newUser(db)
    const partnerId = await newPartner(db, u, { active: false })

    await as(db, admin)
    const no = await db.query<{ r: { ok: boolean; missing: string[] } }>(
      `select public.admin_approve_partner($1) as r`, [partnerId])
    expect(no.rows[0].r.ok).toBe(false)
    expect(no.rows[0].r.missing).toEqual(expect.arrayContaining(['Identidad verificada', 'Entrevista aprobada']))

    await asSystem(db)
    await db.query(`update visit_partners set verified_identity = true, certified = true where id = $1`, [partnerId])
    await db.query(
      `insert into partner_verifications (partner_id, user_id, reference_check_status, interview_status, supervised_visits_completed)
       values ($1, $2, 'VERIFIED', 'VERIFIED', 3)`, [partnerId, u])

    await as(db, admin)
    const yes = await db.query<{ r: { ok: boolean } }>(`select public.admin_approve_partner($1) as r`, [partnerId])
    expect(yes.rows[0].r.ok).toBe(true)
    await asSystem(db)
    const st = await db.query<{ status: string }>(`select status from visit_partners where id = $1`, [partnerId])
    expect(st.rows[0].status).toBe('ACTIVE')
  })

  it('el partner no puede escribir su verificación', async () => {
    const u = await newUser(db)
    const partnerId = await newPartner(db, u, { active: false })
    await rejects(updateAs(u,
      `insert into partner_verifications (partner_id, user_id, identity_status) values ($1, $2, 'VERIFIED')`,
      [partnerId, u]), /row-level security/)
  })
})

// ─────────────────────── 3. Integridad de las reservas ───────────────────────

describe('reservas', () => {
  it('un tercero y un partner no asignado no ven la reserva', async () => {
    const s = await assigned()
    const stranger = await newUser(db)
    const otherPartnerUser = await newUser(db)
    await newPartner(db, otherPartnerUser)
    for (const uid of [stranger, otherPartnerUser]) {
      await as(db, uid)
      const r = await db.query(`select id from visit_bookings where id = $1`, [s.booking])
      expect(r.rows).toHaveLength(0)
    }
  })

  it('no se puede crear una reserva ya COMPLETED, ni con un partner inactivo, ni ASSIGNED sin partner', async () => {
    const client = await newUser(db)
    const p = await newUser(db)
    const activeId = await newPartner(db, p)
    const draftUser = await newUser(db)
    const draftId = await newPartner(db, draftUser, { active: false })

    await rejects(insertBooking(client, activeId, 'COMPLETED'), /no puede nacer/)
    await rejects(insertBooking(client, draftId, 'ASSIGNED'), /no está activo/)
    await rejects(insertBooking(client, null, 'ASSIGNED'), /requiere partner/)
    await rejects(insertBooking(client, activeId, 'SEARCHING_PARTNER'), /debe nacer ASSIGNED/)
  })

  it('el cliente no puede cambiar precio, partner ni saltar a COMPLETED; sí cancelar', async () => {
    const s = await assigned()
    await rejects(updateAs(s.client, `update visit_bookings set price = 0 where id = $1`, [s.booking]), /no se editan/)
    await rejects(updateAs(s.client, `update visit_bookings set assigned_partner_id = null where id = $1`, [s.booking]), /Solo VARA asigna/)
    await rejects(updateAs(s.client, `update visit_bookings set status = 'COMPLETED' where id = $1`, [s.booking]), /inválida/)
    await rejects(updateAs(s.client, `update visit_bookings set status = 'CONFIRMED' where id = $1`, [s.booking]), /no puede hacer esa transición/)

    const ok = await updateAs(s.client,
      `update visit_bookings set status = 'CANCELLED', cancellation_reason = 'cambio de planes' where id = $1`, [s.booking])
    expect(ok.affectedRows).toBe(1)
    await rejects(updateAs(s.client, `update visit_bookings set status = 'REQUESTED' where id = $1`, [s.booking]), /inválida/)
  })

  it('el partner no puede cambiar el precio, las instrucciones ni saltar pasos', async () => {
    const s = await confirmed()
    await rejects(updateAs(s.partnerUser, `update visit_bookings set price = 9999 where id = $1`, [s.booking]), /no se editan/)
    await rejects(updateAs(s.partnerUser, `update visit_bookings set instructions = 'x' where id = $1`, [s.booking]), /Solo quien pidió/)
    await rejects(updateAs(s.partnerUser, `update visit_bookings set status = 'COMPLETED' where id = $1`, [s.booking]), /inválida/)
    // CONFIRMED → ARRIVED existe en el grafo, pero sin check-in real no es una llegada.
    await rejects(updateAs(s.partnerUser, `update visit_bookings set status = 'ARRIVED' where id = $1`, [s.booking]), /no puede hacer esa transición/)
    await rejects(updateAs(s.partnerUser, `update visit_bookings set status = 'INCIDENT_REVIEW' where id = $1`, [s.booking]), /no puede hacer esa transición/)
  })

  it('un partner activo que no es el asignado no puede tocar la reserva', async () => {
    const s = await assigned()
    const other = await newUser(db)
    await newPartner(db, other)
    const r = await updateAs(other, `update visit_bookings set status = 'CONFIRMED' where id = $1`, [s.booking])
    expect(r.affectedRows).toBe(0)
  })

  it('el partner rechaza con reject_assignment (no por update directo) y la visita vuelve a buscarse', async () => {
    const s = await assigned()
    await as(db, s.client)
    await db.query(`insert into visit_assignments (booking_id, partner_id) values ($1, $2)`, [s.booking, s.partnerId])

    await rejects(updateAs(s.partnerUser,
      `update visit_bookings set status = 'SEARCHING_PARTNER', assigned_partner_id = null where id = $1`, [s.booking]), /reject_assignment/)

    const stranger = await newUser(db)
    await rejects(updateAs(stranger, `select public.reject_assignment($1, 'x')`, [s.booking]), /forbidden/)
    await rejects(updateAs(s.client, `select public.reject_assignment($1, 'x')`, [s.booking]), /forbidden/)

    await updateAs(s.partnerUser, `select public.reject_assignment($1, 'no llego')`, [s.booking])
    await asSystem(db)
    const b = await db.query<{ status: string; assigned_partner_id: string | null }>(
      `select status, assigned_partner_id from visit_bookings where id = $1`, [s.booking])
    expect(b.rows[0]).toEqual({ status: 'SEARCHING_PARTNER', assigned_partner_id: null })
    const a = await db.query<{ rejected_at: string | null; rejection_reason: string }>(
      `select rejected_at, rejection_reason from visit_assignments where booking_id = $1`, [s.booking])
    expect(a.rows[0].rejected_at).not.toBeNull()
    expect(a.rows[0].rejection_reason).toBe('no llego')
  })

  it('no se puede rechazar una visita que ya confirmaste', async () => {
    const s = await confirmed()
    await rejects(updateAs(s.partnerUser, `select public.reject_assignment($1)`, [s.booking]), /asignación pendiente/)
  })

  it('un admin asigna a un partner activo, pero no a uno inactivo', async () => {
    const admin = await newUser(db, 'admin'); await makeAdmin(db, admin)
    const client = await newUser(db)
    const booking = await newBooking(db, client, null)
    const p = await newUser(db)
    const activeId = await newPartner(db, p)
    const d = await newUser(db)
    const draftId = await newPartner(db, d, { active: false })

    await rejects(updateAs(admin,
      `update visit_bookings set assigned_partner_id = $2, status = 'ASSIGNED' where id = $1`, [booking, draftId]), /no está activo/)
    const ok = await updateAs(admin,
      `update visit_bookings set assigned_partner_id = $2, status = 'ASSIGNED' where id = $1`, [booking, activeId])
    expect(ok.affectedRows).toBe(1)
  })

  it('el cliente no puede registrar una asignación a un partner que no eligió', async () => {
    const s = await assigned()
    const otherUser = await newUser(db)
    const otherPartner = await newPartner(db, otherUser)
    await rejects(updateAs(s.client,
      `insert into visit_assignments (booking_id, partner_id) values ($1, $2)`, [s.booking, otherPartner]), /row-level security/)
    const ok = await updateAs(s.client,
      `insert into visit_assignments (booking_id, partner_id) values ($1, $2)`, [s.booking, s.partnerId])
    expect(ok.affectedRows).toBe(1)
  })
})

// ─────────────────────── 4. PIN ───────────────────────

describe('PIN', () => {
  it('nadie lee la tabla de PIN: ni cliente, ni partner, ni anónimo', async () => {
    const s = await assigned()
    await rejects(updateAs(s.partnerUser, `select pin from visit_pins`, []), /permission denied/)
    await rejects(updateAs(s.client, `select pin from visit_pins`, []), /permission denied/)
    await asAnon(db)
    await rejects(db.query(`select pin from visit_pins`), /permission denied/)
  })

  it('el partner asignado no puede leer el PIN de ninguna forma', async () => {
    const s = await assigned()
    await rejects(updateAs(s.partnerUser, `select confirmation_pin from visit_bookings where id = $1`, [s.booking]), /does not exist/)
    await rejects(updateAs(s.partnerUser, `select public.get_booking_pin($1)`, [s.booking]), /forbidden/)
  })

  it('solo el cliente dueño obtiene su PIN, y queda auditado', async () => {
    const s = await assigned()
    const stranger = await newUser(db)
    await rejects(updateAs(stranger, `select public.get_booking_pin($1)`, [s.booking]), /forbidden/)

    await as(db, s.client)
    const r = await db.query<{ pin: string }>(`select public.get_booking_pin($1) as pin`, [s.booking])
    expect(r.rows[0].pin).toMatch(/^[0-9]{4}$/)
    expect(r.rows[0].pin).toBe(await pinOf(db, s.booking))
  })

  it('anónimo no puede llamar a las RPC de PIN', async () => {
    const s = await assigned()
    await asAnon(db)
    await rejects(db.query(`select public.get_booking_pin($1)`, [s.booking]), /permission denied/)
    await rejects(db.query(`select public.verify_visit_pin($1, '0000')`, [s.booking]), /permission denied/)
  })

  it('no se verifica el PIN sin check-in, ni por otro partner, ni con la reserva sin confirmar', async () => {
    const s = await confirmed()
    const pin = await pinOf(db, s.booking)
    expect((await verify(s.partnerUser, s.booking, pin)).reason).toBe('NOT_CHECKED_IN')

    const other = await newUser(db)
    await newPartner(db, other)
    await rejects(verify(other, s.booking, pin), /forbidden/)

    const s2 = await assigned()
    expect((await verify(s2.partnerUser, s2.booking, await pinOf(db, s2.booking))).reason).toBe('NOT_READY')
  })

  it('fuerza bruta: a los 3 errores se bloquea, aunque después se mande el PIN correcto', async () => {
    const s = await checkedIn()
    const real = await pinOf(db, s.booking)
    const bad = wrongPin(real)

    expect(await verify(s.partnerUser, s.booking, bad)).toMatchObject({ ok: false, reason: 'WRONG_PIN', attemptsLeft: 2 })
    expect(await verify(s.partnerUser, s.booking, bad)).toMatchObject({ ok: false, reason: 'WRONG_PIN', attemptsLeft: 1 })
    expect(await verify(s.partnerUser, s.booking, bad)).toMatchObject({ ok: false, reason: 'TOO_MANY_ATTEMPTS', attemptsLeft: 0 })
    expect(await verify(s.partnerUser, s.booking, real)).toMatchObject({ ok: false, reason: 'TOO_MANY_ATTEMPTS' })

    await asSystem(db)
    const sess = await db.query<{ pin_attempts: number; confirmation_pin_status: string }>(
      `select pin_attempts, confirmation_pin_status from visit_sessions where booking_id = $1`, [s.booking])
    expect(sess.rows[0]).toEqual({ pin_attempts: 3, confirmation_pin_status: 'FAILED' })
  })

  it('un PIN mal escrito no consume intentos', async () => {
    const s = await checkedIn()
    expect(await verify(s.partnerUser, s.booking, 'abcd')).toMatchObject({ ok: false, reason: 'MALFORMED', attemptsLeft: 3 })
    expect(await verify(s.partnerUser, s.booking, '12')).toMatchObject({ reason: 'MALFORMED', attemptsLeft: 3 })
  })

  it('el partner no puede marcar el PIN como confirmado ni arrancar la visita sin él', async () => {
    const s = await checkedIn()
    await verify(s.partnerUser, s.booking, wrongPin(await pinOf(db, s.booking)))
    await rejects(updateAs(s.partnerUser,
      `update visit_sessions set confirmation_pin_status = 'CONFIRMED' where booking_id = $1`, [s.booking]), /verify_visit_pin/)
    // Resetear el contador de intentos es exactamente el ataque de fuerza bruta.
    await rejects(updateAs(s.partnerUser,
      `update visit_sessions set pin_attempts = 0 where booking_id = $1`, [s.booking]), /verify_visit_pin/)
    await rejects(updateAs(s.partnerUser,
      `update visit_sessions set status = 'IN_PROGRESS' where booking_id = $1`, [s.booking]), /sin PIN confirmado/)
  })

  it('después de un bloqueo, un admin resetea y el PIN nuevo funciona', async () => {
    const s = await checkedIn()
    const real = await pinOf(db, s.booking)
    for (let i = 0; i < 3; i++) await verify(s.partnerUser, s.booking, wrongPin(real))
    expect((await verify(s.partnerUser, s.booking, real)).ok).toBe(false)

    await rejects(updateAs(s.partnerUser, `select public.admin_reset_pin($1)`, [s.booking]), /forbidden/)
    await rejects(updateAs(s.client, `select public.admin_reset_pin($1)`, [s.booking]), /forbidden/)

    const admin = await newUser(db, 'admin'); await makeAdmin(db, admin)
    await updateAs(admin, `select public.admin_reset_pin($1)`, [s.booking])
    const fresh = await pinOf(db, s.booking)
    expect((await verify(s.partnerUser, s.booking, fresh)).ok).toBe(true)
  })

  it('un PIN confirmado no se puede volver a usar para "reconfirmar" otra visita', async () => {
    const a = await checkedIn()
    const b = await checkedIn()
    const pinA = await pinOf(db, a.booking)
    // El PIN de A no sirve en B (salvo que casualmente coincidan, que se descarta).
    const pinB = await pinOf(db, b.booking)
    if (pinA !== pinB) {
      expect((await verify(b.partnerUser, b.booking, pinA)).ok).toBe(false)
    }
  })
})

// ─────────────────────── 5. Sesión: check-in / check-out ───────────────────────

describe('sesión', () => {
  it('no se puede hacer check-in con la reserva sin confirmar', async () => {
    const s = await assigned()
    await as(db, s.partnerUser)
    await db.query(`insert into visit_sessions (booking_id, partner_id) values ($1, $2)`, [s.booking, s.partnerId])
    await rejects(db.query(`update visit_sessions set status = 'CHECKED_IN' where booking_id = $1`, [s.booking]), /check-in con la reserva/)
  })

  it('solo el partner asignado abre la sesión', async () => {
    const s = await confirmed()
    const other = await newUser(db)
    const otherId = await newPartner(db, other)
    await rejects(updateAs(other,
      `insert into visit_sessions (booking_id, partner_id) values ($1, $2)`, [s.booking, otherId]), /row-level security|Solo el partner asignado/)
    await rejects(updateAs(s.client,
      `insert into visit_sessions (booking_id, partner_id) values ($1, $2)`, [s.booking, s.partnerId]), /row-level security|Solo el partner asignado/)
  })

  it('una sesión nueva no puede nacer con el PIN o el check-in ya cargados', async () => {
    const s = await confirmed()
    await as(db, s.partnerUser)
    const r = await db.query<{ status: string; confirmation_pin_status: string; check_in_at: string | null }>(
      `insert into visit_sessions (booking_id, partner_id, status, confirmation_pin_status, check_in_at)
       values ($1, $2, 'IN_PROGRESS', 'CONFIRMED', '2000-01-01')
       returning status, confirmation_pin_status, check_in_at`, [s.booking, s.partnerId])
    expect(r.rows[0]).toEqual({ status: 'NOT_STARTED', confirmation_pin_status: 'PENDING', check_in_at: null })
  })

  it('la hora de check-in y check-out la pone el servidor, no el cliente', async () => {
    const s = await confirmed()
    await as(db, s.partnerUser)
    await db.query(`insert into visit_sessions (booking_id, partner_id) values ($1, $2)`, [s.booking, s.partnerId])
    const ci = await db.query<{ check_in_at: Date }>(
      `update visit_sessions set status = 'CHECKED_IN', check_in_at = '2000-01-01T00:00:00Z'
        where booking_id = $1 returning check_in_at`, [s.booking])
    expect(new Date(ci.rows[0].check_in_at).getFullYear()).toBeGreaterThan(2020)

    await db.query(`update visit_bookings set status = 'ARRIVED' where id = $1`, [s.booking])
    const pin = await pinOf(db, s.booking)
    expect((await verify(s.partnerUser, s.booking, pin)).ok).toBe(true)
    await as(db, s.partnerUser)
    await db.query(`update visit_sessions set status = 'IN_PROGRESS' where booking_id = $1`, [s.booking])
    const co = await db.query<{ check_out_at: Date; duration_minutes: number }>(
      `update visit_sessions set status = 'CHECKED_OUT', check_out_at = '2000-01-01', duration_minutes = 9999
        where booking_id = $1 returning check_out_at, duration_minutes`, [s.booking])
    expect(new Date(co.rows[0].check_out_at).getFullYear()).toBeGreaterThan(2020)
    expect(co.rows[0].duration_minutes).toBeLessThan(5)
  })

  it('no se puede reescribir el check-in una vez hecho', async () => {
    const s = await checkedIn()
    await rejects(updateAs(s.partnerUser,
      `update visit_sessions set check_in_at = '2000-01-01' where booking_id = $1`, [s.booking]), /solo cambian con la transición/)
  })

  it('el checklist solo se edita durante la visita', async () => {
    const s = await confirmed()
    await as(db, s.partnerUser)
    await db.query(`insert into visit_sessions (booking_id, partner_id) values ($1, $2)`, [s.booking, s.partnerId])
    await rejects(db.query(`update visit_sessions set checklist_state = '{"identity":true}' where booking_id = $1`, [s.booking]), /durante la visita/)
  })

  it('el cliente no escribe en la sesión', async () => {
    const s = await checkedIn()
    const r = await updateAs(s.client, `update visit_sessions set status = 'CHECKED_OUT' where booking_id = $1`, [s.booking])
    expect(r.affectedRows).toBe(0)
  })
})

// ─────────────────────── 6. Recorrido legítimo + auditoría ───────────────────────

describe('visita completa', () => {
  it('el camino legítimo funciona de punta a punta y deja rastro auditable', async () => {
    const s = await completed()

    await asSystem(db)
    const b = await db.query<{ status: string }>(`select status from visit_bookings where id = $1`, [s.booking])
    expect(b.rows[0].status).toBe('COMPLETED')

    await as(db, s.partnerUser)
    const rep = await db.query(
      `insert into visit_reports (booking_id, partner_id, attendees_count, rooms_shown) values ($1, $2, 2, '{living}')`,
      [s.booking, s.partnerId])
    expect(rep.affectedRows).toBe(1)

    await as(db, s.client)
    await db.query(
      `insert into partner_reviews (booking_id, reviewer_user_id, partner_id, punctuality, professionalism,
         communication, knowledge, report_quality, overall_rating)
       values ($1, $2, $3, 5, 5, 5, 5, 5, 5)`, [s.booking, s.client, s.partnerId])

    await asSystem(db)
    const p = await db.query<{ review_count: number; rating_sum: string }>(
      `select review_count, rating_sum from visit_partners where id = $1`, [s.partnerId])
    expect(p.rows[0].review_count).toBe(1)
    expect(Number(p.rows[0].rating_sum)).toBe(5)

    const admin = await newUser(db, 'admin'); await makeAdmin(db, admin)
    await as(db, admin)
    const audit = await db.query<{ action: string }>(
      `select action from audit_events where booking_id = $1 order by id`, [s.booking])
    const actions = audit.rows.map(r => r.action)
    expect(actions).toEqual(expect.arrayContaining(
      ['BOOKING_CREATED', 'BOOKING_STATUS', 'SESSION_STATUS', 'PIN_CONFIRMED', 'PARTNER_REVIEWED']))

    await as(db, s.client)
    const mine = await db.query(`select * from audit_events`)
    expect(mine.rows).toHaveLength(0)
  })
})

// ─────────────────────── 7. Reportes y reseñas ───────────────────────

describe('reportes y reseñas', () => {
  it('un tercero no puede calificar a un partner', async () => {
    const s = await completed()
    const stranger = await newUser(db)
    await rejects(updateAs(stranger,
      `insert into partner_reviews (booking_id, reviewer_user_id, partner_id, punctuality, professionalism,
         communication, knowledge, report_quality, overall_rating)
       values ($1, $2, $3, 1, 1, 1, 1, 1, 1)`, [s.booking, stranger, s.partnerId]), /row-level security/)
  })

  it('el cliente no puede calificar antes de que la visita esté COMPLETED', async () => {
    const s = await confirmed()
    await rejects(updateAs(s.client,
      `insert into partner_reviews (booking_id, reviewer_user_id, partner_id, punctuality, professionalism,
         communication, knowledge, report_quality, overall_rating)
       values ($1, $2, $3, 5, 5, 5, 5, 5, 5)`, [s.booking, s.client, s.partnerId]), /row-level security/)
  })

  it('el partner no puede calificarse a sí mismo, ni cliente editar su reseña después', async () => {
    const s = await completed()
    await rejects(updateAs(s.partnerUser,
      `insert into partner_reviews (booking_id, reviewer_user_id, partner_id, punctuality, professionalism,
         communication, knowledge, report_quality, overall_rating)
       values ($1, $2, $3, 5, 5, 5, 5, 5, 5)`, [s.booking, s.partnerUser, s.partnerId]), /row-level security/)

    await as(db, s.client)
    await db.query(
      `insert into partner_reviews (booking_id, reviewer_user_id, partner_id, punctuality, professionalism,
         communication, knowledge, report_quality, overall_rating)
       values ($1, $2, $3, 3, 3, 3, 3, 3, 3)`, [s.booking, s.client, s.partnerId])
    const upd = await db.query(`update partner_reviews set overall_rating = 5 where booking_id = $1`, [s.booking])
    expect(upd.affectedRows).toBe(0)
    await rejects(db.query(
      `insert into partner_reviews (booking_id, reviewer_user_id, partner_id, punctuality, professionalism,
         communication, knowledge, report_quality, overall_rating)
       values ($1, $2, $3, 5, 5, 5, 5, 5, 5)`, [s.booking, s.client, s.partnerId]), /duplicate|unique/)
  })

  it('otro partner no puede escribir el reporte ni la reseña del cliente de una visita ajena', async () => {
    const s = await completed()
    const other = await newUser(db)
    const otherId = await newPartner(db, other)
    await rejects(updateAs(other,
      `insert into visit_reports (booking_id, partner_id) values ($1, $2)`, [s.booking, otherId]), /row-level security/)
    await rejects(updateAs(other,
      `insert into client_reviews (booking_id, partner_id, client_user_id, punctuality, respect, communication)
       values ($1, $2, $3, 1, 1, 1)`, [s.booking, otherId, s.client]), /row-level security/)
  })

  it('no hay reporte hasta que la visita arrancó', async () => {
    const s = await confirmed()
    await rejects(updateAs(s.partnerUser,
      `insert into visit_reports (booking_id, partner_id) values ($1, $2)`, [s.booking, s.partnerId]), /row-level security/)
  })
})

// ─────────────────────── 8. Incidentes ───────────────────────

describe('incidentes', () => {
  it('quien no participa de la visita no puede reportarla', async () => {
    const s = await assigned()
    const stranger = await newUser(db)
    await rejects(updateAs(stranger,
      `insert into safety_incidents (booking_id, reported_by_user_id, reported_user_id, category, severity, description)
       values ($1, $2, $3, 'SAFETY', 'LEVEL_3_CRITICAL', 'falso')`, [s.booking, stranger, s.partnerUser]), /participan/)
  })

  it('no se puede apuntar a una persona sin reserva (vector de suspensión arbitraria)', async () => {
    const s = await assigned()
    const attacker = await newUser(db)
    await rejects(updateAs(attacker,
      `insert into safety_incidents (reported_by_user_id, reported_user_id, category, severity, description)
       values ($1, $2, 'SAFETY', 'LEVEL_3_CRITICAL', 'falso')`, [attacker, s.partnerUser]), /sin reserva/)
    await asSystem(db)
    const p = await db.query<{ status: string }>(`select status from visit_partners where id = $1`, [s.partnerId])
    expect(p.rows[0].status).toBe('ACTIVE')
  })

  it('un participante solo puede reportar a la contraparte de SU visita', async () => {
    const s = await assigned()
    const otherUser = await newUser(db)
    await newPartner(db, otherUser)
    await rejects(updateAs(s.client,
      `insert into safety_incidents (booking_id, reported_by_user_id, reported_user_id, category, severity, description)
       values ($1, $2, $3, 'SAFETY', 'LEVEL_3_CRITICAL', 'otro partner')`, [s.booking, s.client, otherUser]), /contraparte/)
  })

  it('un incidente crítico real suspende al partner y congela la visita; el reportado no lo ve', async () => {
    const s = await confirmed()
    await as(db, s.client)
    const ins = await db.query<{ id: string; status: string; resolution: string | null }>(
      `insert into safety_incidents (booking_id, reported_by_user_id, reported_user_id, category, severity, description,
         status, resolution)
       values ($1, $2, $3, 'SAFETY', 'LEVEL_3_CRITICAL', 'situación real', 'CLOSED', 'me autoresuelvo')
       returning id, status, resolution`, [s.booking, s.client, s.partnerUser])
    expect(ins.rows[0].status).toBe('OPEN')
    expect(ins.rows[0].resolution).toBeNull()

    await asSystem(db)
    const p = await db.query<{ status: string; incident_count: number }>(
      `select status, incident_count from visit_partners where id = $1`, [s.partnerId])
    expect(p.rows[0]).toEqual({ status: 'SUSPENDED', incident_count: 1 })
    const b = await db.query<{ status: string }>(`select status from visit_bookings where id = $1`, [s.booking])
    expect(b.rows[0].status).toBe('INCIDENT_REVIEW')

    await as(db, s.partnerUser)
    expect((await db.query(`select id from safety_incidents`)).rows).toHaveLength(0)

    await as(db, s.client)
    expect((await db.query(`select id from safety_incidents`)).rows).toHaveLength(1)
    const upd = await db.query(`update safety_incidents set status = 'DISMISSED' where id = $1`, [ins.rows[0].id])
    expect(upd.affectedRows).toBe(0)
  })

  it('el partner suspendido no recibe visitas nuevas', async () => {
    const s = await confirmed()
    await updateAs(s.client,
      `insert into safety_incidents (booking_id, reported_by_user_id, reported_user_id, category, severity, description)
       values ($1, $2, $3, 'SAFETY', 'LEVEL_3_CRITICAL', 'real')`, [s.booking, s.client, s.partnerUser])
    const next = await newUser(db)
    await rejects(insertBooking(next, s.partnerId, 'ASSIGNED'), /no está activo/)
  })
})

// ─────────────────────── 9. Auditoría y telemetría ───────────────────────

describe('auditoría y telemetría', () => {
  it('audit_events es append-only, incluso para el dueño', async () => {
    await completed()
    await asSystem(db)
    await rejects(db.query(`update audit_events set action = 'x'`), /append-only/)
    await rejects(db.query(`delete from audit_events`), /append-only/)
    await rejects(db.query(`truncate audit_events`), /append-only/)
  })

  it('la API no puede escribir en audit_events', async () => {
    const u = await newUser(db)
    await rejects(updateAs(u,
      `insert into audit_events (action, entity_type) values ('FAKE', 'x')`, []), /permission denied/)
  })

  it('visit_events solo se escribe a nombre propio', async () => {
    const a = await newUser(db)
    const b = await newUser(db)
    await rejects(updateAs(a, `insert into visit_events (name, user_id) values ('visit_completed', $1)`, [b]), /row-level security/)
    const ok = await updateAs(a, `insert into visit_events (name, user_id) values ('visit_requested', $1)`, [a])
    expect(ok.affectedRows).toBe(1)
  })

  it('recompute_partner_tier ya no es una RPC pública', async () => {
    const s = await assigned()
    await rejects(updateAs(s.client, `select public.recompute_partner_tier($1)`, [s.partnerId]), /does not exist/)
  })

  it('el partner no ve los contactos privados de otro partner', async () => {
    const a = await newUser(db)
    const aId = await newPartner(db, a)
    await asSystem(db)
    await db.query(`insert into partner_contacts (partner_id, user_id, phone, address_line) values ($1, $2, '+54 11 5555', 'Calle 1')`, [aId, a])
    const b = await newUser(db)
    await newPartner(db, b)
    await as(db, b)
    expect((await db.query(`select * from partner_contacts`)).rows).toHaveLength(0)
  })
})
