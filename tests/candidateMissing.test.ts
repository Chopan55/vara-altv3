import { describe, it, expect } from 'vitest'
import { advertiserMessage, patchFor, sentenceFor } from '@/lib/candidates/missing'

describe('datos que faltan en una propiedad', () => {
  it('lo dice en lenguaje humano, en singular y plural', () => {
    expect(sentenceFor(['superficie'])).toBe('Me falta la superficie para poder compararla bien.')
    expect(sentenceFor(['precio', 'superficie'])).toBe('Me faltan el precio y la superficie para poder compararla bien.')
    expect(sentenceFor(['precio', 'superficie', 'ubicación'])).toBe('Me faltan el precio, la superficie y la ubicación para poder compararla bien.')
    expect(sentenceFor([])).toBe('')
  })

  it('arma el cambio a guardar y rechaza lo que no sirve', () => {
    expect(patchFor('precio', '250.000')).toEqual({ price: 250000 })
    expect(patchFor('superficie', ' 400 m2 ')).toEqual({ surface: 400 })
    expect(patchFor('ubicación', ' Pilar ')).toEqual({ city: 'Pilar' })
    expect(patchFor('precio', 'abc')).toBeNull()
    expect(patchFor('precio', '0')).toBeNull()
    expect(patchFor('superficie', '')).toBeNull()
    expect(patchFor('otra cosa', '5')).toBeNull()
  })

  it('prepara el mensaje para el anunciante', () => {
    const m = advertiserMessage(['superficie', 'precio'], 'Casa en Pilar')
    expect(m).toContain('“Casa en Pilar”')
    expect(m).toContain('la superficie y el precio')
    expect(advertiserMessage(['precio'])).toContain('que publicaron')
  })
})
