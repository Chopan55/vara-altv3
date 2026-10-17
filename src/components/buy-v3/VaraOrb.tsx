'use client'

import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { VaraAvatar } from './VaraAvatar'
import { startOrb, type OrbDebug, type OrbState } from './orb'

/**
 * Avatar de VARA: esfera de vidrio que se deforma como gelatina (WebGL).
 * Si el dispositivo no soporta WebGL, se muestra el avatar básico (VaraAvatar).
 * Es decorativo: no cambia lo que dice el análisis.
 */
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
    c.width = c.height = Math.round(size * dpr)
    let calm = false
    try { calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { /* sin matchMedia */ }
    const stop = startOrb(c, {
      textureUrl: '/vara/avatar-1024.webp',
      calm,
      getState: () => stateRef.current,
      getLevel: () => levelRef?.current ?? 0,
      hasAudio: () => audioRef.current,
      debug: () => debugRef?.current ?? null,
    })
    if (!stop) { setFailed(true); return }
    return stop
  }, [size, levelRef, debugRef])

  if (failed) return <VaraAvatar state={state} size={size} />
  return (
    <canvas ref={canvas} aria-hidden="true"
      style={{ width: size, height: size, flex: 'none', filter: 'drop-shadow(0 10px 18px rgba(99,102,216,.38))' }} />
  )
}
