'use client'
import { useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Copy, Lightbulb, Loader2, MessageSquareText, RotateCw, Sparkles } from 'lucide-react'
import type { NextAction } from '@/lib/nba/engine'
import {
  agentContext, buildDraftPrompt, buildExplainPrompt, stripCertaintyLabels, type OperationKind,
} from '@/lib/nba/agentPrompts'

/**
 * El próximo paso, como un agente que ayuda a hacerlo.
 *
 * Qué hay que hacer lo decide el motor de reglas (nba/engine.ts), igual que antes:
 * es auditable y no depende de un modelo. La IA entra después y solo para ayudar:
 * explicar el paso en simple o redactar el mensaje. Nunca manda nada por la
 * persona; deja un borrador que ella revisa y copia.
 *
 * Estética: degradado azul profundo, paneles de vidrio esmerilado y tipografía
 * grande, sin el rojo de alarma. Que una operación esté frenada se dice con
 * palabras y un punto ámbar, no pintando toda la tarjeta de rojo.
 */

type AiState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; text: string }
  | { status: 'error'; message: string }

async function askVara(prompt: string, operationId: string, context: string): Promise<string> {
  let res: Response
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], context, operationId }),
    })
  } catch {
    throw new Error('No hay conexión. Probá de nuevo en un momento.')
  }
  const data = (await res.json().catch(() => ({}))) as { reply?: unknown; error?: unknown }
  if (res.status === 401) throw new Error('Iniciá sesión para que VARA lo haga por vos.')
  if (res.status === 503) throw new Error('VARA AI todavía no está disponible en esta versión.')
  if (!res.ok || typeof data.reply !== 'string') {
    throw new Error(typeof data.error === 'string' ? data.error : 'VARA AI no está disponible ahora.')
  }
  return stripCertaintyLabels(data.reply)
}

const GLASS = 'rounded-2xl bg-white/12 backdrop-blur-md border border-white/20'
const GHOST_BTN =
  'inline-flex items-center gap-2 rounded-full bg-white/15 hover:bg-white/25 border border-white/30 backdrop-blur px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'

interface Props {
  action: NextAction
  operationId: string
  kind?: OperationKind
  province?: string
}

/** Usar con `key={action.id}` para que el estado se reinicie al cambiar de paso. */
export function NextStepAgent({ action, operationId, kind = 'BUY', province }: Props) {
  const [explain, setExplain] = useState<AiState>({ status: 'idle' })
  const [draft, setDraft] = useState<AiState>({ status: 'idle' })
  const [draftText, setDraftText] = useState('')
  const [copied, setCopied] = useState(false)
  const draftRef = useRef<HTMLTextAreaElement>(null)
  const context = agentContext(kind, province)

  async function runExplain() {
    setExplain({ status: 'loading' })
    try {
      setExplain({ status: 'done', text: await askVara(buildExplainPrompt(action, kind), operationId, context) })
    } catch (e) {
      setExplain({ status: 'error', message: e instanceof Error ? e.message : 'Algo salió mal.' })
    }
  }

  async function runDraft() {
    setDraft({ status: 'loading' })
    setCopied(false)
    try {
      const text = await askVara(buildDraftPrompt(action, kind), operationId, context)
      setDraftText(text)
      setDraft({ status: 'done', text })
    } catch (e) {
      setDraft({ status: 'error', message: e instanceof Error ? e.message : 'Algo salió mal.' })
    }
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draftText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      draftRef.current?.select()
    }
  }

  const loadingExplain = explain.status === 'loading'
  const loadingDraft = draft.status === 'loading'

  return (
    <section
      aria-label="Tu próximo paso"
      className="relative overflow-hidden rounded-3xl p-5 sm:p-7 text-white shadow-[0_24px_60px_-24px_rgba(10,69,214,0.7)]"
      style={{ background: 'linear-gradient(155deg, #0a45d6 0%, #1357ec 52%, #2a6df5 100%)' }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/20 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -left-16 -bottom-20 h-52 w-52 rounded-full bg-sky-300/25 blur-3xl" />

      <div className="relative">
        <div className="flex items-center gap-3">
          <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/40 backdrop-blur">
            <Sparkles size={17} aria-hidden="true" />
            <span aria-hidden="true" className="absolute inset-0 rounded-full ring-2 ring-white/30 motion-safe:animate-ping [animation-duration:3.2s]" />
          </span>
          <div>
            <p className="text-xs font-semibold tracking-wide text-white/90">Tu agente VARA</p>
            <p className="flex items-center gap-1.5 text-xs text-white/85">
              {action.blocking ? (
                <>
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                  Esto frena tu operación
                </>
              ) : (
                'Lo siguiente para avanzar'
              )}
            </p>
          </div>
        </div>

        <h2 className="mt-5 text-balance text-2xl font-semibold leading-tight tracking-tight sm:text-[30px]">
          {action.title}
        </h2>
        <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-white/90 sm:text-base">{action.why}</p>

        {action.evidence.length > 0 && (
          <div className={`${GLASS} mt-5 px-4 py-3.5`}>
            <p className="mb-2 text-xs font-semibold text-white/90">En qué me baso</p>
            <ul className="space-y-1.5">
              {action.evidence.map(e => (
                <li key={e} className="flex items-start gap-2 text-sm text-white/90">
                  <span aria-hidden="true" className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-white/70" />
                  {e}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <Link
            href={action.cta.href}
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#0a45d6] shadow-sm transition-colors hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {action.cta.label}
            <ArrowRight size={15} aria-hidden="true" />
          </Link>

          <button type="button" onClick={runExplain} disabled={loadingExplain} className={GHOST_BTN}>
            {loadingExplain ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Lightbulb size={15} aria-hidden="true" />}
            {loadingExplain ? 'Pensando…' : 'Explicámelo simple'}
          </button>

          <button type="button" onClick={runDraft} disabled={loadingDraft} className={GHOST_BTN}>
            {loadingDraft ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <MessageSquareText size={15} aria-hidden="true" />}
            {loadingDraft ? 'Redactando…' : 'Redactá el mensaje'}
          </button>
        </div>

        <div aria-live="polite" className="space-y-3">
          {explain.status === 'done' && (
            <div className={`${GLASS} mt-4 px-4 py-3.5`}>
              <p className="mb-1.5 text-xs font-semibold text-white/90">En simple</p>
              <p className="whitespace-pre-line text-sm leading-relaxed text-white">{explain.text}</p>
            </div>
          )}
          {explain.status === 'error' && (
            <p className="mt-4 rounded-xl bg-black/20 px-3.5 py-2.5 text-sm text-white" role="status">{explain.message}</p>
          )}

          {draft.status === 'done' && (
            <div className={`${GLASS} mt-4 px-4 py-3.5`}>
              <label htmlFor={`draft-${action.id}`} className="mb-1.5 block text-xs font-semibold text-white/90">
                Borrador para mandar
              </label>
              <textarea
                id={`draft-${action.id}`}
                ref={draftRef}
                value={draftText}
                onChange={e => setDraftText(e.target.value)}
                rows={Math.min(10, Math.max(4, draftText.split('\n').length + 1))}
                className="w-full resize-y rounded-xl border border-white/25 bg-white/10 p-3 text-sm leading-relaxed text-white placeholder:text-white/60 focus:border-white/60 focus:outline-none"
              />
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <button type="button" onClick={copyDraft} className={GHOST_BTN}>
                  {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
                <button type="button" onClick={runDraft} disabled={loadingDraft} className={GHOST_BTN}>
                  <RotateCw size={15} aria-hidden="true" /> Otra versión
                </button>
              </div>
              <p className="mt-2.5 text-xs leading-relaxed text-white/85">
                Es un borrador de VARA AI. Revisalo y completá lo que está entre corchetes: VARA no manda nada por vos.
              </p>
            </div>
          )}
          {draft.status === 'error' && (
            <p className="mt-4 rounded-xl bg-black/20 px-3.5 py-2.5 text-sm text-white" role="status">{draft.message}</p>
          )}
        </div>
      </div>
    </section>
  )
}
