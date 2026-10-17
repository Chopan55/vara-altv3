import { describe, it, expect } from 'vitest'
import { ApiError, apiErrorMessage, safeJson, userFacingError } from '@/lib/api/client'

describe('errores de API para el usuario', () => {
  it('safeJson no rompe con una página de error', async () => {
    const html = new Response('<html>504 Gateway Timeout</html>', { status: 504 })
    expect(await safeJson(html)).toEqual({})
    const ok = new Response(JSON.stringify({ a: 1 }))
    expect(await safeJson<{ a: number }>(ok)).toEqual({ a: 1 })
  })

  it('usa el mensaje del servidor solo si es legible', () => {
    expect(apiErrorMessage(400, 'Poné tu nombre.')).toBe('Poné tu nombre.')
    expect(apiErrorMessage(500, 'Unexpected token < in JSON')).not.toContain('Unexpected')
    expect(apiErrorMessage(500, '{"x":1}')).toContain('probá de nuevo')
    expect(apiErrorMessage(500, 'a'.repeat(300))).toContain('probá de nuevo')
  })

  it('traduce los códigos más comunes', () => {
    expect(apiErrorMessage(401)).toContain('Ingresá')
    expect(apiErrorMessage(403)).toContain('habilitada')
    expect(apiErrorMessage(413)).toContain('pesado')
    expect(apiErrorMessage(429)).toContain('límite')
    expect(apiErrorMessage(504)).toContain('Tardó demasiado')
  })

  it('solo muestra errores propios; el resto se reemplaza', () => {
    expect(userFacingError(new ApiError('Mensaje claro', 400), 'x')).toBe('Mensaje claro')
    expect(userFacingError(new SyntaxError('Unexpected token <'), 'Probá de nuevo')).toBe('Probá de nuevo')
    expect(userFacingError(new TypeError('Failed to fetch'), 'Probá de nuevo')).toBe('Probá de nuevo')
  })
})
