import type {
  ConfidenceLevel,
  MissingDatum,
  RentalInput,
  RentalJurisdictionPack,
  RentalRule,
  RuleFinding,
  Severity,
} from './types'
import { isJurisdictionConsistent } from './normalize'
import { FIELD_INFO } from './labels'
import { missingFields } from './contractChecks'

/**
 * Motor de reglas. Evalúa las reglas de la jurisdicción contra los datos del usuario.
 * Las reglas son datos (ver `jurisdictions/`); acá no hay lógica legal propia.
 */

const SEVERITY_ORDER: Record<Severity, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }

export interface RuleEvaluation {
  riskFlags: RuleFinding[]
  contractAlerts: RuleFinding[]
  /** Campos que alguna regla necesitaba y el usuario no cargó. */
  missingFields: Set<keyof RentalInput>
  /** Reglas que corresponden a esta jurisdicción y a este rol. */
  applicable: RentalRule[]
  triggeredIds: Set<string>
}

export function applicableRules(input: RentalInput, pack: RentalJurisdictionPack): RentalRule[] {
  return pack.rules.filter(r => r.jurisdiction === input.jurisdiction && (r.role === 'ANY' || r.role === input.role))
}

function toFinding(rule: RentalRule): RuleFinding {
  return {
    ruleId: rule.id,
    jurisdiction: rule.jurisdiction,
    severity: rule.severity,
    title: rule.title,
    explanation: rule.explanation,
    source: { label: rule.sourceLabel, url: rule.sourceUrl, confidence: rule.confidence },
  }
}

function bySeverity(a: RuleFinding, b: RuleFinding): number {
  return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
}

export function evaluateRules(input: RentalInput, pack: RentalJurisdictionPack): RuleEvaluation {
  const empty: RuleEvaluation = {
    riskFlags: [],
    contractAlerts: [],
    missingFields: new Set(),
    applicable: [],
    triggeredIds: new Set(),
  }
  // País y jurisdicción incoherentes: no se aplica ninguna regla jurisdiccional.
  if (!isJurisdictionConsistent(input)) return empty

  const applicable = applicableRules(input, pack)
  const riskFlags: RuleFinding[] = []
  const contractAlerts: RuleFinding[] = []
  const missing = new Set<keyof RentalInput>()
  const triggeredIds = new Set<string>()

  for (const rule of applicable) {
    rule.missing?.(input).forEach(f => missing.add(f))
    if (rule.evaluate(input) !== 'TRIGGERED') continue
    triggeredIds.add(rule.id)
    ;(rule.kind === 'RISK' ? riskFlags : contractAlerts).push(toFinding(rule))
  }

  // sort() es estable: a igual severidad se conserva el orden de las reglas.
  return {
    riskFlags: riskFlags.sort(bySeverity),
    contractAlerts: contractAlerts.sort(bySeverity),
    missingFields: missing,
    applicable,
    triggeredIds,
  }
}

/** Datos básicos que siempre hacen falta para entender un alquiler. */
export function coreMissingFields(input: RentalInput): (keyof RentalInput)[] {
  const core: (keyof RentalInput)[] = [
    'monthlyRent',
    'contractMonths',
    'depositAmount',
    'upfrontMonths',
    'maintenanceOrExpenses',
    'hasBroker',
    'hasContract',
    'adjustmentFrequency',
    'adjustmentIndex',
    'hasHandoverInventory',
  ]
  if (input.role === 'TENANT') core.push('paysBeforeSigning')
  if (input.hasBroker === true) core.push('brokerFeeAmount')
  if (['SEGURO_CAUCION', 'POLIZA_JURIDICA', 'FIANZA'].includes(input.guaranteeType)) core.push('guaranteeCost')
  return missingFields(input, core)
}

/** Une los datos básicos con los que pidieron las reglas, en el orden de `FIELD_INFO`. */
export function buildMissingData(input: RentalInput, fromRules: Iterable<keyof RentalInput>): MissingDatum[] {
  const all = new Set<keyof RentalInput>([...coreMissingFields(input), ...fromRules])
  const out: MissingDatum[] = []
  for (const key of Object.keys(FIELD_INFO) as (keyof RentalInput)[]) {
    const info = FIELD_INFO[key]
    if (all.has(key) && info) out.push({ field: key, label: info.label, why: info.why })
  }
  return out
}

const RANK: Record<ConfidenceLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 }

function capAt(level: ConfidenceLevel, max: ConfidenceLevel): ConfidenceLevel {
  return RANK[level] <= RANK[max] ? level : max
}

export interface ConfidenceInput {
  pack: RentalJurisdictionPack
  consistent: boolean
  missingCount: number
  findings: RuleFinding[]
}

/**
 * Nivel de confianza del resultado. Nunca supera el techo de la jurisdicción
 * (`pack.maxConfidence`), que hoy es MEDIUM porque las reglas no tuvieron revisión
 * legal profesional.
 */
export function computeConfidence(args: ConfidenceInput): { level: ConfidenceLevel; reasons: string[] } {
  if (!args.consistent) {
    return { level: 'LOW', reasons: ['El país y la jurisdicción elegidos no coinciden: no se aplicó ninguna regla jurisdiccional.'] }
  }

  const reasons: string[] = []
  let level: ConfidenceLevel = 'HIGH'

  if (args.missingCount >= 5) {
    level = 'LOW'
    reasons.push(`Faltan ${args.missingCount} datos básicos: el resultado es una aproximación.`)
  } else if (args.missingCount > 0) {
    level = capAt(level, 'MEDIUM')
    reasons.push(`Faltan ${args.missingCount} ${args.missingCount === 1 ? 'dato' : 'datos'}: algunas reglas no se pudieron evaluar.`)
  }

  if (args.findings.some(f => f.source.confidence === 'NEEDS_REVIEW')) {
    level = capAt(level, 'MEDIUM')
    reasons.push('Alguna alerta se apoya en una fuente que todavía requiere revisión.')
  }

  if (RANK[level] > RANK[args.pack.maxConfidence]) {
    level = args.pack.maxConfidence
    reasons.push(args.pack.maxConfidenceReason)
  }

  return { level, reasons }
}
