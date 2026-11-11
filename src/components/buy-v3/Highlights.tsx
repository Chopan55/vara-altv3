'use client'

/**
 * Lo primero que se ve después de la conclusión: cuánto sale en total, qué
 * preguntarle al vendedor sí o sí, y cómo mandárselo a la familia.
 */

import { useState } from 'react'
import { Copy, MessageCircle, Link2, Share2, ArrowRight, Check } from 'lucide-react'
import type { PropertyAnalysis } from '@/lib/analysis/types'
import { sellerQuestions, sellerQuestionsMessage } from '@/lib/analysis/sellerQuestions'
import { copyText, money } from './format'

export function rangeText(min: number, max: number, cur: Parameters<typeof money>[1]): string {
  return min === max ? money(min, cur) : `${money(min, cur)} – ${money(max, cur).replace(`${cur} `, '')}`
}

export function TotalCostCard({ analysis, onDetail }: { analysis: PropertyAnalysis; onDetail: () => void }) {
  const c = analysis.estimatedTransactionCost
  if (!c.totalRange) return null
  const price = analysis.pricePositioning.subjectAskingPrice
  const extraMin = price ? c.totalRange.min - price.amount : null
  const extraMax = price ? c.totalRange.max - price.amount : null
  return (
    <section aria-labelledby="total-title" className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <p id="total-title" className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lo que pagás en total</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 sm:text-3xl">
        {rangeText(c.totalRange.min, c.totalRange.max, c.totalRange.currency)}
      </p>
      {extraMin !== null && extraMax !== null && (
        <p className="mt-1 text-sm text-slate-600">
          Precio publicado + {rangeText(extraMin, extraMax, c.totalRange.currency)} de gastos de compra estimados.
        </p>
      )}
      <button type="button" onClick={onDetail} className="mt-2 text-sm font-medium text-brand-700 hover:underline">
        Ver de qué se compone
      </button>
    </section>
  )
}

export function SellerQuestionsCard({
  analysis, onAction,
}: { analysis: PropertyAnalysis; onAction: (kind: 'copy_questions' | 'whatsapp_questions') => void }) {
  const [copied, setCopied] = useState(false)
  const f = analysis.subjectProperty.fields
  const kind = f.kind?.value
  const questions = sellerQuestions({
    country: analysis.subjectProperty.country,
    hasCommonCharges: kind === 'apartment' || kind === 'ph' || !!f.community?.value,
  })
  const message = sellerQuestionsMessage(questions, f.title?.value)

  return (
    <section aria-labelledby="questions-title" className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <h2 id="questions-title" className="text-base font-semibold text-slate-900">Preguntale esto al vendedor sí o sí</h2>
      <p className="mt-0.5 text-sm text-slate-500">Antes de dar plata. Sale de los trámites que te van a pedir para firmar.</p>
      <ol className="mt-3 space-y-3">
        {questions.map((q, i) => (
          <li key={q.id} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{i + 1}</span>
            <div>
              <p className="text-sm font-medium text-slate-900">{q.question}</p>
              <p className="text-xs text-slate-500">{q.why}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap gap-2">
        <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer"
          onClick={() => onAction('whatsapp_questions')}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
          <MessageCircle size={14} aria-hidden="true" /> Preguntar por WhatsApp
        </a>
        <button type="button"
          onClick={async () => { if (await copyText(message)) { setCopied(true); onAction('copy_questions'); setTimeout(() => setCopied(false), 2000) } }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />} {copied ? 'Copiado' : 'Copiar las preguntas'}
        </button>
      </div>
    </section>
  )
}

export type ShareChannel = 'wa' | 'link' | 'native'

/** Texto que acompaña al link: lo mínimo para que en WhatsApp se entienda de qué se trata. */
export function shareMessage(analysis: PropertyAnalysis, url: string): string {
  const f = analysis.subjectProperty.fields
  const title = f.title?.value?.slice(0, 90) ?? 'esta propiedad'
  const total = analysis.estimatedTransactionCost.totalRange
  const parts = [
    `Mirá lo que encontré con VARA sobre "${title}".`,
    total ? `Con los gastos de compra sale ${rangeText(total.min, total.max, total.currency)}.` : null,
    url,
  ]
  return parts.filter(Boolean).join(' ')
}

export function ShareCard({
  analysis, share, onFollow,
}: {
  analysis: PropertyAnalysis
  share: (channel: ShareChannel) => string | null
  onFollow: () => void
}) {
  const [notice, setNotice] = useState<string | null>(null)
  const canNative = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const whatsapp = () => {
    const url = share('wa')
    if (!url) return setNotice('No pude armar el link para compartir.')
    window.open(`https://wa.me/?text=${encodeURIComponent(shareMessage(analysis, url))}`, '_blank', 'noopener,noreferrer')
  }
  const copy = async () => {
    const url = share('link')
    if (!url) return setNotice('No pude armar el link para compartir.')
    setNotice(await copyText(url) ? 'Link copiado. No incluye tus preferencias ni tu presupuesto.' : url)
  }
  const native = async () => {
    const url = share('native')
    if (!url) return setNotice('No pude armar el link para compartir.')
    try { await navigator.share({ title: 'Análisis de VARA', text: shareMessage(analysis, '').trim(), url }) } catch { /* canceló */ }
  }

  return (
    <section aria-labelledby="share-title" className="mt-4 rounded-2xl bg-slate-900 p-5 text-white">
      <h2 id="share-title" className="text-base font-semibold">¿Lo decidís con alguien más?</h2>
      <p className="mt-0.5 text-sm text-slate-300">Mandale este análisis. Ve el precio, los comparables y los costos; no ve tus preferencias.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={whatsapp}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600">
          <MessageCircle size={15} aria-hidden="true" /> Compartir por WhatsApp
        </button>
        <button type="button" onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 px-3 py-2.5 text-sm font-medium text-white hover:bg-white/10">
          <Link2 size={15} aria-hidden="true" /> Copiar link
        </button>
        {canNative && (
          <button type="button" onClick={native} aria-label="Más formas de compartir"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 px-3 py-2.5 text-sm font-medium text-white hover:bg-white/10">
            <Share2 size={15} aria-hidden="true" /> Más
          </button>
        )}
      </div>
      {notice && <p role="status" className="mt-3 break-all text-xs text-slate-300">{notice}</p>}
      <div className="mt-5 border-t border-white/10 pt-4">
        <p className="text-sm text-slate-300">¿Te interesa? VARA te acompaña hasta la firma: papeles, oferta y costos.</p>
        <button type="button" onClick={onFollow}
          className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-white hover:underline">
          Seguir esta compra con VARA <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}
