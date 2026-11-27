'use client'

import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { VaraAvatar } from './VaraAvatar'
import type { OrbDebug, OrbState } from './orb'
import { startFluidOrb } from './orbFluid'

/**
 * Avatar de VARA: esfera luminosa de fluido que respira y se deforma con la voz (WebGL).
 * Si el dispositivo no soporta WebGL, se muestra el avatar básico (VaraAvatar).
 * Es decorativo: no cambia lo que dice el análisis.
 */
/** La esfera ocupa ~60 % del lienzo; el resto es el halo. */
const CANVAS_SCALE = 1.65

export function VaraOrb({ state = 'idle', size = 96, levelRef, audio = false, debugRef }: {
  state?: OrbState
  size?: number
  /** Volumen del audio que suena (0..1), actualizado por quien reproduce la voz. */
  levelRef?: MutableRefObject<number>
  audio?: boolean
  /** Solo para pruebas visuales. */
  debugRef?: MutableRefObject<OrbDebug | null>
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<OrbState>(state)
  const audioRef = useRef(audio)
  const [failed, setFailed] = useState(false)

  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { audioRef.current = audio }, [audio])

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    // El lienzo es más grande que el espacio que ocupa: el halo de luz necesita margen alrededor de la esfera.
    c.width = c.height = Math.round(size * CANVAS_SCALE * dpr)
    let calm = false
    try { calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { /* sin matchMedia */ }
    const stop = startFluidOrb(c, {
      calm,
      getState: () => stateRef.current,
      getLevel: () => levelRef?.current ?? 0,
      hasAudio: () => audioRef.current,
      debug: () => debugRef?.current ?? null,
    })
    if (!stop) { setFailed(true); return }
    return stop
  }, [size, levelRef, debugRef])

  if (failed) return <VaraAvatar state={state === 'listening' ? 'idle' : state} size={size} />
  const box = size * CANVAS_SCALE
  return (
    <span aria-hidden="true" style={{ position: 'relative', display: 'inline-block', width: size, height: size, flex: 'none', transition: 'width .35s ease, height .35s ease' }}>
      <canvas ref={canvas}
        style={{ position: 'absolute', left: (size - box) / 2, top: (size - box) / 2, width: box, height: box, pointerEvents: 'none' }} />
    </span>
  )
}
