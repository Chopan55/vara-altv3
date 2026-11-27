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
      createProgram: () => ({}), deleteProgram: () => {}, useProgram: () => {},
    }
    const canvas = { getContext: () => gl } as unknown as HTMLCanvasElement
    expect(startFluidOrb(canvas, opts)).toBeNull()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('avatar de fluido: libera la GPU al detenerse', () => {
  function fakeGl() {
    const calls: string[] = []
    const gl = {
      VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLE_STRIP: 8, COLOR_BUFFER_BIT: 9,
      createShader: () => ({}), shaderSource: () => {}, compileShader: () => {}, getShaderParameter: () => true, deleteShader: () => { calls.push('shader') },
      createProgram: () => ({}), attachShader: () => {}, detachShader: () => { calls.push('detach') }, linkProgram: () => {}, getProgramParameter: () => true, useProgram: (p: unknown) => { if (p === null) calls.push('unuse') }, deleteProgram: () => { calls.push('program') },
      createBuffer: () => ({}), bindBuffer: () => {}, bufferData: () => {}, deleteBuffer: () => { calls.push('buffer') },
      getAttribLocation: () => 0, enableVertexAttribArray: () => {}, vertexAttribPointer: () => {},
      getUniformLocation: () => ({}), viewport: () => {}, clearColor: () => {}, clear: () => {}, uniform1f: () => {}, drawArrays: () => {},
    }
    return { gl, calls }
  }

  it('al detenerlo borra programa, shaders y buffer (cada cambio de tamaño reinicia el avatar)', () => {
    const { gl, calls } = fakeGl()
    vi.stubGlobal('requestAnimationFrame', () => 1)
    vi.stubGlobal('cancelAnimationFrame', () => {})
    const canvas = { getContext: () => gl, width: 100, height: 100 } as unknown as HTMLCanvasElement
    const stop = startFluidOrb(canvas, opts)
    expect(stop).toBeTypeOf('function')
    stop?.()
    expect(calls.filter(c => c !== 'buffer')).toEqual(['unuse', 'detach', 'detach', 'program', 'shader', 'shader'])
    expect(calls).toContain('buffer')
    vi.unstubAllGlobals()
  })

  it('si el programa no enlaza, también libera lo creado', () => {
    const { gl, calls } = fakeGl()
    gl.getProgramParameter = () => false
    const canvas = { getContext: () => gl } as unknown as HTMLCanvasElement
    expect(startFluidOrb(canvas, opts)).toBeNull()
    expect(calls).toEqual(['unuse', 'detach', 'detach', 'program', 'shader', 'shader'])
  })
})
