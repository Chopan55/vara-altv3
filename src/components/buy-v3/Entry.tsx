'use client'

import { useState } from 'react'
import { ArrowRight, Check, Loader2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MustHave, ProfileAnswers } from '@/lib/analysis/prefs'
import type { BuyState } from './useBuyAnalysis'
import { KIND_TEXT, money } from './format'

// ───────────────────────── Entrada: una sola acción ─────────────────────────

export function EntryForm({
  onSubmit, busy, initialUrl = '',
}: { onSubmit: (url: string) => void; busy: boolean; initialUrl?: string }) {
  const [url, setUrl] = useState(initialUrl)
  return (
    <div className="pt-8 sm:pt-16">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
        Pegá el link de una propiedad.
      </h1>
      <p className="mt-3 max-w-xl text-lg text-slate-600">
        VARA la analiza, la compara y te dice qué miraría antes de avanzar.
      </p>
      <form
        className="mt-8 flex flex-col gap-3 sm:flex-row"
        onSubmit={e => { e.preventDefault(); if (url.trim() && !busy) onSubmit(url) }}
      >
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          type="url"
          inputMode="url"
          autoFocus
          placeholder="https://…"
          aria-label="Link de la propiedad"
          className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
        />
        <button type="submit" disabled={!url.trim() || busy}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-6 py-3.5 text-base font-semibold text-white hover:bg-brand-800 disabled:opacity-50">
          Analizar <ArrowRight size={18} />
        </button>
      </form>
      <p className="mt-3 text-sm text-slate-500">Sin cuenta ni formularios. Funciona con Zonaprop, Argenprop, MercadoLibre y más.</p>
    </div>
  )
}

// ───────────────────────── Progreso real, no simulado ─────────────────────────

function Step({ done, active, children }: { done: boolean; active: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2.5 text-sm">
      {done ? <Check size={16} className="text-emerald-600" />
        : active ? <Loader2 size={16} className="animate-spin text-brand-600" />
        : <span className="h-4 w-4 rounded-full border border-slate-300" />}
      <span className={cn(done ? 'text-slate-800' : active ? 'text-slate-800' : 'text-slate-400')}>{children}</span>
    </li>
  )
}

/** Cada paso aparece cuando existe de verdad. Si no hay dato, no hay barra de progreso. */
export function ProgressPanel({ state }: { state: BuyState }) {
  const s = state.subject
  const f = s?.fields
  const where = f ? [f.community?.value, f.neighborhood?.value, f.city?.value].filter(Boolean).join(' · ') : ''
  const price = f?.price?.value && f.currency?.value ? money(f.price.value, f.currency.value) : null
  const facts = f ? [
    f.kind?.value ? KIND_TEXT[f.kind.value] : null,
    f.bedrooms?.value ? `${f.bedrooms.value} dorm.` : null,
    f.coveredArea?.value ? `${f.coveredArea.value} m² cub.` : null,
  ].filter(Boolean) : []

  return (
    <div className="pt-10" role="status" aria-live="polite">
      {s ? (
        <div className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-4">
          {s.photos[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.photos[0]} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover bg-slate-100" />
          )}
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">{f?.title?.value ?? 'Propiedad'}</p>
            {where && <p className="text-sm text-slate-500">{where}</p>}
            <p className="mt-1 text-sm text-slate-600">{[price, ...facts].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
      ) : (
        <p className="text-slate-600">Leyendo la publicación…</p>
      )}

      {state.insight && <p className="mt-5 text-lg text-slate-800">{state.insight}</p>}

      <ul className="mt-5 space-y-2.5">
        <Step done={!!s} active={!s}>Leí la publicación</Step>
        <Step done={!!state.evidence} active={!!s && !state.evidence}>
          {state.evidence
            ? `Encontré ${state.evidence.strongMatches} aviso${state.evidence.strongMatches === 1 ? '' : 's'} comparable${state.evidence.strongMatches === 1 ? '' : 's'}`
            : 'Buscando avisos comparables'}
        </Step>
        <Step done={state.phase === 'done'} active={!!state.evidence && state.phase !== 'done'}>Armando la conclusión</Step>
      </ul>
    </div>
  )
}

// ───────────────────────── Aviso bloqueado: pegar el texto ─────────────────────────

export function BlockedPaste({
  message, onSubmit,
}: { message?: string; onSubmit: (text: string) => void }) {
  const [text, setText] = useState('')
  return (
    <div className="pt-10">
      <p className="text-slate-800">{message ?? 'No pudimos leer ese aviso.'}</p>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={6}
        aria-label="Texto de la publicación"
        placeholder="Copiá todo el texto de la publicación y pegalo acá…"
        className="mt-4 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
      />
      <button type="button" disabled={text.trim().length < 150} onClick={() => onSubmit(text)}
        className="mt-3 rounded-xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
        Analizar con este texto
      </button>
      {text.trim().length > 0 && text.trim().length < 150 && (
        <p className="mt-2 text-xs text-slate-500">Pegá la publicación completa para que pueda leerla.</p>
      )}
    </div>
  )
}

// ───────────────────────── Perfilado progresivo ─────────────────────────

const MUST_HAVES: { key: MustHave; label: string }[] = [
  { key: 'pool', label: 'Pileta' }, { key: 'garden', label: 'Jardín' },
  { key: 'parking', label: 'Cochera' }, { key: 'study', label: 'Escritorio' },
]

export function ProfilePrompt({
  onSubmit, onSkip,
}: { onSubmit: (a: ProfileAnswers) => void | Promise<void>; onSkip: () => void }) {
  const [budget, setBudget] = useState('')
  const [location, setLocation] = useState('')
  const [bedrooms, setBedrooms] = useState('')
  const [must, setMust] = useState<MustHave[]>([])

  const toggle = (k: MustHave) => setMust(m => (m.includes(k) ? m.filter(x => x !== k) : [...m, k]))
  const num = (s: string) => { const n = Number(s.replace(/[^\d.]/g, '')); return isFinite(n) && n > 0 ? n : undefined }
  const empty = !budget && !location && !bedrooms && must.length === 0

  return (
    <div className="rounded-2xl border border-brand-200 bg-brand-50/50 p-5">
      <p className="font-semibold text-slate-900">Ya pude analizar la propiedad.</p>
      <p className="mt-1 text-sm text-slate-600">
        Si me contás cuatro cosas sobre lo que buscás, también puedo decirte qué tan bien encaja con vos.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-sm text-slate-600">Presupuesto máximo (USD)
          <input value={budget} onChange={e => setBudget(e.target.value)} inputMode="numeric"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
        </label>
        <label className="text-sm text-slate-600">Zona
          <input value={location} onChange={e => setLocation(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
        </label>
        <label className="text-sm text-slate-600">Dormitorios (mínimo)
          <input value={bedrooms} onChange={e => setBedrooms(e.target.value)} inputMode="numeric"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
        </label>
      </div>
      <fieldset className="mt-4">
        <legend className="text-sm text-slate-600">Imprescindibles</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {MUST_HAVES.map(m => (
            <button key={m.key} type="button" onClick={() => toggle(m.key)} aria-pressed={must.includes(m.key)}
              className={cn('rounded-full border px-3 py-1.5 text-sm',
                must.includes(m.key) ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700')}>
              {m.label}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="mt-5 flex items-center gap-4">
        <button type="button" disabled={empty}
          onClick={() => onSubmit({ budget: num(budget), location, bedrooms: num(bedrooms), mustHaves: must })}
          className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
          Ver cómo encaja
        </button>
        <button type="button" onClick={onSkip} className="text-sm text-slate-500 hover:underline">Ahora no</button>
      </div>
      <p className="mt-3 text-xs text-slate-500">Se guarda solo en este navegador y no se incluye cuando compartís un análisis.</p>
    </div>
  )
}

// ───────────────────────── Sumar avisos parecidos ─────────────────────────

export function AddComparables({
  onAdd, highlight,
}: {
  onAdd: (url: string, text?: string) => Promise<{ ok: boolean; message: string }>
  highlight: boolean
}) {
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [asText, setAsText] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setMsg(null)
    // Un aviso pegado como texto no tiene link: se le da uno único para que no se pisen entre sí.
    const r = await onAdd(asText ? `https://aviso.pegado/${Date.now()}` : url, asText ? text : undefined)
    setBusy(false)
    setMsg(r.message)
    if (r.ok) { setUrl(''); setText('') }
  }

  return (
    <div className={cn('rounded-xl border p-4', highlight ? 'border-amber-300 bg-amber-50/60' : 'border-slate-200 bg-white')}>
      <p className="flex items-center gap-1.5 text-sm font-medium text-slate-900"><Plus size={14} /> Sumar un aviso parecido</p>
      <p className="mt-0.5 text-sm text-slate-500">
        {highlight
          ? 'Con dos o tres avisos parecidos que hayas visto mejoro mucho la referencia.'
          : 'Si viste otro aviso comparable, sumalo y recalculo.'}
      </p>
      {asText ? (
        <textarea value={text} onChange={e => setText(e.target.value)} rows={4} aria-label="Texto del aviso"
          className="mt-3 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm" />
      ) : (
        <input value={url} onChange={e => setUrl(e.target.value)} type="url" placeholder="https://…" aria-label="Link del aviso"
          className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
      )}
      <div className="mt-3 flex items-center gap-4">
        <button type="button" disabled={busy || (asText ? text.trim().length < 150 : !url.trim())} onClick={submit}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40">
          {busy ? 'Leyendo…' : 'Sumar'}
        </button>
        <button type="button" onClick={() => setAsText(a => !a)} className="text-xs text-slate-500 hover:underline">
          {asText ? 'Usar un link' : 'Pegar el texto del aviso'}
        </button>
      </div>
      {msg && <p role="status" className="mt-2 text-sm text-slate-600">{msg}</p>}
    </div>
  )
}
