import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pingDatabase } from '@/lib/keepalive'
import { resetRateLimits } from '@/lib/api/rateLimit'
import { GET as keepaliveCron } from '@/app/api/keepalive/cron/route'

const ENV = { NEXT_PUBLIC_SUPABASE_URL: 'https://demo.supabase.co/', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key' }

function okFetch() {
  return vi.fn(async (_url: string, _init?: RequestInit) => new Response('[]', { status: 200 }))
}

describe('pingDatabase', () => {
  it('sin base configurada no sale a la red', async () => {
    const fetchImpl = okFetch()
    expect(await pingDatabase({}, fetchImpl)).toEqual({ status: 'not_configured', note: 'Falta configurar la base.' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('hace una consulta real y mínima con la clave pública', async () => {
    const fetchImpl = okFetch()
    const result = await pingDatabase(ENV, fetchImpl)
    expect(result.status).toBe('ok')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://demo.supabase.co/rest/v1/profiles?select=id&limit=1')
    expect(init?.headers).toEqual({ apikey: 'anon-key', Authorization: 'Bearer anon-key' })
    expect(init?.cache).toBe('no-store')
    expect(init?.method).toBeUndefined()
  })

  it('acepta la clave publicable nueva y nunca usa la secreta', async () => {
    const fetchImpl = okFetch()
    await pingDatabase({
      NEXT_PUBLIC_SUPABASE_URL: 'https://demo.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x',
      SUPABASE_SECRET_KEY: 'super-secreta',
    }, fetchImpl)
    const sent = JSON.stringify(fetchImpl.mock.calls[0][1]?.headers)
    expect(sent).toContain('sb_publishable_x')
    expect(sent).not.toContain('super-secreta')
  })

  it('un error HTTP es una falla con el código', async () => {
    const fetchImpl = vi.fn(async () => new Response('no', { status: 503 }))
    expect(await pingDatabase(ENV, fetchImpl)).toMatchObject({ status: 'failed', note: 'Respondió 503.' })
  })

  it('sin red o sin respuesta a tiempo falla sin romper', async () => {
    const down = vi.fn(async () => { throw new TypeError('fetch failed') })
    expect(await pingDatabase(ENV, down)).toMatchObject({ status: 'failed', note: 'No se pudo conectar.' })

    const slow = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
    }))
    expect(await pingDatabase(ENV, slow, 5)).toMatchObject({ status: 'failed', note: 'No respondió a tiempo.' })
  })
})

describe('cron /api/keepalive/cron', () => {
  const original = { ...process.env }
  const SECRET = 'a-very-long-test-secret-value'

  let info: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    resetRateLimits()
    info = vi.spyOn(console, 'info').mockImplementation(() => {})
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://demo.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    delete process.env.CRON_SECRET
  })
  afterEach(() => {
    process.env = { ...original }
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sin CRON_SECRET corre igual y no devuelve hosts ni claves', async () => {
    vi.stubGlobal('fetch', okFetch())
    const res = await keepaliveCron(new Request('http://x/api/keepalive/cron'))
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(JSON.parse(text).status).toBe('ok')
    expect(text).not.toContain('supabase.co')
    expect(text).not.toContain('anon-key')
  })

  it('cada corrida buena deja una línea en los logs, sin hosts ni claves', async () => {
    vi.stubGlobal('fetch', okFetch())
    await keepaliveCron(new Request('http://x/api/keepalive/cron'))
    expect(info).toHaveBeenCalledTimes(1)
    expect(info.mock.calls[0][0]).toBe('[db.keepalive.ok]')
    const printed = JSON.stringify(info.mock.calls[0])
    expect(printed).not.toContain('supabase.co')
    expect(printed).not.toContain('anon-key')
  })

  it('con CRON_SECRET exige el header que manda Vercel', async () => {
    const fetchImpl = okFetch()
    vi.stubGlobal('fetch', fetchImpl)
    process.env.CRON_SECRET = SECRET

    const denied = await keepaliveCron(new Request('http://x/api/keepalive/cron', { headers: { authorization: 'Bearer otro' } }))
    expect(denied.status).toBe(401)
    expect(fetchImpl).not.toHaveBeenCalled()

    const allowed = await keepaliveCron(new Request('http://x/api/keepalive/cron', { headers: { authorization: `Bearer ${SECRET}` } }))
    expect(allowed.status).toBe(200)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('corta las ráfagas de un mismo cliente', async () => {
    vi.stubGlobal('fetch', okFetch())
    const hit = () => keepaliveCron(new Request('http://x/api/keepalive/cron', { headers: { 'x-forwarded-for': '1.2.3.4' } }))
    for (let i = 0; i < 10; i++) expect((await hit()).status).toBe(200)
    expect((await hit()).status).toBe(429)
  })

  it('si la base falla responde 502, y 503 si no está configurada', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('no', { status: 500 })))
    expect((await keepaliveCron(new Request('http://x/api/keepalive/cron'))).status).toBe(502)

    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    expect((await keepaliveCron(new Request('http://x/api/keepalive/cron'))).status).toBe(503)
  })
})

describe('vercel.json', () => {
  const cfg = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')) as {
    crons: { path: string; schedule: string }[]
  }

  it('incluye el ping diario a la base', () => {
    expect(cfg.crons.some(c => c.path === '/api/keepalive/cron')).toBe(true)
  })

  it('cada cron apunta a una ruta que existe y corre como mucho una vez por día', () => {
    for (const c of cfg.crons) {
      expect(existsSync(join(process.cwd(), 'src/app', c.path, 'route.ts')), c.path).toBe(true)
      // Minuto y hora fijos: una vez por día como máximo (el plan Hobby de Vercel no admite más).
      const [minute, hour] = c.schedule.split(/\s+/)
      expect(/^\d+$/.test(minute) && /^\d+$/.test(hour), `${c.path}: ${c.schedule}`).toBe(true)
    }
  })
})
