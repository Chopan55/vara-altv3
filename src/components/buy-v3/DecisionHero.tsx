'use client'

/**
 * El primer pantallazo del resultado, pensado para el celular: responde "¿vale la pena avanzar?" sin scroll.
 * Arriba (oscuro): qué propiedad encontró VARA, el veredicto y las dos cifras que importan, cada una rotulada
 * como dato del aviso o estimación de VARA. Abajo (claro): la prueba (dónde cae el precio entre comparables),
 * la primera pregunta para el vendedor y UNA acción principal.
 */

import { useState } from 'react'
import { AlertTriangle, ArrowRight, Check, Copy, Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NbaType, PropertyAnalysis, Verdict } from '@/lib/analysis/types'
import { sellerQuestions } from '@/lib/analysis/sellerQuestions'
import { uniqueWarnings, type SurfaceWarning } from '@/lib/scrape/surfaces'
import { RangeBar } from './Evidence'
import { rangeText } from './Highlights'
import { CONFIDENCE_DOTS, CONFIDENCE_TEXT, KIND_TEXT, VERDICT_STYLE, copyText, money } from './format'

const VERDICT_DOT: Record<Verdict, string> = {
  PROMISING: 'bg-emerald-400', CAUTION: 'bg-amber-400', WEAK: 'bg-rose-400', UNDETERMINED: 'bg-slate-300',
}

/** Rótulo de procedencia: separa lo que dice el aviso de lo que estima VARA. */
function Source({ kind }: { kind: 'aviso' | 'estimado' }) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
      kind === 'aviso' ? 'bg-white/10 text-slate-200' : 'bg-brand-400/25 text-brand-100',
    )}>
      {kind === 'aviso' ? 'Del aviso' : 'Estimado por VARA'}
    </span>
  )
}

export interface DecisionHeroProps {
  analysis: PropertyAnalysis
  photo?: string
  warnings?: SurfaceWarning[]
  onAct: (type: NbaType) => void
  onShare: () => void
  onScroll: (id: string) => void
  onQuestionCopied: () => void
}

export function DecisionHero({ analysis, photo, warnings, onAct, onShare, onScroll, onQuestionCopied }: DecisionHeroProps) {
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null)
  const { conclusion, nextBestAction: nba, pricePositioning: price, estimatedTransactionCost: cost } = analysis
  const f = analysis.subjectProperty.fields
  const mx = analysis.subjectProperty.country === 'MX'
  const style = VERDICT_STYLE[conclusion.verdict]
  const ask = price.subjectAskingPrice
  const total = cost.totalRange
  const band = price.comparableListingRange
  const extra = ask && total ? { min: total.min - ask.amount, max: total.max - ask.amount } : null
  const where = [f.community?.value, f.neighborhood?.value, f.city?.value].filter(Boolean).join(' · ')
  const facts = [
    f.kind?.value ? KIND_TEXT[f.kind.value] : null,
    f.bedrooms?.value ? `${f.bedrooms.value} ${mx ? 'recámaras' : 'dorm.'}` : null,
    f.coveredArea?.value ? `${f.coveredArea.value} m² ${mx ? 'const.' : 'cub.'}` : null,
    f.landArea?.value ? `${f.landArea.value} m² terreno` : null,
  ].filter(Boolean)
  const kind = f.kind?.value
  // Si falta la superficie cubierta (el dato que más cambia la comparación), esa es la primera pregunta; si no, la de trámites.
  const missingCovered = !f.coveredArea?.value && kind !== 'lot'
  const firstQuestion = missingCovered
    ? { question: mx ? '¿Cuántos m² construidos tiene exactamente?' : '¿Cuántos m² cubiertos tiene exactamente?',
        why: 'Es el dato que más cambia la comparación y hoy falta o está en duda en el aviso.' }
    : sellerQuestions({
        country: analysis.subjectProperty.country,
        hasCommonCharges: kind === 'apartment' || kind === 'ph' || !!f.community?.value,
      })[0]
  const locationInferred = f.neighborhood?.status === 'INFERRED' || f.city?.status === 'INFERRED'
  const hasSurfaceAlert = uniqueWarnings(warnings).length > 0
  const reasons = price.confidenceReasons.slice(0, 2)

  const copyQuestion = async () => {
    if (!firstQuestion) return
    const ok = await copyText(firstQuestion.question)
    setCopied(ok ? 'ok' : 'fail')
    if (ok) onQuestionCopied()
    setTimeout(() => setCopied(null), 2200)
  }

  return (
    <section aria-label="Resumen: ¿vale la pena avanzar?" className="vara-rise overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-elevated">
      {/* Arriba: qué encontró VARA y qué concluye */}
      <div className="bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 p-4 text-white sm:p-6">
        <div className="flex items-start gap-3">
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="h-16 w-16 shrink-0 rounded-xl bg-white/10 object-cover ring-1 ring-white/20" />
          )}
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-semibold leading-snug">{f.title?.value ?? 'Propiedad'}</p>
            <p className="mt-0.5 truncate text-xs text-brand-100">{[where, ...facts].filter(Boolean).join(' · ')}</p>
            {locationInferred && <p className="mt-0.5 text-[11px] text-brand-200">Ubicación tomada del título del aviso</p>}
          </div>
          <button type="button" onClick={onShare} aria-label="Compartir este análisis"
            className="-mr-1 -mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            <Share2 size={18} aria-hidden="true" />
          </button>
        </div>

        <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
          <span className={cn('h-2 w-2 rounded-full', VERDICT_DOT[conclusion.verdict])} aria-hidden="true" />
          {style.label}
        </p>
        <h1 className="font-display mt-2 text-lg font-extrabold leading-snug text-balance sm:text-2xl">{conclusion.headline}</h1>

        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          <div className="rounded-2xl bg-white/[0.07] p-3 ring-1 ring-white/10">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-brand-100">Precio publicado</p>
              <Source kind="aviso" />
            </div>
            <p className="font-display mt-1 text-xl font-extrabold tabular-nums">
              {ask ? money(ask.amount, ask.currency) : 'Sin precio publicado'}
            </p>
          </div>
          <div className="rounded-2xl bg-white/[0.07] p-3 ring-1 ring-white/10">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-brand-100">Total para avanzar</p>
              <Source kind="estimado" />
            </div>
            <p className="font-display mt-1 text-xl font-extrabold tabular-nums">
              {total ? rangeText(total.min, total.max, total.currency) : 'Sin estimar'}
            </p>
            {total && extra && (
              <>
                <p className="mt-1 text-xs text-brand-100">
                  Incluye {rangeText(extra.min, extra.max, total.currency)} de gastos de compra.
                </p>
                <button type="button" onClick={() => onScroll('costos')}
                  className="-mb-1 inline-flex min-h-11 items-center text-xs font-semibold text-white underline decoration-white/40 underline-offset-2 hover:decoration-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                  Ver desglose
                </button>
              </>
            )}
          </div>
        </div>
        {firstQuestion && (
          <p aria-hidden="true" className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-sm leading-snug ring-1 ring-white/10">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-brand-200">Preguntá primero</span>
            <span className="font-semibold">{firstQuestion.question}</span>
          </p>
        )}
      </div>

      {/* Abajo: la prueba, la pregunta y qué hacer */}
      <div className="space-y-5 p-5 sm:p-6">
        {hasSurfaceAlert && (
          <button type="button" onClick={() => onScroll('dato-raro')}
            className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-left text-sm font-medium text-amber-900 hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600">
            <AlertTriangle size={16} className="shrink-0" aria-hidden="true" />
            <span className="flex-1">Hay un dato raro en el aviso. Revisalo antes de decidir.</span>
            <span className="font-semibold">Corregir</span>
          </button>
        )}

        <div data-testid="verdict-proof">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dónde cae el precio</p>
          {band ? (
            <>
              <RangeBar analysis={analysis} />
              <p className="mt-2 text-xs text-slate-500">
                Rango armado con {band.sampleSize} aviso{band.sampleSize === 1 ? '' : 's'} comparable{band.sampleSize === 1 ? '' : 's'}. Son precios pedidos, no de venta.
              </p>
            </>
          ) : (
            <div className="mt-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-800">
                {analysis.comparableEvidence.strongMatches > 0
                  ? `Encontré ${analysis.comparableEvidence.strongMatches} aviso${analysis.comparableEvidence.strongMatches === 1 ? '' : 's'} parecido${analysis.comparableEvidence.strongMatches === 1 ? '' : 's'}, pero no alcanzan para fijar un rango`
                  : 'Todavía no hay comparables reales'}
              </p>
              <p className="mt-1 text-sm text-slate-600">Sin esa referencia no puedo decirte si el precio es alto o bajo.</p>
              <button type="button" onClick={() => onScroll('sumar')}
                className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
                Sumá 2 o 3 avisos parecidos <ArrowRight size={15} aria-hidden="true" />
              </button>
            </div>
          )}
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">Confianza: {CONFIDENCE_TEXT[price.confidence]}</span>
            <span className="flex gap-0.5" aria-hidden="true">
              {[0, 1, 2].map(i => (
                <span key={i} className={cn('h-1.5 w-5 rounded-full', i < CONFIDENCE_DOTS[price.confidence] ? 'bg-brand-600' : 'bg-slate-200')} />
              ))}
            </span>
          </div>
          {reasons.length > 0 && <p className="mt-1 text-xs text-slate-500">{reasons.join(' · ')}</p>}
          {band && (
            <button type="button" onClick={() => onScroll('evidencia')}
              className="mt-1 inline-flex min-h-11 items-center text-xs font-semibold text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
              {analysis.comparableEvidence.strongMatches === band.sampleSize
                ? 'Ver los avisos que usé'
                : `Ver los ${analysis.comparableEvidence.strongMatches} avisos parecidos (${band.sampleSize} entran en el rango)`}
            </button>
          )}
        </div>

        {firstQuestion && (
          <div className="rounded-2xl bg-brand-50 p-4 ring-1 ring-brand-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-800">La primera pregunta</p>
            <p className="mt-1 text-base font-semibold leading-snug text-slate-900">{firstQuestion.question}</p>
            <p className="mt-1 text-xs text-slate-600">{firstQuestion.why}</p>
            <button type="button" onClick={copyQuestion}
              className={cn('mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl border bg-white px-4 text-sm font-semibold transition', copied === 'fail' ? 'border-rose-300 text-rose-800 hover:bg-rose-50' : 'border-brand-200 text-brand-800 hover:bg-brand-50',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600')}>
              {copied === 'ok' ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
              {copied === 'ok' ? 'Copiada' : copied === 'fail' ? 'No pude copiarla: seleccionala' : 'Copiar la pregunta'}
            </button>
          </div>
        )}

        <div>
          <button type="button" onClick={() => onAct(nba.type)}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-700 px-5 text-base font-semibold text-white shadow-sm transition hover:bg-brand-800 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
            {nba.label} <ArrowRight size={18} aria-hidden="true" />
          </button>
          <p className="mt-2 text-sm text-slate-600">{nba.reason}</p>
          {nba.secondary.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-x-5">
              {nba.secondary.map(s => (
                <button key={s.type} type="button" onClick={() => onAct(s.type)}
                  className="min-h-11 text-sm font-medium text-slate-600 hover:text-slate-900 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
