/**
 * Acceso compartido a una operación, contra Postgres real (PGlite).
 *
 * Lo que tiene que valer siempre: solo entra quien tiene el token Y el email
 * invitado; un miembro lee campos seguros y nada más; nadie se agrega solo.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest'
import { createDb, as, asSystem, asAnon, newUser, rejects, type Db } from './harness'

vi.setConfig({ testTimeout: 30_000 })

let db: Db

beforeAll(async () => {
  db = await createDb(['20260926000001_operation_participants.sql', '20261104000000_operation_sharing.sql'])
}, 120_000)

async function emailOf(uid: string): Promise<string> {
  await asSystem(db)
  return (await db.query<{ email: string }>(`select email from auth.users where id = $1`, [uid])).rows[0].email
}

async function newOperation(owner: string): Promise<string> {
  await as(db, owner)
  const r = await db.query<{ id: string }>(
    `insert into operations (user_id, type, title, province) values ($1, 'SELL_PROPERTY', 'Casa en Pilar', 'Buenos Aires') returning id`, [owner])
  const id = r.rows[0].id
  await db.query(
    `insert into operation_documents (user_id, operation_id, name, status, notes, storage_path)
     values ($1, $2, 'Escritura', 'RECEIVED', 'nota privada del dueño', 'u/secret.pdf')`, [owner, id])
  return id
}

async function invite(owner: string, operationId: string, email: string, role = 'COUNTERPARTY') {
  await as(db, owner)
  const r = await db.query<{ id: string; invite_token: string }>(
    `insert into operation_members (operation_id, owner_id, invited_email, role) values ($1, $2, $3, $4)
     returning id, invite_token`, [operationId, owner, email, role])
  return r.rows[0]
}

async function accept(uid: string, token: string) {
  await as(db, uid)
  return (await db.query<{ r: { ok: boolean; reason?: string; operationId?: string } }>(
    `select public.accept_operation_invite($1) as r`, [token])).rows[0].r
}

async function shared(uid: string, operationId: string) {
  await as(db, uid)
  return (await db.query<{ r: Record<string, unknown> | null }>(
    `select public.get_shared_operation($1) as r`, [operationId])).rows[0].r
}

describe('invitar y aceptar', () => {
  it('el invitado con el email correcto entra y ve solo campos seguros', async () => {
    const owner = await newUser(db, 'owner')
    const guest = await newUser(db, 'guest')
    const op = await newOperation(owner)
    const inv = await invite(owner, op, await emailOf(guest))

    expect(await accept(guest, inv.invite_token)).toEqual({ ok: true, operationId: op })

    const view = await shared(guest, op) as { role: string; operation: Record<string, unknown>; documents: Record<string, unknown>[] }
    expect(view.role).toBe('COUNTERPARTY')
    expect(view.operation.title).toBe('Casa en Pilar')
    expect(view.documents).toHaveLength(1)
    expect(view.documents[0]).toMatchObject({ name: 'Escritura', status: 'RECEIVED' })
    expect(JSON.stringify(view)).not.toMatch(/nota privada|secret\.pdf/)

    // Aceptar dos veces es idempotente.
    expect((await accept(guest, inv.invite_token)).ok).toBe(true)
  })

  it('el miembro sigue sin poder leer ni escribir las tablas de la operación', async () => {
    const owner = await newUser(db, 'owner')
    const guest = await newUser(db, 'guest')
    const op = await newOperation(owner)
    await accept(guest, (await invite(owner, op, await emailOf(guest))).invite_token)

    await as(db, guest)
    expect((await db.query(`select * from operations where id = $1`, [op])).rows).toHaveLength(0)
    expect((await db.query(`select * from operation_documents where operation_id = $1`, [op])).rows).toHaveLength(0)
    expect((await db.query(`update operations set title = 'x' where id = $1`, [op])).affectedRows).toBe(0)
  })

  it('con otro email no entra, aunque tenga el token', async () => {
    const owner = await newUser(db, 'owner')
    const intruder = await newUser(db, 'intruder')
    const op = await newOperation(owner)
    const inv = await invite(owner, op, 'otra-persona@test.local')

    expect(await accept(intruder, inv.invite_token)).toMatchObject({ ok: false, reason: 'EMAIL_MISMATCH' })
    expect(await shared(intruder, op)).toBeNull()
  })

  it('un token usado no sirve para otra cuenta, y uno revocado no sirve para nadie', async () => {
    const owner = await newUser(db, 'owner')
    const guest = await newUser(db, 'guest')
    const other = await newUser(db, 'other')
    const op = await newOperation(owner)
    const inv = await invite(owner, op, await emailOf(guest))
    await accept(guest, inv.invite_token)
    expect(await accept(other, inv.invite_token)).toMatchObject({ ok: false })

    const inv2 = await invite(owner, op, await emailOf(other))
    await as(db, owner)
    await db.query(`update operation_members set revoked_at = now() where id = $1`, [inv2.id])
    expect(await accept(other, inv2.invite_token)).toMatchObject({ ok: false, reason: 'INVALID' })
  })

  it('revocar corta el acceso de un miembro que ya había entrado', async () => {
    const owner = await newUser(db, 'owner')
    const guest = await newUser(db, 'guest')
    const op = await newOperation(owner)
    const inv = await invite(owner, op, await emailOf(guest))
    await accept(guest, inv.invite_token)
    await as(db, owner)
    await db.query(`update operation_members set revoked_at = now() where id = $1`, [inv.id])
    expect(await shared(guest, op)).toBeNull()
  })

  it('anónimo no puede aceptar ni leer', async () => {
    const owner = await newUser(db, 'owner')
    const op = await newOperation(owner)
    const inv = await invite(owner, op, 'x@test.local')
    await asAnon(db)
    await rejects(db.query(`select public.accept_operation_invite($1)`, [inv.invite_token]))
    await rejects(db.query(`select public.get_shared_operation($1)`, [op]))
  })
})

describe('nadie se agrega solo', () => {
  it('no se puede invitar a una operación ajena', async () => {
    const owner = await newUser(db, 'owner')
    const attacker = await newUser(db, 'attacker')
    const op = await newOperation(owner)
    await rejects(invite(attacker, op, await emailOf(attacker)))
  })

  it('no se puede crear una invitación ya aceptada', async () => {
    const owner = await newUser(db, 'owner')
    const op = await newOperation(owner)
    await as(db, owner)
    await rejects(db.query(
      `insert into operation_members (operation_id, owner_id, invited_email, member_user_id, accepted_at)
       values ($1, $2, 'a@test.local', $2, now())`, [op, owner]))
  })

  it('el dueño no puede asignar un miembro ni cambiar el token por update', async () => {
    const owner = await newUser(db, 'owner')
    const someone = await newUser(db, 'someone')
    const op = await newOperation(owner)
    const inv = await invite(owner, op, 'a@test.local')
    await as(db, owner)
    await rejects(db.query(`update operation_members set member_user_id = $1 where id = $2`, [someone, inv.id]), /rol o revocar/)
    await rejects(db.query(`update operation_members set invite_token = gen_random_uuid() where id = $1`, [inv.id]), /rol o revocar/)
    expect((await db.query(`update operation_members set role = 'NOTARY' where id = $1`, [inv.id])).affectedRows).toBe(1)
  })

  it('un tercero no ve las invitaciones (ni sus tokens)', async () => {
    const owner = await newUser(db, 'owner')
    const third = await newUser(db, 'third')
    const op = await newOperation(owner)
    await invite(owner, op, 'a@test.local')
    await as(db, third)
    expect((await db.query(`select * from operation_members where operation_id = $1`, [op])).rows).toHaveLength(0)
  })

  it('list_shared_operations devuelve solo lo propio y activo', async () => {
    const owner = await newUser(db, 'owner')
    const guest = await newUser(db, 'guest')
    const op = await newOperation(owner)
    await accept(guest, (await invite(owner, op, await emailOf(guest), 'NOTARY')).invite_token)
    await as(db, guest)
    const list = (await db.query<{ r: { operationId: string; role: string }[] }>(`select public.list_shared_operations() as r`)).rows[0].r
    expect(list).toEqual([expect.objectContaining({ operationId: op, role: 'NOTARY' })])
    await as(db, owner)
    const ownerList = (await db.query<{ r: unknown[] }>(`select public.list_shared_operations() as r`)).rows[0].r
    expect(ownerList).toEqual([])
  })
})
