import type { ChecklistItem, MissingDatum, RentalInput, RentalJurisdictionPack, RuleFinding } from './types'

/**
 * Checklist antes de firmar: pasos generales + pasos de la jurisdicción + un paso
 * por cada alerta importante y por cada dato que falta. Sin duplicados por id.
 */
export function buildChecklist(
  input: RentalInput,
  pack: RentalJurisdictionPack,
  findings: RuleFinding[],
  missing: MissingDatum[],
): ChecklistItem[] {
  const items: ChecklistItem[] = [
    { id: 'common.read-contract', text: 'Leer el contrato completo antes de pagar o firmar.', priority: 'MUST' },
  ]

  // Primero lo que dispararon las reglas: HIGH es obligatorio, MEDIUM recomendado.
  for (const f of findings) {
    if (f.severity === 'LOW') continue
    items.push({
      id: `finding.${f.ruleId}`,
      text: `Revisar: ${f.title}.`,
      relatedRuleId: f.ruleId,
      priority: f.severity === 'HIGH' ? 'MUST' : 'SHOULD',
    })
  }

  pack.checklist.forEach((c, index) => items.push({ id: `pack.${pack.jurisdiction}.${index}`, ...c }))

  if (input.hasHandoverInventory !== true) {
    items.push({
      id: 'common.handover-inventory',
      text: 'Hacer un inventario o acta de entrega con fotos fechadas y firmada por ambas partes.',
      priority: 'SHOULD',
    })
  }
  if (input.hasContract !== false) {
    items.push({
      id: 'common.meters',
      text: 'Anotar las lecturas de los medidores (luz, gas, agua) al recibir el inmueble.',
      priority: 'SHOULD',
    })
  }
  items.push({
    id: 'common.keep-records',
    text: 'Guardar copia del contrato, del inventario y de todos los comprobantes de pago.',
    priority: 'SHOULD',
  })

  for (const m of missing) {
    items.push({ id: `missing.${m.field}`, text: `Confirmar: ${m.label}.`, priority: 'SHOULD' })
  }

  const seen = new Set<string>()
  const unique = items.filter(i => !seen.has(i.id) && seen.add(i.id))
  // MUST primero; sort() es estable, así que dentro de cada grupo se conserva el orden.
  return [...unique.filter(i => i.priority === 'MUST'), ...unique.filter(i => i.priority === 'SHOULD')]
}
