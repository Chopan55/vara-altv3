import { describe, expect, it } from 'vitest'
import { extractDraft } from '@/lib/ai/draft'

describe('borradores del asistente', () => {
  it('separa el borrador y deja la explicación', () => {
    expect(extractDraft('Mandalo hoy.\nBORRADOR\nHola [nombre]\nGracias\nFIN BORRADOR\nRevisá el monto.')).toEqual({
      reply: 'Mandalo hoy.\n\nRevisá el monto.',
      draft: 'Hola [nombre]\nGracias',
    })
  })

  it('sin borrador devuelve el texto como está', () => {
    expect(extractDraft('Respuesta común.')).toEqual({ reply: 'Respuesta común.' })
  })

  it('un marcador suelto no se muestra y no genera tarjeta', () => {
    const out = extractDraft('Texto\nBORRADOR\nsin cierre')
    expect(out.draft).toBeUndefined()
    expect(out.reply).not.toMatch(/^BORRADOR$/m)
  })

  it('limita el largo del borrador', () => {
    const out = extractDraft('BORRADOR\n' + 'a'.repeat(5000) + '\nFIN BORRADOR')
    expect(out.draft?.length).toBe(1500)
  })

  it('si solo hay borrador, deja una frase de acompañamiento', () => {
    expect(extractDraft('BORRADOR\nHola\nFIN BORRADOR').reply).toBe('Te dejo un borrador para que lo revises.')
  })
})
