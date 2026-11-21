'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { readUserComparables } from '@/lib/analysis/providers'
import { accountUrl } from '@/lib/auth/entryJourney'
import type { UserOverrides } from '@/lib/analysis/normalize'
import type { NbaType } from '@/lib/analysis/types'
import type { ProfileAnswers } from '@/lib/analysis/prefs'
import type { BuyState } from './useBuyAnalysis'
import { AskVara } from './AskVara'
import { AddComparables, ProfilePrompt, SurfaceWarningCard } from './Entry'
import { ComparableList, EvidenceSummary } from './Evidence'
import { CostSection, DetailSection, FitSection, GoodSection, LocalRequirementsSection, MissingSection, ProfessionalQuerySection, RisksSection, Section } from './Sections'
import { SellerQuestionsCard, ShareCard, type ShareChannel } from './Highlights'
import { DecisionHero } from './DecisionHero'

export interface ResultActions {
  confirmField: (p: UserOverrides) => Promise<void>
  addComparable: (url: string, text?: string) => Promise<{ ok: boolean; message: string }>
  removeComparable: (id: string) => Promise<void>
  applyProfile: (a: ProfileAnswers) => Promise<void>
  save: () => Promise<boolean>
  discard: (reason?: string) => void
  share: (channel?: ShareChannel) => string | null
  reset: () => void
  track: (name: 'comparable_opened' | 'nba_clicked' | 'missing_data_action' | 'visit_started', props?: Record<string, string | number | boolean | null>) => void
}

export function ResultView({
  state, actions, onAnother,
}: { state: BuyState; actions: ResultActions; onAnother: () => void }) {
  const router = useRouter()
  const [notice, setNoticeText] = useState<string | null>(null)
  const [noticeIsError, setNoticeIsError] = useState(false)
  /** Un aviso de error se ve y se anuncia distinto de uno informativo. */
  const setNotice = (text: string, isError = false) => { setNoticeIsError(isError); setNoticeText(text) }
  const [profileDismissed, setProfileDismissed] = useState(false)
  const analysis = state.analysis
  if (!analysis) return null

  const { userFit, pricePositioning: price } = analysis
  const removable = new Set(readUserComparables().map(l => l.id))
  const photo = state.subject?.photos[0]
  const lowEvidence = price.confidence === 'INSUFFICIENT' || price.confidence === 'LOW'

  // El salto también lleva el foco: con teclado o lector de pantalla se sigue leyendo desde el destino. Sin animación si se pidió menos movimiento.
  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    const calm = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' })
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1')
    el.focus({ preventScroll: true })
  }

  /** Guarda y avisa si no se pudo: nada avanza dando por hecho un guardado que falló. */
  const saveOrWarn = async (): Promise<boolean> => {
    const saved = await actions.save()
    if (!saved) setNotice('No pudimos guardar la propiedad, así que no seguimos. Probá de nuevo en un momento.', true)
    return saved
  }

  const act = async (type: NbaType) => {
    actions.track('nba_clicked', { type })
    switch (type) {
      case 'GET_MISSING_INFORMATION': return scrollTo('faltantes')
      case 'ADD_COMPARABLES': return scrollTo('sumar')
      case 'COMPARE': if (await saveOrWarn()) router.push('/comparar'); return
      case 'VISIT': actions.track('visit_started'); if (await saveOrWarn()) router.push('/vara-visit/solicitar'); return
      case 'SAVE': {
        const saved = await actions.save()
        return setNotice(saved
          ? 'Guardada. La encontrás en tus propiedades.'
          : 'No pudimos guardarla. Probá de nuevo en un momento.', !saved)
      }
      case 'DISCARD':
        actions.discard()
        // Solo se puede recuperar lo que se guardó antes: no prometemos una copia que no existe.
        return setNotice(state.saved
          ? 'Descartada de este análisis. Sigue guardada en tus propiedades.'
          : 'Descartada. No quedó guardada en tus propiedades.')
      default: return
    }
  }

  // Seguir la compra es tener una operación: se entra con la cuenta y después se arma (si ya hay sesión, va directo).
  const follow = async () => {
    if (!(await saveOrWarn())) return
    router.push(accountUrl(`/onboarding?intent=BUY&country=${analysis.subjectProperty.country === 'MX' ? 'MX' : 'AR'}`))
  }

  return (
    <article className="pb-24">
      <DecisionHero
        analysis={analysis}
        photo={photo}
        warnings={state.warnings}
        onAct={act}
        onShare={() => scrollTo('compartir')}
        onScroll={scrollTo}
        onQuestionCopied={() => actions.track('missing_data_action', { kind: 'copy_questions' })}
      />

      {/* El dato raro, completo y corregible; el bloque de arriba lleva hasta acá. */}
      <div id="dato-raro" className="scroll-mt-6">
        <SurfaceWarningCard warnings={state.warnings} onConfirm={actions.confirmField} />
      </div>

      {(notice || state.discarded || state.refreshing) && (
        <p role={noticeIsError && !state.refreshing ? 'alert' : 'status'}
          className={cn('mt-3 flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm min-h-11 break-words',
            noticeIsError && !state.refreshing ? 'border border-rose-200 bg-rose-50 font-medium text-rose-800' : 'bg-slate-100 text-slate-700')}>
          {noticeIsError && !state.refreshing && <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />}
          <span>{state.refreshing ? 'Actualizando el análisis…' : notice ?? 'Descartada.'}</span>
        </p>
      )}

      {/* Lo que más importa para decidir, a la vista: preguntas al vendedor y compartir (el total va arriba). */}
      <SellerQuestionsCard analysis={analysis} onAction={kind => actions.track('missing_data_action', { kind })} />
      <div id="compartir" className="scroll-mt-6">
        <ShareCard analysis={analysis} share={actions.share} onFollow={follow} />
      </div>

      {/* VARA con su avatar, a la vista apenas termina el análisis (solo si la IA está habilitada) */}
      <AskVara analysis={analysis} onAsk={() => actions.track('missing_data_action', { kind: 'ask_vara' })} />

      <div id="evidencia" className="scroll-mt-6">
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
      </div>

      <GoodSection analysis={analysis} />
      {userFit.state === 'NO_PROFILE' && !profileDismissed && (
        <div className="mt-8">
          <ProfilePrompt
            currency={price.subjectAskingPrice?.currency ?? 'USD'}
            mx={analysis.subjectProperty.country === 'MX'}
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
      <LocalRequirementsSection analysis={analysis} />
      <ProfessionalQuerySection analysis={analysis} />
      <DetailSection analysis={analysis} />

      <div className="mt-12 rounded-2xl bg-slate-50 p-5 text-center">
        <p className="font-medium text-slate-900">¿Viste otra propiedad?</p>
        <p className="mt-1 text-sm text-slate-500">Pasame el link y la comparo con esta.</p>
        <button type="button" onClick={onAnother}
          className="mt-3 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 min-h-11">
          Analizar otra propiedad
        </button>
      </div>
    </article>
  )
}
