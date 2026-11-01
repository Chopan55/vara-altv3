import { beforeEach, describe, expect, it, vi } from 'vitest'

const { insert, warn, info, error } = vi.hoisted(() => ({
  insert: vi.fn(async () => ({ error: null as null | { message: string } })),
  warn: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  isSupabaseConfigured: true,
  createClient: async () => ({ from: () => ({ insert }) }),
}))
vi.mock('@/lib/observability/logger', () => ({ log: { warn, info, error } }))

import { POST } from '@/app/api/contacto/route'
import { CONTACT_LIMITS, clientIp, normalizeEmail, validateContact } from '@/lib/contact'

const good = { name: 'Ana Pérez', email: 'Ana.Perez@Example.com ', message: 'Quiero hablar con una persona sobre mi compra.' }
let ipCounter = 0
const post = (body: unknown, ip = `10.0.0.${++ipCounter}`) => POST(new Request('http://x/api/contacto', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
  body: typeof body === 'string' ? body : JSON.stringify(body),
}))

describe('validación del formulario de contacto', () => {
  it('normaliza el mail y limpia espacios', () => {
    const r = validateContact({ ...good, name: '  Ana   Pérez ' })
    expect(r.ok && r.value).toEqual({ name: 'Ana Pérez', email: 'ana.perez@example.com', message: good.message })
    expect(normalizeEmail('  X@Y.com ')).toBe('x@y.com')
  })

  it.each([
    ['no es un objeto', null], ['es una lista', []], ['es un texto', 'hola'],
    ['el nombre no es texto', { ...good, name: 12345 }],
    ['el mail es un objeto', { ...good, email: { a: 1 } }],
    ['el mensaje falta', { name: 'Ana', email: 'a@b.co' }],
  ])('rechaza si %s', (_t, body) => {
    expect(validateContact(body).ok).toBe(false)
  })

  it('rechaza mails dobles, con saltos de línea, sin dominio o larguísimos (sin relay ni inyección de encabezados)', () => {
    for (const email of ['a@b.co, c@d.co', 'a@b.co\nbcc:x@y.co', 'sin-arroba', 'a@b', 'a@@b.co', `${'x'.repeat(130)}@b.co`, '<a@b.co>']) {
      expect(validateContact({ ...good, email }).ok, email).toBe(false)
    }
  })

  it('respeta los largos de la tabla (nombre 2–80, mensaje 10–1000)', () => {
    expect(validateContact({ ...good, name: 'A' }).ok).toBe(false)
    expect(validateContact({ ...good, name: 'A'.repeat(81) }).ok).toBe(false)
    expect(validateContact({ ...good, message: 'corto' }).ok).toBe(false)
    expect(validateContact({ ...good, message: 'x'.repeat(1001) }).ok).toBe(false)
    expect(validateContact({ ...good, message: 'x'.repeat(1000) }).ok).toBe(true)
  })

  it('toma la primera IP del proxy', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('1.2.3.4')
    expect(clientIp(new Headers())).toBe('desconocida')
  })
})

describe('POST /api/contacto', () => {
  beforeEach(() => { insert.mockClear(); insert.mockResolvedValue({ error: null }); warn.mockClear(); error.mockClear() })

  it('guarda un pedido válido, con el mail normalizado', async () => {
    const res = await post(good)
    expect(res.status).toBe(200)
    expect(insert).toHaveBeenCalledWith({ name: 'Ana Pérez', email: 'ana.perez@example.com', message: good.message })
  })

  it('corta cuerpos enormes con 413 sin tocar la base', async () => {
    const res = await post({ ...good, message: 'x'.repeat(CONTACT_LIMITS.maxBodyChars + 1) })
    expect(res.status).toBe(413)
    expect(insert).not.toHaveBeenCalled()
  })

  it('responde 400 a JSON roto o campos inválidos, sin tocar la base', async () => {
    expect((await post('{no es json')).status).toBe(400)
    expect((await post({ ...good, email: 'mal' })).status).toBe(400)
    expect(insert).not.toHaveBeenCalled()
  })

  it('el campo trampa responde OK pero no guarda nada (el bot no se entera)', async () => {
    const res = await post({ ...good, website: 'http://spam.example' })
    expect(res.status).toBe(200)
    expect(insert).not.toHaveBeenCalled()
  })

  it('frena a una misma IP después del tope por hora (429) y no a otra', async () => {
    const ip = '203.0.113.50'
    for (let i = 0; i < CONTACT_LIMITS.perIpPerHour; i++) expect((await post(good, ip)).status).toBe(200)
    expect((await post(good, ip)).status).toBe(429)
    expect((await post(good, '203.0.113.51')).status).toBe(200)
  })

  it('si la base falla, da un error genérico (500) y no registra datos de la persona', async () => {
    insert.mockResolvedValueOnce({ error: { message: 'duplicate key value violates unique constraint "ana.perez@example.com"' } })
    const res = await post(good)
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toMatch(/duplicate|constraint|ana\.perez/i)
    const logged = JSON.stringify([...warn.mock.calls, ...error.mock.calls])
    expect(logged).not.toMatch(/ana|example\.com|Quiero hablar/i)
  })
})
