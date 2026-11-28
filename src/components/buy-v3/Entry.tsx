'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowRight, BarChart3, Check, ClipboardPaste, ExternalLink, Link2, Loader2, MessageCircleQuestion, PencilLine, Plus, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MustHave, ProfileAnswers } from '@/lib/analysis/prefs'
import type { UserOverrides } from '@/lib/analysis/normalize'
import { canAnalyzePastedText, parseListingText } from '@/lib/scrape/parseText'
import { reviewSurfaces, uniqueWarnings, type SurfaceWarning } from '@/lib/scrape/surfaces'
import type { BuyState } from './useBuyAnalysis'
import { KIND_TEXT, money } from './format'
import { ENTRY_COPY } from '@/lib/copy'

/** El servidor solo procesa un texto pegado si tiene MÁS de 150 caracteres (scrape-property): la pantalla pide lo mismo. */
export const MIN_PASTED_CHARS = 151

// ───────────────────────── Entrada: una sola acción ─────────────────────────

const BENEFITS = [
  { Icon: Wallet, title: 'Cuánto te cuesta avanzar', text: 'El precio más los gastos de compra estimados.' },
  { Icon: BarChart3, title: 'Dónde cae el precio', text: 'Contra avisos comparables, con la evidencia a la vista.' },
  { Icon: MessageCircleQuestion, title: 'Qué preguntar antes de visitar', text: 'Lo primero que conviene saber del vendedor.' },
]

/** Estilo común de los botones secundarios: cómodos de tocar y con foco visible. */
const SECONDARY_BTN = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600'

export function EntryForm({
  onSubmit, busy, initialUrl = '', onPasteText, onManual, mx = false,
}: {
  onSubmit: (url: string) => void
  busy: boolean
  initialUrl?: string
  /** Pegar el texto del aviso sin link (el acceso sin cuenta y sin depender de que el portal deje leer). */
  onPasteText?: (text: string) => void
  /** Cargar precio y datos a mano. */
  onManual?: (m: ManualListing) => void
  mx?: boolean
}) {
  const [url, setUrl] = useState(initialUrl)
  const [mode, setMode] = useState<null | 'texto' | 'manual'>(null)
  const [text, setText] = useState('')
  // La carga manual queda montada (oculta) una vez abierta: cerrar o cambiar de modo no borra lo escrito.
  const [manualSeen, setManualSeen] = useState(false)
  const toggle = (m: 'texto' | 'manual') => { if (m === 'manual') setManualSeen(true); setMode(cur => (cur === m ? null : m)) }

  return (
    <div className="pt-2 sm:pt-10">
      <div className="vara-rise relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700 p-6 text-white shadow-product sm:p-10">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-brand-500/30 blur-3xl" />
        <p className="relative [@media(max-height:520px)]:hidden text-xs font-semibold uppercase tracking-widest text-brand-200">Análisis en segundos</p>
        <h1 className="font-display relative mt-3 text-3xl font-extrabold leading-tight text-balance sm:text-5xl [@media(max-height:520px)]:mt-0 [@media(max-height:520px)]:text-2xl">
          ¿Vale la pena esta propiedad?
        </h1>
        <p className="relative mt-3 [@media(max-height:520px)]:hidden max-w-xl text-base text-brand-100 sm:text-lg">
          Pegá el link del aviso y mirá cuánto te costaría avanzar, dónde cae el precio y qué preguntar antes de visitar.
        </p>
        <form
          className="relative mt-6 flex flex-col gap-3 sm:flex-row"
          onSubmit={e => { e.preventDefault(); if (url.trim() && !busy) onSubmit(url) }}
        >
          <label htmlFor="link-aviso" className="sr-only">Link de la propiedad</label>
          <div className="relative min-w-0 flex-1">
            <Link2 size={18} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="link-aviso"
              value={url}
              onChange={e => setUrl(e.target.value)}
              type="url"
              inputMode="url"
              autoFocus
              autoComplete="off"
              placeholder="Pegá acá el link del aviso"
              aria-label="Link de la propiedad"
              className="h-14 w-full rounded-2xl bg-white pl-11 pr-4 text-base text-slate-900 outline-none ring-2 ring-transparent placeholder:text-slate-500 focus:ring-brand-300"
            />
          </div>
          <button type="submit" disabled={!url.trim() || busy}
            className="font-display inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-white px-6 text-base font-bold text-brand-800 shadow-sm transition hover:bg-brand-50 active:scale-[0.99] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            Analizar <ArrowRight size={18} aria-hidden="true" />
          </button>
        </form>
        <p className="relative mt-3 text-xs text-brand-200">Sin cuenta ni formularios. Si el portal bloquea la lectura, podés pegar el encabezado o cargar los datos principales.</p>
      </div>

      {(onPasteText || onManual) && (
        <div className="mt-4">
          <p className="text-sm text-slate-600">¿El portal no deja leer el link, o no lo tenés?</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:flex">
            {onPasteText && (
              <button type="button" onClick={() => toggle('texto')} aria-expanded={mode === 'texto'} className={SECONDARY_BTN}>
                <ClipboardPaste size={16} aria-hidden="true" /> Pegar el texto
              </button>
            )}
            {onManual && (
              <button type="button" onClick={() => toggle('manual')} aria-expanded={mode === 'manual'} className={SECONDARY_BTN}>
                <PencilLine size={16} aria-hidden="true" /> Cargar a mano
              </button>
            )}
          </div>
          {mode === 'texto' && onPasteText && (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-700">{ENTRY_COPY.pasteRecommendation}</p>
              <p className="mt-1 text-xs text-slate-500">{ENTRY_COPY.pasteSteps}</p>
              <textarea value={text} onChange={e => setText(e.target.value)} rows={6} aria-label="Texto de la publicación"
                placeholder="Pegá acá todo el texto de la publicación…"
                className="mt-3 w-full rounded-xl border border-slate-500 bg-white p-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-200" />
              <PastePreview text={text} mx={mx} />
              <button type="button" disabled={!canAnalyzePastedText(text, { mx })} onClick={() => onPasteText(text)}
                className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-700 px-5 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">
                Analizar con este texto
              </button>
              {text.trim().length > 0 && !canAnalyzePastedText(text, { mx }) && (
                <p className="mt-2 text-xs text-amber-800">{ENTRY_COPY.incompleteText}</p>
              )}
            </div>
          )}
          {manualSeen && onManual && (
            <div className={cn('mt-3 rounded-2xl border border-slate-200 bg-white p-4', mode !== 'manual' && 'hidden')}>
              <p className="text-sm font-medium text-slate-800">Cargá los datos del aviso</p>
              <ManualForm mx={mx} onSubmit={onManual} />
            </div>
          )}
        </div>
      )}
      <ul className="mt-5 grid gap-2.5 sm:grid-cols-3">
        {BENEFITS.map(({ Icon, title, text: t }, i) => (
          <li key={title} className="vara-rise flex gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-card" style={{ animationDelay: `${120 + i * 70}ms` }}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Icon size={20} aria-hidden="true" /></span>
            <span>
              <span className="block text-sm font-semibold text-slate-900">{title}</span>
              <span className="mt-0.5 block text-sm text-slate-600">{t}</span>
            </span>
          </li>
        ))}
      </ul>

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
    <div role="alert" className="mt-6 min-w-0 max-w-full rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
        <AlertTriangle size={16} aria-hidden /> Detecté un dato raro en el aviso
      </p>
      <p className="mt-1 text-sm text-amber-900">{w.message}</p>
      {onConfirm && (
        <div className="mt-3 flex min-w-0 flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {w.suggestedLotM2 && (
            <button type="button" onClick={() => onConfirm({ landArea: w.suggestedLotM2 })}
              className="rounded-lg bg-amber-900 px-3 py-2 text-sm font-medium text-white min-h-11">
              Es un lote de {w.suggestedLotM2.toLocaleString('es-AR')} m²
            </button>
          )}
          <input value={m2} onChange={e => setM2(e.target.value)} inputMode="numeric" aria-label="Superficie cubierta en metros cuadrados"
            placeholder="m² cubiertos" className="w-full min-w-0 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm min-h-11 sm:w-32" />
          <button type="button" disabled={!Number.isFinite(n) || n < 10 || n > 20_000}
            onClick={() => onConfirm({ coveredArea: n })}
            className="rounded-lg border border-amber-900 px-3 py-2 text-sm font-medium text-amber-900 disabled:opacity-40 min-h-11">
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
    <li className="flex items-center gap-3 text-base">
      {done ? <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Check size={15} aria-hidden="true" /></span>
        : active ? <Loader2 size={24} className="animate-spin text-brand-600" aria-hidden="true" />
        : <span className="h-6 w-6 rounded-full border-2 border-slate-300" aria-hidden="true" />}
      <span className={cn(done || active ? 'font-medium text-slate-900' : 'text-slate-500')}>{children}</span>
    </li>
  )
}

/** Cada paso aparece cuando existe de verdad. Si no hay dato, no hay barra de progreso. */
export function ProgressPanel({
  state, onConfirm, onPaste, onManual, onPause, onRetry, mx = false,
}: {
  state: BuyState
  onConfirm?: (p: UserOverrides) => Promise<void> | void
  onPaste?: (text: string) => void
  onManual?: (m: ManualListing) => void
  /** Se llama al abrir pegar/manual: la lectura del link deja de contar (no pisa lo que se escribe). */
  onPause?: () => void
  /** Volver a leer el link después de haber dejado de esperar. */
  onRetry?: () => void
  mx?: boolean
}) {
  const [pasted, setPasted] = useState('')
  const [slow, setSlow] = useState(false)
  const [mode, setMode] = useState<null | 'texto' | 'manual'>(null)
  const [paused, setPaused] = useState(false)
  const [manualSeen, setManualSeen] = useState(false)
  const open = (m: 'texto' | 'manual') => {
    if (m === 'manual') setManualSeen(true)
    if (!paused) { onPause?.(); setPaused(true) }
    setMode(cur => (cur === m ? null : m))
  }
  const s = state.subject
  const f = s?.fields
  // Si pasan unos segundos sin ficha, la salida (pegar el texto o cargar a mano) se muestra sola, sin esperar el error.
  useEffect(() => {
    if (s) return
    const t = setTimeout(() => setSlow(true), 5000)
    return () => clearTimeout(t)
  }, [s])

  const where = f ? [f.community?.value, f.neighborhood?.value, f.city?.value].filter(Boolean).join(' · ') : ''
  const price = f?.price?.value && f.currency?.value ? money(f.price.value, f.currency.value) : null
  const facts = f ? [
    f.kind?.value ? KIND_TEXT[f.kind.value] : null,
    f.bedrooms?.value ? `${f.bedrooms.value} ${s?.country === 'MX' ? 'rec.' : 'dorm.'}` : null,
    f.coveredArea?.value ? `${f.coveredArea.value} m² ${s?.country === 'MX' ? 'const.' : 'cub.'}` : null,
  ].filter(Boolean) : []

  return (
    <div className="pt-6 sm:pt-12" role="status" aria-live="polite">
      <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">Analizando</p>
      <h1 className="font-display mt-1 text-2xl font-extrabold text-slate-900">
        {s ? 'Encontré tu propiedad' : 'Leyendo el aviso…'}
      </h1>

      <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-card">
        {s ? (
          <div className="vara-rise flex items-start gap-4">
            {s.photos[0] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.photos[0]} alt="" className="h-20 w-20 shrink-0 rounded-2xl bg-slate-100 object-cover" />
            )}
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">{f?.title?.value ?? 'Propiedad'}</p>
              {where && <p className="text-sm text-slate-500">{where}</p>}
              <p className="mt-1 text-sm font-medium text-slate-700">{[price, ...facts].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
        ) : (
          // Reserva el lugar de la ficha: no inventa datos, solo muestra que se está leyendo.
          <div className="flex items-start gap-4" aria-hidden="true">
            <div className="vara-shimmer h-20 w-20 shrink-0 rounded-2xl" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="vara-shimmer h-4 w-3/4 rounded" />
              <div className="vara-shimmer h-3 w-1/2 rounded" />
              <div className="vara-shimmer h-3 w-2/3 rounded" />
            </div>
          </div>
        )}
      </div>

      <SurfaceWarningCard warnings={state.warnings} onConfirm={onConfirm} />

      {state.insight && <p className="mt-5 text-lg text-slate-800">{state.insight}</p>}

      <ul className="mt-6 space-y-3">
        <Step done={!!s} active={!s}>{s ? 'Leí la publicación' : 'Leyendo la publicación'}</Step>
        <Step done={!!state.evidence} active={!!s && !state.evidence}>
          {state.evidence
            ? `Encontré ${state.evidence.strongMatches} aviso${state.evidence.strongMatches === 1 ? '' : 's'} comparable${state.evidence.strongMatches === 1 ? '' : 's'}`
            : 'Buscando avisos comparables'}
        </Step>
        <Step done={state.phase === 'done'} active={!!state.evidence && state.phase !== 'done'}>Armando la conclusión</Step>
      </ul>

      {/* Salida rápida: algunos portales demoran o no dejan leer. Se ofrece mientras se lee, sin esperar el error. */}
      {!s && slow && (onPaste || onManual) && (
        <div className="vara-rise mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4" data-testid="slow-read">
          <p className="font-semibold text-amber-900">Está tardando más de lo normal</p>
          <p className="mt-1 text-sm text-amber-900/80">Algunos portales demoran o no dejan leer el aviso. Podés seguir sin esperar:</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            {onPaste && (
              <button type="button" onClick={() => open('texto')} aria-expanded={mode === 'texto'} className={SECONDARY_BTN}>
                <ClipboardPaste size={16} aria-hidden="true" /> Pegar el texto del aviso
              </button>
            )}
            {onManual && (
              <button type="button" onClick={() => open('manual')} aria-expanded={mode === 'manual'} className={SECONDARY_BTN}>
                <PencilLine size={16} aria-hidden="true" /> Cargar los datos a mano
              </button>
            )}
          </div>
          {paused && (
            <div className="mt-3">
              <p className="text-sm text-amber-900/90">Dejé de esperar el link para que cargues tus datos tranquilo.</p>
              {/* Volver a leer solo con el formulario cerrado: si no, la respuesta del reintento podría reemplazar lo que se está escribiendo.
                  Al cerrar el reintento deja de estar "en pausa": volver a abrir pegar/manual pausa de nuevo y anula la lectura en curso. */}
              {onRetry && mode === null && (
                <button type="button" onClick={() => { setPaused(false); onRetry() }} className="inline-flex min-h-11 items-center font-semibold text-brand-700 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
                  Volver a leer el link
                </button>
              )}
            </div>
          )}
          {mode === 'texto' && onPaste && (
            <div className="mt-3">
              <p className="text-sm text-slate-700">{ENTRY_COPY.pasteRecommendation}</p>
              <p className="mt-1 text-xs text-slate-500">{ENTRY_COPY.pasteSteps}</p>
              <textarea value={pasted} onChange={e => setPasted(e.target.value)} rows={5} aria-label="Texto del aviso"
                className="mt-2 w-full rounded-xl border border-slate-500 bg-white p-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-200" />
              <button type="button" disabled={!canAnalyzePastedText(pasted, { mx })} onClick={() => onPaste(pasted)}
                className="mt-2 inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-700 px-5 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">
                Analizar este texto
              </button>
              {pasted.trim().length > 0 && !canAnalyzePastedText(pasted, { mx }) && <p className="mt-1 text-xs text-amber-800">{ENTRY_COPY.incompleteText}</p>}
            </div>
          )}
          {manualSeen && onManual && (
            <div className={cn('mt-3 rounded-xl bg-white p-3', mode !== 'manual' && 'hidden')}>
              <ManualForm mx={mx} onSubmit={onManual} />
            </div>
          )}
        </div>
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
            className="rounded-lg border border-slate-500 bg-white px-2 py-2 text-sm min-h-11">
            {currencies.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={price} onChange={e => setPrice(e.target.value)} inputMode="numeric" required placeholder={mx ? '4500000' : '185000'}
            className="min-w-0 flex-1 rounded-lg border border-slate-500 px-3 py-2 text-sm min-h-11" />
        </div>
      </label>
      <label className="text-sm text-slate-600">{mx ? 'Colonia o ciudad' : 'Barrio o ciudad'}
        <input value={where} onChange={e => setWhere(e.target.value)} placeholder={mx ? 'Polanco, CDMX' : 'Palermo, CABA'}
          className="mt-1 w-full rounded-lg border border-slate-500 px-3 py-2 text-sm min-h-11" />
      </label>
      <label className="text-sm text-slate-600">{mx ? 'm² construidos' : 'm² cubiertos'}
        <input value={m2} onChange={e => setM2(e.target.value)} inputMode="numeric"
          className="mt-1 w-full rounded-lg border border-slate-500 px-3 py-2 text-sm min-h-11" />
      </label>
      <label className="text-sm text-slate-600">{mx ? 'Recámaras' : 'Dormitorios'}
        <input value={beds} onChange={e => setBeds(e.target.value)} inputMode="numeric"
          className="mt-1 w-full rounded-lg border border-slate-500 px-3 py-2 text-sm min-h-11" />
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
  if (!text.trim()) return null
  return (
    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3" role="status" aria-live="polite">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-800"><Check size={14} aria-hidden /> {ENTRY_COPY.previewTitle}</p>
      {data.title && <p className="mt-1 text-sm font-medium text-slate-900">{data.title}</p>}
      {facts.length > 0 ? <p className="mt-0.5 text-sm text-slate-700">{facts.join(' · ')}</p> : <p className="mt-1 text-sm text-amber-800">{ENTRY_COPY.incompleteText}</p>}
      {facts.length > 0 && !canAnalyzePastedText(text, { mx }) && <p className="mt-2 text-xs text-amber-800">{ENTRY_COPY.incompleteText}</p>}
      <p className="mt-2 text-xs text-slate-600">{ENTRY_COPY.recognizedMissing}</p>
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
    <div className="vara-rise pt-6 sm:pt-12">
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-800">{ENTRY_COPY.portalBlockedTitle}</p>
        <h1 className="font-display mt-1 text-xl font-extrabold text-slate-900">{message ?? ENTRY_COPY.portalBlockedBody}</h1>
        <p className="mt-1 text-sm text-slate-700">{ENTRY_COPY.pasteRecommendation}</p>
      </div>
      <ol className="mt-5 space-y-3 text-sm text-slate-700">
        <li className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-semibold text-white">1</span>
          {canOpen ? (
            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
              Abrí el aviso <ExternalLink size={13} aria-hidden />
            </a>
          ) : 'Abrí el aviso en tu navegador'}
        </li>
        <li className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-semibold text-white">2</span>
          En el celular: mantené apretado el encabezado del aviso y elegí “Copiar”.
        </li>
        <li className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-semibold text-white">3</span>
          Pegalo acá abajo.
        </li>
      </ol>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={6}
        aria-label="Texto de la publicación"
        placeholder="Pegá acá todo el texto de la publicación…"
        className="mt-4 w-full rounded-xl border border-slate-500 bg-white p-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-200"
      />
      <PastePreview text={text} mx={mx} />
      <button type="button" disabled={!canAnalyzePastedText(text, { mx })} onClick={() => onSubmit(text)}
        className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-700 px-5 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">
        Analizar con este texto
      </button>
      {text.trim().length > 0 && !canAnalyzePastedText(text, { mx }) && (
        <p className="mt-2 text-xs text-amber-800">{ENTRY_COPY.incompleteText}</p>
      )}
      {onManual && (
        <div className="mt-8 border-t border-slate-200 pt-5">
          {manual ? (
            <>
              <p className="text-sm font-medium text-slate-800">Cargá los datos del aviso</p>
              <ManualForm mx={mx} onSubmit={onManual} />
            </>
          ) : (
            <button type="button" onClick={() => setManual(true)} className="min-h-11 text-sm font-medium text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
              ¿No podés copiar el texto? Cargá el precio y los datos a mano
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** Espera asíncrona de Bright Data; siempre deja visible el plan B. */
export function BrightDataPanel({
  progress, message, mx, onSubmit, onManual,
}: {
  progress?: { status: string; records?: number; errors?: number }
  message?: string
  mx: boolean
  onSubmit: (text: string) => void
  onManual: (m: ManualListing) => void
}) {
  const [text, setText] = useState('')
  const [manual, setManual] = useState(false)
  const ready = canAnalyzePastedText(text, { mx })
  return (
    <div className="vara-rise pt-6 sm:pt-12">
      <div className="rounded-3xl border border-brand-200 bg-brand-50 p-5" role="status" aria-live="polite">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">Lectura en curso</p>
        <h1 className="font-display mt-1 text-xl font-extrabold text-slate-900">Estamos leyendo el aviso de Zonaprop</h1>
        <p className="mt-2 text-sm text-slate-700">Puede tardar alrededor de dos minutos. {progress?.status === 'ready' ? `Encontramos ${progress.records ?? 0} resultado${progress.records === 1 ? '' : 's'}.` : 'Podés seguir con el plan B en cualquier momento.'}</p>
        {message && <p className="mt-2 text-xs text-slate-600">{message}</p>}
      </div>
      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-800">¿Preferís no esperar?</p>
        <p className="mt-1 text-sm text-slate-600">Pegá el encabezado donde aparecen el precio y los metros; lo analizamos igual.</p>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={5} aria-label="Encabezado del aviso" className="mt-3 w-full rounded-xl border border-slate-500 p-3 text-sm" placeholder={mx ? 'Pega aquí el encabezado del anuncio…' : 'Pegá acá el encabezado del aviso…'} />
        <button type="button" disabled={!ready} onClick={() => onSubmit(text)} className="mt-2 min-h-11 rounded-xl bg-brand-700 px-5 text-sm font-semibold text-white disabled:opacity-50">Analizar el texto pegado</button>
        <button type="button" onClick={() => setManual(!manual)} className="ml-3 min-h-11 text-sm font-semibold text-brand-700 underline">Cargar datos a mano</button>
        {manual && <ManualForm mx={mx} onSubmit={onManual} />}
      </div>
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
        {mx ? 'Si me cuentas cuatro cosas sobre lo que buscas, también puedo decirte qué tan bien encaja contigo.' : 'Si me contás cuatro cosas sobre lo que buscás, también puedo decirte qué tan bien encaja con vos.'}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-sm text-slate-600">Presupuesto máximo ({currency})
          <input value={budget} onChange={e => setBudget(e.target.value)} inputMode="numeric"
            className="mt-1 w-full rounded-lg border border-slate-500 bg-white px-3 py-2 min-h-11" />
        </label>
        <label className="text-sm text-slate-600">{mx ? 'Zona o colonia' : 'Zona'}
          <input value={location} onChange={e => setLocation(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-500 bg-white px-3 py-2 min-h-11" />
        </label>
        <label className="text-sm text-slate-600">{mx ? 'Recámaras (mínimo)' : 'Dormitorios (mínimo)'}
          <input value={bedrooms} onChange={e => setBedrooms(e.target.value)} inputMode="numeric"
            className="mt-1 w-full rounded-lg border border-slate-500 bg-white px-3 py-2 min-h-11" />
        </label>
      </div>
      <fieldset className="mt-4">
        <legend className="text-sm text-slate-600">Imprescindibles</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {MUST_HAVES.map(m => (
            <button key={m.key} type="button" onClick={() => toggle(m.key)} aria-pressed={must.includes(m.key)}
              className={cn('min-h-11 rounded-full border px-4 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
                must.includes(m.key) ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-300 bg-white text-slate-700')}>
              {(mx && MX_MUST_LABEL[m.key]) || m.label}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="mt-5 flex items-center gap-4">
        <button type="button" disabled={empty}
          onClick={() => onSubmit({ budget: num(budget), budgetCurrency: currency, location, bedrooms: num(bedrooms), mustHaves: must })}
          className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-40 min-h-11">
          Ver cómo encaja
        </button>
        <button type="button" onClick={onSkip} className="min-h-11 px-2 text-sm text-slate-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">Ahora no</button>
      </div>
      <p className="mt-3 text-xs text-slate-600">Se guarda solo en este navegador y no se incluye cuando {mx ? 'compartes' : 'compartís'} un análisis.</p>
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
          className="mt-3 w-full rounded-lg border border-slate-500 bg-white p-2 text-sm" />
      ) : (
        <input value={url} onChange={e => setUrl(e.target.value)} type="url" placeholder="https://…" aria-label="Link del aviso"
          className="mt-3 w-full rounded-lg border border-slate-500 bg-white px-3 py-2 text-sm min-h-11" />
      )}
      <div className="mt-3 flex items-center gap-4">
        <button type="button" disabled={busy || (asText ? !canAnalyzePastedText(text) : !url.trim())} onClick={submit}
          className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-40 min-h-11">
          {busy ? 'Leyendo…' : 'Sumar'}
        </button>
        <button type="button" onClick={() => setAsText(a => !a)} className="min-h-11 px-1 text-xs text-slate-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
          {asText ? 'Usar un link' : 'Pegar el texto del aviso'}
        </button>
      </div>
      {msg && <p role="status" className="mt-2 text-sm text-slate-600">{msg}</p>}
    </div>
  )
}
