import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

vi.mock('@/lib/api/requireAuth', () => ({
  requireAuth: vi.fn(async () => ({ userId: 'u1', email: (globalThis as { __email?: string }).__email })),
}))

import { isAiAllowed as canonical } from '@/lib/ai/allowlist'
import { isAiAllowed as fromAnalysis } from '@/lib/analysis/aiAccess'
import { isAiAllowed as fromApi, requireAiAccess, requireAiAllowed, withinDailyCap } from '@/lib/api/aiAccess'

const setEmail = (e: string | undefined) => { (globalThis as { __email?: string }).__email = e }

describe('lista de permiso de IA: una sola, que falla cerrado', () => {
  const original = { ...process.env }
  beforeEach(() => { delete process.env.AI_ALLOWED_EMAILS; delete process.env.VARA_AI_ALLOWED_EMAILS })
  afterEach(() => { process.env = { ...original }; setEmail(undefined) })

  it('las dos puertas (V3 y rutas heredadas) usan exactamente la misma función', () => {
    expect(fromAnalysis).toBe(canonical)
    expect(fromApi).toBe(canonical)
  })

  it('sin la variable, nadie puede usar la IA', () => {
    expect(canonical('yo@x.com')).toBe(false)
    process.env.AI_ALLOWED_EMAILS = '   '
    expect(canonical('yo@x.com')).toBe(false)
  })

  it('lee AI_ALLOWED_EMAILS en el momento de la consulta, sin importar mayúsculas ni espacios', () => {
    process.env.AI_ALLOWED_EMAILS = ' Yo@X.com , otra@y.com '
    expect(canonical('yo@x.com')).toBe(true)
    expect(canonical('OTRA@y.com')).toBe(true)
    expect(canonical('intruso@z.com')).toBe(false)
    expect(canonical(undefined)).toBe(false)
    expect(canonical(null)).toBe(false)
  })

  it('la variable vieja VARA_AI_ALLOWED_EMAILS ya no habilita a nadie', () => {
    process.env.VARA_AI_ALLOWED_EMAILS = 'yo@x.com'
    expect(canonical('yo@x.com')).toBe(false)
  })

  it('las rutas heredadas: autorizado pasa, no autorizado recibe 403, sin variable recibe 403', async () => {
    process.env.AI_ALLOWED_EMAILS = 'yo@x.com'

    setEmail('yo@x.com')
    expect((await requireAiAccess('text')).error).toBeUndefined()
    expect((await requireAiAllowed()).error).toBeUndefined()

    setEmail('intruso@z.com')
    const denied = await requireAiAccess('text')
    expect(denied.error?.status).toBe(403)

    setEmail('yo@x.com')
    delete process.env.AI_ALLOWED_EMAILS
    expect((await requireAiAccess('text')).error?.status).toBe(403)
    expect((await requireAiAllowed()).error?.status).toBe(403)
  })

  it('el tope diario sigue frenando al autorizado que se pasa', () => {
    const store = new Map<string, number>()
    const limits = { image: 1, text: 1, video: 1 }
    expect(withinDailyCap('u1', 'video', Date.UTC(2026, 9, 16), limits, store)).toBe(true)
    expect(withinDailyCap('u1', 'video', Date.UTC(2026, 9, 16), limits, store)).toBe(false)
  })

  it('el código no vuelve a definir otra lista ni otra variable de permiso', () => {
    const root = path.join(process.cwd(), 'src')
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = path.join(dir, name)
        if (statSync(p).isDirectory()) { walk(p); continue }
        if (!/\.(ts|tsx)$/.test(name)) continue
        const text = readFileSync(p, 'utf8')
        if (text.includes('VARA_AI_ALLOWED_EMAILS')) offenders.push(`${p}: variable vieja`)
        if (!p.endsWith(path.join('lib', 'ai', 'allowlist.ts')) && /split\(','\)[^\n]*toLowerCase\(\)[^\n]*filter\(Boolean\)/.test(text) && /ALLOWED/i.test(text)) {
          offenders.push(`${p}: parece otra lista de permiso`)
        }
      }
    }
    walk(root)
    expect(offenders).toEqual([])
  })

  it('la lista nunca se expone al navegador', () => {
    const root = path.join(process.cwd(), 'src')
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = path.join(dir, name)
        if (statSync(p).isDirectory()) { walk(p); continue }
        if (!/\.(ts|tsx)$/.test(name)) continue
        if (readFileSync(p, 'utf8').includes('NEXT_PUBLIC_AI_ALLOWED')) offenders.push(p)
      }
    }
    walk(root)
    expect(offenders).toEqual([])
  })
})
