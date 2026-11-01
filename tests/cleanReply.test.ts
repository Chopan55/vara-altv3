import { describe, it, expect } from 'vitest'
import { cleanChatReply } from '@/lib/ai/cleanReply'

describe('limpieza de respuestas del chat', () => {
  it('saca [HECHO] y los asteriscos de negrita', () => {
    expect(cleanChatReply('[HECHO] ¡Excelente!\n\n1. **Propiedades**: importá el link.')).toBe('¡Excelente!\n\n1. Propiedades: importá el link.')
  })

  it('traduce las otras etiquetas a palabras', () => {
    expect(cleanChatReply('[ESTIMADO] Entre 1% y 2%.')).toBe('Aproximado: Entre 1% y 2%.')
    expect(cleanChatReply('[RECOMENDACIÓN] Pedí el informe.')).toBe('Recomendación: Pedí el informe.')
    expect(cleanChatReply('[CONSULTAR PROFESIONAL] El estudio de títulos.')).toBe('Consultá con un profesional: El estudio de títulos.')
  })

  it('quita títulos de markdown y compacta saltos de línea', () => {
    expect(cleanChatReply('## Costos\n\n\n\nSellos __importantes__.')).toBe('Costos\n\nSellos importantes.')
  })

  it('no toca un texto limpio', () => {
    expect(cleanChatReply('Hola, ¿en qué te ayudo?')).toBe('Hola, ¿en qué te ayudo?')
  })
})
