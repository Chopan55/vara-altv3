/** Subida de una propiedad a la cuenta (insertProperty): mismo id cuando es UUID, y sin duplicar ante un reintento. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { insertProperty } from '@/lib/supabase/properties'

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

const UUID = '7d3e1c20-8a4b-4f6d-9b2a-5c1e0f9a8b7c'
const input = (over: Record<string, unknown> = {}) => ({ source: 'IMPORTED' as const, sourceUrl: 'https://www.zonaprop.com.ar/casa-1.html', title: 'Casa', ...over })

describe('insertProperty', () => {
  beforeEach(() => { fake.user = { id: 'u1' }; fake.inserts = []; fake.results = []; fake.existing = null })

  it('con un UUID se sube con ese mismo id y el usuario de la sesión', async () => {
    expect(await insertProperty(input({ id: UUID }))).toBe(UUID)
    expect(fake.inserts[0]).toMatchObject({ id: UUID, user_id: 'u1', source: 'IMPORTED', source_url: 'https://www.zonaprop.com.ar/casa-1.html' })
  })

  it('con un id viejo (`cand_…`, `imported-…`) no manda id: lo asigna la base', async () => {
    expect(await insertProperty(input({ id: 'cand_lq1x2y_ab12cd' }))).toBe('id-nuevo-de-la-base')
    expect(fake.inserts[0]).not.toHaveProperty('id')
    expect(await insertProperty(input())).toBe('id-nuevo-de-la-base')
    expect(fake.inserts[1]).not.toHaveProperty('id')
  })

  it('sin sesión no sube nada', async () => {
    fake.user = null
    expect(await insertProperty(input({ id: UUID }))).toBeNull()
    expect(fake.inserts).toHaveLength(0)
  })

  it('si ya estaba subida (clave duplicada) devuelve la existente, y solo si es del usuario', async () => {
    const dup = { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "properties_pkey"' } }
    fake.results = [dup]
    fake.existing = { id: UUID }
    expect(await insertProperty(input({ id: UUID }))).toBe(UUID)
    expect(fake.inserts).toHaveLength(1) // un solo intento, sin segunda fila

    fake.results = [dup]
    fake.existing = null // existe pero es de otra persona (RLS no la deja ver)
    expect(await insertProperty(input({ id: UUID }))).toBeNull()
  })

  it('otros errores devuelven null y no se confunden con un duplicado', async () => {
    fake.results = [{ data: null, error: { code: '42501', message: 'permission denied' } }]
    expect(await insertProperty(input({ id: UUID }))).toBeNull()
  })
})
