import { describe, it, expect } from 'vitest'
import { destination, nextStep, operationTitle, question, type Answers } from '@/lib/onboarding/flow'

describe('flujo de /empezar', () => {
  it('pregunta en orden y no repite lo ya contestado', () => {
    const a: Answers = { intent: 'SELL' }
    expect(nextStep(a)).toBe('country')
    expect(nextStep({ ...a, country: 'AR' })).toBe('province')
    expect(nextStep({ ...a, country: 'AR', province: 'CABA' })).toBe('city')
    expect(nextStep({ ...a, country: 'AR', province: 'CABA', cityDone: true })).toBe('type')
    expect(nextStep({ ...a, country: 'AR', province: 'CABA', cityDone: true, propertyType: 'Casa' })).toBe('already')
    expect(nextStep({ ...a, country: 'AR', province: 'CABA', cityDone: true, propertyType: 'Casa', alreadyHas: false })).toBe('done')
  })

  it('saltear la ciudad cuenta como contestada', () => {
    expect(nextStep({ intent: 'BUY', country: 'AR', province: 'CABA', cityDone: true })).toBe('type')
  })

  it('la pregunta cambia según vender o comprar', () => {
    expect(question('already', { intent: 'SELL' })).toContain('publicada')
    expect(question('already', { intent: 'BUY' })).toContain('viste')
  })

  it('arma el título de la operación', () => {
    expect(operationTitle({ intent: 'SELL', propertyType: 'Casa', city: 'Pilar', province: 'Buenos Aires' })).toBe('Casa en Pilar')
    expect(operationTitle({ intent: 'BUY', province: 'CABA' })).toBe('Compra en CABA')
    expect(operationTitle({ intent: 'SELL' })).toBe('Venta')
  })

  it('lleva a la pantalla que corresponde', () => {
    expect(destination({ intent: 'SELL', alreadyHas: true })).toBe('/revisar-publicacion')
    expect(destination({ intent: 'SELL', alreadyHas: false })).toBe('/preparar-venta')
    expect(destination({ intent: 'BUY', alreadyHas: true })).toBe('/propiedades')
    expect(destination({ intent: 'BUY', alreadyHas: false })).toBe('/mi-busqueda')
  })
})
