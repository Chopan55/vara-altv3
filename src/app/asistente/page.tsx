'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Send, User, ChevronDown, ChevronUp, Sparkles, Handshake, Volume2, VolumeX, Square, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useVaraState } from '@/hooks/useVaraState'
import { useOperations } from '@/hooks/useOperations'
import { useAssistantVoice } from '@/hooks/useAssistantVoice'
import { VaraOrb } from '@/components/buy-v3/VaraOrb'
import { apiErrorMessage, safeJson } from '@/lib/api/client'
import { isErrorMessage, isSpeakable, moodLabel, orbMoodFor } from '@/lib/assistant/voice'

const BUYER_FAQS = [
  '¿Qué documentos le pido al vendedor?',
  '¿Cómo hago una oferta y qué incluye?',
  '¿Cuánto cuesta escriturar en Buenos Aires?',
  '¿Cuánto tiempo tarda la operación?',
]

const SELLER_FAQS = [
  '¿Qué impuestos paga el vendedor?',
  '¿Cómo fijo el precio de publicación?',
  '¿Qué documentación necesito para vender?',
  '¿Cómo negocio una contra-oferta?',
]

interface Message {
  role: 'user' | 'assistant'
  content: string
  time: string
}

export default function AsistentePage() {
  const vara = useVaraState()
  const { journey, activeOperation } = useOperations()
  const nowTime = () => new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

  const welcomeMsg = (() => {
    const name = vara.loaded ? vara.userName.split(' ')[0] : ''
    const kind = journey === 'SELL' ? 'venta' : 'compra'
    return `${name ? `¡Hola, ${name}!` : '¡Hola!'} Soy el Asistente VARA, especializado en operaciones inmobiliarias argentinas.

Puedo ayudarte con tu operación de ${kind}: costos, documentación, plazos, negociación, riesgos legales, y cualquier duda del proceso. ¿Qué querés saber?`
  })()

  // El historial y la hora se leen después de montar: en el servidor no existen y,
  // si se calculan durante el render, el HTML no coincide y React falla (#418).
  const [messages, setMessages] = useState<Message[]>([])
  const [ready, setReady] = useState(false)
  const [chatError, setChatError] = useState<{ auth: boolean; text: string } | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showFaqs, setShowFaqs] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const voice = useAssistantVoice()
  // El avatar refleja lo que pasa de verdad; un error vuelve a reposo sin animación falsa.
  const mood = orbMoodFor({ chatLoading: loading, voice: voice.status })

  useEffect(() => {
    if (ready || !vara.loaded) return
    let restored: Message[] = []
    try {
      const saved = sessionStorage.getItem('vara_chat_history')
      // Se descartan errores técnicos que quedaron guardados como si fueran respuestas.
      if (saved) restored = (JSON.parse(saved) as Message[]).filter(m => !isErrorMessage(m.content))
    } catch {}
    setMessages(restored.length > 0 ? restored : [{ role: 'assistant', content: welcomeMsg, time: nowTime() }])
    setReady(true)
  }, [vara.loaded]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready) return
    try { sessionStorage.setItem('vara_chat_history', JSON.stringify(messages)) } catch {}
  }, [messages, ready])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text?: string) {
    const msg = text ?? input.trim()
    if (!msg || loading) return
    const time = nowTime()
    setChatError(null)
    voice.stop() // lo que esté sonando se corta: la persona ya pasó a otra pregunta
    const newUserMsg: Message = { role: 'user', content: msg, time }
    const updatedMessages = [...messages, newUserMsg]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    const context = vara.loaded
      ? `Usuario: ${vara.userName} · Recorrido: ${journey === 'SELL' ? 'venta' : 'compra'}${activeOperation ? ` · Operación: ${activeOperation.title}` : ''} · Provincia: ${activeOperation?.province || vara.province}`
      : undefined

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.slice(1).map(m => ({ role: m.role, content: m.content })),
          context,
        }),
      })
      const data = await safeJson<{ reply?: string; error?: string }>(res)
      if (!res.ok || !data.reply) {
        // Un error no es una respuesta del asistente: se avisa aparte y el mensaje vuelve al campo para reintentar.
        setMessages(messages)
        setInput(msg)
        setChatError({ auth: res.status === 401, text: res.status === 401 ? 'Tu sesión venció. Ingresá de nuevo para seguir conversando.' : apiErrorMessage(res.status, data.error) })
      } else {
        const reply = data.reply as string
        setMessages(prev => [...prev, { role: 'assistant', content: reply, time: nowTime() }])
        // "Leer respuestas": solo respuestas reales, nunca errores (esos no llegan acá). Si la voz falla, el texto ya está.
        if (voice.autoRead) void voice.play(String(updatedMessages.length), reply, { silent: true })
      }
    } catch {
      setMessages(messages)
      setInput(msg)
      setChatError({ auth: false, text: 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo: tu mensaje sigue en el campo.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col pb-20">
      {/* Header */}
      <header className="px-4 lg:px-6 pt-8 pb-3 flex-shrink-0">
        <div className="max-w-4xl mx-auto">
                      <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm mb-4 transition-colors">
              <ArrowLeft size={14} /> Volver al inicio
            </Link>
          {/* VARA es el protagonista: el avatar vive acá, compacto, y refleja lo que pasa de verdad. */}
          <div className="flex items-center gap-4">
            <VaraOrb state={mood} size={72} levelRef={voice.levelRef} audio={voice.status === 'speaking'} />
            <div className="min-w-0 flex-1">
              <h1 className="font-bold text-slate-900 text-lg leading-tight">Asistente VARA</h1>
              {/* El estado también está escrito: no depende de la animación. */}
              <p role="status" aria-live="polite" data-testid="assistant-status" className="text-sm text-brand-700 font-medium mt-0.5">
                {moodLabel(mood)}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Especializado en operaciones inmobiliarias AR</p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={voice.autoRead}
            onClick={() => voice.setAutoRead(!voice.autoRead)}
            className={cn(
              'mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
              voice.autoRead ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
            )}
          >
            {voice.autoRead ? <Volume2 size={13} aria-hidden="true" /> : <VolumeX size={13} aria-hidden="true" />}
            Leer respuestas
            <span className="font-normal text-slate-500">{voice.autoRead ? '· activado' : '· desactivado'}</span>
          </button>
        </div>
      </header>

      {/* Coach de negociación */}
      <div className="bg-brand-50 border-b border-brand-100 px-4 py-2.5 flex-shrink-0">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/negociacion"
            className="flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-900 transition-colors"
          >
            <Handshake size={14} />
            Coach de Negociación — pegá el mensaje y VARA te dice qué responder
            <span className="ml-auto text-brand-400 text-xs">→</span>
          </Link>
        </div>
      </div>

      {/* FAQ chips */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex-shrink-0">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => setShowFaqs(o => !o)}
            className="text-xs text-brand-700 font-semibold flex items-center gap-1"
          >
            <Sparkles size={12} />
            Preguntas frecuentes
            {showFaqs ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {showFaqs && (
            <div className="mt-2 flex flex-wrap gap-2">
              {(journey === 'SELL' ? SELLER_FAQS : BUYER_FAQS).map(q => (
                <button
                  key={q}
                  onClick={() => { setShowFaqs(false); sendMessage(q) }}
                  className="text-xs bg-brand-50 text-brand-700 border border-brand-200 px-3 py-1.5 rounded-full hover:bg-brand-100 transition-colors text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn(
                'max-w-[80%] rounded-2xl px-4 py-3',
                msg.role === 'user'
                  ? 'bg-slate-900 text-white rounded-tr-sm'
                  : 'bg-white shadow-card text-slate-800 rounded-tl-sm'
              )}>
                <p className="text-sm leading-relaxed whitespace-pre-line">{msg.content}</p>
                <p className={cn('text-[10px] mt-1', msg.role === 'user' ? 'text-slate-400' : 'text-slate-300')}>
                  {msg.time}
                </p>
                {msg.role === 'assistant' && isSpeakable(msg.content) && (() => {
                  const id = String(i)
                  const mine = voice.activeId === id
                  return (
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                      {mine && voice.status === 'speaking' ? (
                        <button type="button" onClick={voice.stop} aria-label="Detener lectura" className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100">
                          <Square size={11} aria-hidden="true" /> Detener
                        </button>
                      ) : mine && voice.status === 'loading' ? (
                        <button type="button" onClick={voice.stop} aria-label="Cancelar lectura" className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200">
                          <Loader2 size={11} className="motion-safe:animate-spin" aria-hidden="true" /> Preparando voz…
                        </button>
                      ) : (
                        <button type="button" onClick={() => void voice.play(id, msg.content)} aria-label="Escuchar respuesta" className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200">
                          <Volume2 size={11} aria-hidden="true" /> Escuchar
                        </button>
                      )}
                      {voice.failedId === id && (
                        <span role="status" className="text-[11px] text-slate-400">No pudimos reproducir la voz ahora. El texto sigue acá.</span>
                      )}
                    </div>
                  )
                })()}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-slate-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User size={14} className="text-slate-600" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="bg-white shadow-card rounded-2xl rounded-tl-sm px-4 py-3" role="status" aria-label="VARA está pensando">
                <div className="flex gap-1 items-center h-5">
                  <span className="w-2 h-2 bg-slate-300 rounded-full motion-safe:animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-slate-300 rounded-full motion-safe:animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-slate-300 rounded-full motion-safe:animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          {chatError && (
            <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p>{chatError.text}</p>
              <div className="mt-2 flex gap-3 text-xs font-semibold">
                {chatError.auth && <Link href="/login?next=/asistente" className="underline">Ingresar de nuevo</Link>}
                <button type="button" onClick={() => sendMessage()} className="underline">Reintentar</button>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-white border-t border-slate-100 px-4 py-3 flex-shrink-0 mb-16">
        <div className="max-w-4xl mx-auto flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Preguntá sobre costos, plazos, documentos..."
            aria-label="Mensaje al asistente"
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-400 focus:bg-white focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-1 transition-colors"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            aria-label="Enviar mensaje"
            className="w-10 h-10 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
          >
            <Send size={16} className="text-slate-900" aria-hidden="true" />
          </button>
        </div>
      </div>

    </div>
  )
}
