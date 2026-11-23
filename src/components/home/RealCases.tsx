import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { EXAMPLES, formatCopiedAt } from '@/data/exampleListing'

/** Primer dato del texto copiado del aviso: el precio publicado (USD o MXN). */
const askingPrice = (text: string) => text.match(/(USD|MXN) [\d.,]+/)?.[0] ?? null

/**
 * Casos reales: análisis de VARA sobre avisos reales y públicos, no testimonios.
 * Cada tarjeta abre el análisis completo con sus avisos parecidos.
 */
export function RealCases() {
  return (
    <section id="casos" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-14 md:px-8">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Casos reales</p>
      <h2 className="font-display mt-2 text-3xl font-extrabold text-brand-900 text-balance md:text-4xl">Mirá lo que VARA encuentra en avisos reales.</h2>
      <p className="mt-3 max-w-2xl text-ink-soft">Avisos publicados en portales de Argentina y México, analizados por VARA con avisos parecidos de la zona. No son opiniones: es el análisis tal cual.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {EXAMPLES.map(e => (
          <Link key={e.id} href={`/analizar?ejemplo=${e.id}`}
            className="group flex flex-col rounded-2xl border border-line bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
            <p className="font-display text-lg font-bold text-brand-900">{e.label}</p>
            {askingPrice(e.text) && <p className="mt-1 text-sm text-ink-soft">Publicado a {askingPrice(e.text)}</p>}
            <p className="mt-1 text-sm text-ink-soft">Comparado con {e.comparables.length} avisos parecidos</p>
            <p className="mt-3 text-xs text-ink-soft">{e.portal} · copiado el {formatCopiedAt(e.copiedAt)}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 group-hover:underline">
              Ver el análisis <ArrowRight size={15} aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
