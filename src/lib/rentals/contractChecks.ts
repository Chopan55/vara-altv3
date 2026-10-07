import type { RentalInput, RentalJurisdiction, RentalRule, RuleConfidence, Severity } from './types'
import { amount } from './normalize'

/**
 * Reglas de contrato que se repiten entre jurisdicciones (contrato escrito,
 * inventario, devolución del depósito). Cada jurisdicción pone su texto y su fuente;
 * la lógica de evaluación vive acá una sola vez.
 */

export interface RuleSource {
  label: string
  url: string
  confidence: RuleConfidence
}

export function sourceFields(s: RuleSource) {
  return { sourceLabel: s.label, sourceUrl: s.url, confidence: s.confidence }
}

/** Prefijo estable de los ids: AR_CABA -> ar-caba. */
export function rulePrefix(jurisdiction: RentalJurisdiction): string {
  return jurisdiction.toLowerCase().replace('_', '-')
}

/** Campos de la lista que el usuario no cargó (null, undefined o NaN). */
export function missingFields(input: RentalInput, fields: (keyof RentalInput)[]): (keyof RentalInput)[] {
  return fields.filter(f => {
    const v = input[f]
    return v === null || v === undefined || (typeof v === 'number' && !Number.isFinite(v))
  })
}

interface SharedCopy {
  title: string
  explanation: string
  source: RuleSource
  severity?: Severity
}

export function noContractRule(jurisdiction: RentalJurisdiction, copy: SharedCopy): RentalRule {
  return {
    id: `${rulePrefix(jurisdiction)}.no-contract`,
    jurisdiction,
    role: 'ANY',
    kind: 'CONTRACT',
    severity: copy.severity ?? 'HIGH',
    title: copy.title,
    explanation: copy.explanation,
    ...sourceFields(copy.source),
    missing: i => missingFields(i, ['hasContract']),
    evaluate: i => (i.hasContract === false ? 'TRIGGERED' : i.hasContract === true ? 'OK' : 'UNKNOWN'),
  }
}

export function noInventoryRule(jurisdiction: RentalJurisdiction, copy: SharedCopy): RentalRule {
  return {
    id: `${rulePrefix(jurisdiction)}.no-handover-inventory`,
    jurisdiction,
    role: 'ANY',
    kind: 'RISK',
    severity: copy.severity ?? 'MEDIUM',
    title: copy.title,
    explanation: copy.explanation,
    ...sourceFields(copy.source),
    missing: i => missingFields(i, ['hasHandoverInventory']),
    evaluate: i => (i.hasHandoverInventory === false ? 'TRIGGERED' : i.hasHandoverInventory === true ? 'OK' : 'UNKNOWN'),
  }
}

/** Solo aplica si hay depósito: sin depósito no hay nada que devolver. */
export function noDepositReturnClauseRule(jurisdiction: RentalJurisdiction, copy: SharedCopy): RentalRule {
  return {
    id: `${rulePrefix(jurisdiction)}.no-deposit-return-clause`,
    jurisdiction,
    role: 'ANY',
    kind: 'CONTRACT',
    severity: copy.severity ?? 'MEDIUM',
    title: copy.title,
    explanation: copy.explanation,
    ...sourceFields(copy.source),
    missing: i => (amount(i.depositAmount) > 0 ? missingFields(i, ['hasDepositReturnClause']) : []),
    evaluate: i => {
      if (amount(i.depositAmount) <= 0) return 'OK'
      if (i.hasDepositReturnClause === false) return 'TRIGGERED'
      return i.hasDepositReturnClause === true ? 'OK' : 'UNKNOWN'
    },
  }
}
