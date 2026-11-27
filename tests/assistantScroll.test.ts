import { describe, expect, it } from 'vitest'
import { isNearBottom } from '@/lib/assistant/scroll'

describe('scroll del asistente', () => {
  it('al final de la página sigue el texto nuevo', () => {
    expect(isNearBottom(1200, 800, 2000)).toBe(true)
  })
  it('cerca del final (menos de 160 px) también', () => {
    expect(isNearBottom(1100, 800, 2000)).toBe(true)
  })
  it('si la persona subió a releer, no se la arrastra', () => {
    expect(isNearBottom(300, 800, 2000)).toBe(false)
  })
  it('una página corta (sin scroll) cuenta como al final', () => {
    expect(isNearBottom(0, 900, 700)).toBe(true)
  })
  it('valores inválidos no frenan el seguimiento', () => {
    expect(isNearBottom(NaN, 800, 2000)).toBe(true)
  })
})
