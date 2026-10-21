'use client'

/**
 * Estado del flujo V3.
 *
 * Toda la inteligencia vive en `lib/analysis`; este hook solo conecta: lee el
 * aviso, corre el análisis, publica cada etapa apenas existe (para mostrar
 * valor sin esperar al final) y registra las señales de producto.
 */

import { useCallback, useRef, useState } from 'react'
import type { ScrapeResult } from '@/app/api/scrape-property/route'
import { analyzeProperty } from '@/lib/analysis/run'
import { track, type EventName } from '@/lib/analysis/events'
import { listingFromScrape, type UserOverrides } from '@/lib/analysis/normalize'
import {
  addUserComparable, candidatesProvider, readUserComparables, removeUserComparable,
  userListingsProvider, userPropertyFromScrape,
} from '@/lib/analysis/providers'
import { marketProvider } from '@/lib/analysis/market/provider'
import { buildPreferences, readPreferences, writePreferences, type ProfileAnswers } from '@/lib/analysis/prefs'
import { buildSharedAnalysis, encodeShared } from '@/lib/analysis/share'
import type {
  ComparableEvidence, ExtractionQuality, PropertyAnalysis, SubjectProperty,
} from '@/lib/analysis/types'
import { resolveProvinceCode } from '@/lib/regulations'

export type Phase = 'idle' | 'reading' | 'blocked' | 'analyzing' | 'done' | 'error'

export interface BuyState {
  phase: Phase
  url: string
  /** Mensaje para mostrar; nunca un error interno. */
  message?: string
  subject?: SubjectProperty
  extraction?: ExtractionQuality
  insight?: string
  evidence?: ComparableEvidence
  analysis?: PropertyAnalysis
  /** true mientras se recalcula con datos nuevos, sin borrar lo que ya se ve. */
  refreshing: boolean
  saved: boolean
  discarded: boolean
}

const INITIAL: BuyState = { phase: 'idle', url: '', refreshing: false, saved: false, discarded: false }

function sessionId(): string {
  try {
    let id = sessionStorage.getItem('vara_v3_session')
    if (!id) {
      id = `s_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
      sessionStorage.setItem('vara_v3_session', id)
    }
    return id
  } catch { return 'anon' }
}

export function useBuyAnalysis() {
  const [state, setState] = useState<BuyState>(INITIAL)
  const scrapeRef = useRef<ScrapeResult | null>(null)
  const overridesRef = useRef<UserOverrides>({})
  const submittedRef = useRef<Set<string>>(new Set())
  const startedAt = useRef(0)

  const ev = useCallback((name: EventName, props?: Parameters<typeof track>[2]) => {
    track(name, sessionId(), props)
  }, [])

  const run = useCallback(async (scrape: ScrapeResult, refresh: boolean) => {
    scrapeRef.current = scrape
    // Latencia medida desde que la persona pegó el link (incluye leer el aviso).
    const t0 = refresh ? Date.now() : startedAt.current || Date.now()

    try {
      const { loadCandidates } = await import('@/lib/candidates/store')
      const candidates = await loadCandidates().catch(() => [])
      const province = (() => {
        try { return resolveProvinceCode(localStorage.getItem('vara_province') ?? '') } catch { return undefined }
      })()

      await analyzeProperty({
        scrape,
        providers: [
          candidatesProvider(candidates),
          userListingsProvider(readUserComparables()),
          marketProvider(),
        ],
        preferences: readPreferences(),
        provinceCode: province,
        overrides: overridesRef.current,
        elapsedBeforeMs: refresh ? 0 : Date.now() - t0,
        onStage: e => {
          if (refresh && e.stage !== 'done') return
          if (e.stage === 'property') {
            setState(s => ({ ...s, phase: 'analyzing', subject: e.subject, extraction: e.extraction }))
            ev('property_extracted', { ms: Date.now() - t0, completeness: e.extraction.completeness })
          } else if (e.stage === 'insight') {
            setState(s => ({ ...s, insight: e.text }))
            ev('first_insight_shown', { ms: Date.now() - t0 })
          } else if (e.stage === 'comparables') {
            setState(s => ({ ...s, evidence: e.evidence }))
            ev('comparables_found', { strong: e.evidence.strongMatches, scope: e.evidence.geographicScope })
          } else {
            setState(s => ({
              ...s, phase: 'done', analysis: e.analysis, subject: e.analysis.subjectProperty,
              evidence: e.analysis.comparableEvidence, refreshing: false,
            }))
            if (!refresh) {
              ev('analysis_completed', {
                ms: Date.now() - t0,
                confidence: e.analysis.pricePositioning.confidence,
                nba: e.analysis.nextBestAction.type,
              })
            }
          }
        },
      })
    } catch {
      setState(s => ({
        ...s, phase: s.analysis ? 'done' : 'error', refreshing: false,
        message: 'No pudimos completar el análisis. Probá de nuevo en un momento.',
      }))
    }
  }, [ev])

  /** Lee el aviso (por link o por texto pegado) y arranca el análisis. */
  const submit = useCallback(async (url: string, pastedText?: string) => {
    const clean = url.trim()
    if (!clean) return
    ev('listing_submitted', { listingKey: clean })
    if (submittedRef.current.size > 0 && !submittedRef.current.has(clean)) {
      ev('second_property_added', { listingKey: clean })
    }
    submittedRef.current.add(clean)
    overridesRef.current = {}
    startedAt.current = Date.now()
    setState({ ...INITIAL, phase: 'reading', url: clean })

    try {
      const res = await fetch('/api/scrape-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: clean, text: pastedText }),
      })
      const scrape = (await res.json()) as ScrapeResult
      const readable = scrape.status === 'success' || scrape.status === 'partial' || scrape.status === 'expired'
      if (!readable) {
        setState(s => ({
          ...s, phase: 'blocked',
          message: scrape.errorMessage ?? 'No pudimos leer ese aviso. Probá pegando el texto de la publicación.',
        }))
        return
      }
      await run(scrape, false)
    } catch {
      setState(s => ({ ...s, phase: 'error', message: 'No pudimos acceder al aviso. Probá de nuevo.' }))
    }
  }, [ev, run])

  const rerun = useCallback(async () => {
    if (!scrapeRef.current) return
    setState(s => ({ ...s, refreshing: true }))
    await run(scrapeRef.current, true)
  }, [run])

  /** Suma un aviso parecido (link o texto) como evidencia. */
  const addComparable = useCallback(async (url: string, text?: string): Promise<{ ok: boolean; message: string }> => {
    try {
      const res = await fetch('/api/scrape-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), text }),
      })
      const scrape = (await res.json()) as ScrapeResult
      const listing = listingFromScrape(scrape)
      if (!listing.price) {
        return { ok: false, message: scrape.errorMessage ?? 'Ese aviso no trae precio, así que no sirve para comparar.' }
      }
      addUserComparable(listing)
      ev('missing_data_action', { kind: 'add_comparable' })
      await rerun()
      return { ok: true, message: 'Sumado. Recalculé la comparación.' }
    } catch {
      return { ok: false, message: 'No pudimos leer ese aviso. Probá pegando el texto.' }
    }
  }, [ev, rerun])

  const removeComparable = useCallback(async (id: string) => {
    removeUserComparable(id)
    await rerun()
  }, [rerun])

  /** "LA SÉ": la persona confirma un dato. */
  const confirmField = useCallback(async (patch: UserOverrides) => {
    overridesRef.current = { ...overridesRef.current, ...patch }
    ev('missing_data_action', { kind: 'confirm', field: Object.keys(patch).join(',') })
    await rerun()
  }, [ev, rerun])

  const applyProfile = useCallback(async (answers: ProfileAnswers) => {
    writePreferences(buildPreferences(answers))
    ev('missing_data_action', { kind: 'profile' })
    await rerun()
  }, [ev, rerun])

  const save = useCallback(async () => {
    if (!scrapeRef.current) return
    try {
      const { addCandidate } = await import('@/lib/candidates/store')
      await addCandidate(userPropertyFromScrape(scrapeRef.current))
      setState(s => ({ ...s, saved: true }))
      ev('property_saved')
    } catch { /* guardar nunca rompe el resultado */ }
  }, [ev])

  const discard = useCallback((reason?: string) => {
    setState(s => ({ ...s, discarded: true }))
    ev('property_discarded', { reason: reason ?? null })
  }, [ev])

  const share = useCallback((): string | null => {
    if (!state.analysis) return null
    const encoded = encodeShared(buildSharedAnalysis(state.analysis))
    if (!encoded) return null
    ev('analysis_shared')
    return `${window.location.origin}/compartido#d=${encoded}`
  }, [state.analysis, ev])

  const reset = useCallback(() => {
    scrapeRef.current = null
    setState(INITIAL)
  }, [])

  return {
    state, submit, addComparable, removeComparable, confirmField, applyProfile,
    save, discard, share, reset, track: ev,
  }
}
