/**
 * Orquestador del análisis.
 *
 * Junta las capas en orden y avisa por etapas, para que la pantalla muestre
 * valor sin esperar al final:
 *   property   propiedad reconocida y datos clave (objetivo ≤ 15 s)
 *   insight    primera lectura útil, antes de buscar comparables
 *   comparables evidencia encontrada
 *   done       análisis completo
 *
 * Es el único lugar que arma un `PropertyAnalysis`. La UI, el NBA y la IA lo
 * leen; no lo recalculan.
 */

import type { ScrapeResult } from '@/app/api/scrape-property/route'
import { buildConclusion, decideNextAction } from './conclusion'
import { assessConfidence } from './confidence'
import { estimateTransactionCost } from './cost'
import './costProviders/ar'
import { findMissing } from './missing'
import {
  applyUserOverrides, evaluateExtraction, flattenSubject, subjectFromScrape, type UserOverrides,
} from './normalize'
import { calculatePrice, interpretPrice, PRICE_METHOD } from './priceIntelligence'
import { retrieveComparables, type ComparableProvider } from './retrieval'
import { isStrongMatch } from './similarity'
import { deriveRisks } from './risks'
import { evaluateFit } from './userFit'
import {
  ANALYSIS_VERSION,
  type ExtractionQuality, type PropertyAnalysis, type ProvenanceEntry, type StageTimings,
  type SubjectProperty, type UserPreferences, type ComparableEvidence,
} from './types'

export type StageEvent =
  | { stage: 'property'; subject: SubjectProperty; extraction: ExtractionQuality }
  | { stage: 'insight'; text: string }
  | { stage: 'comparables'; evidence: ComparableEvidence }
  | { stage: 'done'; analysis: PropertyAnalysis }

export interface AnalyzeInput {
  scrape: ScrapeResult
  providers: ComparableProvider[]
  preferences?: UserPreferences | null
  provinceCode?: string
  equivalentNeighborhoods?: string[]
  /** Datos que la persona confirmó ("LA SÉ"). */
  overrides?: UserOverrides
  /** Milisegundos transcurridos desde que se pegó el link hasta empezar a analizar. */
  elapsedBeforeMs?: number
  now?: Date
  /** Reloj en ms; se inyecta en tests. */
  clock?: () => number
  onStage?: (e: StageEvent) => void
}

const METHODOLOGY =
  'Se buscan avisos de la misma comunidad primero y se amplía solo si hace falta. ' +
  'Cada aviso se puntúa por parecido (ubicación, tipo, dormitorios, superficie, terreno, estado…), ' +
  'se fusionan los duplicados y se pondera por frescura. Son precios publicados, no de venta.'

function quickInsight(subject: SubjectProperty, q: ExtractionQuality): string {
  const f = subject.fields
  const kind = f.kind?.value
  const kindText = kind === 'house' ? 'Casa' : kind === 'apartment' ? 'Departamento' : kind === 'ph' ? 'PH' : kind === 'lot' ? 'Lote' : 'Propiedad'
  const beds = f.bedrooms?.value
  const where = f.community?.value ?? f.neighborhood?.value ?? f.city?.value
  const head = `${kindText}${beds ? ` de ${beds} dormitorios` : ''}${where ? ` en ${where}` : ''}.`
  const rest = q.missing.length
    ? ` Todavía no sabemos ${q.missing.slice(0, 2).join(' ni ')}.`
    : ' El aviso trae los datos principales.'
  return head + rest
}

export async function analyzeProperty(input: AnalyzeInput): Promise<PropertyAnalysis> {
  const now = input.now ?? new Date()
  const clock = input.clock ?? (() => Date.now())
  const t0 = clock()
  // Los tiempos cuentan desde que la persona pegó el link: incluye la lectura del aviso.
  const since = () => clock() - t0 + (input.elapsedBeforeMs ?? 0)
  const steps: StageTimings['steps'] = []
  const timed = async <T>(name: string, fn: () => Promise<T> | T, note?: string): Promise<T> => {
    const s = clock()
    try {
      const out = await fn()
      steps.push({ name, ms: clock() - s, ok: true, note })
      return out
    } catch (err) {
      steps.push({ name, ms: clock() - s, ok: false, note: err instanceof Error ? err.message.slice(0, 100) : 'error' })
      throw err
    }
  }

  // 1. Propiedad
  const subject = await timed('normalize', () => {
    const s = subjectFromScrape(input.scrape, now)
    return input.overrides ? applyUserOverrides(s, input.overrides, now) : s
  })
  const facts = flattenSubject(subject, now)
  const extraction = evaluateExtraction(subject)
  const timeToPropertyMs = since()
  input.onStage?.({ stage: 'property', subject, extraction })

  const missing = findMissing(facts, subject)
  const fit = evaluateFit(facts, input.preferences)

  input.onStage?.({ stage: 'insight', text: quickInsight(subject, extraction) })
  const timeToFirstValueMs = since()

  // 2. Comparables
  const retrieved = await timed('retrieval', () =>
    retrieveComparables(facts, input.providers, {
      now, equivalentNeighborhoods: input.equivalentNeighborhoods,
    }),
  )
  const strong = retrieved.matches.filter(m => isStrongMatch(m.similarityScore))

  // 3. Precio y confianza
  const calc = calculatePrice({
    subjectPrice: facts.price,
    subjectCurrency: facts.currency,
    subjectCoveredArea: facts.coveredArea,
    comparables: retrieved.matches,
  })
  const conf = assessConfidence({
    used: calc.used,
    scope: retrieved.summary.searchScope,
    band: calc.band,
    subjectHasCoveredArea: !!facts.coveredArea,
  })

  const evidence: ComparableEvidence = {
    retrieval: retrieved.summary,
    matches: retrieved.matches,
    strongMatches: strong.length,
    methodology: METHODOLOGY,
    geographicScope: retrieved.summary.searchScope,
    evidenceQuality: conf.level,
  }
  const timeToComparablesMs = since()
  input.onStage?.({ stage: 'comparables', evidence })

  const insufficient = conf.level === 'INSUFFICIENT'
  const pricePositioning = {
    subjectAskingPrice: facts.price && facts.currency ? { amount: facts.price, currency: facts.currency } : null,
    comparableListingRange: insufficient ? null : calc.band,
    position: insufficient ? ('UNKNOWN' as const) : calc.position,
    differencePct: insufficient ? null : calc.differencePct,
    confidence: conf.level,
    confidenceReasons: conf.reasons,
    interpretation: interpretPrice(calc, facts.price, facts.currency ?? 'USD', insufficient),
  }

  // 4. Riesgos, costos, conclusión
  const risks = deriveRisks({
    facts, price: pricePositioning, missing, fit, completenessWarnings: extraction.warnings,
  })
  const cost = estimateTransactionCost(facts.country, {
    price: facts.price, currency: facts.currency, provinceCode: input.provinceCode,
  })
  const ctx = { fit, price: pricePositioning, missing, risks }
  const nextBestAction = decideNextAction(ctx)
  const conclusion = buildConclusion(ctx, nextBestAction)
  const timeToConclusionMs = since()

  const provenance: ProvenanceEntry[] = [
    { path: 'subjectProperty.fields', kind: 'FACT', derivedFrom: [subject.url], note: `Método: ${extraction.method}` },
    { path: 'comparableEvidence.matches', kind: 'FACT', derivedFrom: retrieved.summary.providers.map(p => p.name) },
    { path: 'comparableEvidence.matches[].similarityScore', kind: 'INFERENCE', derivedFrom: ['subjectProperty.fields', 'comparableEvidence.matches'] },
    { path: 'pricePositioning.comparableListingRange', kind: 'ESTIMATE', derivedFrom: ['comparableEvidence.matches'], note: PRICE_METHOD },
    { path: 'pricePositioning.confidence', kind: 'INFERENCE', derivedFrom: ['comparableEvidence', 'subjectProperty.fields.coveredArea'] },
    { path: 'userFit', kind: 'INFERENCE', derivedFrom: ['subjectProperty.fields', 'preferences'] },
    { path: 'estimatedTransactionCost', kind: 'ESTIMATE', derivedFrom: ['subjectProperty.fields.price', `costProvider:${facts.country}`] },
    { path: 'conclusion', kind: 'RECOMMENDATION', derivedFrom: conclusion.basedOn },
    { path: 'nextBestAction', kind: 'RECOMMENDATION', derivedFrom: ['userFit', 'pricePositioning', 'missingInformation'] },
  ]

  const analysis: PropertyAnalysis = {
    subjectProperty: subject,
    extractionQuality: extraction,
    userFit: fit,
    comparableEvidence: evidence,
    pricePositioning,
    missingInformation: missing,
    prioritizedRisks: risks,
    estimatedTransactionCost: cost,
    conclusion,
    nextBestAction,
    provenance,
    timings: { timeToPropertyMs, timeToFirstValueMs, timeToComparablesMs, timeToConclusionMs, steps },
    generatedAt: now.toISOString(),
    version: ANALYSIS_VERSION,
  }
  input.onStage?.({ stage: 'done', analysis })
  return analysis
}
