'use client'

/**
 * VARA AI flotante — disponible desde cualquier pantalla.
 *
 * Punto de entrada rápido para el usuario sin navegar a /asistente.
 * Usa el mismo endpoint /api/chat con contexto de la página actual.
 *
 * Diseño: FAB fijo abajo-derecha. Click abre panel slide-up de 340px.
 * Máx. 8 mensajes visibles. No persiste entre sesiones de navegador.
 */

import { useState, useRef, useEffect } from 'react'
import { MessageSquare, X, Send, Loader2, Minimize2 } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useVaraState } from '@/hooks/useVaraState'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const PAGE_CONTEXT: Record<string, string> = {
  '/dashboard': 'El usuario está en su panel de inicio viendo sus operaciones activas.',
  '/costos': 'El usuario está calculando costos de escrituración y gastos de compraventa.',
  '/propiedades': 'El usuario está gestionando sus propiedades importadas.',
  '/visitas': 'El usuario está usando el checklist de visita de propiedades.',
  '/vara-labs': 'El usuario está en VARA Labs explorando herramientas de negociación.',
  '/negociacion': 'El usuario está en el módulo de negociación inteligente.',
  '/acciones': 'El usuario está en el centro de acciones viendo todas sus tareas pendientes urgentes.',
}

function getPageContext(pathname: string, operationId: string): string {
  for (const [prefix, ctx] of Object.entries(PAGE_CONTEXT)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return ctx
  }
  if (pathname.startsWith('/operacion/')) {
    return `El usuario está viendo el detalle de su operación${operationId ? ` (ID: ${operationId})` : ''}.`
  }
  return 'El usuario está navegando VARA.'
}

const QUICK_QUESTIONS = [
  '¿Cuánto pago de sellos?',
  '¿Qué es el boleto de compraventa?',
  '¿Cuánto tarda una escritura?',
]

export function VaraAIFloat() {
  const pathname = usePathname()
  const vara = useVaraState()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // Sin shell o en asistente: no mostrar el FAB
  if (
    pathname === '/' ||
    pathname === '/onboarding' ||
    pathname === '/login' ||
    pathname === '/asistente' ||
    pathname.startsWith('/visit/')
  ) return null

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || loading) return

    const next: Message[] = [...messages, { role: 'user', content }]
    setMessages(next)
    setInput('')
    setLoading(true)

    try {
      const context = getPageContext(pathname, vara.operationId)
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, context }),
      })
      const data = await res.json() as { message?: string; reply?: string; content?: string }
      const reply = data.message ?? data.reply ?? data.content ?? 'Sin respuesta.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'No pude conectarme ahora. Probá de nuevo.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {open && (
        <div
          className={cn(
            'fixed bottom-20 right-4 z-50',
            'w-[340px] max-w-[calc(100vw-2rem)]',
            'bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col',
          )}
          style={{ maxHeight: 'min(480px, calc(100dvh - 120px))' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-brand-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <MessageSquare size={13} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 leading-none">VARA AI</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Preguntá lo que necesitás</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label="Minimizar"
            >
              <Minimize2 size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
            {messages.length === 0 ? (
              <div className="pt-1">
                <p className="text-xs text-slate-400 text-center mb-3">¿En qué te puedo ayudar?</p>
                <div className="space-y-1.5">
                  {QUICK_QUESTIONS.map(q => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="w-full text-left text-xs text-slate-600 bg-slate-50 hover:bg-brand-50 hover:text-brand-700 px-3 py-2 rounded-xl transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.slice(-8).map((m, i) => (
                <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap',
                    m.role === 'user'
                      ? 'bg-brand-600 text-white rounded-br-sm'
                      : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                  )}>
                    {m.content}
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 rounded-2xl rounded-bl-sm px-3 py-2.5">
                  <Loader2 size={12} className="animate-spin text-slate-400" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="px-3 pb-3 pt-2 flex-shrink-0 border-t border-slate-50">
            <div className="flex items-center gap-2 bg-slate-50 rounded-xl border border-slate-200 focus-within:border-brand-400 transition-colors px-3 py-2">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                placeholder="Escribí tu consulta…"
                disabled={loading}
                className="flex-1 text-xs text-slate-700 bg-transparent outline-none placeholder:text-slate-300 disabled:opacity-50 min-w-0"
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || loading}
                className="text-brand-600 hover:text-brand-700 disabled:opacity-30 flex-shrink-0 transition-colors"
                aria-label="Enviar"
              >
                <Send size={13} />
              </button>
            </div>
            <p className="text-[10px] text-slate-300 mt-1.5 text-center">
              Para historial completo:{' '}
              <a href="/asistente" className="hover:text-brand-500 underline">Asistente VARA</a>
            </p>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'fixed bottom-4 right-4 z-50 w-12 h-12 rounded-2xl shadow-lg',
          'flex items-center justify-center transition-all duration-200',
          open
            ? 'bg-slate-700 hover:bg-slate-800 text-white'
            : 'bg-brand-600 hover:bg-brand-700 text-white'
        )}
        aria-label={open ? 'Cerrar VARA AI' : 'Abrir VARA AI'}
      >
        {open ? <X size={18} /> : <MessageSquare size={18} />}
      </button>
    </>
  )
}
