/**
 * Resultado compartible, sin datos privados.
 *
 * Caso de uso: "Mirá lo que VARA encontró sobre esta casa", enviado a la
 * pareja, la familia o un asesor.
 *
 * Arquitectura: el snapshot viaja codificado en el fragmento (`#d=…`) del
 * link. El fragmento no se envía al servidor, así que no hay nada que guardar,
 * filtrar ni borrar. La contracara: no se puede revocar un link ya enviado.
 *
 * Se EXCLUYE siempre: preferencias, encaje con la persona, presupuesto,
 * perfil financiero, documentos, notas, datos de negociación y costos. El
 * titular se reconstruye desde el precio y los datos faltantes, no desde la
 * conclusión personal (que puede mencionar lo que la persona busca).
 */

import type { PropertyAnalysis } from './types'

export const SHARE_VERSION = 1
const MAX_ENCODED = 16_000
const MAX_STR = 500

export interface SharedMatch {
  price?: number
  cur?: 'USD' | 'ARS'
  where?: string
  beds?: number
  cov?: number
  land?: number
  score: number
  reasons: string[]
  diffs: string[]
  fresh?: string
  src: string
  url?: string
}

export interface SharedAnalysis {
  v: typeof SHARE_VERSION
  at: string
  title: string
  where?: string
  price?: { a: number; c: 'USD' | 'ARS' }
  headline: string
  priceText: string
  position: 'BELOW' | 'WITHIN' | 'ABOVE' | 'UNKNOWN'
  range?: { lo: number; hi: number; c: 'USD' | 'ARS' }
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT'
  matches: SharedMatch[]
  checks: { title: string; reason: string }[]
  missing: string[]
  question: string | null
}

const clip = (s: string | undefined, n = MAX_STR) => (s ?? '').slice(0, n)

function neutralHeadline(a: PropertyAnalysis): string {
  const p = a.pricePositioning
  const missing = a.missingInformation.items.filter(i => i.impact === 'HIGH')
  const base =
    p.confidence === 'INSUFFICIENT' ? 'Todavía no hay base suficiente para opinar sobre el precio.'
    : p.position === 'ABOVE' ? 'El precio publicado está por encima de los avisos más comparables.'
    : p.position === 'BELOW' ? 'El precio publicado está por debajo de los avisos más comparables.'
    : p.position === 'WITHIN' ? 'El precio publicado está en línea con los avisos más comparables.'
    : 'No se pudo ubicar el precio frente a otros avisos.'
  return missing.length ? `${base} Faltan datos clave por confirmar.` : base
}

export function buildSharedAnalysis(a: PropertyAnalysis): SharedAnalysis {
  const f = a.subjectProperty.fields
  const band = a.pricePositioning.comparableListingRange
  const ask = a.pricePositioning.subjectAskingPrice

  const strong = a.comparableEvidence.matches
    .filter(m => m.similarityScore >= 60)
    .slice(0, 5)

  return {
    v: SHARE_VERSION,
    at: a.generatedAt,
    title: clip(f.title?.value ?? 'Propiedad'),
    where: clip([f.community?.value, f.neighborhood?.value, f.city?.value].filter(Boolean).join(', ')) || undefined,
    price: ask ? { a: ask.amount, c: ask.currency } : undefined,
    headline: neutralHeadline(a),
    priceText: clip(a.pricePositioning.interpretation),
    position: a.pricePositioning.position,
    range: band ? { lo: band.low, hi: band.high, c: band.currency } : undefined,
    confidence: a.pricePositioning.confidence,
    matches: strong.map(m => ({
      price: m.listing.price,
      cur: m.listing.currency,
      where: clip([m.listing.community, m.listing.neighborhood].filter(Boolean).join(', ')) || undefined,
      beds: m.listing.bedrooms,
      cov: m.listing.coveredArea,
      land: m.listing.landArea,
      score: m.similarityScore,
      reasons: m.similarityReasons.slice(0, 4).map(s => clip(s, 160)),
      diffs: m.importantDifferences.slice(0, 3).map(s => clip(s, 160)),
      fresh: m.freshness.note ? clip(m.freshness.note, 160) : undefined,
      src: clip(m.listing.source, 60),
      url: m.listing.url,
    })),
    checks: a.prioritizedRisks
      .filter(r => r.id !== 'deal-breaker')
      .slice(0, 3)
      .map(r => ({ title: clip(r.title, 160), reason: clip(r.reason, 300) })),
    missing: a.missingInformation.items.map(i => clip(i.label, 80)),
    question: a.missingInformation.draftMessage ? clip(a.missingInformation.draftMessage) : null,
  }
}

// ───────────────────────── Codificación ─────────────────────────

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  bytes.forEach(b => { bin += String.fromCharCode(b) })
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)))
}

export function encodeShared(s: SharedAnalysis): string | null {
  const out = toBase64Url(JSON.stringify(s))
  return out.length <= MAX_ENCODED ? out : null
}

const isStr = (v: unknown): v is string => typeof v === 'string'
const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v)
const safeUrl = (v: unknown): string | undefined =>
  isStr(v) && /^https?:\/\//i.test(v) && v.length < 600 ? v : undefined

/**
 * Un link ajeno es entrada no confiable: se valida forma y largo, se descarta
 * lo que no cuadra y solo se aceptan URLs http(s). La pantalla lo muestra como
 * texto, nunca como HTML.
 */
export function decodeShared(encoded: string): SharedAnalysis | null {
  try {
    if (!encoded || encoded.length > MAX_ENCODED) return null
    const o = JSON.parse(fromBase64Url(encoded)) as Record<string, unknown>
    if (!o || o.v !== SHARE_VERSION || !isStr(o.title) || !isStr(o.headline)) return null

    const arr = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : [])
    const strs = (v: unknown, max: number, len = MAX_STR) =>
      arr(v, max).filter(isStr).map(s => s.slice(0, len))
    const cur = (v: unknown): 'USD' | 'ARS' | undefined => (v === 'USD' || v === 'ARS' ? v : undefined)
    const priceObj = o.price as { a?: unknown; c?: unknown } | undefined
    const rangeObj = o.range as { lo?: unknown; hi?: unknown; c?: unknown } | undefined

    return {
      v: SHARE_VERSION,
      at: isStr(o.at) ? o.at.slice(0, 40) : '',
      title: clip(o.title),
      where: isStr(o.where) ? clip(o.where) : undefined,
      price: priceObj && isNum(priceObj.a) && cur(priceObj.c) ? { a: priceObj.a, c: cur(priceObj.c)! } : undefined,
      headline: clip(o.headline),
      priceText: isStr(o.priceText) ? clip(o.priceText) : '',
      position: ['BELOW', 'WITHIN', 'ABOVE', 'UNKNOWN'].includes(o.position as string) ? (o.position as SharedAnalysis['position']) : 'UNKNOWN',
      range: rangeObj && isNum(rangeObj.lo) && isNum(rangeObj.hi) && cur(rangeObj.c)
        ? { lo: rangeObj.lo, hi: rangeObj.hi, c: cur(rangeObj.c)! } : undefined,
      confidence: ['HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT'].includes(o.confidence as string)
        ? (o.confidence as SharedAnalysis['confidence']) : 'INSUFFICIENT',
      matches: arr(o.matches, 5).map((m): SharedMatch => {
        const x = (m ?? {}) as Record<string, unknown>
        return {
          price: isNum(x.price) ? x.price : undefined,
          cur: cur(x.cur),
          where: isStr(x.where) ? clip(x.where) : undefined,
          beds: isNum(x.beds) ? x.beds : undefined,
          cov: isNum(x.cov) ? x.cov : undefined,
          land: isNum(x.land) ? x.land : undefined,
          score: isNum(x.score) ? Math.max(0, Math.min(100, x.score)) : 0,
          reasons: strs(x.reasons, 4, 160),
          diffs: strs(x.diffs, 3, 160),
          fresh: isStr(x.fresh) ? clip(x.fresh, 160) : undefined,
          src: isStr(x.src) ? clip(x.src, 60) : '',
          url: safeUrl(x.url),
        }
      }),
      checks: arr(o.checks, 3).map(c => {
        const x = (c ?? {}) as Record<string, unknown>
        return { title: isStr(x.title) ? clip(x.title, 160) : '', reason: isStr(x.reason) ? clip(x.reason, 300) : '' }
      }),
      missing: strs(o.missing, 10, 80),
      question: isStr(o.question) ? clip(o.question) : null,
    }
  } catch {
    return null
  }
}
