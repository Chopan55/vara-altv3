import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const touchedNetwork = vi.fn(() => { throw new Error('Se llamó a la red: no debería') })
const upsert = vi.fn()

vi.mock('@/lib/analysis/market', () => ({ getMarketStore: () => ({ upsert }) }))

import { GET as cronGet } from '@/app/api/v3/market/sweep/cron/route'
import { POST as sweepPost } from '@/app/api/v3/market/sweep/route'

const walk = (dir: string, out: string[] = []) => {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}

describe('Bright Data es opcional para /analizar', () => {
  const original = { ...process.env }
  beforeEach(() => {
    delete process.env.BRIGHTDATA_API_KEY
    delete process.env.MARKET_CRON_ENABLED
    delete process.env.CRON_SECRET
    vi.stubGlobal('fetch', touchedNetwork)
    touchedNetwork.mockClear()
    upsert.mockClear()
  })
  afterEach(() => { process.env = { ...original }; vi.unstubAllGlobals() })

  it('solo las dos rutas de barrido del servidor usan Bright Data; ni el cliente ni /analizar', () => {
    const users = walk(path.join(process.cwd(), 'src'))
      .filter(f => /brightdata|BRIGHTDATA/i.test(readFileSync(f, 'utf8')))
      .map(f => path.relative(process.cwd(), f).split(path.sep).join('/'))
      .sort()
    expect(users).toEqual([
      'src/app/api/v3/market/sweep/cron/route.ts',
      'src/app/api/v3/market/sweep/route.ts',
      'src/lib/analysis/market/brightdata.ts',
    ])
    // Ninguno es código de navegador.
    for (const f of users) expect(readFileSync(f, 'utf8').slice(0, 200)).not.toContain("'use client'")
  })

  it('sin la clave, el barrido falla con honestidad (503) y no inventa nada', async () => {
    process.env.MARKET_SWEEP_SECRET = 'a-very-long-test-secret-value'
    const res = await sweepPost(new Request('http://x/api/v3/market/sweep', {
      method: 'POST',
      headers: { 'x-sweep-secret': 'a-very-long-test-secret-value', 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'start' }),
    }))
    expect(res.status).toBe(503)
    expect((await res.json()).error).toMatch(/Bright Data/)
    expect(touchedNetwork).not.toHaveBeenCalled()
    expect(upsert).not.toHaveBeenCalled()
  })

  it('el barrido rechaza a quien no tiene el secreto', async () => {
    process.env.MARKET_SWEEP_SECRET = 'a-very-long-test-secret-value'
    const res = await sweepPost(new Request('http://x/api/v3/market/sweep', {
      method: 'POST',
      headers: { 'x-sweep-secret': 'otro', 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'start' }),
    }))
    expect(res.status).toBe(401)
  })

  it('cron apagado: responde "disabled", no llama a ningún proveedor y no escribe datos', async () => {
    process.env.BRIGHTDATA_API_KEY = 'presente-pero-no-debe-usarse'
    const res = await cronGet(new Request('http://x/api/v3/market/sweep/cron'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'disabled' })
    expect(touchedNetwork).not.toHaveBeenCalled()
    expect(upsert).not.toHaveBeenCalled()
  })

  it('cron encendido pero sin credenciales correctas: rechaza (401) sin tocar el proveedor', async () => {
    process.env.MARKET_CRON_ENABLED = '1'
    process.env.CRON_SECRET = 'un-secreto-de-cron-bastante-largo'
    const res = await cronGet(new Request('http://x/api/v3/market/sweep/cron', { headers: { authorization: 'Bearer incorrecto' } }))
    expect(res.status).toBe(401)
    expect(touchedNetwork).not.toHaveBeenCalled()
  })
})
