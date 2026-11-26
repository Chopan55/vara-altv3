import { describe, expect, it } from 'vitest'
import { isPublicPath, loginPathFor } from '@/lib/auth/routeAccess'

describe('acceso a rutas', () => {
  it('mantiene públicas las entradas y el contenido informativo', () => {
    for (const path of ['/', '/login', '/onboarding', '/analizar', '/como-usar', '/guia', '/compartido', '/labs', '/planes', '/vara-visit', '/partner/entrar', '/auth/callback', '/auth/nueva-clave', '/visit/ABC123', '/visit/ABC123/reporte', '/invitacion/ABC']) {
      expect(isPublicPath(path), path).toBe(true)
    }
  })

  it('protege demo y la plataforma operativa', () => {
    for (const path of ['/demo', '/dashboard', '/costos', '/vara-labs', '/visitas', '/vara-visit/solicitar', '/partner', '/operacion/123', '/empezar', '/banco-demo', '/compartida', '/compartida/123']) {
      expect(isPublicPath(path), path).toBe(false)
    }
  })

  it('el portal de partners manda a su propia entrada y el resto al login general', () => {
    expect(loginPathFor('/partner')).toBe('/partner/entrar')
    expect(loginPathFor('/partner/onboarding')).toBe('/partner/entrar')
    expect(loginPathFor('/dashboard')).toBe('/login')
    expect(loginPathFor('/partnerx')).toBe('/login')
  })
})
