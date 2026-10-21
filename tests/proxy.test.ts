/**
 * Regresión: proxy de sesión Supabase (Next.js 16)
 *
 * Verifica que:
 * 1. src/proxy.ts exporta `proxy` (no `middleware` — deprecado en Next.js 16).
 * 2. config.matcher excluye estáticos y cubre las rutas de app.
 * 3. Cuando Supabase refresca el token, las cookies nuevas llegan al request
 *    (para route handlers SSR) Y a la response (para el browser vía Set-Cookie).
 *    Si solo se escribe en uno de los dos, la sesión aparece como expirada.
 *
 * Sin esto: la sesión expiraba a los ~15 min porque middleware.ts (deprecado)
 * no se ejecutaba en Next.js 16.3.x y el token JWT nunca se rotaba.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Estado compartido entre el mock y los tests ────────────────────────────

/** Simula el cookie store del request (lo que llega al servidor). */
const reqStore = new Map<string, string>()
/** Simula el cookie store de la response (lo que se envía al browser). */
const resStore = new Map<string, { value: string; options?: Record<string, unknown> }>()

// Captura la fn setAll que proxy.ts le pasa a createServerClient,
// para poder llamarla desde los tests como si fuera Supabase rotando el token.
let _capturedSetAll: ((c: Array<{ name: string; value: string; options?: Record<string, unknown> }>) => void) | undefined

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@supabase/ssr', () => ({
  createServerClient: (
    _url: string,
    _key: string,
    opts: {
      cookies: {
        getAll(): Array<{ name: string; value: string }>
        setAll(c: Array<{ name: string; value: string; options?: Record<string, unknown> }>): void
      }
    },
  ) => {
    _capturedSetAll = opts.cookies.setAll
    return {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
      },
    }
  },
}))

vi.mock('next/server', () => {
  // Simula NextResponse.next() y las cookies de request/response.
  class FakeResponse {
    cookies = {
      set(name: string, value: string, options?: Record<string, unknown>) {
        resStore.set(name, { value, options })
      },
      get(name: string) {
        return resStore.get(name)
      },
    }

    static next(_opts?: { request?: unknown }) {
      return new FakeResponse()
    }
  }

  return { NextResponse: FakeResponse }
})

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(cookies: Record<string, string> = {}) {
  for (const [k, v] of Object.entries(cookies)) reqStore.set(k, v)
  return {
    cookies: {
      getAll: () => [...reqStore.entries()].map(([name, value]) => ({ name, value })),
      set: (name: string, value: string) => { reqStore.set(name, value) },
    },
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('proxy — Next.js 16 session refresh', () => {
  beforeEach(() => {
    reqStore.clear()
    resStore.clear()
    _capturedSetAll = undefined
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-test-key'
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    vi.resetModules()
  })

  it('exporta proxy() — no middleware() (Next.js 16 renombró el archivo)', async () => {
    const mod = await import('@/proxy')
    expect(typeof mod.proxy).toBe('function')
    // Asegurar que el nombre viejo no está presente
    expect((mod as Record<string, unknown>).middleware).toBeUndefined()
  })

  it('exporta config.matcher como array no vacío', async () => {
    const { config } = await import('@/proxy')
    expect(Array.isArray(config.matcher)).toBe(true)
    expect(config.matcher.length).toBeGreaterThan(0)
  })

  it('el matcher excluye _next/static, _next/image y favicon.ico', async () => {
    const { config } = await import('@/proxy')
    const pattern = config.matcher[0] as string
    expect(pattern).toContain('_next/static')
    expect(pattern).toContain('_next/image')
    expect(pattern).toContain('favicon.ico')
  })

  it('propaga cookies refrescadas al request Y a la response', async () => {
    const { proxy } = await import('@/proxy')
    const req = makeRequest({ 'sb-test-auth-token': 'old-jwt' })

    await proxy(req as unknown as import('next/server').NextRequest)

    // Supabase llama a setAll cuando rota el token — simulamos esa llamada
    expect(_capturedSetAll).toBeDefined()
    _capturedSetAll!([
      { name: 'sb-test-auth-token', value: 'rotated-jwt', options: { httpOnly: true, path: '/' } },
    ])

    // El token nuevo debe estar en el request (server components / route handlers lo leen)
    expect(reqStore.get('sb-test-auth-token')).toBe('rotated-jwt')

    // El token nuevo debe estar en la response (el browser lo recibe vía Set-Cookie)
    expect(resStore.get('sb-test-auth-token')?.value).toBe('rotated-jwt')
  })

  it('no configura el cliente Supabase si las env vars no están presentes', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    const { proxy } = await import('@/proxy')

    const req = makeRequest()
    await proxy(req as unknown as import('next/server').NextRequest)

    // Si createServerClient no se llamó, setAll nunca se capturó
    expect(_capturedSetAll).toBeUndefined()
  })
})
