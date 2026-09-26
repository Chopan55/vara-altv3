'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Send, Bot, User, ChevronDown, ChevronUp, Sparkles, Handshake } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useVaraState } from '@/hooks/useVaraState'

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

  const welcomeMsg = (() => {
    const name = vara.loaded ? vara.userName.split(' ')[0] : 'Francisco'
    const journey = vara.journeyType === 'SELL_PROPERTY' ? 'venta' : 'compra'
    return `¡Hola, ${name}! Soy el Asistente VARA, especializado en operaciones inmobiliarias argentinas.\n\nPuedo ayudarte con tu operación de ${journey}: costos, documentación, plazos, negociación, riesgos legales, y cualquier duda del proceso. ¿Qué querés saber?`
  })()

  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = sessionStorage.getItem('vara_chat_history')
      if (saved) return JSON.parse(saved) as Message[]
    } catch {}
    return [{ role: 'assistant', content: welcomeMsg, time: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) }]
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showFaqs, setShowFaqs] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try { sessionStorage.setItem('vara_chat_history', JSON.stringify(messages)) } catch {}
  }, [messages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text?: string) {
    const msg = text ?? input.trim()
    if (!msg || loading) return
    const time = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    const newUserMsg: Message = { role: 'user', content: msg, time }
    const updatedMessages = [...messages, newUserMsg]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    const context = vara.loaded
      ? `Usuario: ${vara.userName} · Journey: ${vara.journeyType} · Provincia: ${vara.province}`
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
      const data = await res.json()
      const reply = data.reply ?? data.error ?? 'Error al procesar tu consulta.'
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: reply,
        time: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'No pude conectarme al servidor. Verificá tu conexión e intentá de nuevo.',
        time: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
      }])
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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center flex-shrink-0">
              <Bot size={18} className="text-slate-900" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-base">Asistente VARA</h1>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />
                Especializado en operaciones inmobiliarias AR
              </p>
            </div>
          </div>
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
              {(vara.journeyType === 'SELL_PROPERTY' ? SELLER_FAQS : BUYER_FAQS).map(q => (
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
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-xl bg-brand-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot size={14} className="text-slate-900" />
                </div>
              )}
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
              <div className="w-8 h-8 rounded-xl bg-brand-500 flex items-center justify-center flex-shrink-0">
                <Bot size={14} className="text-slate-900" />
              </div>
              <div className="bg-white shadow-card rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1 items-center h-5">
                  <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
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
