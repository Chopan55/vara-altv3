'use client'

import type { Ref } from 'react'
import Image from 'next/image'
import './avatar.css'

export type AvatarState = 'idle' | 'thinking' | 'speaking'

/**
 * Avatar animado de VARA. Es decorativo: no cambia lo que dice el análisis, solo
 * muestra si VARA está quieta, pensando o hablando. Mostrarlo u ocultarlo lo decide
 * quien usa la app.
 */
export function VaraAvatar({ state = 'idle', size = 88, lipsync = false, rootRef }: {
  state?: AvatarState
  size?: number
  /** La boca sigue la variable CSS `--vara-level` (0..1), que actualiza quien reproduce el audio. */
  lipsync?: boolean
  rootRef?: Ref<HTMLSpanElement>
}) {
  return (
    <span ref={rootRef} className="vara-avatar" data-state={state} data-lipsync={lipsync}
      style={{ width: size, height: size }} aria-hidden="true">
      <span className="vara-avatar__ring" />
      <span className="vara-avatar__float block">
        <span className="vara-avatar__body block">
          <Image src="/vara/avatar.png" alt="" width={1254} height={1254} sizes={`${Math.round(size * 1.4)}px`}
            className="vara-avatar__img" />
          <span className="vara-avatar__lid vara-avatar__lid--l" />
          <span className="vara-avatar__lid vara-avatar__lid--r" />
          <span className="vara-avatar__mouth" />
        </span>
      </span>
    </span>
  )
}
