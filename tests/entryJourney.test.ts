/**
 * Entry journey: Home → Entrar → /login → /dashboard · Home → Empezar → /onboarding ·
 * /login con sesión redirige · el login de Visit Partners no se rompe.
 */
import { readFileSync } from 'node:fs'
import { createElement, isValidElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`)
})
const getUserMock = vi.fn()

vi.mock('next/navigation', () => ({
  redirect: (url: string) => redirectMock(url),
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/lib/supabase/server', () => ({ getCurrentUser: () => getUserMock() }))

// La home real, sin sus secciones pesadas: lo que se prueba son los enlaces del header y del hero.
vi.mock('@/components/home/HeroInteractive', () => ({ HeroInteractive: () => null }))
vi.mock('@/components/home/ContactForm', () => ({ ContactForm: () => null }))
vi.mock('@/components/home/FaqAssistant', () => ({ FaqAssistant: () => null }))
vi.mock('@/components/ui/ProductFrame', () => ({ ProductFrame: () => null }))
vi.mock('@/components/home/HomeSections', () => {
  const none = () => null
  return {
    ParadigmSection: none, BenefitsSection: none, AnalyzeSection: none, CompareSection: none, OperationSection: none,
    NegotiateSection: none, VisitSection: none, JourneySection: none, AiSection: none, ProductsSection: none, TrustSection: none,
  }
})

import LandingPage from '@/app/page'
import LoginPage from '@/app/login/page'
import PartnerEntryPage from '@/app/partner/entrar/page'
import { AuthScreen } from '@/components/auth/AuthScreen'
import { ENTRY, loginRedirect, postLoginTarget, safeNext } from '@/lib/auth/entryJourney'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

/** Enlaces de la home: texto visible → href. */
function homeLinks() {
  const html = renderToStaticMarkup(createElement(LandingPage))
  const links: { text: string; href: string }[] = []
  for (const m of html.matchAll(/<a\b[^>]*?href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    links.push({ href: m[1], text: m[2].replace(/<[^>]+>/g, '').trim() })
  }
  return links
}

describe('home pública', () => {
  it('"Entrar" va a /login', () => {
    const entrar = homeLinks().filter(l => l.text === 'Entrar')
    expect(entrar.length).toBeGreaterThan(0)
    expect(entrar.every(l => l.href === '/login')).toBe(true)
  })

  it('"Empezar" del header va a /onboarding', () => {
    const header = renderToStaticMarkup(createElement(LandingPage)).split('</header>')[0]
    const empezar = [...header.matchAll(/<a\b[^>]*?href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].filter(m => m[2].replace(/<[^>]+>/g, '').trim() === 'Empezar')
    expect(empezar).toHaveLength(1)
    expect(empezar[0][1]).toBe('/onboarding')
  })

  it('el CTA principal del hero también va a /onboarding (no baja a una sección)', () => {
    const html = renderToStaticMarkup(createElement(LandingPage))
    const hero = html.split('</header>')[1].split('Ver cómo funciona')[0]
    const empezar = [...hero.matchAll(/<a\b[^>]*?href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].filter(m => m[2].replace(/<[^>]+>/g, '').trim() === 'Empezar')
    expect(empezar).toHaveLength(1)
    expect(empezar[0][1]).toBe('/onboarding')
  })

  it('ningún botón "Empezar" navega a un ancla: siempre inicia el journey', () => {
    const empezar = homeLinks().filter(l => l.text === 'Empezar')
    expect(empezar.length).toBeGreaterThanOrEqual(2)
    expect(empezar.every(l => l.href === ENTRY.start)).toBe(true)
    expect(empezar.some(l => l.href.startsWith('#'))).toBe(false)
  })
})

describe('/login', () => {
  beforeEach(() => {
    redirectMock.mockClear()
    getUserMock.mockReset()
  })
  const render = (next?: string | string[]) => LoginPage({ searchParams: Promise.resolve(next === undefined ? {} : { next }) })

  it('con sesión válida redirige a /dashboard y no muestra el formulario', async () => {
    getUserMock.mockResolvedValue({ id: 'u1' })
    await expect(render()).rejects.toThrow('NEXT_REDIRECT:/dashboard')
    expect(redirectMock).toHaveBeenCalledWith('/dashboard')
  })

  it('con sesión y un next interno seguro, va ahí', async () => {
    getUserMock.mockResolvedValue({ id: 'u1' })
    await expect(render('/operacion/abc?tab=docs')).rejects.toThrow('NEXT_REDIRECT:/operacion/abc?tab=docs')
    await expect(render(['/comparar', '/otro'])).rejects.toThrow('NEXT_REDIRECT:/comparar')
  })

  it('con sesión, un next externo o que vuelve al login se ignora (sin open redirect ni loop)', async () => {
    getUserMock.mockResolvedValue({ id: 'u1' })
    for (const bad of ['https://evil.com', '//evil.com', '/\\evil.com', '/login', '/login?next=/dashboard', '/partner/entrar']) {
      redirectMock.mockClear()
      await expect(render(bad)).rejects.toThrow('NEXT_REDIRECT:/dashboard')
    }
  })

  it('sin sesión muestra el login de cliente (login / signup / reset) y no redirige', async () => {
    getUserMock.mockResolvedValue(null)
    const el = (await render()) as ReactElement<{ audience: string }>
    expect(isValidElement(el)).toBe(true)
    expect(el.type).toBe(AuthScreen)
    expect(el.props.audience).toBe('client')
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('si no se puede verificar la sesión (Supabase sin configurar) también muestra el login', async () => {
    getUserMock.mockResolvedValue(null)
    expect(((await render()) as ReactElement).type).toBe(AuthScreen)
  })
})

describe('login de Visit Partners', () => {
  it('sigue siendo su propia puerta: AuthScreen audience partner, sin chequeo de sesión ni redirect', () => {
    redirectMock.mockClear()
    getUserMock.mockClear()
    const el = PartnerEntryPage() as ReactElement<{ audience: string }>
    expect(el.type).toBe(AuthScreen)
    expect(el.props.audience).toBe('partner')
    expect(getUserMock).not.toHaveBeenCalled()
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('el partner termina en /partner y el cliente en /dashboard', () => {
    expect(postLoginTarget('partner', null)).toBe('/partner')
    expect(postLoginTarget('client', null)).toBe('/dashboard')
    expect(postLoginTarget('partner', '/partner/visitas')).toBe('/partner/visitas')
    expect(postLoginTarget('partner', '/partner/entrar')).toBe('/partner')
  })

  it('la home sigue enlazando a Visit Partners', () => {
    expect(homeLinks().some(l => l.href === '/partner/entrar')).toBe(true)
  })
})

describe('reglas puras del journey', () => {
  it('safeNext solo acepta rutas internas que no sean pantallas de login', () => {
    expect(safeNext('/dashboard')).toBe('/dashboard')
    expect(safeNext('/operacion/1#docs')).toBe('/operacion/1#docs')
    expect(safeNext(null)).toBe('/dashboard')
    expect(safeNext('', '/x')).toBe('/x')
    expect(safeNext('dashboard')).toBe('/dashboard')
    expect(safeNext('/login/')).toBe('/dashboard')
  })

  it('loginRedirect: redirige solo con sesión', () => {
    expect(loginRedirect(false, '/comparar')).toBeNull()
    expect(loginRedirect(true, undefined)).toBe('/dashboard')
    expect(loginRedirect(true, '/comparar')).toBe('/comparar')
  })
})

describe('/empezar sigue siendo experimental', () => {
  it('se mantiene detrás del flag conversationalEntry y no es el destino por defecto del login', () => {
    expect(read('src/app/empezar/page.tsx')).toContain("isEnabled('conversationalEntry')")
    expect(read('src/components/auth/AuthScreen.tsx')).not.toMatch(/conversationalEntry|'\/empezar'/)
    expect(read('src/app/page.tsx')).not.toMatch(/href="\/empezar|href="#empezar/)
  })
})
