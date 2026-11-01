import { describe, it, expect } from 'vitest'
import { resolveAppEnv, resolveBaseUrl } from '@/lib/config/env'
import { checkAi, checkDatabase, checkMarket, evaluateHealth, type HealthCheck } from '@/lib/health'
import { productionOnly, setAnalyticsSink, track, type AnalyticsEvent } from '@/lib/analysis/events'

describe('entorno', () => {
  it('lo explícito manda sobre todo lo demás', () => {
    expect(resolveAppEnv({ VARA_ENV: 'staging', VERCEL_ENV: 'production' })).toBe('staging')
    expect(resolveAppEnv({ NEXT_PUBLIC_VARA_ENV: 'production' })).toBe('production')
  })

  it('deduce el entorno de Vercel', () => {
    expect(resolveAppEnv({ VERCEL_ENV: 'production' })).toBe('production')
    expect(resolveAppEnv({ VERCEL_ENV: 'preview' })).toBe('staging')
    expect(resolveAppEnv({ VERCEL_ENV: 'development' })).toBe('development')
  })

  it('reconoce el desarrollo local por dirección o por NODE_ENV', () => {
    expect(resolveAppEnv({}, 'localhost')).toBe('development')
    expect(resolveAppEnv({}, '127.0.0.1')).toBe('development')
    expect(resolveAppEnv({ NODE_ENV: 'development' })).toBe('development')
  })

  it('si no puede saberlo dice "unknown" y no adivina producción', () => {
    expect(resolveAppEnv({})).toBe('unknown')
    expect(resolveAppEnv({ NODE_ENV: 'production' }, 'algo.com')).toBe('unknown')
    expect(resolveAppEnv({ VARA_ENV: 'cualquier-cosa' })).toBe('unknown')
  })

  it('la URL base sale de configuración y se normaliza', () => {
    expect(resolveBaseUrl({ APP_BASE_URL: 'https://vara.example.com/' })).toBe('https://vara.example.com')
    expect(resolveBaseUrl({ NEXT_PUBLIC_APP_URL: 'vara.example.com' })).toBe('https://vara.example.com')
    expect(resolveBaseUrl({ VERCEL_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'prod.example.com', VERCEL_URL: 'preview-abc.vercel.app' }))
      .toBe('https://prod.example.com')
    expect(resolveBaseUrl({ VERCEL_ENV: 'preview', VERCEL_URL: 'preview-abc.vercel.app' })).toBe('https://preview-abc.vercel.app')
    expect(resolveBaseUrl({})).toBeNull()
    expect(resolveBaseUrl({ APP_BASE_URL: 'http://[' })).toBeNull()
  })
})

describe('salud', () => {
  const ok = (name: string, critical: boolean): HealthCheck => ({ name, status: 'ok', critical })
  const meta = { env: 'production' as const, version: 'abc1234', now: new Date('2026-10-15T12:00:00Z') }

  it('todo bien → ok', () => {
    expect(evaluateHealth([ok('app', true), ok('database', true), ok('ai', false)], meta).status).toBe('ok')
  })

  it('una dependencia crítica caída → down', () => {
    const r = evaluateHealth([ok('app', true), { name: 'database', status: 'down', critical: true }], meta)
    expect(r.status).toBe('down')
  })

  it('una crítica sin configurar también es down: no se anuncia "ok" sin base', () => {
    const r = evaluateHealth([ok('app', true), { name: 'database', status: 'not_configured', critical: true }], meta)
    expect(r.status).toBe('down')
  })

  it('una opcional caída solo degrada', () => {
    const r = evaluateHealth([ok('app', true), ok('database', true), { name: 'market', status: 'degraded', critical: false }], meta)
    expect(r.status).toBe('degraded')
  })

  it('la base responde ok, caída o lenta', async () => {
    const env = { NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'k' }
    expect((await checkDatabase(env, async () => new Response('{}', { status: 200 }))).status).toBe('ok')
    expect((await checkDatabase(env, async () => new Response('', { status: 503 }))).status).toBe('down')
    expect((await checkDatabase(env, async () => { throw new Error('red') })).status).toBe('down')

    const slow = await checkDatabase(env, (_u, init) => new Promise((_res, rej) => {
      init?.signal?.addEventListener('abort', () => rej(Object.assign(new Error('abort'), { name: 'AbortError' })))
    }), 20)
    expect(slow.status).toBe('down')
    expect(slow.note).toMatch(/a tiempo/)
  })

  it('sin configuración de base no intenta conectarse', async () => {
    let called = false
    const r = await checkDatabase({}, async () => { called = true; return new Response('') })
    expect(r.status).toBe('not_configured')
    expect(called).toBe(false)
  })

  it('el reporte no contiene claves, hosts ni URLs', async () => {
    const env = { NEXT_PUBLIC_SUPABASE_URL: 'https://secretoproyecto.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'CLAVE-SECRETA', OPENAI_API_KEY: 'sk-secreta' }
    const db = await checkDatabase(env, async () => new Response('{}', { status: 200 }))
    const report = evaluateHealth([db, checkAi(env)], meta)
    expect(JSON.stringify(report)).not.toMatch(/secretoproyecto|CLAVE-SECRETA|sk-secreta|supabase\.co/)
  })

  it('la IA y el mercado reportan su estado real', async () => {
    expect(checkAi({}).status).toBe('not_configured')
    expect(checkAi({ OPENAI_API_KEY: 'x' }).status).toBe('ok')
    expect((await checkMarket({ stats: async () => ({ total: 0, lastSweepAt: null }) })).status).toBe('degraded')
    expect((await checkMarket({ stats: async () => ({ total: 120, lastSweepAt: 'x' }) })).status).toBe('ok')
    expect((await checkMarket({ stats: async () => { throw new Error('x') } })).status).toBe('down')
  })
})

describe('métricas: producción separada', () => {
  const ev = (env: AnalyticsEvent['env'], i: number): AnalyticsEvent => ({ name: 'listing_submitted', sessionId: `s${i}`, env, at: '2026-10-15T00:00:00Z' })

  it('solo cuentan los eventos de producción', () => {
    const all = [ev('production', 1), ev('staging', 2), ev('development', 3), ev('unknown', 4), ev(undefined, 5)]
    expect(productionOnly(all).map(e => e.sessionId)).toEqual(['s1'])
  })

  it('cada evento sale etiquetado con su entorno', () => {
    const seen: AnalyticsEvent[] = []
    setAnalyticsSink(e => seen.push(e))
    track('listing_submitted', 's1')
    setAnalyticsSink(null)
    expect(seen[0].env).toBeDefined()
    // En tests no hay Vercel ni localhost: no se puede afirmar producción.
    expect(seen[0].env).not.toBe('production')
  })
})
