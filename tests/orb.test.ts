import { describe, expect, it, vi } from 'vitest'
import { startOrb, type OrbOptions } from '@/components/buy-v3/orb'

const opts: OrbOptions = {
  textureUrl: '/vara/avatar-1024.webp',
  calm: false,
  getState: () => 'idle',
  getLevel: () => 0,
  hasAudio: () => false,
}

describe('avatar WebGL: cae al respaldo sin romper la pantalla', () => {
  it('sin WebGL (getContext devuelve null) no arranca y devuelve null para usar el avatar básico', () => {
    const canvas = { getContext: vi.fn(() => null) } as unknown as HTMLCanvasElement
    expect(startOrb(canvas, opts)).toBeNull()
    expect(canvas.getContext).toHaveBeenCalled()
  })

  it('si el shader no compila, devuelve null y avisa por consola sin lanzar error', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const gl = {
      VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3,
      createShader: () => ({}),
      shaderSource: () => {},
      compileShader: () => {},
      getShaderParameter: () => false,
      getShaderInfoLog: () => 'error simulado',
      deleteShader: () => {},
      createProgram: () => ({}),
    }
    const canvas = { getContext: () => gl } as unknown as HTMLCanvasElement
    expect(startOrb(canvas, opts)).toBeNull()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('si no se pueden crear shaders (contexto perdido), devuelve null', () => {
    const gl = {
      VERTEX_SHADER: 1, FRAGMENT_SHADER: 2,
      createShader: () => null,
      createProgram: () => null,
    }
    const canvas = { getContext: () => gl } as unknown as HTMLCanvasElement
    expect(startOrb(canvas, opts)).toBeNull()
  })
})
