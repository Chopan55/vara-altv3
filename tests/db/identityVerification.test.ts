/**
 * Trust Passport: verificación de identidad, contra Postgres real (PGlite).
 * Nadie se verifica solo; la contraparte ve señales, no archivos.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest'
import { createDb, as, asSystem, asAnon, newUser, makeAdmin, rejects, type Db } from './harness'

vi.setConfig({ testTimeout: 30_000 })

let db: Db

beforeAll(async () => {
  db = await createDb([
    '20260926000001_operation_participants.sql',
    '20261104000000_operation_sharing.sql',
    '20261105000000_identity_verification.sql',
  ])
}, 120_000)

async function submit(uid: string) {
  await as(db, uid)
  await db.query(
    `insert into identity_verifications (user_id, document_path, selfie_path) values ($1, $2, $3)`,
    [uid, `${uid}/dni.jpg`, `${uid}/selfie.jpg`])
}

async function statusOf(uid: string) {
  await asSystem(db)
  return (await db.query<{ status: string; rejection_reason: string | null; reviewed_by: string | null }>(
    `select status, rejection_reason, reviewed_by from identity_verifications where user_id = $1`, [uid])).rows[0]
}

describe('verificación de identidad', () => {
  it('el usuario envía; no puede insertarse ni marcarse verificado', async () => {
    const u = await newUser(db)
    await as(db, u)
    await rejects(db.query(
      `insert into identity_verifications (user_id, status, document_path, selfie_path) values ($1, 'VERIFIED', 'a', 'b')`, [u]))
    await submit(u)
    await rejects(db.query(`update identity_verifications set status = 'VERIFIED' where user_id = $1`, [u]), /decide VARA/)
    await rejects(db.query(`update identity_verifications set reviewed_by = $1 where user_id = $1`, [u]), /decide VARA/)
    expect((await statusOf(u)).status).toBe('SUBMITTED')
  })

  it('el admin aprueba y queda registrado quién revisó', async () => {
    const u = await newUser(db)
    const admin = await newUser(db, 'admin'); await makeAdmin(db, admin)
    await submit(u)
    await as(db, admin)
    await db.query(`update identity_verifications set status = 'VERIFIED' where user_id = $1`, [u])
    const s = await statusOf(u)
    expect(s.status).toBe('VERIFIED')
    expect(s.reviewed_by).toBe(admin)
    // Una vez verificado, el usuario no lo puede tocar.
    await as(db, u)
    await rejects(db.query(`update identity_verifications set document_path = 'x' where user_id = $1`, [u]), /ya está verificada/)
  })

  it('rechazado: el usuario reenvía y el motivo anterior se limpia', async () => {
    const u = await newUser(db)
    const admin = await newUser(db, 'admin'); await makeAdmin(db, admin)
    await submit(u)
    await as(db, admin)
    await db.query(`update identity_verifications set status = 'REJECTED', rejection_reason = 'Foto borrosa' where user_id = $1`, [u])
    expect((await statusOf(u)).rejection_reason).toBe('Foto borrosa')
    await as(db, u)
    await db.query(`update identity_verifications set status = 'SUBMITTED', document_path = $2 where user_id = $1`, [u, `${u}/dni2.jpg`])
    const s = await statusOf(u)
    expect(s).toMatchObject({ status: 'SUBMITTED', rejection_reason: null })
  })

  it('un tercero no ve la verificación de otro', async () => {
    const u = await newUser(db)
    const other = await newUser(db)
    await submit(u)
    await as(db, other)
    expect((await db.query(`select * from identity_verifications where user_id = $1`, [u])).rows).toHaveLength(0)
  })
})

describe('pasaporte en una operación compartida', () => {
  async function sharedOp() {
    const owner = await newUser(db, 'owner')
    const guest = await newUser(db, 'guest')
    const outsider = await newUser(db, 'outsider')
    const admin = await newUser(db, 'admin'); await makeAdmin(db, admin)
    await asSystem(db)
    await db.query(`update auth.users set email_confirmed_at = now() where id = $1`, [owner])
    const guestEmail = (await db.query<{ email: string }>(`select email from auth.users where id = $1`, [guest])).rows[0].email
    await as(db, owner)
    const op = (await db.query<{ id: string }>(
      `insert into operations (user_id, type, title) values ($1, 'SELL_PROPERTY', 'Casa') returning id`, [owner])).rows[0].id
    const token = (await db.query<{ invite_token: string }>(
      `insert into operation_members (operation_id, owner_id, invited_email, role) values ($1, $2, $3, 'COUNTERPARTY') returning invite_token`,
      [op, owner, guestEmail])).rows[0].invite_token
    await as(db, guest)
    await db.query(`select public.accept_operation_invite($1)`, [token])
    await submit(owner)
    await as(db, admin)
    await db.query(`update identity_verifications set status = 'VERIFIED' where user_id = $1`, [owner])
    return { owner, guest, outsider, op }
  }

  async function trust(uid: string, op: string) {
    await as(db, uid)
    return (await db.query<{ r: Record<string, unknown>[] | null }>(`select public.get_operation_trust($1) as r`, [op])).rows[0].r
  }

  it('el invitado ve las señales del dueño, sin archivos ni datos de contacto', async () => {
    const { owner, guest, op } = await sharedOp()
    const list = (await trust(guest, op))!
    const ownerRow = list.find(x => x.userId === owner)!
    expect(ownerRow).toMatchObject({ isOwner: true, emailVerified: true, identityVerified: true })
    expect(JSON.stringify(list)).not.toMatch(/dni|selfie|@test\.local|document_path/)
    expect(list.find(x => x.userId === guest)).toMatchObject({ role: 'COUNTERPARTY', identityVerified: false })
  })

  it('el dueño también ve al invitado; un tercero o anónimo no ve nada', async () => {
    const { owner, outsider, op } = await sharedOp()
    expect((await trust(owner, op))!.length).toBe(2)
    expect(await trust(outsider, op)).toBeNull()
    await asAnon(db)
    await rejects(db.query(`select public.get_operation_trust($1)`, [op]))
  })
})
