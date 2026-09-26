'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, ChevronDown, ChevronRight, Copy, Check,
  AlertTriangle, Phone, FileText, BarChart3, Lightbulb,
  MessageCircle, Mail, HelpCircle, Zap, Shield,
  Target, Ban, Network, Sparkles, RefreshCw, Plus, Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  NegotiationMode, NegotiationContext, NegotiationResponse, CallPrep, NegotiationBrief, EmotionAlert,
} from '@/app/api/negotiation/route'
import { useNegotiationStore, type Negotiation } from '@/hooks/useNegotiationStore'

// ── Types ──────────────────────────────────────────────────────────────────

type Channel = 'whatsapp' | 'email' | 'telefono' | 'otro'
type CounterpartyStyle = 'desconocido' | 'agresivo' | 'empatico' | 'racional' | 'dificil'

// ── Config ─────────────────────────────────────────────────────────────────

const MODES: { id: NegotiationMode; label: string; short: string; icon: React.ElementType; description: string }[] = [
  { id: 'reply',    label: 'Responder',    short: 'Responder',  icon: MessageCircle, description: 'Analizá el mensaje y VARA te dice qué responder' },
  { id: 'analyze',  label: 'Analizar',     short: 'Analizar',   icon: BarChart3,     description: 'Entendé qué hay detrás de lo que te dijeron' },
  { id: 'prepare',  label: 'Preparar',     short: 'Preparar',   icon: Target,        description: 'Armá tu estrategia antes de negociar' },
  { id: 'strategy', label: 'Estrategia',   short: 'Estrategia', icon: Lightbulb,     description: '¿Cuál es el mejor movimiento ahora?' },
  { id: 'call',     label: 'Llamada',      short: 'Llamada',    icon: Phone,         description: 'Preparate para una llamada' },
  { id: 'offer',    label: 'Oferta',       short: 'Oferta',     icon: Zap,           description: 'Redactá una oferta estratégica' },
  { id: 'counter',  label: 'Contraoferta', short: 'Contra',     icon: RefreshCw,     description: 'Preparar una contraoferta con trade-offs' },
  { id: 'review',   label: 'Revisar',      short: 'Revisar',    icon: FileText,      description: 'Revisá un acuerdo antes de aceptar' },
]

const CHANNELS: { id: Channel; label: string; icon: React.ElementType }[] = [
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { id: 'email',    label: 'Mail',     icon: Mail },
  { id: 'telefono', label: 'Teléfono', icon: Phone },
  { id: 'otro',     label: 'Otro',     icon: HelpCircle },
]

const STYLES: { id: CounterpartyStyle; label: string; emoji: string }[] = [
  { id: 'desconocido', label: 'No sé',    emoji: '🤷' },
  { id: 'agresivo',    label: 'Agresivo', emoji: '🔥' },
  { id: 'empatico',    label: 'Empático', emoji: '🤝' },
  { id: 'racional',    label: 'Racional', emoji: '🧠' },
  { id: 'dificil',     label: 'Difícil',  emoji: '😶' },
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

// ── Message History ────────────────────────────────────────────────────────

function MessageHistory({ messages }: { messages: import('@/hooks/useNegotiationStore').NegotiationMessage[] }) {
  const [open, setOpen] = useState(false)
  if (!messages.length) return null
  const MODE_LABELS: Record<string, string> = {
    prepare: 'Brief', reply: 'Respuesta', analyze: 'Análisis',
    strategy: 'Estrategia', call: 'Llamada', offer: 'Oferta',
    counter: 'Contraoferta', review: 'Revisión',
  }
  return (
    <div className="bg-white shadow-card rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
      >
        <Clock size={13} className="text-slate-400" />
        <p className="text-xs font-semibold text-slate-600 flex-1">Historial ({messages.length})</p>
        <ChevronDown size={13} className={cn('text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t border-slate-100 divide-y divide-slate-100">
          {messages.map(m => (
            <div key={m.id} className="px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
                  {MODE_LABELS[m.mode] ?? m.mode}
                </span>
                {m.channel && <span className="text-[10px] text-slate-400">{m.channel}</span>}
                <span className="text-[10px] text-slate-400 ml-auto">
                  {new Date(m.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {m.input_message && (
                <p className="text-xs text-slate-500 italic truncate mb-1">"{m.input_message.slice(0, 80)}..."</p>
              )}
              {m.result.nextAction && (
                <p className="text-xs text-brand-700 font-medium">✦ {m.result.nextAction}</p>
              )}
              {m.result.suggestedReply && (
                <p className="text-xs text-slate-600 truncate">{m.result.suggestedReply.slice(0, 80)}...</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Negotiation Selector ───────────────────────────────────────────────────

function NegotiationSelector({
  negotiations, activeId, loading,
  onSelect, onCreate,
}: {
  negotiations: Negotiation[]
  activeId: string | null
  loading: boolean
  onSelect: (n: Negotiation) => void
  onCreate: () => void
}) {
  const [open, setOpen] = useState(false)
  const active = negotiations.find(n => n.id === activeId)

  if (loading) return (
    <div className="bg-white shadow-card rounded-2xl px-4 py-3 text-xs text-slate-400 animate-pulse">
      Cargando negociaciones...
    </div>
  )

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full bg-white shadow-card rounded-2xl px-4 py-3 flex items-center gap-2 text-left"
      >
        <div className="w-6 h-6 rounded-lg bg-brand-500 flex items-center justify-center flex-shrink-0">
          <span className="text-[9px] font-extrabold text-slate-900">N</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-800 truncate">
            {active?.title ?? 'Negociación sin título'}
          </p>
          {active?.next_action && (
            <p className="text-[10px] text-brand-600 truncate">✦ {active.next_action}</p>
          )}
        </div>
        <ChevronDown size={13} className={cn('text-slate-400 transition-transform flex-shrink-0', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-lg border border-slate-100 z-10 overflow-hidden">
          <button
            onClick={() => { onCreate(); setOpen(false) }}
            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-brand-600 font-semibold hover:bg-brand-50 transition-colors border-b border-slate-100"
          >
            <Plus size={14} /> Nueva negociación
          </button>
          {negotiations.map(n => (
            <button
              key={n.id}
              onClick={() => { onSelect(n); setOpen(false) }}
              className={cn(
                'w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors',
                n.id === activeId && 'bg-brand-50'
              )}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{n.title}</p>
                <p className="text-[10px] text-slate-400">
                  {new Date(n.updated_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                  {n.next_action && ` · ${n.next_action.slice(0, 40)}...`}
                </p>
              </div>
              <span className={cn(
                'text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5',
                n.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
              )}>
                {n.status === 'active' ? 'Activa' : n.status}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Chip({ children, color = 'slate' }: { children: React.ReactNode; color?: string }) {
  return (
    <span className={cn(
      'inline-flex items-center text-[11px] font-medium px-2.5 py-1 rounded-full',
      color === 'red'     && 'bg-red-50 text-red-700',
      color === 'green'   && 'bg-emerald-50 text-emerald-700',
      color === 'amber'   && 'bg-amber-50 text-amber-700',
      color === 'blue'    && 'bg-blue-50 text-blue-700',
      color === 'slate'   && 'bg-slate-100 text-slate-600',
    )}>
      {children}
    </span>
  )
}

function InfoCard({ title, children, icon: Icon, accent = false }: {
  title: string; children: React.ReactNode; icon?: React.ElementType; accent?: boolean
}) {
  return (
    <div className={cn('rounded-2xl p-4', accent ? 'bg-brand-50 border border-brand-100' : 'bg-white shadow-card')}>
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon size={13} className={accent ? 'text-brand-500' : 'text-slate-400'} />}
        <p className={cn('text-[11px] font-bold uppercase tracking-wide', accent ? 'text-brand-600' : 'text-slate-500')}>{title}</p>
      </div>
      {children}
    </div>
  )
}

function BriefView({ brief }: { brief: NegotiationBrief }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <InfoCard title="Objetivo" icon={Target} accent>
          <p className="text-sm text-brand-800 font-medium">{brief.objetivo}</p>
        </InfoCard>
        <InfoCard title="Target" icon={Zap} accent>
          <p className="text-sm text-brand-800 font-medium">{brief.target}</p>
        </InfoCard>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <InfoCard title="BATNA" icon={Network}>
          <p className="text-sm text-slate-700">{brief.batna}</p>
        </InfoCard>
        <InfoCard title="Contraparte">
          <p className="text-sm text-slate-700">{brief.counterpartProfile}</p>
        </InfoCard>
      </div>
      <InfoCard title="Palancas disponibles" icon={BarChart3}>
        <div className="flex flex-wrap gap-2">
          {brief.levers.map((l, i) => <Chip key={i} color="blue">{l}</Chip>)}
        </div>
      </InfoCard>
      <InfoCard title="Intereses conocidos de la contraparte">
        <ul className="space-y-1.5">
          {brief.knownInterests.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0 mt-1.5" />
              {s}
            </li>
          ))}
        </ul>
      </InfoCard>
      <InfoCard title="Apertura sugerida" icon={MessageCircle} accent>
        <p className="text-sm text-brand-800 italic">"{brief.opening}"</p>
      </InfoCard>
      <InfoCard title="Preguntas para hacerle">
        <ul className="space-y-1.5">
          {brief.questions.map((q, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
              <span className="text-brand-400 flex-shrink-0">→</span> {q}
            </li>
          ))}
        </ul>
      </InfoCard>
      {brief.doNotReveal.length > 0 && (
        <InfoCard title="No revelar" icon={Shield}>
          <div className="flex flex-wrap gap-2">
            {brief.doNotReveal.map((d, i) => <Chip key={i} color="red">{d}</Chip>)}
          </div>
        </InfoCard>
      )}
      {brief.risks.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700 mb-3 flex items-center gap-1.5">
            <AlertTriangle size={12} /> Riesgos identificados
          </p>
          <ul className="space-y-1.5">
            {brief.risks.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-amber-800">
                <span className="flex-shrink-0 mt-0.5">⚠</span> {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function CallPrepView({ callPrep }: { callPrep: CallPrep }) {
  return (
    <div className="space-y-3">
      <InfoCard title="Objetivo de la llamada" icon={Target} accent>
        <p className="text-sm text-brand-800 font-medium">{callPrep.objective}</p>
      </InfoCard>
      <InfoCard title="Cómo arrancar" icon={MessageCircle}>
        <p className="text-sm text-slate-700 italic">"{callPrep.opening}"</p>
      </InfoCard>
      <InfoCard title="Preguntas clave">
        <ul className="space-y-2">
          {callPrep.questions.map((q, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
              <span className="text-brand-400 flex-shrink-0 font-bold">{i + 1}.</span> {q}
            </li>
          ))}
        </ul>
      </InfoCard>
      {callPrep.scenarios.length > 0 && (
        <InfoCard title="Si dicen X → respondé Y">
          <div className="space-y-3">
            {callPrep.scenarios.map((s, i) => (
              <div key={i} className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">Si dicen:</p>
                <p className="text-sm text-slate-700 italic mb-2">"{s.trigger}"</p>
                <p className="text-xs text-brand-600 mb-1">Respondé:</p>
                <p className="text-sm text-brand-800 font-medium">"{s.response}"</p>
              </div>
            ))}
          </div>
        </InfoCard>
      )}
      {callPrep.doNotReveal.length > 0 && (
        <InfoCard title="No revelar" icon={Shield}>
          <div className="flex flex-wrap gap-2">
            {callPrep.doNotReveal.map((d, i) => <Chip key={i} color="red">{d}</Chip>)}
          </div>
        </InfoCard>
      )}
      <InfoCard title="Cierre sugerido" icon={Check}>
        <p className="text-sm text-slate-700 italic">"{callPrep.closing}"</p>
      </InfoCard>
    </div>
  )
}

function ReplyView({ result, channel }: { result: NegotiationResponse; channel: Channel }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    if (!result.suggestedReply) return
    navigator.clipboard.writeText(result.suggestedReply).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="space-y-3">
      {/* Emotion alert */}
      {result.emotionAlert?.detected && <EmotionAlertBanner alert={result.emotionAlert} />}

      {/* Diagnosis chips */}
      <div className="bg-white shadow-card rounded-2xl p-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-3">Diagnóstico</p>
        <div className="flex flex-wrap gap-2">
          {result.profileLabel && (
            <span className="text-xs font-semibold text-slate-800 bg-slate-100 px-3 py-1.5 rounded-full">
              {result.profileLabel}
            </span>
          )}
          {result.sentiment && (
            <span className={cn('text-xs font-medium px-3 py-1.5 rounded-full capitalize', SENTIMENT_COLOR[result.sentiment])}>
              Tono {result.sentiment}
            </span>
          )}
          <span className={cn('text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1', URGENCY_COLOR[result.urgencyLevel])}>
            <Zap size={10} /> Urgencia {result.urgencyLevel}
          </span>
          <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', CONFIDENCE_COLOR[result.confidenceLevel])}>
            Confianza {result.confidenceLevel}
          </span>
        </div>
      </div>

      {/* Key signals */}
      {(result.keySignals?.length ?? 0) > 0 && (
        <InfoCard title="Señales detectadas" icon={BarChart3}>
          <ul className="space-y-2">
            {result.keySignals!.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0 mt-1.5" />
                {s}
              </li>
            ))}
          </ul>
        </InfoCard>
      )}

      {/* Tactic detected */}
      {result.tacticDetected && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-purple-700 mb-2">Táctica detectada</p>
          <p className="text-sm text-purple-800">{result.tacticDetected}</p>
        </div>
      )}

      {/* Tone advice */}
      {result.toneAdvice && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700 mb-2">Cómo posicionarte</p>
          <p className="text-sm text-amber-800 leading-relaxed">{result.toneAdvice}</p>
        </div>
      )}

      {/* Suggested reply */}
      {result.suggestedReply && (
        <div className="bg-white shadow-card rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Respuesta sugerida {channel !== 'otro' && `· ${CHANNELS.find(c => c.id === channel)?.label}`}
            </p>
            <button
              onClick={copy}
              className={cn(
                'flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors',
                copied ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-50 text-brand-700 hover:bg-brand-100'
              )}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-800 leading-relaxed whitespace-pre-line border border-slate-100">
            {result.suggestedReply}
          </div>
        </div>
      )}

      {/* What not to say */}
      {(result.whatNotToSay?.length ?? 0) > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-red-700 mb-3 flex items-center gap-1.5">
            <Ban size={11} /> Qué no decir
          </p>
          <ul className="space-y-2">
            {result.whatNotToSay!.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                <span className="flex-shrink-0 mt-0.5">✗</span> {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Debrief */}
      <DebriefView result={result} />

      {/* Red flags */}
      {(result.redFlags?.length ?? 0) > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-red-700 mb-3 flex items-center gap-1.5">
            <AlertTriangle size={12} /> Alertas
          </p>
          <ul className="space-y-2">
            {result.redFlags!.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-red-800">
                <span className="flex-shrink-0">🚩</span> {f}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function AnalysisView({ result }: { result: NegotiationResponse }) {
  return (
    <div className="space-y-3">
      {result.emotionAlert?.detected && <EmotionAlertBanner alert={result.emotionAlert} />}
      {result.analysis && (
        <InfoCard title="Análisis" icon={BarChart3} accent>
          <p className="text-sm text-brand-900 leading-relaxed">{result.analysis}</p>
        </InfoCard>
      )}
      {result.strategy && (
        <InfoCard title="Estrategia recomendada" icon={Lightbulb}>
          <p className="text-sm text-slate-700 leading-relaxed">{result.strategy}</p>
        </InfoCard>
      )}
      {(result.keySignals?.length ?? 0) > 0 && (
        <InfoCard title="Señales clave" icon={BarChart3}>
          <ul className="space-y-2">
            {result.keySignals!.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0 mt-1.5" />
                {s}
              </li>
            ))}
          </ul>
        </InfoCard>
      )}
      <DebriefView result={result} />
      {(result.redFlags?.length ?? 0) > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-red-700 mb-3 flex items-center gap-1.5">
            <AlertTriangle size={12} /> Alertas
          </p>
          <ul className="space-y-2">
            {result.redFlags!.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-red-800">
                <span className="flex-shrink-0">🚩</span> {f}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function DebriefView({ result }: { result: NegotiationResponse }) {
  const hasDebrief = (result.whatChanged?.length ?? 0) > 0
    || (result.whatDidNotChange?.length ?? 0) > 0
    || (result.newInformation?.length ?? 0) > 0

  if (!hasDebrief) return (
    <div className="bg-brand-50 border border-brand-100 rounded-2xl p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-brand-600 mb-1">Próxima jugada</p>
      <p className="text-sm text-brand-800 font-medium">{result.nextAction}</p>
    </div>
  )

  return (
    <div className="space-y-3">
      {(result.whatChanged?.length ?? 0) > 0 && (
        <InfoCard title="Qué cambió">
          <ul className="space-y-1.5">
            {result.whatChanged!.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="text-emerald-500 flex-shrink-0">↑</span> {c}
              </li>
            ))}
          </ul>
        </InfoCard>
      )}
      {(result.whatDidNotChange?.length ?? 0) > 0 && (
        <InfoCard title="Qué no cambió">
          <ul className="space-y-1.5">
            {result.whatDidNotChange!.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="text-slate-400 flex-shrink-0">–</span> {c}
              </li>
            ))}
          </ul>
        </InfoCard>
      )}
      {(result.newInformation?.length ?? 0) > 0 && (
        <InfoCard title="Nueva información">
          <ul className="space-y-1.5">
            {result.newInformation!.map((n, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="text-blue-500 flex-shrink-0">★</span> {n}
              </li>
            ))}
          </ul>
        </InfoCard>
      )}
      <div className="bg-brand-50 border border-brand-100 rounded-2xl p-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-brand-600 mb-1">Próxima jugada</p>
        <p className="text-sm text-brand-800 font-medium">{result.nextAction}</p>
      </div>
    </div>
  )
}

// ── Emotion Alert Banner ───────────────────────────────────────────────────

function EmotionAlertBanner({ alert }: { alert: EmotionAlert }) {
  if (!alert.detected) return null
  return (
    <div className="bg-orange-50 border border-orange-300 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <span className="text-xl flex-shrink-0">🧘</span>
        <div className="flex-1">
          {alert.label && (
            <p className="text-[11px] font-bold uppercase tracking-wide text-orange-700 mb-1">{alert.label}</p>
          )}
          {alert.reframe && (
            <p className="text-sm text-orange-800 leading-relaxed mb-2">{alert.reframe}</p>
          )}
          {alert.breathe && (
            <p className="text-xs font-semibold text-orange-700 bg-orange-100 px-3 py-1.5 rounded-xl inline-block">
              ⏸ {alert.breathe}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Context Bar ────────────────────────────────────────────────────────────

function ContextBar({ ctx, nextAction, onEdit }: {
  ctx: NegotiationContext; nextAction: string; onEdit: () => void
}) {
  const hasCtx = ctx.objetivo || ctx.target || ctx.batna || ctx.deadline

  if (!hasCtx) return (
    <button
      onClick={onEdit}
      className="w-full text-left bg-slate-50 border border-dashed border-slate-300 rounded-2xl px-4 py-3 text-sm text-slate-400 hover:border-brand-300 hover:text-brand-500 transition-colors flex items-center gap-2"
    >
      <Target size={14} />
      Definí tu objetivo, límite y BATNA para que VARA te dé mejor contexto →
    </button>
  )

  return (
    <div className="bg-white shadow-card rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Mi posición</p>
        <button onClick={onEdit} className="text-[10px] text-brand-500 hover:text-brand-700 font-semibold">Editar</button>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {ctx.objetivo && (
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">🎯 Objetivo</p>
            <p className="text-xs font-medium text-slate-800 truncate">{ctx.objetivo}</p>
          </div>
        )}
        {ctx.target && (
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">⚡ Target</p>
            <p className="text-xs font-medium text-slate-800 truncate">{ctx.target}</p>
          </div>
        )}
        {ctx.walkAway && (
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">🛑 Límite</p>
            <p className="text-xs font-medium text-slate-800 truncate">🔒 {ctx.walkAway}</p>
          </div>
        )}
        {ctx.batna && (
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">🅱️ BATNA</p>
            <p className="text-xs font-medium text-slate-800 truncate">{ctx.batna}</p>
          </div>
        )}
        {ctx.deadline && (
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">⏰ Deadline</p>
            <p className="text-xs font-medium text-slate-800 truncate">{ctx.deadline}</p>
          </div>
        )}
        {ctx.currentOffer && (
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">💬 Oferta actual</p>
            <p className="text-xs font-medium text-slate-800 truncate">{ctx.currentOffer}</p>
          </div>
        )}
      </div>
      {nextAction && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">✦ Próxima jugada</p>
          <p className="text-xs text-brand-700 font-medium">{nextAction}</p>
        </div>
      )}
    </div>
  )
}

function OperationLinker({
  linkedOp, loading, onLink,
}: { linkedOp: string | null; loading: boolean; onLink: (id: string) => void }) {
  const [ops, setOps] = useState<Array<{ id: string; title: string }>>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetch('/api/operations?limit=10')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.operations)) {
          setOps(d.operations.map((o: { id: string; property_address?: string; journey_type?: string }) => ({
            id: o.id,
            title: o.property_address ?? `Operación ${o.journey_type === 'BUY_PROPERTY' ? 'Compra' : 'Venta'}`,
          })))
        }
      })
      .catch(() => {})
  }, [])

  if (!ops.length) return null

  return (
    <div className="relative">
      {linkedOp ? (
        <div className="flex items-center gap-2 bg-brand-50 border border-brand-200 rounded-xl px-3 py-2">
          <span className="text-xs text-brand-700 font-semibold flex-1 truncate">🏠 {linkedOp}</span>
          <button onClick={() => { setOpen(o => !o) }} className="text-[10px] text-brand-500 hover:text-brand-800">cambiar</button>
        </div>
      ) : (
        <button
          onClick={() => setOpen(o => !o)}
          disabled={loading}
          className="w-full text-left bg-slate-50 border border-dashed border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-500 hover:border-brand-300 hover:text-brand-600 transition-colors flex items-center gap-2"
        >
          {loading ? <RefreshCw size={12} className="animate-spin" /> : <Network size={12} />}
          {loading ? 'Cargando contexto de operación...' : 'Vincular operación VARA (auto-contexto)'}
        </button>
      )}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-slate-100 z-20 overflow-hidden">
          {ops.map(op => (
            <button
              key={op.id}
              onClick={() => { onLink(op.id); setOpen(false) }}
              className="w-full text-left px-3 py-2.5 text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition-colors border-b border-slate-50 last:border-0"
            >
              🏠 {op.title}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ContextEditor({ ctx, onSave }: { ctx: NegotiationContext; onSave: (c: NegotiationContext) => void }) {
  const [draft, setDraft] = useState<NegotiationContext>(ctx)
  const [opCtxLoading, setOpCtxLoading] = useState(false)
  const [linkedOp, setLinkedOp] = useState<string | null>(null)

  const f = (k: keyof NegotiationContext) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft(d => ({ ...d, [k]: e.target.value }))

  async function loadOperationContext(operationId: string) {
    if (!operationId) return
    setOpCtxLoading(true)
    try {
      const res = await fetch(`/api/negotiation/operation-context?operationId=${operationId}`)
      const data = await res.json()
      if (data.context) {
        const c = data.context
        setLinkedOp(c.operationTitle)
        setDraft(d => ({
          ...d,
          otherContext: c.rawForPrompt,
          currentOffer: d.currentOffer || (c.offerSummary !== 'Sin ofertas registradas' ? c.offerSummary : d.currentOffer),
          deadline: d.deadline || (c.closingDate ?? d.deadline),
        }))
      }
    } catch { /* silent */ }
    setOpCtxLoading(false)
  }

  const inputCls = "w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-400 focus:bg-white transition-colors"

  return (
    <div className="bg-white shadow-card rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Tu posición en esta negociación</p>
      </div>

      {/* Operation linking */}
      <OperationLinker
        linkedOp={linkedOp}
        loading={opCtxLoading}
        onLink={loadOperationContext}
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] text-slate-500 font-semibold mb-1 block">🎯 Objetivo</label>
          <input value={draft.objetivo ?? ''} onChange={f('objetivo')} placeholder="ej: Comprar a USD 410k" className={inputCls} />
        </div>
        <div>
          <label className="text-[11px] text-slate-500 font-semibold mb-1 block">⚡ Target</label>
          <input value={draft.target ?? ''} onChange={f('target')} placeholder="ej: USD 410k" className={inputCls} />
        </div>
        <div>
          <label className="text-[11px] text-slate-500 font-semibold mb-1 block">🛑 Límite privado</label>
          <input value={draft.walkAway ?? ''} onChange={f('walkAway')} placeholder="máximo que pagarías" className={inputCls} />
          <p className="text-[10px] text-slate-400 mt-1">Solo vos lo ves. VARA nunca lo sugiere en mensajes.</p>
        </div>
        <div>
          <label className="text-[11px] text-slate-500 font-semibold mb-1 block">🅱️ BATNA</label>
          <input value={draft.batna ?? ''} onChange={f('batna')} placeholder="qué hacés si no hay acuerdo" className={inputCls} />
        </div>
        <div>
          <label className="text-[11px] text-slate-500 font-semibold mb-1 block">⏰ Deadline</label>
          <input value={draft.deadline ?? ''} onChange={f('deadline')} placeholder="ej: 20 de octubre" className={inputCls} />
        </div>
        <div>
          <label className="text-[11px] text-slate-500 font-semibold mb-1 block">💬 Oferta actual</label>
          <input value={draft.currentOffer ?? ''} onChange={f('currentOffer')} placeholder="ej: USD 430k del vendedor" className={inputCls} />
        </div>
      </div>
      <div>
        <label className="text-[11px] text-slate-500 font-semibold mb-1 block">Historial / contexto</label>
        <textarea
          value={draft.negotiationHistory ?? ''}
          onChange={f('negotiationHistory')}
          rows={3}
          placeholder="Resumí brevemente qué pasó hasta acá..."
          className={inputCls + ' resize-none'}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] text-slate-500 font-semibold mb-1 block">Rol contraparte</label>
          <input value={draft.counterpartyRole ?? ''} onChange={f('counterpartyRole')} placeholder="ej: Vendedor / Inmobiliaria" className={inputCls} />
        </div>
        <div>
          <label className="text-[11px] text-slate-500 font-semibold mb-1 block">Estilo contraparte</label>
          <div className="flex flex-wrap gap-1.5">
            {STYLES.map(s => (
              <button
                key={s.id}
                onClick={() => setDraft(d => ({ ...d, counterpartyStyle: s.id }))}
                className={cn(
                  'text-xs px-2 py-1 rounded-lg border transition-colors',
                  draft.counterpartyStyle === s.id
                    ? 'bg-brand-500 text-slate-900 border-brand-500'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-brand-300'
                )}
              >
                {s.emoji} {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <button
        onClick={() => onSave(draft)}
        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
      >
        Guardar contexto
      </button>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function NegociacionPage() {
  const store = useNegotiationStore()
  const [mode, setMode] = useState<NegotiationMode>('reply')
  const [channel, setChannel] = useState<Channel>('whatsapp')
  const [message, setMessage] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<NegotiationResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editingCtx, setEditingCtx] = useState(false)
  const [newNegTitle, setNewNegTitle] = useState('')
  const [creatingNew, setCreatingNew] = useState(false)

  const { ctx, nextAction, negotiations, activeId, loading, messages } = store

  async function handleSaveContext(c: NegotiationContext) {
    await store.saveContext(c)
    setEditingCtx(false)
  }

  async function handleCreateNegotiation() {
    const title = newNegTitle.trim() || 'Negociación'
    await store.createNegotiation(title)
    setCreatingNew(false)
    setNewNegTitle('')
  }

  async function analyze() {
    const needsMessage = mode !== 'prepare'
    if (needsMessage && !message.trim()) return
    setAnalyzing(true); setError(null); setResult(null)

    try {
      const res = await fetch('/api/negotiation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          message: message.trim() || undefined,
          context: { ...ctx, channel },
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const r = data.result as NegotiationResponse
      setResult(r)
      if (r.nextAction) await store.saveNextAction(r.nextAction)
      await store.saveMessage(mode, channel, message.trim() || undefined, r)
    } catch {
      setError('No pude analizar. Verificá tu conexión e intentá de nuevo.')
    } finally {
      setAnalyzing(false)
    }
  }

  const currentMode = MODES.find(m => m.id === mode)!

  const getPlaceholder = () => {
    switch (mode) {
      case 'reply':    return channel === 'telefono' ? 'Anotá lo que te dijeron...' : 'Pegá el mensaje recibido...'
      case 'analyze':  return 'Pegá el mensaje o describí la conversación...'
      case 'strategy': return 'Describí la situación actual...'
      case 'offer':    return 'Describí el contexto y qué tipo de oferta querés hacer...'
      case 'counter':  return 'Pegá la oferta que recibiste y describí la situación...'
      case 'review':   return 'Pegá las condiciones o el texto a revisar...'
      case 'call':     return 'Describí el objetivo de la llamada y la situación...'
      case 'prepare':  return 'Opcional: agregá contexto adicional...'
      default: return 'Describí la situación...'
    }
  }

  const getButtonLabel = () => {
    switch (mode) {
      case 'prepare':  return 'Armar brief de negociación'
      case 'reply':    return 'Analizar y sugerir respuesta'
      case 'analyze':  return 'Analizar mensaje'
      case 'strategy': return 'Ver estrategia recomendada'
      case 'call':     return 'Preparar guía de llamada'
      case 'offer':    return 'Redactar oferta'
      case 'counter':  return 'Redactar contraoferta'
      case 'review':   return 'Revisar acuerdo'
    }
  }

  const showChannelSelector = ['reply', 'offer', 'counter'].includes(mode)
  const showMessage = mode !== 'prepare' || true // always show, optional for prepare

  return (
    <div className="min-h-screen bg-[var(--background)] pb-24">
      <header className="px-4 pt-8 pb-4">
        <div className="max-w-2xl mx-auto">
          <Link href="/asistente" className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm mb-4 transition-colors">
            <ArrowLeft size={14} /> VARA AI
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center flex-shrink-0">
              <Sparkles size={18} className="text-slate-900" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-base">Negotiation Intelligence</h1>
              <p className="text-xs text-slate-400">Antes, durante y después de cada conversación</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 space-y-4">

        {/* Negotiation selector — only when authenticated */}
        {store.userId && (
          <>
            {creatingNew ? (
              <div className="bg-white shadow-card rounded-2xl p-4 flex gap-2">
                <input
                  autoFocus
                  value={newNegTitle}
                  onChange={e => setNewNegTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateNegotiation()}
                  placeholder="Nombre de la negociación..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
                />
                <button onClick={handleCreateNegotiation} className="bg-slate-900 text-white text-xs font-semibold px-4 rounded-xl">Crear</button>
                <button onClick={() => setCreatingNew(false)} className="text-slate-400 text-xs px-2">✕</button>
              </div>
            ) : (
              <NegotiationSelector
                negotiations={negotiations}
                activeId={activeId}
                loading={loading}
                onSelect={store.selectNegotiation}
                onCreate={() => setCreatingNew(true)}
              />
            )}
          </>
        )}

        {/* Context bar */}
        {editingCtx
          ? <ContextEditor ctx={ctx} onSave={handleSaveContext} />
          : <ContextBar ctx={ctx} nextAction={nextAction} onEdit={() => setEditingCtx(true)} />
        }

        {/* Mode selector */}
        <div className="bg-white shadow-card rounded-2xl p-3">
          <div className="grid grid-cols-4 gap-1.5">
            {MODES.map(m => {
              const Icon = m.icon
              return (
                <button
                  key={m.id}
                  onClick={() => { setMode(m.id); setResult(null); setError(null) }}
                  className={cn(
                    'flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-center transition-colors',
                    mode === m.id
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-500 hover:bg-slate-50'
                  )}
                >
                  <Icon size={15} />
                  <span className="text-[10px] font-semibold leading-tight">{m.short}</span>
                </button>
              )
            })}
          </div>
          <p className="text-xs text-slate-400 text-center mt-2">{currentMode.description}</p>
        </div>

        {/* Channel selector */}
        {showChannelSelector && (
          <div className="bg-white shadow-card rounded-2xl p-4">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-3">Canal</p>
            <div className="flex gap-2 flex-wrap">
              {CHANNELS.map(c => {
                const Icon = c.icon
                return (
                  <button
                    key={c.id}
                    onClick={() => setChannel(c.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors border',
                      channel === c.id
                        ? 'bg-brand-500 text-slate-900 border-brand-500'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-brand-300'
                    )}
                  >
                    <Icon size={13} /> {c.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Message input */}
        {showMessage && (
          <div className="bg-white shadow-card rounded-2xl p-4">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-3">
              {mode === 'prepare' ? 'Contexto adicional (opcional)' : 'Mensaje / situación'}
            </p>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={mode === 'prepare' ? 3 : 5}
              placeholder={getPlaceholder()}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-400 focus:bg-white resize-none transition-colors"
            />
          </div>
        )}

        {/* Analyze button */}
        <button
          onClick={analyze}
          disabled={analyzing || (mode !== 'prepare' && !message.trim())}
          className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-semibold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 transition-colors"
        >
          {analyzing ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Analizando...
            </>
          ) : (
            <>
              <Sparkles size={15} />
              {getButtonLabel()}
            </>
          )}
        </button>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700 flex items-start gap-2">
            <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <>
            {result.brief && <BriefView brief={result.brief} />}
            {result.callPrep && <CallPrepView callPrep={result.callPrep} />}
            {(result.suggestedReply || result.toneAdvice || result.keySignals?.length || result.whatNotToSay?.length)
              && !result.brief && !result.callPrep
              && <ReplyView result={result} channel={channel} />}
            {(result.analysis || result.strategy)
              && !result.brief && !result.callPrep
              && <AnalysisView result={result} />}
            {!result.brief && !result.callPrep && !result.suggestedReply && !result.analysis && !result.strategy && (
              <DebriefView result={result} />
            )}

            <button
              onClick={() => { setResult(null); setMessage(''); setError(null) }}
              className="w-full border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium py-3 rounded-2xl text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <RefreshCw size={13} /> Nueva consulta
            </button>
          </>
        )}

        {/* History */}
        {!result && messages.length > 0 && (
          <MessageHistory messages={messages} />
        )}

      </div>
    </div>
  )
}
