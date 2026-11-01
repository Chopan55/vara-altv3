'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Send, Sparkles, Loader2, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface VARAAssistantProps {
  /** Contexto pre-cargado que se inyecta como primer mensaje del sistema. */
  context?: string
  /** Sugerencias iniciales para el usuario. */
  suggestions?: string[]
}

export function VARAAssistant({ context, suggestions }: VARAAssistantProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 120)
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || loading) return
    setInput('')

    const userMsg: Message = { role: 'user', content: msg }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          context: context ?? '',
        }),
      })

      if (res.status === 401) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Para usar el asistente necesitás estar logueado.' }])
        return
      }

      const data = await res.json() as { reply?: string; error?: string }
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply ?? data.error ?? 'Sin respuesta.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'No pude conectarme. Revisá tu conexión y reintentá.' }])
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, context])

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Abrir asistente VARA"
        className={cn(
          'fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg transition-all text-sm font-semibold',
          open
            ? 'bg-slate-800 text-white'
            : 'bg-brand-600 hover:bg-brand-700 text-white'
        )}
      >
        {open ? <ChevronDown size={16} /> : <Sparkles size={16} />}
        {open ? 'Cerrar' : 'VARA AI'}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-20 right-5 z-50 w-[min(380px,calc(100vw-2.5rem))] h-[min(520px,calc(100dvh-7rem))] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100 bg-slate-50 flex-shrink-0">
            <div className="w-8 h-8 rounded-xl bg-brand-100 flex items-center justify-center">
              <Sparkles size={14} className="text-brand-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 leading-none">VARA AI</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Asistente inmobiliario</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors" aria-label="Cerrar">
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-slate-500 leading-relaxed">
                  {context
                    ? 'Tengo el contexto de esta operación cargado. ¿Qué querés saber?'
                    : 'Hola, soy el asistente de VARA. Puedo ayudarte con costos, documentos, plazos, negociación y riesgos de tu operación inmobiliaria.'}
                </p>
                {suggestions && suggestions.length > 0 && (
                  <div className="space-y-1.5">
                    {suggestions.map(s => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="w-full text-left text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                  m.role === 'user'
                    ? 'bg-brand-600 text-white rounded-br-sm'
                    : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                )}>
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 rounded-2xl rounded-bl-sm px-3.5 py-2.5">
                  <Loader2 size={14} className="text-slate-400 animate-spin" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-slate-100 flex-shrink-0">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Escribí tu pregunta…"
                rows={1}
                className="flex-1 resize-none rounded-xl border border-slate-200 focus:border-brand-400 focus:outline-none px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 bg-white leading-relaxed max-h-28 overflow-y-auto"
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || loading}
                className="w-9 h-9 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0"
                aria-label="Enviar"
              >
                <Send size={14} className="text-white" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
