'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { decodeShared, type SharedAnalysis } from '@/lib/analysis/share'
import { CONFIDENCE_TEXT, POSITION_TEXT, money, moneyK } from '@/components/buy-v3/format'

/**
 * Vista de un análisis compartido.
 *
 * El contenido viaja en el fragmento de la URL (`#d=…`): no pasa por ningún
 * servidor ni se guarda. Es entrada no confiable: `decodeShared` la valida y
 * acá todo se muestra como texto.
 */
export default function CompartidoPage() {
  const [data, setData] = useState<SharedAnalysis | null | undefined>(undefined)

  useEffect(() => {
    const m = window.location.hash.match(/[#&]d=([A-Za-z0-9_-]+)/)
    setData(m ? decodeShared(m[1]) : null)
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.appendChild(meta)
    return () => { document.head.removeChild(meta) }
  }, [])

  if (data === undefined) {
    return <div className="mx-auto mt-24 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />
  }

  if (data === null) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-xl font-semibold text-slate-900">Este link no se pudo abrir</h1>
        <p className="mt-2 text-slate-600">Puede estar incompleto o ser de una versión anterior. Pedile a quien te lo mandó que lo comparta de nuevo.</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Análisis de VARA</p>
      <h1 className="mt-1 text-2xl font-semibold text-slate-900">{data.title}</h1>
      {data.where && <p className="text-slate-500">{data.where}</p>}
      {data.price && <p className="mt-1 font-medium text-slate-800">{money(data.price.a, data.price.c)}</p>}

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <p className="text-xl font-semibold leading-snug text-slate-900">{data.headline}</p>
        <p className="mt-3 text-slate-700">{data.priceText}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-slate-100 px-3 py-1">Precio publicado: {POSITION_TEXT[data.position]}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">Confianza: {CONFIDENCE_TEXT[data.confidence]}</span>
          {data.range && (
            <span className="rounded-full bg-slate-100 px-3 py-1">
              Rango comparable: {moneyK(data.range.lo, data.range.c)} – {moneyK(data.range.hi, data.range.c).replace(`${data.range.c} `, '')}
            </span>
          )}
        </div>
        <p className="mt-3 text-xs text-slate-500">Son precios pedidos en avisos publicados, no precios de venta.</p>
      </div>

      {data.matches.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900">Avisos con los que se comparó</h2>
          <ul className="mt-3 space-y-2">
            {data.matches.map((m, i) => (
              <li key={i} className="rounded-xl border border-slate-200 bg-white">
                <details className="p-4">
                  <summary className="cursor-pointer list-none">
                    <span className="font-semibold text-slate-900">{m.price && m.cur ? money(m.price, m.cur) : 'Sin precio'}</span>
                    <span className="text-sm text-slate-500"> · {[m.where, m.beds ? `${m.beds} dorm.` : null, m.cov ? `${m.cov} m² cub.` : null].filter(Boolean).join(' · ')}</span>
                    <span className="float-right text-sm font-semibold text-brand-700">{m.score}</span>
                  </summary>
                  <ul className="mt-3 space-y-1 text-sm text-slate-700">
                    {m.reasons.map(r => <li key={r}>✓ {r}</li>)}
                    {m.diffs.map(r => <li key={r} className="text-amber-700">⚠ {r}</li>)}
                    {m.fresh && <li className="text-slate-500">{m.fresh}</li>}
                  </ul>
                  {m.url && (
                    <a href={m.url} target="_blank" rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
                      Ver el aviso en {m.src || 'el portal'} <ExternalLink size={12} />
                    </a>
                  )}
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.checks.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900">Qué miraría antes de avanzar</h2>
          <ul className="mt-3 space-y-2">
            {data.checks.map(c => (
              <li key={c.title} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="font-medium text-slate-900">{c.title}</p>
                <p className="mt-1 text-sm text-slate-600">{c.reason}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.missing.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900">Qué falta confirmar</h2>
          <p className="mt-2 text-slate-700">{data.missing.join(', ')}.</p>
          {data.question && <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-800">{data.question}</p>}
        </section>
      )}

      <div className="mt-12 rounded-2xl bg-slate-50 p-5 text-center">
        <p className="font-medium text-slate-900">¿Querés analizar una propiedad vos?</p>
        <Link href="/analizar?v3=1" className="mt-3 inline-block rounded-xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-800">
          Pegar el link de una propiedad
        </Link>
      </div>
    </main>
  )
}
