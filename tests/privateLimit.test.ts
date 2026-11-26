import { describe, expect, it } from 'vitest'
import { privateLimitText } from '@/lib/ai/privateLimit'
import { scrubWalkAway } from '@/lib/negotiation/walkAway'

describe('tope privado en el chat', () => {
  it('detecta frases con un tope y un monto', () => {
    const text = privateLimitText([{ role: 'user', content: 'Me gusta la casa. Mi tope es USD 130.000. ¿Qué hago?' }])
    expect(text).toContain('130.000')
    expect(text).not.toContain('Me gusta')
  })

  it('ignora montos sin señal de tope y mensajes del asistente', () => {
    expect(privateLimitText([
      { role: 'user', content: 'El aviso dice USD 150.000.' },
      { role: 'assistant', content: 'Tu tope es USD 99.000.' },
    ])).toBe('')
  })

  it('el protector común tapa el monto en formatos argentinos', () => {
    const text = privateLimitText([{ role: 'user', content: 'No pagaría más de U$S 130 mil.' }])
    expect(scrubWalkAway('Podemos subir hasta USD 130.000.', text)).toContain('[tu límite privado]')
  })
})
