import { describe, expect, it } from 'vitest'
import { cleanChatReply } from '@/lib/ai/cleanReply'
import { MX_REMINDER } from '@/lib/assistant/operationContext'

describe('México sin voseo', () => {
  it('la etiqueta «consultar profesional» se traduce en «tú» para México y en voseo para Argentina', () => {
    expect(cleanChatReply('[CONSULTAR PROFESIONAL] Confirma el predial.', 'MX')).toBe('Consulta con un profesional: Confirma el predial.')
    expect(cleanChatReply('[CONSULTAR PROFESIONAL] Confirmá el dominio.')).toBe('Consultá con un profesional: Confirmá el dominio.')
    expect(cleanChatReply('[CONSULTAR PROFESIONAL] Confirmá el dominio.', 'AR')).toContain('Consultá con un profesional')
  })

  it('las demás etiquetas no cambian con el país', () => {
    expect(cleanChatReply('[ESTIMADO] 3 %', 'MX')).toBe('Aproximado: 3 %')
    expect(cleanChatReply('[RECOMENDACIÓN] Pide plazo.', 'MX')).toBe('Recomendación: Pide plazo.')
  })

  it('el recordatorio final prohíbe el voseo y pide terminología mexicana', () => {
    expect(MX_REMINDER).toMatch(/sin voseo/)
    expect(MX_REMINDER).toMatch(/notario/)
  })
})
