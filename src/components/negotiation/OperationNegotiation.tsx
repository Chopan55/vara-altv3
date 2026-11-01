'use client'
import { useState, useCallback } from 'react'
import {
  MessageCircle, BarChart3, Target, Lightbulb, Phone,
  Zap, RefreshCw, FileText, Copy, Check, AlertTriangle,
  Loader2, ChevronDown, Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  NegotiationMode, NegotiationContext, NegotiationResponse, EmotionAlert,
} from '@/app/api/negotiation/route'
import type { CountryCode } from '@/types'

type Channel = 'whatsapp' | 'email' | 'telefono' | 'otro'

const MODES: { id: NegotiationMode; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'reply',    label: 'Responder',    icon: MessageCircle, description: 'Analizá el mensaje y VARA te dice qué responder' },
  { id: 'analyze',  label: 'Analizar',     icon: BarChart3,     description: 'Entendé qué hay detrás de lo que te dijeron' },
  { id: 'prepare',  label: 'Preparar',     icon: Target,        description: 'Armá tu estrategia antes de negociar' },
  { id: 'strategy', label: 'Estrategia',   icon: Lightbulb,     description: '¿Cuál es el mejor movimiento ahora?' },
  { id: 'call',     label: 'Llamada',      icon: Phone,         description: 'Preparate para una llamada' },
  { id: 'offer',    label: 'Oferta',       icon: Zap,           description: 'Redactá una oferta estratégica' },
  { id: 'counter',  label: 'Contraoferta', icon: RefreshCw,     description: 'Preparar una contraoferta con trade-offs' },
  { id: 'review',   label: 'Revisar',      icon: FileText,      description: 'Revisá un acuerdo antes de aceptar' },
]

const CHANNELS: { id: Channel; label: string }[] = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'email',    label: 'Mail' },
  { id: 'telefono', label: 'Teléfono' },
  { id: 'otro',     label: 'Otro' },
]

const CONFIDENCE_COLOR: Record<string, string> = {
  alta:  'text-emerald-600 bg-emerald-50',
  media: 'text-amber-600 bg-amber-50',
  baja:  'text-slate-500 bg-slate-100',
}
const URGENCY_COLOR: Record<string, string> = {
  alta:  'text-red-600',
  media: 'text-amber-600',
  baja:  'text-emerald-600',
}
const SENTIMENT_COLOR: Record<string, string> = {
  positivo: 'text-emerald-600 bg-emerald-50',
  negativo: 'text-red-600 bg-red-50',
  neutral:  'text-slate-600 bg-slate-100',
  ambiguo:  'text-amber-600 bg-amber-50',
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(text) } catch { /* ignore */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 transition-colors">
      {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  )
}

function EmotionBanner({ alert }: { alert: EmotionAlert }) {
  if (!alert.detected) return null
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
      <Shield size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
      <div className="space-y-0.5">
        {alert.label && <p className="text-xs font-bold text-amber-800">{alert.label}</p>}
        {alert.reframe && <p className="text-xs text-amber-700">{alert.reframe}</p>}
        {alert.breathe && <p className="text-xs text-amber-600 italic">{alert.breathe}</p>}
      </div>
    </div>
  )
}

interface Props {
  operationTitle?: string
  operationCity?: string
  country?: CountryCode
}

export function OperationNegotiation({ operationTitle, operationCity, country = 'AR' }: Props) {
  const [mode, setMode] = useState<NegotiationMode>('reply')
  const [channel, setChannel] = useState<Channel>('whatsapp')
  const [message, setMessage] = useState('')
  const [objetivo, setObjetivo] = useState('')
  const [target, setTarget] = useState('')
  const [walkAway, setWalkAway] = useState('')
  const [showCtx, setShowCtx] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<NegotiationResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const activeMode = MODES.find(m => m.id === mode)!

  const analyze = useCallback(async () => {
    if (loading) return
    if (mode !== 'prepare' && !message.trim()) return

    setLoading(true)
    setError(null)
    setResult(null)

    const ctx: NegotiationContext = {
      objetivo: objetivo || (operationTitle ? `Operación: ${operationTitle}` : undefined),
      target: target || undefined,
      walkAway: walkAway || undefined,
      channel,
      otherContext: operationCity ? `Ciudad: ${operationCity}` : undefined,
    }

    try {
      const res = await fetch('/api/negotiation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, message: message.trim(), context: ctx, country }),
      })

      if (res.status === 401) { setError('Necesitás estar logueado para usar Negociación.'); return }
      if (res.status === 402) { setError('Sin crédito de IA. Contactá soporte.'); return }
      if (res.status === 429) { setError('Demasiados pedidos. Esperá un minuto.'); return }

      const data = await res.json() as { result?: NegotiationResponse; error?: string }
      if (data.error) { setError(data.error); return }
      if (data.result) setResult(data.result)
    } catch {
      setError('No pudimos conectarnos. Revisá tu conexión.')
    } finally {
      setLoading(false)
    }
  }, [loading, mode, message, objetivo, target, walkAway, channel, country, operationTitle, operationCity])

  return (
    <div className="space-y-4">

      {/* Mode selector */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4 space-y-3">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">¿Qué necesitás?</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {MODES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setMode(id); setResult(null) }}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all',
                mode === id
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              )}
            >
              <Icon size={13} className="flex-shrink-0" />{label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">{activeMode.description}</p>
      </div>

      {/* Channel + message */}
      {mode !== 'prepare' && (
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4 space-y-3">
          <div className="flex gap-2 flex-wrap">
            {CHANNELS.map(c => (
              <button
                key={c.id}
                onClick={() => setChannel(c.id)}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
                  channel === c.id
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={
              mode === 'reply'   ? 'Pegá el mensaje que recibiste…' :
              mode === 'analyze' ? 'Pegá la conversación a analizar…' :
              mode === 'review'  ? 'Pegá el texto del acuerdo a revisar…' :
              mode === 'counter' ? 'Pegá la oferta que recibiste…' :
              mode === 'call'    ? 'Describí de qué va a tratar la llamada…' :
              'Describí la situación actual…'
            }
            rows={4}
            className="w-full resize-none rounded-xl border border-slate-200 focus:border-brand-400 focus:outline-none px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 bg-white leading-relaxed"
          />
        </div>
      )}

      {/* Optional context */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card overflow-hidden">
        <button
          onClick={() => setShowCtx(o => !o)}
          className="w-full flex items-center gap-2 px-4 py-3 text-left"
        >
          <p className="text-xs font-semibold text-slate-600 flex-1">Contexto (opcional)</p>
          <ChevronDown size={13} className={cn('text-slate-400 transition-transform', showCtx && 'rotate-180')} />
        </button>
        {showCtx && (
          <div className="border-t border-slate-100 p-4 space-y-3">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Mi objetivo</label>
              <input value={objetivo} onChange={e => setObjetivo(e.target.value)}
                placeholder={operationTitle ? `Ej: cerrar la ${operationTitle} a USD 175.000` : 'Ej: comprar a USD 175.000'}
                className="w-full rounded-xl border border-slate-200 focus:border-brand-400 focus:outline-none px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 bg-white" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Target (precio ideal)</label>
              <input value={target} onChange={e => setTarget(e.target.value)}
                placeholder="Ej: USD 170.000"
                className="w-full rounded-xl border border-slate-200 focus:border-brand-400 focus:outline-none px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 bg-white" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Walk-away (límite privado)</label>
              <input value={walkAway} onChange={e => setWalkAway(e.target.value)}
                placeholder="Ej: USD 180.000 — nunca se revela a la contraparte"
                className="w-full rounded-xl border border-slate-200 focus:border-brand-400 focus:outline-none px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 bg-white" />
            </div>
          </div>
        )}
      </div>

      {/* Action */}
      <button
        onClick={analyze}
        disabled={loading || (mode !== 'prepare' && !message.trim())}
        className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-2xl transition-colors flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
        {loading ? 'Analizando…' : `${activeMode.label} con VARA`}
      </button>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-2">
          <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-3">
          {result.emotionAlert && <EmotionBanner alert={result.emotionAlert} />}

          <div className="flex flex-wrap gap-2">
            {result.urgencyLevel && (
              <span className={cn('text-xs font-bold', URGENCY_COLOR[result.urgencyLevel])}>
                Urgencia: {result.urgencyLevel}
              </span>
            )}
            {result.confidenceLevel && (
              <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', CONFIDENCE_COLOR[result.confidenceLevel])}>
                Confianza {result.confidenceLevel}
              </span>
            )}
            {result.sentiment && (
              <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', SENTIMENT_COLOR[result.sentiment])}>
                {result.sentiment}
              </span>
            )}
          </div>

          {result.suggestedReply && (
            <div className="bg-white rounded-2xl border border-brand-200 shadow-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-brand-700 uppercase tracking-wide">Respuesta sugerida</p>
                <CopyButton text={result.suggestedReply} />
              </div>
              <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{result.suggestedReply}</p>
              {result.toneAdvice && (
                <p className="text-xs text-slate-500 italic border-t border-slate-100 pt-2">{result.toneAdvice}</p>
              )}
            </div>
          )}

          {result.brief && (
            <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4 space-y-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Pre-Negotiation Brief</p>
              <div className="space-y-2 text-sm text-slate-700">
                <p><span className="font-semibold">Objetivo:</span> {result.brief.objetivo}</p>
                <p><span className="font-semibold">Target:</span> {result.brief.target}</p>
                <p><span className="font-semibold">BATNA:</span> {result.brief.batna}</p>
                <p><span className="font-semibold">Contraparte:</span> {result.brief.counterpartProfile}</p>
              </div>
              {result.brief.levers.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">Palancas</p>
                  <ul className="space-y-1">{result.brief.levers.map((l, i) => <li key={i} className="text-xs text-slate-600 flex gap-1.5"><span className="text-slate-300 mt-0.5">·</span>{l}</li>)}</ul>
                </div>
              )}
              {result.brief.doNotReveal.length > 0 && (
                <div className="bg-red-50 rounded-xl p-3">
                  <p className="text-[11px] font-bold text-red-600 uppercase tracking-wide mb-1">No revelar</p>
                  <ul className="space-y-1">{result.brief.doNotReveal.map((d, i) => <li key={i} className="text-xs text-red-700">{d}</li>)}</ul>
                </div>
              )}
            </div>
          )}

          {result.analysis && (
            <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Análisis</p>
              <p className="text-sm text-slate-700 leading-relaxed">{result.analysis}</p>
            </div>
          )}

          {result.strategy && (
            <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Estrategia</p>
              <p className="text-sm text-slate-700 leading-relaxed">{result.strategy}</p>
            </div>
          )}

          {result.callPrep && (
            <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4 space-y-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Guía de llamada</p>
              <p className="text-sm text-slate-700"><span className="font-semibold">Apertura:</span> {result.callPrep.opening}</p>
              {result.callPrep.questions.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">Preguntas</p>
                  <ul className="space-y-1">{result.callPrep.questions.map((q, i) => <li key={i} className="text-xs text-slate-600 flex gap-1.5"><span className="text-slate-300">·</span>{q}</li>)}</ul>
                </div>
              )}
              {result.callPrep.doNotReveal.length > 0 && (
                <div className="bg-red-50 rounded-xl p-3">
                  <p className="text-[11px] font-bold text-red-600 uppercase tracking-wide mb-1">No revelar</p>
                  <ul className="space-y-1">{result.callPrep.doNotReveal.map((d, i) => <li key={i} className="text-xs text-red-700">{d}</li>)}</ul>
                </div>
              )}
            </div>
          )}

          {result.keySignals && result.keySignals.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">Señales clave</p>
              <ul className="space-y-1">{result.keySignals.map((s, i) => <li key={i} className="text-xs text-slate-600 flex gap-1.5"><span className="text-slate-300 mt-0.5">·</span>{s}</li>)}</ul>
            </div>
          )}

          {result.redFlags && result.redFlags.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
              <p className="text-[11px] font-bold text-red-600 uppercase tracking-wide mb-2">Banderas rojas</p>
              <ul className="space-y-1">{result.redFlags.map((f, i) => <li key={i} className="text-xs text-red-700 flex gap-1.5"><AlertTriangle size={10} className="flex-shrink-0 mt-0.5" />{f}</li>)}</ul>
            </div>
          )}

          {result.nextAction && (
            <div className="bg-brand-50 border border-brand-200 rounded-2xl p-4 flex items-start gap-2">
              <Zap size={14} className="text-brand-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[11px] font-bold text-brand-700 uppercase tracking-wide mb-0.5">Próximo paso</p>
                <p className="text-sm text-slate-800">{result.nextAction}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
