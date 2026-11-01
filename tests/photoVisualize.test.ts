import { describe, it, expect } from 'vitest'
import { GENERATED_LABEL, VISUALIZE_MODES, humanError, noticeFor } from '@/lib/photoVisualize'

describe('visualizar potencial de una foto', () => {
  it('toda imagen se rotula como generada', () => {
    expect(GENERATED_LABEL.toLowerCase()).toContain('generada')
    expect(GENERATED_LABEL.toLowerCase()).toContain('no es el estado real')
  })

  it('los modos coinciden con los que acepta el servidor', () => {
    expect(VISUALIZE_MODES.map(m => m.id).sort()).toEqual(['AUTO', 'BANO', 'COCINA', 'INTERIOR', 'JARDIN', 'PINTURA_EXTERIOR', 'VACIAR'])
  })

  it('el aviso aclara que no es la propiedad real', () => {
    expect(noticeFor('edit')).toContain('no cómo está hoy')
    expect(noticeFor('generated')).toContain('no tu propiedad')
    expect(noticeFor('none')).toBeTruthy()
    expect(noticeFor('none', 'nota del servidor')).toBe('nota del servidor')
  })

  it('traduce errores del servidor a lenguaje humano', () => {
    expect(humanError(403)).toContain('en prueba')
    expect(humanError(429)).toContain('límite diario')
    expect(humanError(402)).toContain('crédito')
    expect(humanError(401)).toContain('Ingresá')
    expect(humanError(500)).toContain('Probá de nuevo')
    expect(humanError(500, 'Detalle')).toBe('Detalle')
  })
})
