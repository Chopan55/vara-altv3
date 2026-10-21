'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  INITIAL_LIVE, LIVE_LIMITS, applyRealtimeEvent, historySeed, livePartial, takeFinished,
  type LiveEntry, type LiveErrorCode, type LiveState, type LiveStatus, type RealtimeEvent,
} from '@/lib/assistant/realtime'

/**
 * Conversación de voz en tiempo real con VARA (WebRTC contra OpenAI Realtime).
 *
 * El navegador pide un secreto efímero a /api/assistant/realtime (la clave real queda en el servidor), abre la
 * conexión con ese secreto y manda el micrófono. La respuesta vuelve como audio y por un canal de datos llegan los
 * eventos: de ahí salen el estado del avatar y el transcript. Si algo falla, queda `error` y el chat de texto sigue.
 *
 * Todo lo que se abre (micrófono, conexión, audio, temporizadores) se cierra al terminar y al salir de la pantalla.
 */

const CALLS_URL = 'https://api.openai.com/v1/realtime/calls'

interface Options {
  /** Mensajes ya definitivos y en orden (lo que dijo la persona y lo que respondió VARA). */
  onFinal: (entries: LiveEntry[]) => void
  /** Chat de texto actual: la voz lo usa como contexto inicial. */
  getHistory: () => { role: 'user' | 'assistant'; content: string }[]
  isError: (text: string) => boolean
}

class LiveError extends Error {
  constructor(readonly code: LiveErrorCode) { super(code) }
}

export function useRealtimeVoice({ onFinal, getHistory, isError }: Options) {
  const [status, setStatus] = useState<LiveStatus>('off')
  const [errorCode, setErrorCode] = useState<LiveErrorCode | null>(null)
  const [partial, setPartial] = useState<LiveEntry[]>([])
  /** Volumen de la voz de VARA (0..1): mueve la boca del avatar. */
  const levelRef = useRef(0)

  const opts = useRef({ onFinal, getHistory, isError })
  useEffect(() => { opts.current = { onFinal, getHistory, isError } })

  const res = useRef<{
    pc: RTCPeerConnection | null
    dc: RTCDataChannel | null
    mic: MediaStream | null
    audio: HTMLAudioElement | null
    ctx: AudioContext | null
    meter: ReturnType<typeof setInterval> | null
    maxTimer: ReturnType<typeof setTimeout> | null
    idleTimer: ReturnType<typeof setTimeout> | null
    live: LiveState
    run: number
  }>({ pc: null, dc: null, mic: null, audio: null, ctx: null, meter: null, maxTimer: null, idleTimer: null, live: INITIAL_LIVE, run: 0 })

  /** Cierra todo. Idempotente. Entrega lo que haya quedado del transcript. */
  const teardown = useCallback(() => {
    const r = res.current
    r.run++ // invalida cualquier arranque en curso
    if (r.meter) clearInterval(r.meter)
    if (r.maxTimer) clearTimeout(r.maxTimer)
    if (r.idleTimer) clearTimeout(r.idleTimer)
    r.meter = r.maxTimer = r.idleTimer = null
    try { r.dc?.close() } catch { /* ya cerrado */ }
    try { r.pc?.getSenders().forEach(s => s.track?.stop()) } catch { /* sin senders */ }
    try { r.pc?.close() } catch { /* ya cerrado */ }
    r.mic?.getTracks().forEach(t => t.stop())
    if (r.audio) { r.audio.pause(); r.audio.srcObject = null }
    try { void r.ctx?.close() } catch { /* ya cerrado */ }
    r.pc = r.dc = r.mic = r.audio = r.ctx = null

    const leftover = takeFinished({ ...r.live, entries: r.live.entries.map(e => ({ ...e, final: true })) }).done
    r.live = INITIAL_LIVE
    levelRef.current = 0
    setPartial([])
    if (leftover.length) opts.current.onFinal(leftover)
  }, [])

  const stop = useCallback(() => {
    teardown()
    setErrorCode(null)
    setStatus('off')
  }, [teardown])

  const fail = useCallback((code: LiveErrorCode) => {
    teardown()
    setErrorCode(code)
    setStatus('error')
  }, [teardown])

  const armIdle = useCallback(() => {
    const r = res.current
    if (r.idleTimer) clearTimeout(r.idleTimer)
    r.idleTimer = setTimeout(() => fail('timeout'), LIVE_LIMITS.idleMs)
  }, [fail])

  const onEvent = useCallback((raw: string) => {
    let ev: RealtimeEvent
    try { ev = JSON.parse(raw) as RealtimeEvent } catch { return }
    const r = res.current
    if (!r.pc) return

    // Interrupción: si la persona habla mientras VARA suena, se corta el audio local ya (el servidor corta la respuesta).
    if (ev.type === 'input_audio_buffer.speech_started' && r.live.audioPlaying && r.dc?.readyState === 'open') {
      try { r.dc.send(JSON.stringify({ type: 'output_audio_buffer.clear' })) } catch { /* canal cerrándose */ }
    }
    if (ev.type === 'input_audio_buffer.speech_started' || ev.type === 'response.created') armIdle()

    const next = applyRealtimeEvent(r.live, ev)
    if (next === r.live) return
    const { done, state } = takeFinished(next)
    r.live = state
    setStatus(state.status)
    setPartial(livePartial(state))
    if (done.length) opts.current.onFinal(done)
  }, [armIdle])

  const start = useCallback(async () => {
    const r = res.current
    if (r.pc || status === 'connecting') return
    const run = ++r.run
    const stale = () => run !== r.run
    setErrorCode(null)
    setStatus('connecting')

    try {
      if (typeof RTCPeerConnection === 'undefined' || !navigator.mediaDevices?.getUserMedia) throw new LiveError('unsupported')

      // 1. Micrófono (pide permiso).
      let mic: MediaStream
      try {
        mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      } catch (e) {
        const name = e instanceof DOMException ? e.name : ''
        throw new LiveError(name === 'NotFoundError' || name === 'OverconstrainedError' ? 'mic-missing' : 'mic-denied')
      }
      if (stale()) { mic.getTracks().forEach(t => t.stop()); return }
      r.mic = mic

      // 2. Secreto efímero desde el servidor.
      let secret = ''
      try {
        const resp = await fetch('/api/assistant/realtime', { method: 'POST' })
        if (resp.status === 403 || resp.status === 401) throw new LiveError('not-allowed')
        if (resp.status === 429) throw new LiveError('limit')
        if (!resp.ok) throw new LiveError('unavailable')
        secret = ((await resp.json()) as { value?: string }).value ?? ''
      } catch (e) {
        throw e instanceof LiveError ? e : new LiveError('unavailable')
      }
      if (!secret) throw new LiveError('unavailable')
      if (stale()) return

      // 3. Conexión WebRTC: micrófono hacia VARA, audio de VARA hacia acá, canal de datos para los eventos.
      const pc = new RTCPeerConnection()
      r.pc = pc
      const audio = new Audio()
      audio.autoplay = true
      r.audio = audio
      pc.ontrack = e => {
        audio.srcObject = e.streams[0]
        try {
          const ctx = new AudioContext()
          r.ctx = ctx
          const analyser = ctx.createAnalyser()
          analyser.fftSize = 512
          ctx.createMediaStreamSource(e.streams[0]).connect(analyser)
          const buf = new Uint8Array(analyser.fftSize)
          r.meter = setInterval(() => {
            analyser.getByteTimeDomainData(buf)
            let sum = 0
            for (const v of buf) sum += ((v - 128) / 128) ** 2
            levelRef.current = Math.min(1, Math.sqrt(sum / buf.length) * 4)
          }, 50)
        } catch { /* sin medidor: la boca usa el ritmo sintético */ }
      }
      mic.getTracks().forEach(t => pc.addTrack(t, mic))

      const dc = pc.createDataChannel('oai-events')
      r.dc = dc
      dc.onmessage = e => { if (typeof e.data === 'string') onEvent(e.data) }
      dc.onopen = () => {
        if (stale()) return
        // La voz retoma la conversación de texto que ya había.
        for (const m of historySeed(opts.current.getHistory(), opts.current.isError)) {
          dc.send(JSON.stringify({
            type: 'conversation.item.create',
            item: { type: 'message', role: m.role, content: [{ type: m.role === 'user' ? 'input_text' : 'output_text', text: m.text }] },
          }))
        }
        r.live = INITIAL_LIVE
        setStatus('listening')
        armIdle()
      }
      pc.onconnectionstatechange = () => {
        if (stale()) return
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') fail('dropped')
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      const answer = await fetch(CALLS_URL, {
        method: 'POST',
        body: offer.sdp,
        headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/sdp' },
      })
      if (!answer.ok) throw new LiveError('unavailable')
      const sdp = await answer.text()
      if (stale()) return
      await pc.setRemoteDescription({ type: 'answer', sdp })

      // Tope de duración de la sesión.
      r.maxTimer = setTimeout(() => fail('timeout'), LIVE_LIMITS.maxSessionMs)
    } catch (e) {
      if (stale()) return
      fail(e instanceof LiveError ? e.code : 'unavailable')
    }
  }, [status, onEvent, armIdle, fail])

  // Al salir de la pantalla o cerrar la pestaña: micrófono y conexión se cierran.
  useEffect(() => {
    const onHide = () => teardown()
    window.addEventListener('pagehide', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      teardown()
    }
  }, [teardown])

  return { status, errorCode, partial, levelRef, start, stop }
}
