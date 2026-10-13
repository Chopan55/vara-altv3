/**
 * Regla única de "en qué recorrido está el usuario" (comprar o vender) y cuál es su
 * operación activa. Antes el menú, la guía y el Dashboard decidían cada uno por su
 * cuenta y podían contradecirse (menú en Comprando, guía hablando de una venta).
 *
 * - Si el usuario eligió un recorrido, ese manda.
 * - Si no eligió, se deduce de su operación seleccionada (o la primera).
 * - Sin operaciones ni elección, se asume compra.
 * - La operación activa es siempre del recorrido actual: nunca una venta en modo compra.
 */
export type Journey = 'BUY' | 'SELL'

interface OpLike { id: string; type: Journey }

export function deriveJourney(journeyType: string, ops: OpLike[], selectedId: string | null): Journey {
  if (journeyType === 'SELL_PROPERTY') return 'SELL'
  if (journeyType === 'BUY_PROPERTY') return 'BUY'
  const selected = ops.find(o => o.id === selectedId) ?? ops[0]
  return selected?.type ?? 'BUY'
}

export function pickActiveOperation<T extends OpLike>(ops: T[], selectedId: string | null, journey: Journey): T | null {
  const ofJourney = ops.filter(o => o.type === journey)
  return ofJourney.find(o => o.id === selectedId) ?? ofJourney[0] ?? null
}

/** Valor que se guarda en `vara_journey_type` para cada recorrido. */
export function journeyToStored(j: Journey): string {
  return j === 'SELL' ? 'SELL_PROPERTY' : 'BUY_PROPERTY'
}
