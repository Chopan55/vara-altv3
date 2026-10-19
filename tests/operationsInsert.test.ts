import { describe, it, expect, beforeEach, vi } from 'vitest'
import { insertOperation, isDuplicateKeyError, isMissingColumnError } from '@/lib/supabase/operations'
import { messageOf } from '@/lib/observability/logger'
import type { StoredOperation } from '@/lib/userOperations'

// Cliente de Supabase falso: registra lo que se inserta y devuelve los resultados que se le carguen.
const fake = vi.hoisted(() => ({
  user: { id: 'u1' } as { id: string } | null,
  inserts: [] as Record<string, unknown>[],
  results: [] as { data: unknown; error: unknown }[],
  existing: null as { id: string } | null,
}))
vi.mock('@/lib/supabase/client', () => ({
  tryCreateClient: () => ({
    auth: { getUser: async () => ({ data: { user: fake.user } }) },
    from: () => ({
      insert: (payload: Record<string, unknown>) => {
        fake.inserts.push(payload)
        return { select: () => ({ single: async () => fake.results.shift() ?? { data: { id: (payload.id as string) ?? 'id-nuevo-de-la-base' }, error: null } }) }
      },
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: fake.existing, error: null }) }) }),
    }),
  }),
}))

const UUID = '3f2b8c1e-5a47-4d9b-9c60-1e2f3a4b5c6d'
const PROP_UUID = '9a1c7e22-0b3d-4f5a-8a6b-7c8d9e0f1a2b'
const op = (over: Partial<StoredOperation> = {}): StoredOperation => ({
  id: UUID, type: 'SELL', title: 'Mi venta', status: 'ACTIVE', province: 'Ciudad de Buenos Aires', provinceCode: 'CABA', city: '', country: 'AR', progress: 0, createdAt: 1, ...over,
})

describe('subida de una operación a la cuenta (insertOperation)', () => {
  beforeEach(() => { fake.user = { id: 'u1' }; fake.inserts = []; fake.results = []; fake.existing = null })

  it('una operación de invitado (UUID) se sube con el MISMO id y el usuario de la sesión', async () => {
    expect(await insertOperation(op())).toBe(UUID)
    expect(fake.inserts[0]).toMatchObject({ id: UUID, user_id: 'u1', type: 'SELL_PROPERTY', title: 'Mi venta', province_code: 'CABA', country: 'AR' })
  })

  it('una operación vieja (id que no es UUID) se sube sin id: la base asigna uno', async () => {
    expect(await insertOperation(op({ id: 'op-1760000000000-abc12' }))).toBe('id-nuevo-de-la-base')
    expect(fake.inserts[0]).not.toHaveProperty('id')
  })

  it('sin sesión no sube nada', async () => {
    fake.user = null
    expect(await insertOperation(op())).toBeNull()
    expect(fake.inserts).toHaveLength(0)
  })

  it('una propiedad local (no UUID) no rompe la subida: se sube sin ese vínculo; una real se conserva', async () => {
    await insertOperation(op({ propertyId: 'imported-1760000000000' }))
    expect(fake.inserts[0].property_id).toBeNull()
    await insertOperation(op({ propertyId: PROP_UUID }))
    expect(fake.inserts[1].property_id).toBe(PROP_UUID)
  })

  it('si ya estaba subida (clave duplicada) no la duplica: devuelve la existente, y solo si es del usuario', async () => {
    const dup = { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "operations_pkey"' } }
    expect(isDuplicateKeyError(dup.error)).toBe(true)
    expect(isDuplicateKeyError({ code: '42501' })).toBe(false)

    fake.results = [dup]
    fake.existing = { id: UUID }
    expect(await insertOperation(op())).toBe(UUID)
    expect(fake.inserts).toHaveLength(1) // un solo intento: no reintenta ni inserta otra

    fake.results = [dup]
    fake.existing = null // la fila existe pero es de otra persona (RLS no la deja ver)
    expect(await insertOperation(op())).toBeNull()
  })

  it('si la base no tiene la columna country, reintenta sin ella y conserva el id', async () => {
    fake.results = [{ data: null, error: { code: 'PGRST204', message: "Could not find the 'country' column of 'operations' in the schema cache" } }]
    expect(await insertOperation(op())).toBe(UUID)
    expect(fake.inserts).toHaveLength(2)
    expect(fake.inserts[0]).toHaveProperty('country')
    expect(fake.inserts[1]).not.toHaveProperty('country')
    expect(fake.inserts[1].id).toBe(UUID)
  })
})

describe('inserción de operaciones', () => {
  const pgrst = { code: 'PGRST204', message: "Could not find the 'country' column of 'operations' in the schema cache" }

  it('detecta cuando falta la columna country en la base', () => {
    expect(isMissingColumnError(pgrst, 'country')).toBe(true)
  })

  it('no confunde otras columnas ni otros errores', () => {
    expect(isMissingColumnError(pgrst, 'locale')).toBe(false)
    expect(isMissingColumnError({ code: '42501', message: "permission denied for 'country'" }, 'country')).toBe(false)
    expect(isMissingColumnError(null, 'country')).toBe(false)
    expect(isMissingColumnError('texto', 'country')).toBe(false)
  })

  it('el log muestra la causa real y no "Error desconocido Object"', () => {
    expect(messageOf(pgrst)).toContain('PGRST204')
    expect(messageOf(pgrst)).toContain("'country'")
  })
})
