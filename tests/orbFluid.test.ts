import { describe, expect, it, vi } from 'vitest'
import { startFluidOrb } from '@/components/buy-v3/orbFluid'

const opts = { calm: false, getState: () => 'idle' as const, getLevel: () => 0, hasAudio: () => false }

describe('avatar de fluido: cae al respaldo sin romper la pantalla', () => {
  it('sin WebGL no arranca y devuelve null para usar el avatar básico', () => {
    const canvas = { getContext: vi.fn(() => null) } as unknown as HTMLCanvasElement
    expect(startFluidOrb(canvas, opts)).toBeNull()
  })

  it('si el shader no compila, devuelve null y avisa por consola sin lanzar error', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const gl = {
      VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3,
      createShader: () => ({}), shaderSource: () => {}, compileShader: () => {},
      getShaderParameter: () => false, getShaderInfoLog: () => 'error simulado', deleteShader: () => {},
      createProgram: () => ({}),
    }
    const canvas = { getContext: () => gl } as unknown as HTMLCanvasElement
    expect(startFluidOrb(canvas, opts)).toBeNull()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
