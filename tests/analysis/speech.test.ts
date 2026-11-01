import { describe, it, expect } from 'vitest'
import { sanitizeSpeechText, SPEECH_MAX_CHARS } from '@/lib/analysis/speech'
import { AI_LIMITS } from '@/lib/analysis/aiAccess'

describe('voz de VARA: texto que se lee', () => {
  it('rechaza lo que no es texto o no tiene nada que leer', () => {
    expect(sanitizeSpeechText(undefined)).toBeNull()
    expect(sanitizeSpeechText(42)).toBeNull()
    expect(sanitizeSpeechText('   ')).toBeNull()
    expect(sanitizeSpeechText('.')).toBeNull()
  })

  it('saca links y marcas de formato, y junta los espacios', () => {
    const out = sanitizeSpeechText('**Ojo**: mirá https://zonaprop.com.ar/x  y   `después` avisame.')
    expect(out).toBe('Ojo: mirá y después avisame.')
  })

  it('un texto corto queda igual', () => {
    expect(sanitizeSpeechText('El precio está por encima de la mediana.')).toBe('El precio está por encima de la mediana.')
  })

  it('un texto largo se corta en un final de oración y respeta el tope', () => {
    const sentence = 'Esta es una oración de prueba bastante larga para llenar el espacio. '
    const out = sanitizeSpeechText(sentence.repeat(30)) as string
    expect(out.length).toBeLessThanOrEqual(SPEECH_MAX_CHARS)
    expect(out.endsWith('.')).toBe(true)
  })

  it('los topes de gasto de voz existen y son acotados', () => {
    expect(AI_LIMITS.speakPerUserPerHour).toBeGreaterThan(0)
    expect(AI_LIMITS.speakPerUserPerHour).toBeLessThanOrEqual(60)
    expect(AI_LIMITS.speakGlobalPerDay).toBeLessThanOrEqual(300)
  })
})
