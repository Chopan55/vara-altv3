'use client'
import { useState, useRef, useEffect } from 'react'
import { useBrowserState } from '@/hooks/useHydrated'
import Link from 'next/link'
import { ArrowLeft, Copy, Send, User, ChevronDown, ChevronUp, Sparkles, Handshake, Volume2, VolumeX, Square, Loader2, Mic } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useVaraState } from '@/hooks/useVaraState'
import { useOperations, type OperationsState } from '@/hooks/useOperations'
import { useAssistantVoice } from '@/hooks/useAssistantVoice'
import { useRealtimeVoice } from '@/hooks/useRealtimeVoice'
import { VaraOrb } from '@/components/buy-v3/VaraOrb'
import { apiErrorMessage, safeJson } from '@/lib/api/client'
import { readChatStream, type FinalPayload } from '@/lib/assistant/chatStream'
import { isErrorMessage, isSpeakable, moodLabel, orbMoodFor } from '@/lib/assistant/voice'
import { liveErrorMessage, liveLabel, liveOrbMood } from '@/lib/assistant/realtime'
import { addAssistantMemory, clearAssistantMemories, deleteAssistantMemory, readAssistantMemories, readAssistantMemoryEnabled, writeAssistantMemoryEnabled, type AssistantMemory } from '@/lib/assistant/memory'
import { tryCreateClient } from '@/lib/supabase/client'

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

const OPERATION_ACTIONS_BUY = [
  'Prepará una pregunta para el vendedor',
  'Ayudame a pedir más tiempo antes de señar',
  'Armame un mensaje para contraofertar',
]

const OPERATION_ACTIONS_SELL = [
  'Prepará una respuesta a la oferta que recibí',
  'Armame un mensaje para pedir documentos al comprador',
  'Ayudame a pedir una mejora de oferta',
]

interface Message {
  role: 'user' | 'assistant'
  content: string
  time: string
  documentsForOperation?: string
  documentsUnavailable?: boolean
  draft?: string
  sources?: { kind: 'operation' | 'calculator' | 'knowledge' | 'general'; label: string; detail?: string; href?: string }[]
}

export default function AsistentePage() {
  const vara = useVaraState()
  const { journey, activeOperation } = useOperations()
  const scope = activeOperation?.id ?? 'general'
  return <AssistantConversation key={scope} vara={vara} journey={journey} activeOperation={activeOperation} scope={scope} />
}

function AssistantConversation({ vara, journey, activeOperation, scope }: {
  vara: ReturnType<typeof useVaraState>
  journey: OperationsState['journey']
  activeOperation: OperationsState['activeOperation']
  scope: string
}) {
  const historyKey = `vara_chat_history:${scope}`
  const nowTime = () => new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

  const name = vara.loaded ? vara.userName.split(' ')[0] : ''
  const welcomeMsg = `${name ? `¡Hola, ${name}!` : '¡Hola!'} ¿En qué parte de tu compra o venta estás? Puedo ayudarte a entender qué falta, revisar los gastos o preparar una pregunta antes de avanzar.`

  // El historial y la hora se leen después de montar: en el servidor no existen y,
  // si se calculan durante el render, el HTML no coincide y React falla (#418).
  // Se lee recién con el estado de VARA cargado, para saludar por el nombre.
  const [messages, setMessages] = useBrowserState<Message[]>(() => {
    if (!vara.loaded) return []
    let restored: Message[] = []
    try {
      const saved = sessionStorage.getItem(historyKey)
      // Se descartan errores técnicos que quedaron guardados como si fueran respuestas.
      if (saved) restored = (JSON.parse(saved) as Message[]).filter(m => !isErrorMessage(m.content))
    } catch { /* historial ilegible o storage bloqueado: se arranca de cero */ }
    return restored.length > 0 ? restored : [{ role: 'assistant', content: welcomeMsg, time: nowTime() }]
  }, [], vara.loaded)
  const ready = vara.loaded && messages.length > 0
  const [chatError, setChatError] = useState<{ auth: boolean; text: string } | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  // Texto provisorio de la respuesta mientras se está generando (se reemplaza por la respuesta final del servidor).
  const [streamText, setStreamText] = useState<string | null>(null)
  const streamFrame = useRef<number | null>(null)
  // Permite detener una respuesta en curso: corta el pedido y no se sigue gastando.
  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => () => abortRef.current?.abort(), [])
  // Si la persona subió a releer, el texto nuevo no la arrastra hacia abajo.
  const stickToBottom = useRef(true)
  const inputRef = useRef<HTMLInputElement>(null)
  const [showFaqs, setShowFaqs] = useState(false)
  // La memoria es de la cuenta: sin el id de la persona no se lee ni se guarda nada.
  const [memoryScope, setMemoryScope] = useState<string | null>(null)
  useEffect(() => {
    const supabase = tryCreateClient()
    if (!supabase) return
    let alive = true
    void supabase.auth.getUser().then(({ data }) => { if (alive) setMemoryScope(data.user?.id ?? null) })
    return () => { alive = false }
  }, [])
  const memoryKey = `${vara.loaded}:${memoryScope ?? ''}`
  const [memoryEnabled, setMemoryEnabled] = useBrowserState<boolean>(() => readAssistantMemoryEnabled(memoryScope), false, memoryKey)
  const [memories, setMemories] = useBrowserState<AssistantMemory[]>(() => readAssistantMemories(memoryScope), [], memoryKey)
  const [memoryDraft, setMemoryDraft] = useState('')
  const [memoryNotice, setMemoryNotice] = useState('')
  const [showMemory, setShowMemory] = useState(false)
  const [copyStatus, setCopyStatus] = useState<{ index: number; message: string }>()
  const bottomRef = useRef<HTMLDivElement>(null)
  // Se observa lo que realmente se ve: funciona igual si desplaza la página o un contenedor interno.
  useEffect(() => {
    const end = bottomRef.current
    if (!end || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => { stickToBottom.current = entry.isIntersecting }, { rootMargin: '0px 0px 160px 0px' })
    io.observe(end)
    return () => io.disconnect()
  }, [ready])
  const voice = useAssistantVoice()
  // Conversación de voz en tiempo real: lo que se dice queda en el mismo chat, en orden.
  const messagesRef = useRef<Message[]>([])
  useEffect(() => { messagesRef.current = messages }, [messages])
  const live = useRealtimeVoice({
    onFinal: entries => setMessages(prev => [...prev, ...entries.map(e => ({ role: e.role, content: e.text, time: nowTime() }))]),
    getHistory: () => messagesRef.current.slice(1).map(m => ({ role: m.role, content: m.content })),
    isError: isErrorMessage,
  })
  const liveMood = liveOrbMood(live.status)
  const liveActive = live.status !== 'off' && live.status !== 'error'
  // El avatar refleja lo que pasa de verdad; un error vuelve a reposo sin animación falsa.
  const mood = liveMood ?? orbMoodFor({ chatLoading: loading, voice: voice.status })
  const statusText = liveMood ? liveLabel(live.status) : moodLabel(mood as 'idle' | 'thinking' | 'speaking')

  function toggleLive() {
    if (liveActive) { live.stop(); return }
    voice.stop() // la lectura de una respuesta no se pisa con la conversación
    setChatError(null)
    void live.start(activeOperation?.id)
  }

  function toggleMemory(enabled: boolean) {
    if (!memoryScope) return
    writeAssistantMemoryEnabled(memoryScope, enabled)
    setMemoryEnabled(enabled)
    setMemoryNotice('')
  }

  function saveMemory() {
    if (!memoryScope || !memoryEnabled) return
    const result = addAssistantMemory(memoryScope, memoryDraft)
    if (result.rejected === 'vacio') return
    if (result.rejected === 'sensible') {
      setMemoryNotice('No guardamos claves, números de documento, de tarjeta o de cuenta. Escribí una preferencia, por ejemplo: «prefiero ver los montos en USD».')
      return
    }
    setMemoryNotice('')
    setMemories(result.memories)
    setMemoryDraft('')
  }

  function clearMemory() {
    clearAssistantMemories(memoryScope)
    setMemories([])
    setMemoryNotice('Borramos todos tus recuerdos.')
  }

  useEffect(() => {
    if (!ready) return
    try { sessionStorage.setItem(historyKey, JSON.stringify(messages)) } catch {}
  }, [messages, ready, historyKey])

  useEffect(() => {
    if (!stickToBottom.current) return
    // Mientras llega el texto, el desplazamiento es inmediato: varias animaciones suaves juntas se pisan y marean.
    bottomRef.current?.scrollIntoView({ behavior: streamText !== null ? 'auto' : 'smooth', block: 'end' })
  }, [messages, live.partial, streamText])

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
    stickToBottom.current = true
    const controller = new AbortController()
    abortRef.current = controller
    // Si algo falla o se detiene, solo se retira ESTE mensaje (no se pisan transcripciones de la voz que hayan llegado)
    // y el texto vuelve al campo únicamente si la persona no escribió otra cosa mientras tanto.
    const restore = () => {
      setMessages(prev => prev.filter(m => m !== newUserMsg))
      setInput(cur => (cur.trim() ? cur : msg))
    }

    const context = vara.loaded
      ? `Recorrido: ${journey === 'SELL' ? 'venta' : 'compra'} · Provincia: ${activeOperation?.province || vara.province}`
      : undefined

    try {
      const history = updatedMessages.slice(1).map(m => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, context, operationId: activeOperation?.id, includeNextStep: true, stream: true, assistantMemory: memoryEnabled && memoryScope ? memories.map(memory => memory.text) : undefined }),
        signal: controller.signal,
      })

      // Dos formas de respuesta: transmitida (el texto aparece mientras se genera) o JSON completa (costos y errores).
      let status = res.status
      let data: Partial<FinalPayload> & { error?: string } = {}
      let failed = false
      if (res.ok && (res.headers.get('content-type') ?? '').includes('ndjson') && res.body) {
        // El texto provisorio se pinta como mucho una vez por cuadro de pantalla: fluido y sin trabar el celular.
        let latest = ''
        const outcome = await readChatStream(res.body, history, text => {
          latest = text
          if (streamFrame.current === null) {
            streamFrame.current = requestAnimationFrame(() => { streamFrame.current = null; setStreamText(latest) })
          }
        })
        if (streamFrame.current !== null) { cancelAnimationFrame(streamFrame.current); streamFrame.current = null }
        setStreamText(null)
        if (outcome.kind === 'final') data = outcome.payload
        else { failed = true; status = outcome.kind === 'error' ? outcome.status : 0; data = { error: outcome.kind === 'error' ? outcome.error : undefined } }
      } else {
        data = await safeJson<Partial<FinalPayload> & { error?: string }>(res)
        failed = !res.ok || !data.reply
      }

      if (failed || !data.reply) {
        // Un error no es una respuesta del asistente: se avisa aparte y el mensaje vuelve al campo para reintentar.
        restore()
        // Detenerla fue decisión de la persona: no es un error.
        if (!controller.signal.aborted) setChatError(status === 0
          ? { auth: false, text: 'Se cortó la conexión mientras respondía. Probá de nuevo: tu mensaje sigue en el campo.' }
          : { auth: status === 401, text: status === 401 ? 'Tu sesión venció. Ingresá de nuevo para seguir conversando.' : apiErrorMessage(status, data.error) })
      } else {
        const reply = data.reply
        const documentsForOperation = data.nextStep?.target === 'documents'
          && data.nextStep.operationId === activeOperation?.id
          ? data.nextStep.operationId
          : undefined
        setMessages(prev => [...prev, {
          role: 'assistant', content: reply, time: nowTime(), documentsForOperation,
          documentsUnavailable: data.documentsUnavailable === true,
          draft: typeof data.draft === 'string' && data.draft.trim() ? data.draft : undefined,
          sources: Array.isArray(data.sources) ? data.sources.slice(0, 4) : undefined,
        }])
        // "Leer respuestas": solo respuestas reales, nunca errores (esos no llegan acá). Si la voz falla, el texto ya está.
        if (voice.autoRead && !liveActive) void voice.play(String(updatedMessages.length), reply, { silent: true })
      }
    } catch {
      restore()
      // Detenerla fue decisión de la persona: no es un error. El mensaje vuelve al campo por si quiere editarlo.
      if (!controller.signal.aborted) setChatError({ auth: false, text: 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo: tu mensaje sigue en el campo.' })
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setStreamText(null)
      setLoading(false)
      // El botón de detener desaparece: el foco vuelve al campo para que el teclado no quede sin destino.
      if (controller.signal.aborted) inputRef.current?.focus()
    }
  }

  async function copyReply(index: number, content: string) {
    try {
      await navigator.clipboard.writeText(content)
      setCopyStatus({ index, message: 'Copiado' })
    } catch {
      setCopyStatus({ index, message: 'No pudimos copiar. Podés seleccionar el texto y copiarlo.' })
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
            {/* El espacio del avatar es fijo: al crecer con la voz desborda sin empujar el resto de la pantalla. */}
            <div className="relative h-[72px] w-[72px] flex-none">
              <div className="absolute inset-0 flex items-center justify-center">
                <VaraOrb state={mood} size={liveActive ? 104 : 72} levelRef={liveActive ? live.levelRef : voice.levelRef} audio={liveActive ? live.status === 'speaking' : voice.status === 'speaking'} />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-bold text-slate-900 text-lg leading-tight">Asistente VARA</h1>
              {/* El estado también está escrito: no depende de la animación. */}
              <p role="status" aria-live="polite" data-testid="assistant-status" className="text-sm text-brand-700 font-medium mt-0.5">
                {statusText}
              </p>
              <p className="mt-0.5 text-xs text-slate-600">Te ayuda a entender y dar el próximo paso</p>
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

          <button type="button" onClick={() => setShowMemory(value => !value)} aria-expanded={showMemory} aria-controls="memoria-asistente" className="mt-3 ml-2 inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
            Memoria {memoryEnabled ? '· activada' : '· apagada'}
          </button>
          {showMemory && (
            <section id="memoria-asistente" aria-label="Memoria del asistente" className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-800">Memoria de VARA</p>
                  <p className="text-xs text-slate-500">Se guarda en este navegador, solo para tu cuenta. Si la activás, tus recuerdos viajan con cada pregunta al servicio de IA que usa VARA para responderte. No guardes claves ni números de documento.</p>
                  {!memoryScope && <p role="status" className="mt-1 text-xs text-amber-800">Entrá con tu cuenta para usar la memoria.</p>}
                </div>
                <button type="button" role="switch" aria-checked={memoryEnabled} disabled={!memoryScope} onClick={() => toggleMemory(!memoryEnabled)} className={cn('min-h-11 rounded-full px-4 py-1 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50', memoryEnabled ? 'bg-brand-100 text-brand-800' : 'bg-slate-100 text-slate-600')}>
                  {memoryEnabled ? 'Activada' : 'Apagada'}
                </button>
              </div>
              {memoryEnabled && <>
                <div className="mt-3 flex gap-2">
                  <input value={memoryDraft} onChange={event => setMemoryDraft(event.target.value)} placeholder="Ej.: prefiero ver los montos en USD" aria-label="Nuevo recuerdo" maxLength={240} className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 sm:text-xs" />
                  <button type="button" onClick={saveMemory} className="min-h-11 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">Guardar</button>
                </div>
                {memories.length > 0 && <ul className="mt-3 space-y-2">{memories.map(memory => <li key={memory.id} className="flex items-start justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700"><span>{memory.text}</span><button type="button" onClick={() => setMemories(deleteAssistantMemory(memoryScope, memory.id))} className="min-h-11 shrink-0 px-2 font-semibold text-slate-500 underline focus-visible:outline-2 focus-visible:outline-brand-500" aria-label={`Borrar recuerdo: ${memory.text}`}>Borrar</button></li>)}</ul>}
                {memoryNotice && <p role="status" className="mt-2 text-xs text-slate-600">{memoryNotice}</p>}
                {memories.length > 0 && <button type="button" onClick={clearMemory} className="mt-3 min-h-11 text-xs font-semibold text-slate-600 underline focus-visible:outline-2 focus-visible:outline-brand-500">Borrar toda la memoria</button>}
              </>}
            </section>
          )}

          {/* Conversación de voz: micrófono solo mientras la sesión está activa. */}
          <button
            type="button"
            onClick={toggleLive}
            aria-pressed={liveActive}
            disabled={live.status === 'connecting'}
            className={cn(
              'mt-3 ml-2 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-60',
              liveActive ? 'bg-slate-900 text-white hover:bg-slate-700' : 'bg-brand-600 text-white hover:bg-brand-700',
            )}
          >
            {liveActive ? <Square size={12} aria-hidden="true" /> : live.status === 'connecting' ? <Loader2 size={12} className="motion-safe:animate-spin" aria-hidden="true" /> : <Mic size={13} aria-hidden="true" />}
            {liveActive ? 'Terminar conversación' : live.status === 'connecting' ? 'Conectando…' : 'Hablar con VARA'}
          </button>
          {live.status === 'error' && live.errorCode && (
            <p role="status" className="mt-2 text-xs text-amber-800">{liveErrorMessage(live.errorCode)}</p>
          )}
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
            aria-expanded={showFaqs}
            className="text-xs text-brand-700 font-semibold flex items-center gap-1"
          >
            <Sparkles size={12} />
            Preguntas frecuentes
            {showFaqs ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {activeOperation && (
            <button type="button" disabled={loading}
              onClick={() => sendMessage('¿Qué me falta para avanzar?')}
              className="mt-2 min-h-11 rounded-xl border border-brand-200 bg-brand-50 px-3 text-sm font-semibold text-brand-800 focus-visible:outline-2 focus-visible:outline-brand-700 disabled:opacity-50">
              ¿Qué me falta para avanzar?
            </button>
          )}
          {activeOperation && (
            <div className="mt-2 flex flex-wrap gap-2">
              {(journey === 'SELL' ? OPERATION_ACTIONS_SELL : OPERATION_ACTIONS_BUY).map(q => (
                <button key={q} type="button" disabled={loading} onClick={() => sendMessage(q)}
                  className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-brand-700 disabled:opacity-50">
                  {q}
                </button>
              ))}
            </div>
          )}
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
                'rounded-2xl px-4 py-3',
                msg.draft ? 'w-full sm:max-w-[80%]' : 'max-w-[80%]',
                msg.role === 'user'
                  ? 'bg-slate-900 text-white rounded-tr-sm'
                  : 'bg-white shadow-card text-slate-800 rounded-tl-sm'
              )}>
                <p className="text-sm leading-relaxed whitespace-pre-line">{msg.content}</p>
                {msg.role === 'assistant' && msg.documentsUnavailable && (
                  <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">
                    No pudimos verificar el estado de tus documentos en este momento.
                  </p>
                )}
                {msg.role === 'assistant' && msg.documentsForOperation && (
                  <Link href={`/operacion/${encodeURIComponent(msg.documentsForOperation)}?tab=documentos`}
                    className="mt-3 inline-flex rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800 hover:underline">
                    Revisar documentos
                  </Link>
                )}
                {msg.role === 'assistant' && msg.draft && (
                  <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50/60 p-3" data-testid="assistant-draft">
                    <p className="text-xs font-bold text-brand-800">Borrador para revisar</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-800 whitespace-pre-line">{msg.draft}</p>
                    <p className="mt-2 text-xs text-slate-600">VARA no lo envía. Revisalo, completá lo que está entre corchetes y mandalo vos.</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => void copyReply(-(i + 1), msg.draft ?? '')}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">
                        <Copy size={12} aria-hidden="true" /> Copiar borrador
                      </button>
                      {copyStatus?.index === -(i + 1) && <span role="status" className="text-xs text-slate-700">{copyStatus.message}</span>}
                    </div>
                  </div>
                )}
                {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                  <ul aria-label="En qué se basa esta respuesta" className="mt-3 flex flex-wrap gap-1.5" data-testid="reply-sources">
                    {msg.sources.map(src => {
                      const chip = (
                        <>
                          <span className="font-semibold">{src.label}</span>
                          {src.detail && <span className="text-slate-600"> · {src.detail}</span>}
                        </>
                      )
                      const tone = src.kind === 'general' ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-emerald-200 bg-emerald-50 text-emerald-950'
                      return (
                        <li key={src.label}>
                          {src.href ? (
                            <Link href={src.href} className={cn('inline-block rounded-lg border px-2.5 py-1 text-xs hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700', tone)}>{chip}</Link>
                          ) : (
                            <span className={cn('inline-block rounded-lg border px-2.5 py-1 text-xs', tone)}>{chip}</span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
                <p className={cn('text-[10px] mt-1', msg.role === 'user' ? 'text-slate-400' : 'text-slate-300')}>
                  {msg.time}
                </p>
                {msg.role === 'assistant' && isSpeakable(msg.content) && (() => {
                  const id = String(i)
                  const mine = voice.activeId === id
                  return (
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <button type="button" onClick={() => void copyReply(i, msg.content)}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-slate-100 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                        <Copy size={12} aria-hidden="true" /> Copiar respuesta
                      </button>
                      {copyStatus?.index === i && <span role="status" className="text-xs text-slate-700">{copyStatus.message}</span>}
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
          {live.partial.map(p => (
            <div key={p.id} className={cn('flex gap-3', p.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[80%] rounded-2xl px-4 py-3 opacity-80', p.role === 'user' ? 'bg-slate-900 text-white rounded-tr-sm' : 'bg-white shadow-card text-slate-800 rounded-tl-sm')}>
                <p className="text-sm leading-relaxed whitespace-pre-line">{p.text}</p>
              </div>
            </div>
          ))}
          {loading && streamText && (
            <div className="flex gap-3 justify-start" data-testid="stream-bubble">
              <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-slate-800 shadow-card" aria-busy="true">
                <p className="whitespace-pre-line text-sm leading-relaxed">
                  {streamText}
                  <span aria-hidden="true" className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-brand-600 motion-safe:animate-pulse" />
                </p>
              </div>
            </div>
          )}
          {loading && !streamText && (
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
          {messages.length <= 1 && !loading && !activeOperation && (
            <div className="flex flex-wrap gap-2" data-testid="starter-chips" role="group" aria-label="Preguntas para empezar">
              {(journey === 'SELL' ? SELLER_FAQS : BUYER_FAQS).slice(0, 3).map(q => (
                <button key={q} type="button" onClick={() => sendMessage(q)}
                  className="min-h-11 rounded-xl border border-brand-200 bg-brand-50 px-3 text-left text-sm font-semibold text-brand-800 hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-brand-700">
                  {q}
                </button>
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-white border-t border-slate-100 px-4 py-3 flex-shrink-0 mb-16">
        <div className="max-w-4xl mx-auto flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Preguntá sobre costos, plazos, documentos..."
            aria-label="Mensaje al asistente"
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-400 focus:bg-white focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-1 transition-colors"
          />
          {loading ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              aria-label="Detener respuesta"
              className="w-10 h-10 bg-slate-900 hover:bg-slate-700 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              <Square size={14} className="text-white" aria-hidden="true" />
            </button>
          ) : (
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim()}
              aria-label="Enviar mensaje"
              className="w-10 h-10 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
            >
              <Send size={16} className="text-slate-900" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

    </div>
  )
}
