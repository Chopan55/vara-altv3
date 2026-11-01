'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const VOICE_KEY = 'vara.voice'

export interface SpeechHandlers {
  onStart: () => void
  /** 0..1 según cuánto del audio ya sonó (sirve para ir mostrando el texto al ritmo de la voz). */
  onProgress: (p: number) => void
  onEnd: () => void
}

export interface PreparedSpeech {
  start: (h: SpeechHandlers) => Promise<boolean>
}

/**
 * Voz de VARA en el navegador. Pide el audio al servidor, lo reproduce y mide su volumen
 * cuadro a cuadro: ese nivel (0..1) es lo que mueve la boca del avatar, así que la boca
 * sigue de verdad lo que suena. Quien la silencia queda silenciado en ese navegador.
 */
export function useVaraVoice(onLevel: (level: number) => void) {
  const [voiceOn, setVoiceOn] = useState(true)
  const levelRef = useRef(onLevel)
  const current = useRef<{ audio: HTMLAudioElement; url: string } | null>(null)
  const ctx = useRef<AudioContext | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { levelRef.current = onLevel }, [onLevel])

  useEffect(() => {
    try { if (localStorage.getItem(VOICE_KEY) === 'off') setVoiceOn(false) } catch { /* sin storage */ }
  }, [])

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current)
    timer.current = null
    const c = current.current
    current.current = null
    if (c) {
      c.audio.onended = null
      c.audio.pause()
      URL.revokeObjectURL(c.url)
    }
    levelRef.current(0)
  }, [])

  useEffect(() => stop, [stop])

  const toggle = useCallback(() => {
    setVoiceOn(prev => {
      const next = !prev
      try { localStorage.setItem(VOICE_KEY, next ? 'on' : 'off') } catch { /* sin storage */ }
      if (!next) stop()
      return next
    })
  }, [stop])

  /** Pide el audio. Devuelve null si el servidor no lo da (sin permiso, tope o error): se sigue solo con texto. */
  const prepare = useCallback(async (text: string): Promise<PreparedSpeech | null> => {
    let blob: Blob
    try {
      const res = await fetch('/api/v3/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) return null
      blob = await res.blob()
    } catch {
      return null
    }

    return {
      start: async h => {
        stop()
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        current.current = { audio, url }

        let analyser: AnalyserNode | null = null
        const samples = new Uint8Array(512)
        try {
          const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
          if (Ctor) {
            ctx.current ??= new Ctor()
            const node = ctx.current.createAnalyser()
            node.fftSize = samples.length
            const source = ctx.current.createMediaElementSource(audio)
            source.connect(node)
            node.connect(ctx.current.destination)
            analyser = node
            if (ctx.current.state === 'suspended') await ctx.current.resume()
          }
        } catch {
          analyser = null
        }

        const finish = () => {
          if (current.current?.audio !== audio) return
          stop()
          h.onProgress(1)
          h.onEnd()
        }
        audio.onended = finish

        try {
          await audio.play()
        } catch {
          stop() // el navegador bloqueó el audio: se sigue con texto
          return false
        }
        h.onStart()

        let smooth = 0
        const tick = () => {
          if (current.current?.audio !== audio) return
          let level: number
          if (analyser) {
            analyser.getByteTimeDomainData(samples)
            let sum = 0
            for (const v of samples) { const d = (v - 128) / 128; sum += d * d }
            level = Math.min(1, Math.sqrt(sum / samples.length) * 4.5)
          } else {
            level = 0.45 + 0.35 * Math.sin(performance.now() / 85) // sin análisis de audio: movimiento genérico
          }
          smooth = smooth * 0.55 + level * 0.45
          levelRef.current(smooth)
          if (audio.duration > 0) h.onProgress(audio.currentTime / audio.duration)
        }
        timer.current = setInterval(tick, 33) // ~30 cuadros por segundo alcanzan para la boca
        return true
      },
    }
  }, [stop])

  return { voiceOn, toggle, prepare, stop }
}
