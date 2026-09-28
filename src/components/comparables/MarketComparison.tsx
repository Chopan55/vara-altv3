'use client'

/**
 * Comparación con el mercado.
 * El usuario elige cuál de sus propiedades comparar, VARA genera el link
 * de búsqueda en Zonaprop/Argenprop, el usuario pega los avisos que encontró.
 *
 */

import { useState, useCallback, useEffect } from 'react'
import {
  AlertCircle, ExternalLink, Plus, X, TrendingUp, TrendingDown, Minus,
  ChevronDown, Search,
} from 'lucide-react'
import {
  analyzeMarketPosition, fromScrapedListing, MARKET_CAVEAT, MIN_COMPARABLES,
  type Comparable, type MarketVerdict,
} from '@/lib/comparables/model'
import type { ComparablesResponse } from '@/app/api/comparables/route'
import type { ScrapeResult } from '@/app/api/scrape-property/route'
import type { PropertyCandidate } from '@/lib/candidates/model'

const VERDICT_STYLE: Record<Exclude<MarketVerdict, 'NOT_ENOUGH_DATA'>, { bg: string; fg: string; Icon: React.ElementType }> = {
  BELOW: { bg: 'bg-sky-50 border-sky-100', fg: 'text-sky-700', Icon: TrendingDown },
  WITHIN: { bg: 'bg-emerald-50 border-emerald-100', fg: 'text-emerald-700', Icon: Minus },
  ABOVE: { bg: 'bg-amber-50 border-amber-100', fg: 'text-amber-700', Icon: TrendingUp },
}

function money(n: number, currency: string) {
  return `${currency} ${n.toLocaleString('es-AR')}`
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

function zonapropUrl(c: PropertyCandidate): string {
  const tipo = c.type === 'APARTMENT' ? 'departamentos'
    : c.type === 'PH' ? 'ph'
    : c.type === 'LAND' ? 'terrenos'
    : c.type === 'LOCAL' ? 'locales-y-comercios'
    : 'casas'
  const loc = slugify(c.neighborhood || c.city || '')
  return loc
    ? `https://www.zonaprop.com.ar/${tipo}-venta-${loc}.html`
    : `https://www.zonaprop.com.ar/${tipo}-venta.html`
}

function argenpropUrl(c: PropertyCandidate): string {
  const tipo = c.type === 'APARTMENT' ? 'departamento'
    : c.type === 'PH' ? 'ph'
    : 'casa'
  const q = c.neighborhood || c.city || ''
  return q
    ? `https://www.argenprop.com/${tipo}/venta?q=${encodeURIComponent(q)}`
    : `https://www.argenprop.com/${tipo}/venta`
}

function PasteListing({ onAdd, busy }: { onAdd: (url: string) => void; busy: boolean }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 border-2 border-dashed border-slate-200 hover:border-brand-300 text-slate-500 text-xs font-semibold py-2.5 rounded-xl transition-colors">
        <Plus size={13} /> Pegar link de un aviso comparable
      </button>
    )
  }

  return (
    <div className="border border-slate-200 rounded-xl p-3 space-y-2">
      <p className="text-[11px] text-slate-500 leading-relaxed">
        Encontraste una propiedad parecida en Zonaprop o Argenprop: pegá su link acá.
        De MeLi leemos la ficha oficial; de los demás portales leemos el aviso.
      </p>
      <input
        value={url} onChange={e => setUrl(e.target.value)} autoFocus type="url"
        placeholder="https://www.zonaprop.com.ar/..."
        className="w-full border border-slate-200 focus:border-brand-400 rounded-lg px-3 py-2 text-xs text-slate-700 outline-none placeholder:text-slate-300"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={() => { onAdd(url.trim()); setUrl(''); setOpen(false) }}
          disabled={!url.trim() || busy}
          className="text-xs font-bold text-brand-600 hover:text-brand-700 disabled:opacity-40">
          Sumar
        </button>
        <button onClick={() => setOpen(false)} className="text-xs text-slate-400 hover:text-slate-600">
          Cancelar
        </button>
      </div>
    </div>
  )
}

export function MarketComparison({ initialCandidates }: { initialCandidates?: PropertyCandidate[] }) {
  const [candidates, setCandidates] = useState<PropertyCandidate[]>(initialCandidates ?? [])
  const [selected, setSelected] = useState<PropertyCandidate | null>(null)
  const [comparables, setComparables] = useState<Comparable[]>([])
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (initialCandidates) {
      const active = initialCandidates.filter(c => c.status !== 'DISCARDED' && c.price > 0)
      setCandidates(active)
      if (!selected && active.length > 0) setSelected(active[0])
      return
    }
    import('@/lib/candidates/store')
      .then(m => m.loadCandidates())
      .then(list => {
        const active = list.filter(c => c.status !== 'DISCARDED' && c.price > 0)
        setCandidates(active)
        if (active.length > 0) setSelected(active[0])
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addListing = useCallback(async (url: string) => {
    if (!url) return
    try { new URL(url) } catch { setNotice('Ese link no parece válido.'); return }

    setBusy(true); setNotice(null)
    try {
      const meliRes = await fetch('/api/comparables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const meli: ComparablesResponse = await meliRes.json()

      if (meli.status === 'ok' && meli.comparable) {
        const c = meli.comparable
        setComparables(list => (list.some(x => x.id === c.id) ? list : [...list, c]))
        return
      }
      if (meli.status !== 'not_meli') {
        setNotice(meli.message ?? 'No pudimos leer ese aviso de MercadoLibre.')
        return
      }

      const res = await fetch('/api/scrape-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data: ScrapeResult = await res.json()
      const c = fromScrapedListing({ url, portal: data.portal, data: data.data })

      if (!c) {
        setNotice(
          data.status === 'blocked'
            ? 'El portal bloqueó la lectura. Abrí el aviso, copiá todo el texto (Ctrl+A, Ctrl+C) y pegalo en el campo.'
            : 'No pudimos sacar el precio de ese aviso.',
        )
        return
      }
      setComparables(list => (list.some(x => x.id === c.id) ? list : [...list, c]))
    } catch {
      setNotice('No pudimos leer ese aviso.')
    } finally {
      setBusy(false)
    }
  }, [])

  const currency = selected?.currency === 'ARS' ? 'ARS' : 'USD'
  const position = analyzeMarketPosition(selected?.price ?? 0, selected?.surface ?? 0, comparables, currency)
  const withPricePerM2 = comparables.filter(c => typeof c.pricePerM2 === 'number')
  const hasResult = comparables.length > 0

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4 space-y-4">

      <div>
        <p className="text-sm font-semibold text-slate-800">Comparar con el mercado</p>
        <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
          Elegí una propiedad de tu lista y compará su precio contra lo publicado en la zona.
        </p>
      </div>

      {/* Selector de propiedad */}
      {candidates.length === 0 ? (
        <div className="bg-slate-50 rounded-xl px-3 py-2.5">
          <p className="text-[11px] text-slate-500">
            Todavía no tenés propiedades con precio cargadas. Sumá alguna desde el botón + de arriba.
          </p>
        </div>
      ) : (
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
            Propiedad a comparar
          </p>
          <div className="relative">
            <select
              value={selected?.id ?? ''}
              onChange={e => {
                const c = candidates.find(x => x.id === e.target.value) ?? null
                setSelected(c)
                setComparables([])
                setNotice(null)
              }}
              className="w-full appearance-none border border-slate-200 focus:border-brand-400 rounded-xl px-3 py-2.5 pr-8 text-xs text-slate-800 outline-none bg-white"
            >
              {candidates.map(c => (
                <option key={c.id} value={c.id}>
                  {c.title} — {c.currency} {c.price.toLocaleString('es-AR')}
                  {c.surface > 0 ? ` · ${c.surface} m²` : ''}
                  {c.neighborhood ? ` · ${c.neighborhood}` : ''}
                </option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {selected && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500 px-1">
              {selected.price > 0 && selected.surface > 0 && (
                <span className="tabular-nums font-semibold text-slate-700">
                  {currency} {Math.round(selected.price / selected.surface).toLocaleString('es-AR')}/m²
                </span>
              )}
              {selected.neighborhood && <span>{selected.neighborhood}</span>}
              {selected.city && <span>{selected.city}</span>}
              {selected.surface > 0 && <span>{selected.surface} m²</span>}
              {!selected.surface && (
                <span className="text-amber-600">Sin superficie — no se puede calcular precio/m²</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Buscador de comparables */}
      {selected && (selected.neighborhood || selected.city) && (
        <div className="bg-slate-50 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <Search size={12} className="text-slate-400" />
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
              Buscá comparables acá
            </p>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Los portales no permiten búsqueda automática. Hacé clic, elegí 3–5 propiedades
            parecidas y pegá sus links abajo.
          </p>
          <div className="flex flex-wrap gap-2">
            <a href={zonapropUrl(selected)} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-white border border-slate-200 hover:border-brand-400 text-xs font-semibold text-slate-700 px-3 py-1.5 rounded-lg transition-colors">
              <ExternalLink size={11} /> Zonaprop
            </a>
            <a href={argenpropUrl(selected)} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-white border border-slate-200 hover:border-brand-400 text-xs font-semibold text-slate-700 px-3 py-1.5 rounded-lg transition-colors">
              <ExternalLink size={11} /> Argenprop
            </a>
          </div>
        </div>
      )}

      {/* Resultado */}
      {hasResult && position.verdict !== 'NOT_ENOUGH_DATA' && (() => {
        const s = VERDICT_STYLE[position.verdict]
        return (
          <div className={`rounded-xl border px-4 py-3 ${s.bg}`}>
            <div className="flex items-start gap-2">
              <s.Icon size={15} className={`${s.fg} mt-0.5 flex-shrink-0`} />
              <div>
                <p className={`text-sm font-bold ${s.fg}`}>{position.label}</p>
                <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
                  Esta propiedad: {money(position.yourPricePerM2!, currency)}/m² ·{' '}
                  Rango publicado: {money(position.minPricePerM2!, currency)} – {money(position.maxPricePerM2!, currency)}/m²
                  {' '}· {position.sampleSize} aviso{position.sampleSize !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>
        )
      })()}

      {hasResult && position.verdict === 'NOT_ENOUGH_DATA' && (
        <div className="bg-slate-50 rounded-xl px-3 py-2.5">
          <p className="text-[11px] text-slate-600 leading-relaxed">
            {position.label}
            {withPricePerM2.length > 0 && withPricePerM2.length < MIN_COMPARABLES &&
              ` Sumá al menos ${MIN_COMPARABLES - withPricePerM2.length} aviso${MIN_COMPARABLES - withPricePerM2.length > 1 ? 's' : ''} más con superficie.`}
          </p>
        </div>
      )}

      {/* Lista de comparables */}
      {comparables.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
            Avisos de referencia ({comparables.length})
          </p>
          {comparables.map(c => (
            <div key={c.id} className="flex items-center gap-2 py-1.5 border-t border-slate-50">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-700 truncate">{c.title}</p>
                <p className="text-[10px] text-slate-400 tabular-nums">
                  {money(c.price, c.currency)}
                  {c.pricePerM2 ? ` · ${money(c.pricePerM2, c.currency)}/m²` : ' · sin superficie'}
                  {' · '}{c.source === 'meli' ? 'MercadoLibre' : c.portal || 'portal'}
                </p>
              </div>
              <a href={c.url} target="_blank" rel="noopener noreferrer"
                aria-label="Ver aviso" className="text-slate-300 hover:text-slate-600 flex-shrink-0">
                <ExternalLink size={12} />
              </a>
              <button
                onClick={() => setComparables(list => list.filter(x => x.id !== c.id))}
                aria-label="Sacar comparable"
                className="text-slate-300 hover:text-rose-500 flex-shrink-0">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {notice && (
        <div className="flex items-start gap-2 bg-slate-100 rounded-xl px-3 py-2.5">
          <AlertCircle size={12} className="text-slate-500 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-slate-600 leading-relaxed">{notice}</p>
        </div>
      )}

      {selected && <PasteListing onAdd={addListing} busy={busy} />}

      <p className="text-[10px] text-slate-400 leading-relaxed">{MARKET_CAVEAT}</p>
    </div>
  )
}
