import type { RentalCheckResult, RentalInput, RentalRule, RuleFinding, SourceRef } from './types'
import { isJurisdictionConsistent } from './normalize'
import { sanitizeInput } from './defaults'
import { calculateCosts } from './calculator'
import { DEFAULT_JURISDICTION, PACKS, getPack } from './jurisdictions'
import { buildMissingData, computeConfidence, evaluateRules } from './risks'
import { buildGuaranteeNotes } from './guarantees'
import { buildChecklist } from './checklist'

export * from './types'
export { GUARANTEE_LABELS, ADJUSTMENT_FREQUENCY_LABELS, ADJUSTMENT_INDEX_LABELS } from './labels'
export { RENTAL_JURISDICTIONS, getPack } from './jurisdictions'
export { emptyRentalInput, sanitizeInput } from './defaults'
export { calculateCosts } from './calculator'

function mismatchFinding(input: RentalInput): RuleFinding {
  return {
    ruleId: 'rentals.jurisdiction-mismatch',
    jurisdiction: input.jurisdiction,
    severity: 'LOW',
    title: 'El país y la jurisdicción no coinciden',
    explanation: 'Revisar: el país y la jurisdicción elegidos no coinciden, por lo que no se aplicó ninguna regla jurisdiccional.',
    source: { label: 'VARA Alquiler Check', url: '', confidence: 'NEEDS_REVIEW' },
  }
}

/** Fuentes de las reglas evaluadas, sin repetir; primero las de las alertas disparadas. */
function collectSources(applicable: RentalRule[], triggeredIds: Set<string>): SourceRef[] {
  const ordered = [...applicable].sort((a, b) => Number(triggeredIds.has(b.id)) - Number(triggeredIds.has(a.id)))
  const seen = new Map<string, SourceRef>()
  for (const r of ordered) {
    const key = `${r.sourceUrl}|${r.sourceLabel}`
    if (!seen.has(key)) seen.set(key, { label: r.sourceLabel, url: r.sourceUrl, confidence: r.confidence })
  }
  return [...seen.values()]
}

/**
 * Punto de entrada del módulo. Función pura: sin red, sin IA, sin estado.
 * Acepta cualquier objeto con la forma de `RentalInput` (se sanea antes de usar).
 */
export function runRentalCheck(raw: RentalInput): RentalCheckResult {
  const input = sanitizeInput(raw)
  const consistent = isJurisdictionConsistent(input)
  const pack = getPack(input.jurisdiction) ?? PACKS[DEFAULT_JURISDICTION[input.country]]

  const costs = calculateCosts(input)
  const evaluation = evaluateRules(input, pack)
  const riskFlags = consistent ? evaluation.riskFlags : [mismatchFinding(input)]
  const contractAlerts = evaluation.contractAlerts
  const findings = [...riskFlags, ...contractAlerts]

  const missingData = buildMissingData(input, evaluation.missingFields)
  const confidence = computeConfidence({ pack, consistent, missingCount: missingData.length, findings })

  return {
    currency: costs.currency,
    entryCostItems: costs.entryCostItems,
    entryTotal: costs.entryTotal,
    monthlyCostItems: costs.monthlyCostItems,
    monthlyTotal: costs.monthlyTotal,
    riskFlags,
    contractAlerts,
    guaranteeNotes: buildGuaranteeNotes(input, pack),
    missingData,
    signingChecklist: buildChecklist(input, pack, findings, missingData),
    confidenceLevel: confidence.level,
    confidenceReasons: confidence.reasons,
    sources: collectSources(evaluation.applicable, evaluation.triggeredIds),
    disclaimer: pack.disclaimer,
  }
}
