'use client'

import { useState } from 'react'
import { AlertTriangle, Check, ChevronDown, ExternalLink, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PropertyAnalysis, ScoredComparable } from '@/lib/analysis/types'
import { CONDITION_TEXT, KIND_TEXT, SCOPE_TEXT, freshnessText, money, moneyK } from './format'

/** Rango de avisos comparables y dónde cae el precio pedido. */
export function RangeBar({ analysis }: { analysis: PropertyAnalysis }) {
  const band = analysis.pricePositioning.comparableListingRange
  const ask = analysis.pricePositioning.subjectAskingPrice
  if (!band) return null

  const values = [band.low, band.high, ask?.currency === band.currency ? ask.amount : band.median]
  const lo = Math.min(...values) * 0.94
  const hi = Math.max(...values) * 1.06
  const pos = (v: number) => `${Math.max(2, Math.min(98, ((v - lo) / (hi - lo)) * 100))}%`

  return (
    <div className="mt-4" aria-label="Rango de publicación comparable">
      <div className="flex items-baseline justify-between text-xs text-slate-500 mb-1.5">
        <span>Rango de publicación comparable</span>
        <span className="font-medium text-slate-700">
          {moneyK(band.low, band.currency)} – {moneyK(band.high, band.currency).replace(`${band.currency} `, '')}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-slate-100">
        <div
          className="absolute h-2 rounded-full bg-brand-200"
          style={{ left: pos(band.low), width: `calc(${pos(band.high)} - ${pos(band.low)})` }}
        />
        {ask && ask.currency === band.currency && (
          <div className="absolute -top-1.5 -translate-x-1/2" style={{ left: pos(ask.amount) }}>
            <div className="h-5 w-1 rounded bg-brand-700" />
          </div>
        )}
      </div>
      {ask && ask.currency === band.currency && (
        <p className="mt-2 text-xs text-slate-500">
          La barra oscura es el precio publicado de esta propiedad: {money(ask.amount, ask.currency)}.
        </p>
      )}
    </div>
  )
}

export function EvidenceSummary({ analysis }: { analysis: PropertyAnalysis }) {
  const ev = analysis.comparableEvidence
  const r = ev.retrieval
  return (
    <div>
      <p className="text-slate-700">
        {ev.strongMatches > 0
          ? `Comparé con ${ev.strongMatches} aviso${ev.strongMatches === 1 ? '' : 's'} publicado${ev.strongMatches === 1 ? '' : 's'} realmente parecido${ev.strongMatches === 1 ? '' : 's'}, en ${SCOPE_TEXT[ev.geographicScope]}.`
          : 'No encontré avisos realmente parecidos para comparar.'}{' '}
        <span className="text-slate-500">Son precios pedidos, no precios de venta.</span>
      </p>
      <RangeBar analysis={analysis} />
      <ul className="mt-3 space-y-1 text-xs text-slate-500">
        {r.searchExpansionReason && <li>{r.searchExpansionReason}</li>}
        {r.duplicatesMerged > 0 && (
          <li>
            {ev.matches.some(m => m.duplicateUncertain)
              ? `Agrupé ${r.duplicatesMerged} aviso${r.duplicatesMerged === 1 ? '' : 's'} que parece${r.duplicatesMerged === 1 ? '' : 'n'} la misma propiedad publicada más de una vez; no pude confirmarlo del todo, así que lo conté una sola vez y bajé la confianza.`
              : `Unifiqué ${r.duplicatesMerged} aviso${r.duplicatesMerged === 1 ? '' : 's'} repetido${r.duplicatesMerged === 1 ? '' : 's'} para no contar dos veces la misma propiedad.`}
          </li>
        )}
        {r.providers.filter(p => !p.ok).map(p => (
          <li key={p.name}>No pude consultar «{p.name}»; el resultado se apoya en el resto.</li>
        ))}
      </ul>
    </div>
  )
}

function ComparableCard({
  m, onOpen, onRemove,
}: { m: ScoredComparable; onOpen: (id: string) => void; onRemove?: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const l = m.listing
  const where = [l.community, l.neighborhood].filter(Boolean).join(' · ')
  const facts = [
    l.kind ? KIND_TEXT[l.kind] : null,
    l.bedrooms ? `${l.bedrooms} dorm.` : null,
    l.coveredArea ? `${l.coveredArea} m² cub.` : l.totalArea ? `${l.totalArea} m²` : null,
    l.landArea ? `${l.landArea} m² terreno` : null,
    l.ageYears !== undefined ? `${l.ageYears} años` : null,
    l.condition ? CONDITION_TEXT[l.condition] : null,
  ].filter(Boolean)

  const toggle = () => {
    if (!open) onOpen(l.id)
    setOpen(o => !o)
  }

  return (
    <li className="rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="w-full text-left p-4 flex items-start gap-3"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold text-slate-900">
              {l.price && l.currency ? money(l.price, l.currency) : 'Sin precio'}
            </span>
            {where && <span className="text-sm text-slate-500 truncate">{where}</span>}
          </div>
          <p className="mt-0.5 text-sm text-slate-600">{facts.join(' · ') || 'Pocos datos'}</p>
          <p className="mt-1 text-xs text-slate-500">
            {freshnessText(m.freshness)} · {l.source}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-semibold text-brand-700">{m.similarityScore}</div>
          <div className="text-[11px] text-slate-400">de parecido</div>
        </div>
        <ChevronDown size={16} className={cn('mt-1 shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 text-sm space-y-3">
          {m.similarityReasons.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Por qué se parece</p>
              <ul className="space-y-1">
                {m.similarityReasons.map(r => (
                  <li key={r} className="flex gap-2 text-slate-700"><Check size={14} className="mt-1 shrink-0 text-emerald-600" />{r}</li>
                ))}
              </ul>
            </div>
          )}
          {m.importantDifferences.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Diferencias que importan</p>
              <ul className="space-y-1">
                {m.importantDifferences.map(r => (
                  <li key={r} className="flex gap-2 text-slate-700"><AlertTriangle size={14} className="mt-1 shrink-0 text-amber-600" />{r}</li>
                ))}
              </ul>
            </div>
          )}
          {m.missingComparisonFields.length > 0 && (
            <p className="text-xs text-slate-500">
              No pude comparar: {m.missingComparisonFields.join(', ')}.
            </p>
          )}
          {m.freshness.note && <p className="text-xs text-amber-700">{m.freshness.note}</p>}
          {m.mergedDuplicateIds.length > 0 && (
            <p className="text-xs text-slate-500">
              Este aviso aparece {m.mergedDuplicateIds.length + 1} veces
              {m.duplicateUncertain ? ' (no pude confirmar del todo que sean la misma propiedad)' : ''}; lo conté una sola vez.
            </p>
          )}
          <div className="flex items-center gap-4 pt-1">
            {l.url && /^https?:\/\//.test(l.url) && (
              <a href={l.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
                Ver el aviso <ExternalLink size={12} />
              </a>
            )}
            {onRemove && (
              <button type="button" onClick={() => onRemove(l.id)}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600">
                <X size={12} /> Quitar de la comparación
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  )
}

export function ComparableList({
  matches, removableIds, onOpen, onRemove,
}: {
  matches: ScoredComparable[]
  removableIds: Set<string>
  onOpen: (id: string) => void
  onRemove: (id: string) => void
}) {
  const [all, setAll] = useState(false)
  const strong = matches.filter(m => m.similarityScore >= 60)
  const visible = all ? strong : strong.slice(0, 3)
  if (strong.length === 0) return null

  return (
    <div className="mt-5">
      <ul className="space-y-2">
        {visible.map(m => (
          <ComparableCard
            key={m.listing.id}
            m={m}
            onOpen={onOpen}
            onRemove={removableIds.has(m.listing.id) ? onRemove : undefined}
          />
        ))}
      </ul>
      {strong.length > 3 && (
        <button type="button" onClick={() => setAll(a => !a)}
          className="mt-3 text-sm font-medium text-brand-700 hover:underline">
          {all ? 'Ver menos' : `Ver los ${strong.length} avisos`}
        </button>
      )}
    </div>
  )
}
