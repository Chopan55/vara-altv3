import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { flag, access, getUser, docQuery, download, logs } = vi.hoisted(() => ({
  flag: vi.fn(), access: vi.fn(), getUser: vi.fn(),
  docQuery: { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn() },
  download: vi.fn(), logs: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/flags', () => ({ isEnabled: flag }))
vi.mock('@/lib/api/aiAccess', () => ({ requireAiAccess: access }))
vi.mock('@/lib/observability/logger', () => ({ log: logs }))
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [] }) }))
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser }, from: () => docQuery, storage: { from: () => ({ download }) } }),
}))

import { POST } from '@/app/api/documents/read/route'

const PDF = readFileSync(join(__dirname, 'fixtures', 'escritura-ficticia.pdf'))
const call = (body: unknown) => POST(new Request('http://localhost/api/documents/read', { method: 'POST', body: JSON.stringify(body) }))

describe('POST /api/documents/read', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.invalid')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'k')
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')
    flag.mockReturnValue(true)
    access.mockResolvedValue({ userId: 'u1' })
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    docQuery.maybeSingle.mockResolvedValue({ data: { id: 'd1', storage_path: 'u1/op/escritura.pdf' } })
    download.mockResolvedValue({ data: new Blob([PDF]), error: null })
  })

  it('apagado por el interruptor, no hace nada', async () => {
    flag.mockReturnValue(false)
    expect((await call({ documentId: 'd1' })).status).toBe(403)
    expect(getUser).not.toHaveBeenCalled()
  })

  it('exige sesión y un id de documento válido', async () => {
    expect((await call({})).status).toBe(400)
    expect((await call({ documentId: 'x'.repeat(100) })).status).toBe(400)
    getUser.mockResolvedValue({ data: { user: null } })
    expect((await call({ documentId: 'd1' })).status).toBe(401)
  })

  it('solo lee documentos del dueño: filtra por user_id y responde 404 si no es suyo', async () => {
    docQuery.maybeSingle.mockResolvedValue({ data: null })
    expect((await call({ documentId: 'd1' })).status).toBe(404)
    expect(docQuery.eq.mock.calls).toEqual([['id', 'd1'], ['user_id', 'u1']])
    expect(download).not.toHaveBeenCalled()
  })

  it('rechaza lo que no es PDF y lo demasiado pesado', async () => {
    docQuery.maybeSingle.mockResolvedValue({ data: { id: 'd1', storage_path: 'u1/foto.jpg' } })
    expect((await call({ documentId: 'd1' })).status).toBe(400)
    docQuery.maybeSingle.mockResolvedValue({ data: { id: 'd1', storage_path: 'u1/a.pdf' } })
    download.mockResolvedValue({ data: { size: 16 * 1024 * 1024 }, error: null })
    expect((await call({ documentId: 'd1' })).status).toBe(413)
  })

  it('camino feliz: manda solo texto al modelo (nunca el archivo), devuelve citas comprobadas y no registra contenido', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ findings: [
      { kind: 'mortgage', text: 'Hipoteca', page: 2, quote: 'Se constituye hipoteca en primer grado a favor del Banco Ejemplo por USD 80.000' },
      { kind: 'embargo', text: 'Inventado', page: 1, quote: 'embargo trabado por el juzgado civil numero cuatro' },
    ] }) } }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await call({ documentId: 'd1' })
    expect(res.status).toBe(200)
    const { summary } = await res.json()
    expect(summary.findings).toHaveLength(1)
    expect(summary.findings[0]).toMatchObject({ kind: 'mortgage', page: 2 })
    expect(summary.discarded).toBe(1)
    const urls = fetchMock.mock.calls.map(c => String((c as unknown as [string])[0]))
    expect(urls).toEqual(['https://api.openai.com/v1/chat/completions'])
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body))
    expect(body.messages[1].content).toContain('<documento>')
    const logged = JSON.stringify([logs.info.mock.calls, logs.warn.mock.calls, logs.error.mock.calls])
    expect(logged).not.toContain('Alvarez')
    expect(logged).not.toContain('hipoteca')
    vi.unstubAllGlobals()
  })

  it('si el modelo principal falla usa el de respaldo, y si ambos fallan responde 503 sin filtrar el error', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: '{"findings":[]}' } }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    expect((await call({ documentId: 'd1' })).status).toBe(200)
    expect(JSON.parse(String((fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body)).model).toBe('gpt-4o-mini')

    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })))
    const res = await call({ documentId: 'd1' })
    expect(res.status).toBe(503)
    expect(JSON.stringify(await res.json())).not.toContain('openai')
    vi.unstubAllGlobals()
  })
})
