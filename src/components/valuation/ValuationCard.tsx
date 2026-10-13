'use client'
import { useEffect, useMemo, useState } from 'react'
import { Link2, Plus, X, Loader2, TrendingUp } from 'lucide-react'
import type { Property } from '@/types'
import type { ScrapeResult } from '@/app/api/scrape-property/route'
import { cn, formatPrice } from '@/lib/utils'
import { estimateValue, MIN_USED, type Confidence, type ValuationComp, type Verdict } from '@/lib/valuation/model'
import { addComp, compFromScraped, loadComps, removeComp, subjectFromProperty } from '@/lib/valuation/store'
import { parseCount } from '@/lib/propertyOverrides'

const VERDICT: Record<Verdict, { title: string; tone: string }> = {
  DENTRO: { title: 'Precio competitivo', tone: 'text-emerald-700' },
  LEVE_ARRIBA: { title: 'Levemente por encima del mercado', tone: 'text-amber-700' },
  ARRIBA: { title: 'Por encima del mercado', tone: 'text-rose-700' },
  LEVE_ABAJO: { title: 'Levemente por debajo del mercado', tone: 'text-emerald-700' },
  OPORTUNIDAD_APARENTE: { title: 'Oportunidad aparente', tone: 'text-emerald-700' },
}

const CONFIDENCE: Record<Confidence, string> = {
  ALTA: 'Confianza alta: hay varias propiedades muy parecidas.',
  MEDIA: 'Confianza media: hay algunas propiedades parecidas.',
  BAJA: 'Confianza baja: pocos comparables o muy distintos entre sí. Tomalo como una orientación.',
}

function verdictText(v: Verdict, gap: number): string {
  switch (v) {
    case 'DENTRO': return 'Está dentro del rango habitual de propiedades comparables.'
    case 'LEVE_ARRIBA': return `Está aproximadamente ${Math.round(gap)}% por encima de las propiedades similares que cargaste.`
    case 'ARRIBA': return `Está aproximadamente ${Math.round(gap)}% por encima del rango de propiedades similares.`
    case 'LEVE_ABAJO': return `Está aproximadamente ${Math.round(gap)}% por debajo del rango de propiedades similares.`
    case 'OPORTUNIDAD_APARENTE': return `Está entre ${Math.max(1, Math.round(gap) - 2)} y ${Math.round(gap) + 2}% por debajo de comparables similares. Un precio bajo no siempre es oportunidad: conviene revisar si hay algo que lo explique.`
  }
}

const num = (n: number, cur: 'USD' | 'ARS') => formatPrice(n, cur)

export function ValuationCard({ property }: { property: Property }) {
  const [comps, setComps] = useState<ValuationComp[]>([])
  const [mode, setMode] = useState<'link' | 'manual' | null>(null)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [m, setM] = useState<Record<string, string>>({})

  useEffect(() => { setComps(loadComps(property.id)) }, [property.id])

  const subject = useMemo(() => subjectFromProperty(property), [property])
  const result = useMemo(() => estimateValue(subject, comps), [subject, comps])
  const currency = subject.currency

  async function addByLink() {
    const link = url.trim()
    try { new URL(link) } catch { setNotice('Ese link no parece válido.'); return }
    setBusy(true); setNotice(null)
    try {
      const res = await fetch('/api/scrape-property', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: link }) })
      const data = (await res.json()) as ScrapeResult
      const c = compFromScraped(link, data.data ?? {})
      if (!c) {
        setNotice(data.status === 'blocked'
          ? 'Ese portal bloqueó la lectura. Probá con el modo manual.'
          : 'No pudimos sacar el precio de ese aviso. Probá con el modo manual.')
        return
      }
      setComps(addComp(property.id, c)); setUrl(''); setMode(null)
    } catch {
      setNotice('No pudimos leer ese aviso. Probá con el modo manual.')
    } finally { setBusy(false) }
  }

  function addManual() {
    const price = parseCount(m.price ?? '')
    if (!price) { setNotice('Escribí el precio publicado.'); return }
    const yn = (k: string) => (m[k] === 'SI' ? true : m[k] === 'NO' ? false : undefined)
    const c: ValuationComp = {
      id: `manual-${Date.now()}`,
      title: (m.title ?? '').trim() || 'Comparable manual',
      price, currency,
      type: subject.type,
      neighborhood: (m.neighborhood ?? '').trim() || undefined,
      city: (m.city ?? '').trim() || subject.city,
      bedrooms: parseCount(m.bedrooms ?? ''), bathrooms: parseCount(m.bathrooms ?? ''),
      coveredSurface: parseCount(m.covered ?? ''), surface: parseCount(m.lot ?? ''),
      ageYears: parseCount(m.age ?? ''), garage: yn('garage'), pool: yn('pool'),
    }
    setComps(addComp(property.id, c)); setM({}); setMode(null); setNotice(null)
  }

  const input = 'mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-base font-normal sm:text-sm'
  const field = (key: string, label: string, ph = '') => (
    <label key={key} className="block text-xs font-semibold text-slate-600">{label}
      <input value={m[key] ?? ''} onChange={e => setM(s => ({ ...s, [key]: e.target.value }))} placeholder={ph} inputMode={['title', 'neighborhood', 'city'].includes(key) ? 'text' : 'decimal'} className={input} />
    </label>
  )
  const yesNo = (key: string, label: string) => (
    <div key={key} className="text-xs font-semibold text-slate-600">{label}
      <div className="mt-1 flex gap-2">
        {[['SI', 'Sí'], ['NO', 'No']].map(([v, l]) => (
          <button key={v} type="button" aria-pressed={m[key] === v} onClick={() => setM(s => ({ ...s, [key]: s[key] === v ? '' : v }))}
            className={cn('flex-1 rounded-xl border px-3 py-2 text-sm font-semibold', m[key] === v ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600')}>{l}</button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <TrendingUp size={16} className="text-brand-500" aria-hidden="true" />
        <h2 className="text-sm font-bold text-slate-900">Valor de referencia</h2>
      </div>

      {result.status === 'ok' ? (
        <div className="mt-3 space-y-4">
          <div>
            <p className={cn('text-base font-extrabold', VERDICT[result.verdict].tone)}>{VERDICT[result.verdict].title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{verdictText(result.verdict, result.gapPct)}</p>
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>{num(result.low, currency)}</span><span className="font-semibold text-slate-700">Rango de comparables</span><span>{num(result.high, currency)}</span>
            </div>
            {(() => {
              const min = Math.min(result.low, property.price) * 0.94
              const max = Math.max(result.high, property.price) * 1.06
              const pos = (v: number) => `${Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100))}%`
              return (
                <div className="relative mt-1.5 h-2 rounded-full bg-slate-100">
                  <div className="absolute inset-y-0 rounded-full bg-emerald-200" style={{ left: pos(result.low), width: `calc(${pos(result.high)} - ${pos(result.low)})` }} />
                  <div className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand-600 shadow" style={{ left: pos(property.price) }} aria-label="Precio publicado" />
                </div>
              )
            })()}
            <p className="mt-2 text-center text-xs font-bold text-slate-700">Publicada en {num(property.price, currency)}</p>
          </div>

          <p className="text-xs text-slate-500">{CONFIDENCE[result.confidence]} Según {result.comps.filter(c => c.used).length} comparables.</p>

          {(result.pushUp.length > 0 || result.pushDown.length > 0) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {result.pushUp.length > 0 && <div><p className="text-[11px] font-bold text-emerald-700">Lo que empuja el valor hacia arriba</p><p className="mt-0.5 text-xs text-slate-600">{result.pushUp.join(' · ')}</p></div>}
              {result.pushDown.length > 0 && <div><p className="text-[11px] font-bold text-amber-700">Lo que lo limita</p><p className="mt-0.5 text-xs text-slate-600">{result.pushDown.join(' · ')}</p></div>}
            </div>
          )}

          <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-600">
            <span className="font-semibold text-slate-800">Margen de negociación: {result.negotiation.margin === 'ALTO' ? 'alto' : result.negotiation.margin === 'MODERADO' ? 'moderado' : 'bajo'}. </span>
            {result.negotiation.offerLow !== null && result.negotiation.offerHigh !== null
              ? `Una oferta inicial razonable podría estar entre ${num(result.negotiation.offerLow, currency)} y ${num(result.negotiation.offerHigh, currency)}, según el estado real y la motivación del vendedor.`
              : 'El precio ya está en línea con propiedades parecidas; no hay mucho espacio para bajar sin riesgo de perder la operación.'}
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          {comps.length === 0
            ? `Para saber si el precio publicado es razonable, VARA la compara con propiedades parecidas que cargues vos (mismo barrio, tipo, dormitorios, estado y antigüedad). Cargá al menos ${MIN_USED}.`
            : `Tenés ${result.used} comparable${result.used === 1 ? '' : 's'} parecido${result.used === 1 ? '' : 's'}; hacen falta ${MIN_USED} para estimar. Sumá ${result.needed} más${result.comps.length > result.used ? ' (los que cargaste son poco parecidos a esta propiedad)' : ''}.`}
        </p>
      )}

      {comps.length > 0 && (
        <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
          {result.comps.map(sc => (
            <li key={sc.comp.id} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-800">{sc.comp.title}</p>
                <p className="text-[11px] text-slate-500">
                  {num(sc.comp.price, sc.comp.currency)} · {Math.round(sc.sim.score * 100)}% comparable{!sc.used ? ' · no se usa (poco parecida)' : ''}
                </p>
                {sc.sim.matches.length > 0 && <p className="text-[11px] text-slate-400">Parecida en: {sc.sim.matches.join(', ')}</p>}
                {sc.sim.differences.length > 0 && <p className="text-[11px] text-amber-600">Distinta en: {sc.sim.differences.join(', ')}</p>}
              </div>
              <button type="button" onClick={() => setComps(removeComp(property.id, sc.comp.id))} aria-label={`Quitar ${sc.comp.title}`} className="flex-shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700"><X size={14} /></button>
            </li>
          ))}
          {result.ignoredOtherCurrency > 0 && <li className="py-2 text-[11px] text-slate-400">{result.ignoredOtherCurrency} comparable(s) en otra moneda no se usan.</li>}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => { setMode(mode === 'link' ? null : 'link'); setNotice(null) }} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"><Link2 size={12} aria-hidden="true" /> Sumar por link</button>
        <button type="button" onClick={() => { setMode(mode === 'manual' ? null : 'manual'); setNotice(null) }} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"><Plus size={12} aria-hidden="true" /> Sumar a mano</button>
      </div>

      {mode === 'link' && (
        <form className="mt-3 flex gap-2" onSubmit={e => { e.preventDefault(); void addByLink() }}>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Pegá el link del aviso (MercadoLibre, Zonaprop, Argenprop…)" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-sm" />
          <button type="submit" disabled={busy || !url.trim()} className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{busy ? <Loader2 size={13} className="animate-spin" /> : null} Sumar</button>
        </form>
      )}

      {mode === 'manual' && (
        <form className="mt-3 space-y-3" onSubmit={e => { e.preventDefault(); addManual() }}>
          <div className="grid gap-3 sm:grid-cols-2">
            {field('title', 'Nombre o referencia', 'Casa Los Álamos')}
            {field('price', `Precio publicado (${currency})`)}
            {field('neighborhood', 'Barrio', subject.neighborhood ?? '')}
            {field('bedrooms', 'Dormitorios')}
            {field('bathrooms', 'Baños')}
            {field('covered', 'Superficie cubierta (m²)')}
            {field('lot', 'Lote / total (m²)')}
            {field('age', 'Antigüedad (años)')}
            {yesNo('garage', 'Cochera')}
            {yesNo('pool', 'Pileta')}
          </div>
          <button type="submit" className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white hover:bg-slate-800">Sumar comparable</button>
        </form>
      )}

      {notice && <p role="alert" className="mt-2 text-xs text-rose-600">{notice}</p>}

      <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
        Compara precios publicados (pedidos), no de cierre, y solo con las propiedades que cargaste. No es una tasación.
      </p>
    </div>
  )
}
