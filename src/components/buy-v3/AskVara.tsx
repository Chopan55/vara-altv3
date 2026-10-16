'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Send } from 'lucide-react'
import { buildBrief } from '@/lib/analysis/brief'
import type { PropertyAnalysis } from '@/lib/analysis/types'
import { Section } from './Sections'
import { VaraAvatar, type AvatarState } from './VaraAvatar'

interface Msg { role: 'user' | 'assistant'; content: string }

const AVATAR_KEY = 'vara.avatar'
/** Caracteres que se muestran por tick mientras VARA "habla" (cada 28 ms). */
const REVEAL_STEP = 3

function reducedMotion(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

const SUGGESTIONS = [
  '¿Por qué dice eso del precio?',
  '¿Qué le preguntaría al vendedor?',
  '¿Qué comparables pesan más y por qué?',
]

/**
 * Preguntarle a VARA sobre ESTE análisis.
 *
 * Solo aparece si el servidor confirma que la IA está habilitada para la
 * cuenta (no se promete lo que no funciona). La IA recibe únicamente los
 * hechos ya calculados y el servidor descarta respuestas con números que el
 * análisis no tiene.
 */
export function AskVara({ analysis, onAsk }: { analysis: PropertyAnalysis; onAsk?: () => void }) {
  const [enabled, setEnabled] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottom = useRef<HTMLDivElement>(null)
  const brief = useMemo(() => buildBrief(analysis), [analysis])
  // Avatar: lo ve quien no lo apagó. Lo decide cada persona y se recuerda en este navegador.
  const [showAvatar, setShowAvatar] = useState(true)
  // Cuántos caracteres de la última respuesta ya se mostraron (VARA "habla" mientras se completa).
  const [revealed, setRevealed] = useState<number | null>(null)

  useEffect(() => {
    try { if (localStorage.getItem(AVATAR_KEY) === 'off') setShowAvatar(false) } catch { /* sin storage */ }
  }, [])

  const toggleAvatar = () => {
    const next = !showAvatar
    setShowAvatar(next)
    try { localStorage.setItem(AVATAR_KEY, next ? 'on' : 'off') } catch { /* sin storage */ }
  }

  const last = messages[messages.length - 1]
  const speaking = revealed !== null && last?.role === 'assistant' && revealed < last.content.length
  const avatarState: AvatarState = loading ? 'thinking' : speaking ? 'speaking' : 'idle'

  useEffect(() => {
    if (revealed === null || !last || last.role !== 'assistant' || revealed >= last.content.length) return
    const t = setTimeout(() => setRevealed(r => (r === null ? r : r + REVEAL_STEP)), 28)
    return () => clearTimeout(t)
  }, [revealed, last])

  useEffect(() => {
    let alive = true
    fetch('/api/v3/explain')
      .then(r => (r.ok ? r.json() : { enabled: false }))
      .then((j: { enabled?: boolean }) => { if (alive) setEnabled(!!j.enabled) })
      .catch(() => { if (alive) setEnabled(false) })
    return () => { alive = false }
  }, [])

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [messages])

  if (!enabled) return null

  const ask = async (text: string) => {
    const q = text.trim()
    if (!q || loading) return
    setInput('')
    const history: Msg[] = [...messages, { role: 'user', content: q }]
    setMessages(history)
    setLoading(true)
    onAsk?.()
    try {
      const res = await fetch('/api/v3/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, messages: history }),
      })
      const j = (await res.json()) as { reply?: string; error?: string }
      if (res.status === 403) setEnabled(false)
      setMessages(m => [...m, { role: 'assistant', content: j.reply ?? j.error ?? 'No pude responder ahora.' }])
      setRevealed(reducedMotion() ? null : 0)
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'No pude conectarme. Probá de nuevo.' }])
      setRevealed(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Section title="Preguntale a VARA" hint="Responde solo con lo que está en este análisis. Si algo no se sabe, te lo dice.">
      <div className="mb-4 flex items-center gap-4">
        {showAvatar && <VaraAvatar state={avatarState} size={88} />}
        <div className="min-w-0 flex-1 text-sm text-slate-600" aria-live="polite">
          <p className="font-medium text-slate-800">
            {avatarState === 'thinking' ? 'Pensando…' : avatarState === 'speaking' ? 'Te cuento…' : 'Estoy lista. ¿Qué querés saber?'}
          </p>
          <button type="button" onClick={toggleAvatar}
            className="mt-1 text-xs text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline">
            {showAvatar ? 'Ocultar avatar' : 'Mostrar avatar'}
          </button>
        </div>
      </div>

      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map(s => (
            <button key={s} type="button" onClick={() => ask(s)}
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
              {s}
            </button>
          ))}
        </div>
      )}

      {messages.length > 0 && (
        <ul className="space-y-3" aria-live="polite">
          {messages.map((m, i) => {
            const isLast = i === messages.length - 1
            const text = isLast && speaking && revealed !== null ? m.content.slice(0, revealed) : m.content
            return (
              <li key={i} className={m.role === 'user' ? 'text-right' : ''}>
                <span onClick={isLast && speaking ? () => setRevealed(null) : undefined}
                  className={m.role === 'user'
                    ? 'inline-block max-w-[85%] rounded-2xl bg-slate-900 px-3 py-2 text-left text-sm text-white'
                    : 'inline-block max-w-[95%] whitespace-pre-wrap rounded-2xl bg-slate-100 px-3 py-2 text-left text-sm text-slate-800'}>
                  {text}
                </span>
              </li>
            )
          })}
          <div ref={bottom} />
        </ul>
      )}

      <form className="mt-3 flex gap-2" onSubmit={e => { e.preventDefault(); void ask(input) }}>
        <input value={input} onChange={e => setInput(e.target.value)} maxLength={600}
          placeholder="Preguntá algo sobre esta propiedad…" aria-label="Pregunta sobre esta propiedad"
          className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500" />
        <button type="submit" disabled={!input.trim() || loading} aria-label="Enviar pregunta"
          className="rounded-xl bg-slate-900 px-3 text-white disabled:opacity-40">
          <Send size={16} />
        </button>
      </form>
    </Section>
  )
}
