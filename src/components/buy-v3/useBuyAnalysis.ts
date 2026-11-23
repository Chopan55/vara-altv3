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
import type { SurfaceWarning } from '@/lib/scrape/surfaces'
import { analyzeProperty } from '@/lib/analysis/run'
import { track, type EventName } from '@/lib/analysis/events'
import { trackFunnel } from '@/lib/funnel/track'
import { listingFromScrape, type UserOverrides } from '@/lib/analysis/normalize'
import { withSubjectLocation } from '@/lib/scrape/locationFromTitle'
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
import type { ManualListing } from './Entry'
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
  /** Superficies del aviso que parecen un error de carga: se apartaron del análisis hasta que la persona las confirme. */
  warnings?: SurfaceWarning[]
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
  /** Número de la última lectura pedida: si la persona pega el texto mientras se lee el link, gana la más nueva. */
  const seqRef = useRef(0)

  const ev = useCallback((name: EventName, props?: Parameters<typeof track>[2]) => {
    track(name, sessionId(), props)
  }, [])

  const run = useCallback(async (scrape: ScrapeResult, refresh: boolean, seq: number) => {
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
          if (seq !== seqRef.current) return // una lectura más nueva (texto pegado) ya tomó la pantalla
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
              trackFunnel('analyze_done', {
                country: e.analysis.subjectProperty.country,
                confidence: e.analysis.pricePositioning.confidence,
                has_total: e.analysis.estimatedTransactionCost.totalRange !== null,
              })
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
      if (seq !== seqRef.current) return
      setState(s => ({
        ...s, phase: s.analysis ? 'done' : 'error', refreshing: false,
        message: 'No pudimos completar el análisis. Probá de nuevo en un momento.',
      }))
    }
  }, [ev])

  /** Lee el aviso (por link o por texto pegado) y arranca el análisis. */
  const submit = useCallback(async (url: string, pastedText?: string, opts?: { example?: boolean }) => {
    const clean = url.trim()
    if (!clean) return
    // El ejemplo de la portada no es una propiedad de la persona: no cuenta en las métricas.
    if (!opts?.example) {
      ev('listing_submitted', { listingKey: clean })
      trackFunnel('analyze_start')
      if (submittedRef.current.size > 0 && !submittedRef.current.has(clean)) {
        ev('second_property_added', { listingKey: clean })
      }
      submittedRef.current.add(clean)
    }
    overridesRef.current = {}
    startedAt.current = Date.now()
    const seq = ++seqRef.current
    setState({ ...INITIAL, phase: 'reading', url: clean })

    try {
      const res = await fetch('/api/scrape-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: clean, text: pastedText }),
      })
      const scrape = (await res.json()) as ScrapeResult
      if (seq !== seqRef.current) return // llegó una lectura más nueva (texto pegado): esta ya no vale
      const readable = scrape.status === 'success' || scrape.status === 'partial' || scrape.status === 'expired'
      if (!readable) {
        setState(s => ({
          ...s, phase: 'blocked',
          message: scrape.errorMessage ?? 'No pudimos leer ese aviso. Probá pegando el texto de la publicación.',
        }))
        return
      }
      if (scrape.warnings?.length) setState(s => ({ ...s, warnings: scrape.warnings }))
      await run(scrape, false, seq)
    } catch {
      if (seq !== seqRef.current) return
      setState(s => ({ ...s, phase: 'error', message: 'No pudimos acceder al aviso. Probá de nuevo.' }))
    }
  }, [ev, run])

  /** La persona eligió pegar el texto o cargar a mano mientras se leía el link: se deja de esperar esa lectura,
   *  así su respuesta no reemplaza lo que está escribiendo. */
  const holdRead = useCallback(() => { seqRef.current++ }, [])

  /** Datos cargados a mano cuando el portal no deja leer el aviso. */
  const submitManual = useCallback(async (url: string, m: ManualListing) => {
    ev('listing_submitted', { listingKey: url, manual: true })
    trackFunnel('analyze_start', { manual: true })
    const seq = ++seqRef.current
    overridesRef.current = {}
    startedAt.current = Date.now()
    setState({ ...INITIAL, phase: 'analyzing', url })
    const where = m.where?.slice(0, 120)
    const scrape: ScrapeResult = {
      status: 'partial', url, portal: null, method: 'paste', photos: [], missingFields: [],
      data: {
        title: where ? `Propiedad en ${where}` : 'Propiedad cargada a mano',
        price: m.price, currency: m.currency, coveredM2: m.coveredM2, bedrooms: m.bedrooms,
        city: where,
      },
    }
    await run(scrape, false, seq)
  }, [ev, run])

  const rerun = useCallback(async () => {
    if (!scrapeRef.current) return
    setState(s => ({ ...s, refreshing: true }))
    await run(scrapeRef.current, true, seqRef.current)
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
      // Un aviso pegado como texto no trae barrio ni ciudad: se toman de la propiedad analizada solo si el texto los nombra.
      if (text) scrape.data = withSubjectLocation(scrape.data, scrapeRef.current?.data)
      const listing = listingFromScrape(scrape)
      if (!listing.price) {
        return { ok: false, message: scrape.errorMessage ?? 'Ese aviso no trae precio, así que no sirve para comparar.' }
      }
      addUserComparable(listing)
      ev('missing_data_action', { kind: 'add_comparable' })
      await rerun()
      // Sin barrio ni ciudad el aviso no se puede ubicar entre los comparables: se dice, en vez de prometer un recálculo que no lo cuenta.
      if (!listing.neighborhood && !listing.city) {
        return { ok: true, message: 'Lo sumé, pero el texto no dice el barrio ni la ciudad, así que todavía no cuenta para el rango. Pegá también la ubicación o usá el link del aviso.' }
      }
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
    // Si la persona confirma una superficie, el aviso de "revisá la superficie" ya está resuelto.
    if (patch.coveredArea !== undefined || patch.totalArea !== undefined || patch.landArea !== undefined) {
      setState(s => ({ ...s, warnings: undefined }))
    }
    ev('missing_data_action', { kind: 'confirm', field: Object.keys(patch).join(',') })
    await rerun()
  }, [ev, rerun])

  const applyProfile = useCallback(async (answers: ProfileAnswers) => {
    writePreferences(buildPreferences(answers))
    ev('missing_data_action', { kind: 'profile' })
    await rerun()
  }, [ev, rerun])

  /** Devuelve true solo si la propiedad quedó guardada de verdad: la pantalla no debe confirmar un guardado que falló. */
  const save = useCallback(async (): Promise<boolean> => {
    if (!scrapeRef.current) return false
    try {
      const { addCandidate } = await import('@/lib/candidates/store')
      const saved = await addCandidate(userPropertyFromScrape(scrapeRef.current))
      if (!saved) return false // con sesión puede volver null; sin sesión, el navegador puede rechazar la escritura
      setState(s => ({ ...s, saved: true }))
      ev('property_saved')
      return true
    } catch {
      // Guardar nunca rompe el resultado, pero tampoco se confirma como hecho.
      return false
    }
  }, [ev])

  const discard = useCallback((reason?: string) => {
    setState(s => ({ ...s, discarded: true }))
    ev('property_discarded', { reason: reason ?? null })
  }, [ev])

  const share = useCallback((channel: 'wa' | 'link' | 'native' = 'link'): string | null => {
    if (!state.analysis) return null
    const encoded = encodeShared(buildSharedAnalysis(state.analysis))
    if (!encoded) return null
    ev('analysis_shared')
    trackFunnel('share', { channel, country: state.analysis.subjectProperty.country })
    // `ref=share` va antes del fragmento: el servidor lo ve y mide quién llega por un link compartido.
    return `${window.location.origin}/compartido?ref=share#d=${encoded}`
  }, [state.analysis, ev])

  const reset = useCallback(() => {
    scrapeRef.current = null
    setState(INITIAL)
  }, [])

  return {
    state, submit, submitManual, addComparable, removeComparable, confirmField, applyProfile,
    save, discard, share, reset, holdRead, track: ev,
  }
}
