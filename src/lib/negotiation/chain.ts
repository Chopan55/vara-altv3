/**
 * Cálculos de la cadena de ofertas. Puros: la IA interpreta, pero los números
 * que mostramos salen de acá y se pueden testear.
 */

export type ChainParty = 'comprador' | 'vendedor' | 'inmobiliaria'

export interface ChainRound {
  quien: ChainParty
  monto: string
}

/**
 * Lee montos escritos a mano en formato argentino o internacional.
 * "USD 120.000" → 120000 · "120,000" → 120000 · "120.000,50" → 120000.5 · "1500,5" → 1500.5
 * Devuelve null si no hay un número.
 */
export function parseAmount(raw: string): number | null {
  const s = raw.replace(/[^0-9.,]/g, '')
  if (!/[0-9]/.test(s)) return null
  const hasDot = s.includes('.')
  const hasComma = s.includes(',')
  let normalized: string
  if (hasDot && hasComma) {
    // El separador que aparece último es el decimal.
    normalized = s.lastIndexOf(',') > s.lastIndexOf('.')
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '')
  } else if (hasDot || hasComma) {
    const sep = hasDot ? '.' : ','
    const thousands = new RegExp(`^\\d{1,3}(\\${sep}\\d{3})+$`)
    normalized = thousands.test(s) ? s.split(sep).join('') : s.replace(',', '.')
  } else {
    normalized = s
  }
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

const isAsk = (q: ChainParty) => q === 'vendedor' || q === 'inmobiliaria'

export interface ChainStats {
  /** Último pedido del vendedor (o su inmobiliaria). */
  lastAsk: number | null
  /** Última oferta del comprador. */
  lastBid: number | null
  /** Distancia entre lo que pide uno y ofrece el otro, en % del pedido. */
  gapPct: number | null
  /** Cuánto bajó el vendedor desde su primer pedido, en %. */
  sellerMovePct: number | null
  /** Cuánto subió el comprador desde su primera oferta, en %. */
  buyerMovePct: number | null
}

/** Compara cada parte consigo misma: mezclar un pedido con una oferta no dice nada. */
export function chainStats(rounds: ChainRound[]): ChainStats {
  const asks = rounds.filter(r => isAsk(r.quien)).map(r => parseAmount(r.monto)).filter((n): n is number => n !== null && n > 0)
  const bids = rounds.filter(r => !isAsk(r.quien)).map(r => parseAmount(r.monto)).filter((n): n is number => n !== null && n > 0)
  const lastAsk = asks.at(-1) ?? null
  const lastBid = bids.at(-1) ?? null
  const pct = (from: number, to: number) => ((to - from) / from) * 100
  return {
    lastAsk,
    lastBid,
    gapPct: lastAsk !== null && lastBid !== null ? ((lastAsk - lastBid) / lastAsk) * 100 : null,
    sellerMovePct: asks.length >= 2 ? pct(asks[0], asks[asks.length - 1]) : null,
    buyerMovePct: bids.length >= 2 ? pct(bids[0], bids[bids.length - 1]) : null,
  }
}
