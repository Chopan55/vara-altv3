import { describe, it, expect, vi, beforeEach } from 'vitest'

/*
 * Rutas /api/v1 con la base simulada. Lo que se prueba es el contrato HTTP:
 * qué código y qué cuerpo devuelve cada caso. La seguridad de las RPC (que una
 * clave solo vea lo de su dueño) se prueba contra Postgres real en tests/db/publicApi.
 */

const rpc = vi.fn()
const getUser = vi.fn()
let flagOn = true

vi.mock('@/lib/flags', () => ({ isEnabled: () => flagOn }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc, auth: { getUser } }) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) }))

const KEY = 'vara_live_' + 'a'.repeat(32)
const req = (auth?: string) => new Request('http://x/api/v1/operations', { headers: auth ? { authorization: auth } : {} })
const OP = { id: '11111111-1111-1111-1111-111111111111', title: 'Mi venta', type: 'SELL_PROPERTY', status: 'ACTIVE', province_code: 'CABA', created_at: 'x', updated_at: 'x' }

beforeEach(() => {
  rpc.mockReset(); getUser.mockReset(); flagOn = true
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
})

describe('GET /api/v1/operations', async () => {
  const { GET } = await import('@/app/api/v1/operations/route')

  it('403 con la API apagada', async () => {
    flagOn = false
    expect((await GET(req(`Bearer ${KEY}`))).status).toBe(403)
  })

  it('200 con clave válida', async () => {
    rpc.mockResolvedValue({ data: [OP], error: null })
    const res = await GET(req(`Bearer ${KEY}`))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: [OP] })
    // Viaja el hash, nunca la clave.
    expect(JSON.stringify(rpc.mock.calls[0])).not.toContain(KEY)
  })

  it('401 con clave inexistente o revocada', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    expect((await GET(req(`Bearer ${KEY}`))).status).toBe(401)
  })

  it('503 si falta la migración', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } })
    const res = await GET(req(`Bearer ${KEY}`))
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'not_ready' })
  })

  it('401 sin credenciales', async () => {
    expect((await GET(req())).status).toBe(401)
  })

  it('401 con un token de sesión inválido', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    expect((await GET(req('Bearer token-roto'))).status).toBe(401)
  })
})

describe('GET /api/v1/operations/:id', async () => {
  const { GET } = await import('@/app/api/v1/operations/[id]/route')
  const call = (id: string, auth?: string) => GET(req(auth), { params: Promise.resolve({ id }) })

  it('200 con clave y operación propia', async () => {
    rpc.mockResolvedValue({ data: OP, error: null })
    const res = await call(OP.id, `Bearer ${KEY}`)
    expect(res.status).toBe(200)
  })

  it('404 si no existe o no es del dueño de la clave', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    expect((await call(OP.id, `Bearer ${KEY}`)).status).toBe(404)
  })

  it('un id que no es UUID da 404, no 500', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    expect((await call('no-es-un-uuid', `Bearer ${KEY}`)).status).toBe(404)
    expect(rpc.mock.calls[0][1].p_operation_id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('una clave mala es 401 aunque el id sea inválido', async () => {
    rpc.mockResolvedValue({ data: { error: 'unauthenticated' }, error: null })
    expect((await call('no-es-un-uuid', `Bearer ${KEY}`)).status).toBe(401)
  })
})
