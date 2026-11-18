'use client'

import { useState } from 'react'
import { AlertTriangle, ArrowRight, Check, ExternalLink, Loader2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MustHave, ProfileAnswers } from '@/lib/analysis/prefs'
import type { UserOverrides } from '@/lib/analysis/normalize'
import { parseListingText } from '@/lib/scrape/parseText'
import { reviewSurfaces, uniqueWarnings, type SurfaceWarning } from '@/lib/scrape/surfaces'
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

// ───────────────────────── Superficie dudosa: confirmarla en un toque ─────────────────────────

/**
 * El aviso declara una superficie que no tiene sentido (por ejemplo 108 ha para una casa). VARA la apartó del
 * análisis y lo dice acá, con el dato que sí se pueda confirmar en un toque. Nada se aplica sin que la persona lo toque.
 */
export function SurfaceWarningCard({
  warnings, onConfirm,
}: { warnings?: SurfaceWarning[]; onConfirm?: (p: UserOverrides) => Promise<void> | void }) {
  const [m2, setM2] = useState('')
  const list = uniqueWarnings(warnings)
  if (list.length === 0) return null
  const w = list[0]
  const n = Number(m2.replace(/[^\d]/g, ''))
  return (
    <div role="alert" className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
        <AlertTriangle size={16} aria-hidden /> Detecté un dato raro en el aviso
      </p>
      <p className="mt-1 text-sm text-amber-900">{w.message}</p>
      {onConfirm && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {w.suggestedLotM2 && (
            <button type="button" onClick={() => onConfirm({ landArea: w.suggestedLotM2 })}
              className="rounded-lg bg-amber-900 px-3 py-2 text-sm font-medium text-white">
              Es un lote de {w.suggestedLotM2.toLocaleString('es-AR')} m²
            </button>
          )}
          <input value={m2} onChange={e => setM2(e.target.value)} inputMode="numeric" aria-label="Superficie cubierta en metros cuadrados"
            placeholder="m² cubiertos" className="w-32 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm" />
          <button type="button" disabled={!Number.isFinite(n) || n < 10 || n > 20_000}
            onClick={() => onConfirm({ coveredArea: n })}
            className="rounded-lg border border-amber-900 px-3 py-2 text-sm font-medium text-amber-900 disabled:opacity-40">
            Confirmar
          </button>
        </div>
      )}
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
export function ProgressPanel({ state, onConfirm, onPaste }: { state: BuyState; onConfirm?: (p: UserOverrides) => Promise<void> | void; onPaste?: (text: string) => void }) {
  const [pasted, setPasted] = useState('')
  const s = state.subject
  const f = s?.fields
  const where = f ? [f.community?.value, f.neighborhood?.value, f.city?.value].filter(Boolean).join(' · ') : ''
  const price = f?.price?.value && f.currency?.value ? money(f.price.value, f.currency.value) : null
  const facts = f ? [
    f.kind?.value ? KIND_TEXT[f.kind.value] : null,
    f.bedrooms?.value ? `${f.bedrooms.value} ${s?.country === 'MX' ? 'rec.' : 'dorm.'}` : null,
    f.coveredArea?.value ? `${f.coveredArea.value} m² ${s?.country === 'MX' ? 'const.' : 'cub.'}` : null,
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

      <SurfaceWarningCard warnings={state.warnings} onConfirm={onConfirm} />

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

      {/* Salida rápida: algunos portales bloquean la lectura. Se ofrece mientras se lee, sin esperar el error. */}
      {!s && onPaste && (
        <details className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <summary className="cursor-pointer font-medium">¿Tarda mucho? Pegá el texto del aviso</summary>
          <p className="mt-2 text-slate-600">Abrí el aviso, seleccioná todo, copialo y pegalo acá. Lo leo igual.</p>
          <textarea value={pasted} onChange={e => setPasted(e.target.value)} rows={5} aria-label="Texto del aviso"
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <button type="button" disabled={pasted.trim().length < 150} onClick={() => onPaste(pasted)}
            className="mt-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            Analizar este texto
          </button>
          {pasted.trim().length < 150 && <p className="mt-1 text-xs text-slate-500">Pegá el aviso completo (al menos unas pocas líneas).</p>}
        </details>
      )}
    </div>
  )
}

// ───────────────────────── Aviso bloqueado: pegar el texto ─────────────────────────

export interface ManualListing {
  price: number
  currency: 'USD' | 'ARS' | 'MXN'
  coveredM2?: number
  bedrooms?: number
  where?: string
}

/** Último recurso: cinco datos a mano. Con eso ya hay costo total y preguntas. */
function ManualForm({ mx, onSubmit }: { mx: boolean; onSubmit: (m: ManualListing) => void }) {
  const currencies = mx ? (['MXN', 'USD'] as const) : (['USD', 'ARS'] as const)
  const [price, setPrice] = useState('')
  const [currency, setCurrency] = useState<ManualListing['currency']>(currencies[0])
  const [m2, setM2] = useState('')
  const [beds, setBeds] = useState('')
  const [where, setWhere] = useState('')
  const toNum = (s: string) => { const n = Number(s.replace(/[^\d]/g, '')); return Number.isFinite(n) && n > 0 ? n : undefined }
  const p = toNum(price)
  return (
    <form className="mt-3 grid gap-3 sm:grid-cols-2"
      onSubmit={e => { e.preventDefault(); if (p) onSubmit({ price: p, currency, coveredM2: toNum(m2), bedrooms: toNum(beds), where: where.trim() || undefined }) }}>
      <label className="text-sm text-slate-600">Precio publicado
        <div className="mt-1 flex gap-2">
          <select value={currency} onChange={e => setCurrency(e.target.value as ManualListing['currency'])} aria-label="Moneda"
            className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm">
            {currencies.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={price} onChange={e => setPrice(e.target.value)} inputMode="numeric" required placeholder={mx ? '4500000' : '185000'}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </label>
      <label className="text-sm text-slate-600">{mx ? 'Colonia o ciudad' : 'Barrio o ciudad'}
        <input value={where} onChange={e => setWhere(e.target.value)} placeholder={mx ? 'Polanco, CDMX' : 'Palermo, CABA'}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </label>
      <label className="text-sm text-slate-600">{mx ? 'm² construidos' : 'm² cubiertos'}
        <input value={m2} onChange={e => setM2(e.target.value)} inputMode="numeric"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </label>
      <label className="text-sm text-slate-600">{mx ? 'Recámaras' : 'Dormitorios'}
        <input value={beds} onChange={e => setBeds(e.target.value)} inputMode="numeric"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </label>
      <button type="submit" disabled={!p}
        className="rounded-xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2 sm:justify-self-start">
        Analizar con estos datos
      </button>
    </form>
  )
}

/** Lo que VARA ya entendió del texto pegado, al instante y sin enviar nada: es la prueba de que "lo leemos igual". */
function PastePreview({ text, mx }: { text: string; mx: boolean }) {
  const { data, warnings } = reviewSurfaces(parseListingText(text, { mx }))
  const facts = [
    data.price ? `${data.currency === 'USD' ? 'US$' : data.currency === 'MXN' ? 'MX$' : '$'} ${data.price.toLocaleString('es-AR')}` : null,
    data.rooms ? `${data.rooms} ambientes` : null,
    data.bedrooms ? `${data.bedrooms} ${mx ? 'recámaras' : 'dormitorios'}` : null,
    data.bathrooms ? `${data.bathrooms} baños` : null,
    data.coveredM2 ? `${data.coveredM2.toLocaleString('es-AR')} m² ${mx ? 'construidos' : 'cubiertos'}` : null,
    data.totalM2 ? `${data.totalM2.toLocaleString('es-AR')} m² totales` : null,
  ].filter(Boolean)
  if (facts.length === 0 && warnings.length === 0) return null
  return (
    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3" role="status" aria-live="polite">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-800"><Check size={14} aria-hidden /> Esto es lo que leí</p>
      {data.title && <p className="mt-1 text-sm font-medium text-slate-900">{data.title}</p>}
      <p className="mt-0.5 text-sm text-slate-700">{facts.join(' · ')}</p>
      {uniqueWarnings(warnings).map(w => (
        <p key={w.field} className="mt-2 flex items-start gap-1.5 text-sm text-amber-900">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden /> <span>{w.message}</span>
        </p>
      ))}
    </div>
  )
}

export function BlockedPaste({
  message, onSubmit, mx = false, onManual, url,
}: { message?: string; onSubmit: (text: string) => void; mx?: boolean; onManual?: (m: ManualListing) => void; url?: string }) {
  const [text, setText] = useState('')
  const [manual, setManual] = useState(false)
  const canOpen = !!url && /^https?:\/\//i.test(url)
  return (
    <div className="pt-10">
      <p className="text-slate-800">{message ?? 'No pudimos leer ese aviso.'}</p>
      <p className="mt-1 text-sm text-slate-600">Son tres pasos y lo leo igual:</p>
      <ol className="mt-3 space-y-2 text-sm text-slate-700">
        <li className="flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">1</span>
          {canOpen ? (
            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
              Abrí el aviso <ExternalLink size={13} aria-hidden />
            </a>
          ) : 'Abrí el aviso en tu navegador'}
        </li>
        <li className="flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">2</span>
          Seleccioná todo y copialo (⌘A y ⌘C en Mac, Ctrl+A y Ctrl+C en Windows). En el celular: mantené apretado el texto y elegí “Seleccionar todo”.
        </li>
        <li className="flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">3</span>
          Pegalo acá abajo.
        </li>
      </ol>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={6}
        aria-label="Texto de la publicación"
        placeholder="Pegá acá todo el texto de la publicación…"
        className="mt-4 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
      />
      <PastePreview text={text} mx={mx} />
      <button type="button" disabled={text.trim().length < 150} onClick={() => onSubmit(text)}
        className="mt-3 rounded-xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
        Analizar con este texto
      </button>
      {text.trim().length > 0 && text.trim().length < 150 && (
        <p className="mt-2 text-xs text-slate-500">Pegá la publicación completa para que pueda leerla.</p>
      )}
      {onManual && (
        <div className="mt-8 border-t border-slate-200 pt-5">
          {manual ? (
            <>
              <p className="text-sm font-medium text-slate-800">Cargá los datos del aviso</p>
              <ManualForm mx={mx} onSubmit={onManual} />
            </>
          ) : (
            <button type="button" onClick={() => setManual(true)} className="text-sm font-medium text-brand-700 hover:underline">
              ¿No podés copiar el texto? Cargá el precio y los datos a mano
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ───────────────────────── Perfilado progresivo ─────────────────────────

const MUST_HAVES: { key: MustHave; label: string }[] = [
  { key: 'pool', label: 'Pileta' }, { key: 'garden', label: 'Jardín' },
  { key: 'parking', label: 'Cochera' }, { key: 'study', label: 'Escritorio' },
]

const MX_MUST_LABEL: Partial<Record<MustHave, string>> = { pool: 'Alberca', parking: 'Estacionamiento', study: 'Estudio' }

export function ProfilePrompt({
  onSubmit, onSkip, currency = 'USD', mx = false,
}: {
  onSubmit: (a: ProfileAnswers) => void | Promise<void>
  onSkip: () => void
  /** Moneda del aviso: el presupuesto se pide en la misma, así se puede comparar. */
  currency?: 'USD' | 'ARS' | 'MXN'
  mx?: boolean
}) {
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
        <label className="text-sm text-slate-600">Presupuesto máximo ({currency})
          <input value={budget} onChange={e => setBudget(e.target.value)} inputMode="numeric"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
        </label>
        <label className="text-sm text-slate-600">{mx ? 'Zona o colonia' : 'Zona'}
          <input value={location} onChange={e => setLocation(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
        </label>
        <label className="text-sm text-slate-600">{mx ? 'Recámaras (mínimo)' : 'Dormitorios (mínimo)'}
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
              {(mx && MX_MUST_LABEL[m.key]) || m.label}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="mt-5 flex items-center gap-4">
        <button type="button" disabled={empty}
          onClick={() => onSubmit({ budget: num(budget), budgetCurrency: currency, location, bedrooms: num(bedrooms), mustHaves: must })}
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
