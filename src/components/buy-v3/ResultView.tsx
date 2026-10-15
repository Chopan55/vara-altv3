'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { readUserComparables } from '@/lib/analysis/providers'
import type { UserOverrides } from '@/lib/analysis/normalize'
import type { NbaType, PropertyAnalysis } from '@/lib/analysis/types'
import type { ProfileAnswers } from '@/lib/analysis/prefs'
import type { BuyState } from './useBuyAnalysis'
import { AskVara } from './AskVara'
import { AddComparables, ProfilePrompt } from './Entry'
import { ComparableList, EvidenceSummary } from './Evidence'
import { CostSection, DetailSection, FitSection, GoodSection, MissingSection, RisksSection, Section } from './Sections'
import {
  CONFIDENCE_DOTS, CONFIDENCE_TEXT, KIND_TEXT, POSITION_TEXT, VERDICT_STYLE, copyText, money,
} from './format'

export interface ResultActions {
  confirmField: (p: UserOverrides) => Promise<void>
  addComparable: (url: string, text?: string) => Promise<{ ok: boolean; message: string }>
  removeComparable: (id: string) => Promise<void>
  applyProfile: (a: ProfileAnswers) => Promise<void>
  save: () => Promise<void>
  discard: (reason?: string) => void
  share: () => string | null
  reset: () => void
  track: (name: 'comparable_opened' | 'nba_clicked' | 'missing_data_action' | 'visit_started', props?: Record<string, string | number | boolean | null>) => void
}

function Header({ analysis, photo }: { analysis: PropertyAnalysis; photo?: string }) {
  const f = analysis.subjectProperty.fields
  const ask = analysis.pricePositioning.subjectAskingPrice
  const where = [f.community?.value, f.neighborhood?.value, f.city?.value].filter(Boolean).join(' · ')
  const facts = [
    f.kind?.value ? KIND_TEXT[f.kind.value] : null,
    f.bedrooms?.value ? `${f.bedrooms.value} dormitorios` : null,
    f.coveredArea?.value ? `${f.coveredArea.value} m² cubiertos` : null,
    f.landArea?.value ? `${f.landArea.value} m² de terreno` : null,
  ].filter(Boolean)

  return (
    <div className="flex items-start gap-4">
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover bg-slate-100" />
      )}
      <div className="min-w-0">
        <p className="truncate font-semibold text-slate-900">{f.title?.value ?? 'Propiedad'}</p>
        {where && <p className="text-sm text-slate-500">{where}</p>}
        <p className="mt-1 text-sm text-slate-600">
          {ask ? <span className="font-semibold text-slate-900">{money(ask.amount, ask.currency)}</span> : 'Sin precio publicado'}
          {facts.length > 0 && <span> · {facts.join(' · ')}</span>}
        </p>
      </div>
    </div>
  )
}

function Chip({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-900">{value}</p>
      {sub}
    </div>
  )
}

export function ResultView({
  state, actions, onAnother,
}: { state: BuyState; actions: ResultActions; onAnother: () => void }) {
  const router = useRouter()
  const [notice, setNotice] = useState<string | null>(null)
  const [profileDismissed, setProfileDismissed] = useState(false)
  const analysis = state.analysis
  if (!analysis) return null

  const { conclusion, nextBestAction: nba, userFit, pricePositioning: price } = analysis
  const style = VERDICT_STYLE[conclusion.verdict]
  const removable = new Set(readUserComparables().map(l => l.id))
  const photo = state.subject?.photos[0]
  const lowEvidence = price.confidence === 'INSUFFICIENT' || price.confidence === 'LOW'

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const act = async (type: NbaType) => {
    actions.track('nba_clicked', { type })
    switch (type) {
      case 'GET_MISSING_INFORMATION': return scrollTo('faltantes')
      case 'ADD_COMPARABLES': return scrollTo('sumar')
      case 'COMPARE': await actions.save(); return router.push('/comparar')
      case 'VISIT': actions.track('visit_started'); await actions.save(); return router.push('/vara-visit/solicitar')
      case 'SAVE': await actions.save(); return setNotice('Guardada. La encontrás en tus propiedades.')
      case 'DISCARD': actions.discard(); return setNotice('Descartada. Podés recuperarla desde tus propiedades.')
      default: return
    }
  }

  const share = async () => {
    const url = actions.share()
    if (!url) return setNotice('No pude armar el link para compartir.')
    const ok = await copyText(url)
    setNotice(ok
      ? 'Link copiado. Incluye la propiedad, la conclusión de precio y los comparables. No incluye tus preferencias.'
      : url)
  }

  return (
    <article className="pb-24">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Header analysis={analysis} photo={photo} />
        </div>
        <button type="button" onClick={share} aria-label="Compartir este análisis"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          <Share2 size={14} /> <span className="hidden sm:inline">Compartir</span>
        </button>
      </div>

      {/* Primer viewport: conclusión, tres señales y UNA acción */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className={cn('h-1.5', style.bar)} />
        <div className="p-5 sm:p-6">
          <p className={cn('text-xs font-semibold uppercase tracking-wide', style.text)}>{style.label}</p>
          <h1 className="mt-1 text-xl font-semibold leading-snug text-slate-900 sm:text-2xl">{conclusion.headline}</h1>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex gap-3"><dt className="w-14 shrink-0 text-slate-400">Encaje</dt><dd className="text-slate-700">{conclusion.why}</dd></div>
            <div className="flex gap-3"><dt className="w-14 shrink-0 text-slate-400">Precio</dt><dd className="text-slate-700">{conclusion.price}</dd></div>
            <div className="flex gap-3"><dt className="w-14 shrink-0 text-slate-400">Falta</dt><dd className="text-slate-700">{conclusion.unknown}</dd></div>
          </dl>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <Chip label="Encaje" value={userFit.score !== null ? `${userFit.score}/100` : 'Sin perfil'} />
            <Chip label="Precio publicado" value={POSITION_TEXT[price.position]} />
            <Chip
              label="Confianza"
              value={CONFIDENCE_TEXT[price.confidence]}
              sub={
                <div className="mt-1 flex gap-0.5" aria-hidden>
                  {[0, 1, 2].map(i => (
                    <span key={i} className={cn('h-1 w-5 rounded-full', i < CONFIDENCE_DOTS[price.confidence] ? 'bg-brand-600' : 'bg-slate-200')} />
                  ))}
                </div>
              }
            />
          </div>

          <button type="button" onClick={() => act(nba.type)}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 py-3.5 text-base font-semibold text-white hover:bg-brand-800 sm:w-auto">
            {nba.label} <ArrowRight size={18} />
          </button>
          <p className="mt-2 text-sm text-slate-500">{nba.reason}</p>
          {nba.secondary.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
              {nba.secondary.map(s => (
                <button key={s.type} type="button" onClick={() => act(s.type)}
                  className="text-sm text-slate-500 hover:text-slate-800 hover:underline">
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {(notice || state.discarded || state.refreshing) && (
        <p role="status" className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700 break-all">
          {state.refreshing ? 'Actualizando el análisis…' : notice ?? 'Descartada.'}
        </p>
      )}

      <Section title="La evidencia" hint="Podés abrir cada aviso y discutir la conclusión.">
        <EvidenceSummary analysis={analysis} />
        <ComparableList
          matches={analysis.comparableEvidence.matches}
          removableIds={removable}
          onOpen={id => actions.track('comparable_opened', { id })}
          onRemove={actions.removeComparable}
        />
        <div id="sumar" className={cn('mt-5 scroll-mt-6', !lowEvidence && 'opacity-90')}>
          <AddComparables highlight={lowEvidence} onAdd={actions.addComparable} />
        </div>
      </Section>

      <GoodSection analysis={analysis} />
      {userFit.state === 'NO_PROFILE' && !profileDismissed && (
        <div className="mt-8">
          <ProfilePrompt
            onSubmit={a => { setProfileDismissed(true); return actions.applyProfile(a) }}
            onSkip={() => setProfileDismissed(true)}
          />
        </div>
      )}
      <FitSection analysis={analysis} />
      <RisksSection risks={analysis.prioritizedRisks} />
      <MissingSection
        analysis={analysis}
        onConfirm={actions.confirmField}
        onAction={kind => actions.track('missing_data_action', { kind })}
      />
      <CostSection analysis={analysis} />
      <AskVara analysis={analysis} onAsk={() => actions.track('missing_data_action', { kind: 'ask_vara' })} />
      <DetailSection analysis={analysis} />

      <div className="mt-12 rounded-2xl bg-slate-50 p-5 text-center">
        <p className="font-medium text-slate-900">¿Viste otra propiedad?</p>
        <p className="mt-1 text-sm text-slate-500">Pasame el link y la comparo con esta.</p>
        <button type="button" onClick={onAnother}
          className="mt-3 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100">
          Analizar otra propiedad
        </button>
      </div>
    </article>
  )
}
