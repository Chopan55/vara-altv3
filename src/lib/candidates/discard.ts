/**
 * Motivos de descarte. Se guardan dentro del texto `discardReason` que ya existe
 * (etiquetas separadas por coma), así no cambia ningún dato ni esquema.
 */
export const DISCARD_REASONS = [
  'Precio', 'Ubicación', 'Distribución', 'Estado', 'Estilo',
  'Luz', 'Ruido', 'Tamaño', 'Jardín', 'Otro',
] as const
export type DiscardReason = (typeof DISCARD_REASONS)[number]

export function encodeDiscard(reasons: DiscardReason[], note?: string): string {
  const base = reasons.join(', ')
  const n = note?.trim()
  return n ? (base ? `${base} — ${n}` : n) : base
}

/** Cuenta cuántas veces apareció cada motivo entre las propiedades descartadas, de mayor a menor. */
export function summarizeDiscards(list: { status: string; discardReason?: string }[]): { reason: DiscardReason; count: number }[] {
  const counts = new Map<DiscardReason, number>()
  for (const c of list) {
    if (c.status !== 'DISCARDED' || !c.discardReason) continue
    const head = c.discardReason.split(' — ')[0]
    for (const part of head.split(',').map(s => s.trim())) {
      const r = DISCARD_REASONS.find(x => x === part)
      if (r) counts.set(r, (counts.get(r) ?? 0) + 1)
    }
  }
  return [...counts.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count)
}
