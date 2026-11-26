import { describe, expect, it } from 'vitest'
import { isPublicPath } from '@/lib/auth/routeAccess'

describe('acceso a rutas', () => {
  it('mantiene públicas las entradas y el contenido informativo', () => {
    for (const path of ['/', '/login', '/onboarding', '/analizar', '/como-usar', '/guia', '/compartido', '/labs', '/planes', '/vara-visit', '/partner/entrar', '/auth/callback', '/auth/nueva-clave', '/visit/ABC123', '/visit/ABC123/reporte', '/invitacion/ABC']) {
      expect(isPublicPath(path), path).toBe(true)
    }
  })

  it('protege demo y la plataforma operativa', () => {
    for (const path of ['/demo', '/dashboard', '/costos', '/vara-labs', '/visitas', '/vara-visit/solicitar', '/partner', '/operacion/123', '/empezar', '/compartida', '/compartida/123']) {
      expect(isPublicPath(path), path).toBe(false)
    }
  })
})
