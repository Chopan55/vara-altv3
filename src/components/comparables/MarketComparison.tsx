'use client'

/**
 * Cómo se compara tu propiedad con lo que hay publicado.
 *
 * Un solo camino: pegás el link del aviso. No hay búsqueda automática, y no
 * es por falta de ganas — está medido:
 *
 *  - **MercadoLibre** cerró `/sites/MLA/search`: devuelve 403 incluso con un
 *    token de aplicación válido. Pero dejó abierta la lectura de un aviso
 *    puntual, así que de ahí traemos datos limpios de la API oficial.
 *  - **Zonaprop y Argenprop** bloquean la lectura automática con Cloudflare.
 *    Un aviso suelto sí se puede leer, y si el portal lo impide, pegando el
 *    texto.
 *
 * Que lo elijas vos no es un consuelo: un comparable que elegiste suele ser
 * mejor que uno que encontró una búsqueda por palabras, porque vos sabés por
 * qué se parece al tuyo.
 *
 * Lo que esta pantalla nunca hace es decir cuánto vale tu casa. Son precios
 * pedidos, no de venta.
 */

import { useState, useCallback } from 'react'
import {
  Loader2, AlertCircle, ExternalLink, Plus, X, TrendingUp, TrendingDown, Minus,
} from 'lucide-react'
import {
  analyzeMarketPosition, fromScrapedListing, MARKET_CAVEAT, MIN_COMPARABLES,
  type Comparable, type MarketVerdict,
} from '@/lib/comparables/model'
import type { ComparablesResponse } from '@/app/api/comparables/route'
import type { ScrapeResult } from '@/app/api/scrape-property/route'

const VERDICT_STYLE: Record<Exclude<MarketVerdict, 'NOT_ENOUGH_DATA'>, { bg: string; fg: string; Icon: React.ElementType }> = {
  BELOW: { bg: 'bg-sky-50 border-sky-100', fg: 'text-sky-700', Icon: TrendingDown },
  WITHIN: { bg: 'bg-emerald-50 border-emerald-100', fg: 'text-emerald-700', Icon: Minus },
  ABOVE: { bg: 'bg-amber-50 border-amber-100', fg: 'text-amber-700', Icon: TrendingUp },
}

function money(n: number, currency: string) {
  return `${currency} ${n.toLocaleString('es-AR')}`
}

function PasteListing({ onAdd, busy }: { onAdd: (url: string) => void; busy: boolean }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 border-2 border-dashed border-slate-200 hover:border-slate-300 text-slate-500 text-xs font-semibold py-2.5 rounded-xl transition-colors">
        <Plus size={13} /> Sumar un aviso de referencia
      </button>
    )
  }

  return (
    <div className="border border-slate-200 rounded-xl p-3 space-y-2">
      <p className="text-[11px] text-slate-500 leading-relaxed">
        Pegá el link de un aviso parecido al tuyo. De MercadoLibre leemos la
        ficha oficial; de Zonaprop, Argenprop y el resto leemos la publicación.
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

export function MarketComparison({ price, surface, currency = 'USD', neighborhood, city, province, propertyType }: {
  price?: number
  surface?: number
  currency?: 'USD' | 'ARS'
  neighborhood?: string
  city?: string
  province?: string
  propertyType?: string
}) {
  const [comparables, setComparables] = useState<Comparable[]>([])
  const [searched, setSearched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  /**
   * Un link, dos lectores. MeLi primero porque da datos estructurados; si no
   * es de MeLi, lo intenta el lector de HTML.
   */
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

      // No es de MeLi: lo intenta el lector de HTML.
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
            ? 'Ese portal bloqueó la lectura. Abrí el aviso, copiá el texto (Ctrl+A, Ctrl+C) y sumalo desde Mis propiedades.'
            : 'No pudimos sacar el precio de ese aviso.',
        )
        return
      }
      setComparables(list => (list.some(x => x.id === c.id) ? list : [...list, c]))
    } catch {
      setNotice('No pudimos leer ese aviso.')
    } finally {
      setBusy(false); setSearched(true)
    }
  }, [])

  const position = analyzeMarketPosition(price ?? 0, surface ?? 0, comparables, currency)
  const withPricePerM2 = comparables.filter(c => typeof c.pricePerM2 === 'number')

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-slate-800">Contra el mercado</p>
        <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
          Sumá los avisos que quieras usar de referencia pegando su link.
          Los portales no dejan buscar de forma automática, así que los elegís vos.
        </p>
      </div>

      {notice && (
        <div className="flex items-start gap-2 bg-slate-100 rounded-xl px-3 py-2.5">
          <AlertCircle size={12} className="text-slate-500 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-slate-600 leading-relaxed">{notice}</p>
        </div>
      )}

      {searched && position.verdict !== 'NOT_ENOUGH_DATA' && (() => {
        const s = VERDICT_STYLE[position.verdict]
        return (
          <div className={`rounded-xl border px-4 py-3 ${s.bg}`}>
            <div className="flex items-start gap-2">
              <s.Icon size={15} className={`${s.fg} mt-0.5 flex-shrink-0`} />
              <div>
                <p className={`text-sm font-bold ${s.fg}`}>{position.label}</p>
                <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
                  Tu propiedad: {money(position.yourPricePerM2!, currency)}/m² ·
                  {' '}Rango publicado: {money(position.minPricePerM2!, currency)} – {money(position.maxPricePerM2!, currency)}/m²
                  {' '}· {position.sampleSize} avisos
                </p>
              </div>
            </div>
          </div>
        )
      })()}

      {searched && position.verdict === 'NOT_ENOUGH_DATA' && (
        <div className="bg-slate-50 rounded-xl px-3 py-2.5">
          <p className="text-[11px] text-slate-600 leading-relaxed">
            {position.label}
            {withPricePerM2.length > 0 && withPricePerM2.length < MIN_COMPARABLES &&
              ` Hacen falta al menos ${MIN_COMPARABLES} para que el número signifique algo.`}
          </p>
        </div>
      )}

      {comparables.length > 0 && (
        <div className="space-y-1.5">
          {comparables.map(c => (
            <div key={c.id} className="flex items-center gap-2 py-1.5 border-t border-slate-50">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-700 truncate">{c.title}</p>
                <p className="text-[10px] text-slate-400 tabular-nums">
                  {money(c.price, c.currency)}
                  {c.pricePerM2 ? ` · ${money(c.pricePerM2, c.currency)}/m²` : ' · sin superficie'}
                  {' · '}
                  {c.source === 'meli' ? 'MercadoLibre' : c.portal || 'aviso que pegaste'}
                </p>
              </div>
              <a href={c.url} target="_blank" rel="noopener noreferrer"
                aria-label="Ver el aviso"
                className="text-slate-300 hover:text-slate-600 flex-shrink-0">
                <ExternalLink size={12} />
              </a>
              <button
                onClick={() => setComparables(list => list.filter(x => x.id !== c.id))}
                aria-label="Sacar de la comparación"
                className="text-slate-300 hover:text-rose-500 flex-shrink-0">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <PasteListing onAdd={addListing} busy={busy} />

      <p className="text-[10px] text-slate-400 leading-relaxed">{MARKET_CAVEAT}</p>
    </div>
  )
}
