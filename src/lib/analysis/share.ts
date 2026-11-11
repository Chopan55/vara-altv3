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
 * perfil financiero, documentos, notas y datos de negociación. El titular se
 * reconstruye desde el precio y los datos faltantes, no desde la conclusión
 * personal (que puede mencionar lo que la persona busca).
 *
 * Los costos y las preguntas al vendedor NO viajan: quien abre el link los
 * vuelve a calcular con el país, la provincia o estado y el precio (son
 * públicos). Así un link adulterado no puede mostrar costos inventados.
 *
 * Un link ajeno es entrada no confiable: al leerlo se quitan links, emails y
 * teléfonos de los textos, y solo se aceptan links a portales conocidos. Así
 * nadie puede usar la página de VARA para mandar a alguien a otro lado.
 */

import type { ListingCurrency, PropertyAnalysis } from './types'

export const SHARE_VERSION = 1
const MAX_ENCODED = 16_000
const MAX_STR = 500

export interface SharedMatch {
  price?: number
  cur?: ListingCurrency
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
  /** País del aviso (reglas de costos y preguntas). */
  country?: 'AR' | 'MX'
  /** Provincia o estado para recalcular costos, si se conoce. */
  prov?: string
  /** Hay expensas o cuota de mantenimiento (departamento, PH, barrio o condominio). */
  common?: boolean
  price?: { a: number; c: ListingCurrency }
  headline: string
  priceText: string
  position: 'BELOW' | 'WITHIN' | 'ABOVE' | 'UNKNOWN'
  range?: { lo: number; hi: number; c: ListingCurrency }
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT'
  matches: SharedMatch[]
  checks: { title: string; reason: string }[]
  missing: string[]
  question: string | null
}

const clip = (s: string | undefined, n = MAX_STR) => (s ?? '').slice(0, n)
/** Para leer un link ajeno: recorta y además limpia. */
const safe = (s: string | undefined, n = MAX_STR) => scrub(clip(s, n))

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

  const kind = f.kind?.value
  const country = a.subjectProperty.country === 'MX' ? 'MX' : 'AR'

  return {
    v: SHARE_VERSION,
    at: a.generatedAt,
    title: clip(f.title?.value ?? 'Propiedad'),
    where: clip([f.community?.value, f.neighborhood?.value, f.city?.value].filter(Boolean).join(', ')) || undefined,
    country,
    prov: a.estimatedTransactionCost.region,
    common: kind === 'apartment' || kind === 'ph' || !!f.community?.value,
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
      // Solo links a portales conocidos: es lo mismo que acepta quien abre el link.
      url: m.listing.url && isPortalUrl(m.listing.url) ? m.listing.url : undefined,
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

/** Portales de avisos a los que un link compartido puede llevar. Cualquier otro se descarta. */
const PORTAL_HOSTS = [
  'zonaprop.com.ar', 'argenprop.com', 'mercadolibre.com.ar', 'properati.com.ar', 'remax.com.ar',
  'inmobusqueda.com.ar', 'inmuebles24.com', 'lamudi.com.mx', 'vivanuncios.com.mx', 'propiedades.com',
  'mercadolibre.com.mx',
]

export function isPortalUrl(v: string): boolean {
  try {
    const u = new URL(v)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
    const h = u.hostname.toLowerCase()
    return PORTAL_HOSTS.some(d => h === d || h.endsWith(`.${d}`))
  } catch {
    return false
  }
}

const safeUrl = (v: unknown): string | undefined =>
  isStr(v) && v.length < 600 && isPortalUrl(v) ? v : undefined

/**
 * Saca de un texto lo que serviría para llevar a alguien a otro lado: links,
 * emails y teléfonos. Los montos con separador de miles (1.250.000) quedan.
 */
export function scrub(s: string): string {
  return s
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, '')
    .replace(/\b(?:wa\.me|t\.me|bit\.ly)\/\S*/gi, '')
    .replace(/\S+@\S+\.\S+/g, '')
    .replace(/\+?\(?\d[\d\s().-]{6,}\d/g, m => {
      const t = m.trim()
      if (/^\d{1,3}([.,]\d{3})+$/.test(t)) return m
      return t.replace(/\D/g, '').length >= 8 ? '' : m
    })
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Un link ajeno es entrada no confiable: se valida forma y largo, se descarta
 * lo que no cuadra, se limpian los textos (`scrub`) y solo se aceptan links a
 * portales conocidos. La pantalla lo muestra como texto, nunca como HTML.
 */
export function decodeShared(encoded: string): SharedAnalysis | null {
  try {
    if (!encoded || encoded.length > MAX_ENCODED) return null
    const o = JSON.parse(fromBase64Url(encoded)) as Record<string, unknown>
    if (!o || o.v !== SHARE_VERSION || !isStr(o.title) || !isStr(o.headline)) return null

    const arr = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : [])
    const strs = (v: unknown, max: number, len = MAX_STR) =>
      arr(v, max).filter(isStr).map(s => safe(s, len)).filter(Boolean)
    const cur = (v: unknown): ListingCurrency | undefined => (v === 'USD' || v === 'ARS' || v === 'MXN' ? v : undefined)
    const priceObj = o.price as { a?: unknown; c?: unknown } | undefined
    const rangeObj = o.range as { lo?: unknown; hi?: unknown; c?: unknown } | undefined

    return {
      v: SHARE_VERSION,
      at: isStr(o.at) ? o.at.slice(0, 40) : '',
      title: safe(o.title) || 'Propiedad',
      where: isStr(o.where) ? safe(o.where) || undefined : undefined,
      country: o.country === 'MX' ? 'MX' : o.country === 'AR' ? 'AR' : undefined,
      prov: isStr(o.prov) && /^[A-Z_]{2,30}$/.test(o.prov) ? o.prov : undefined,
      common: o.common === true,
      price: priceObj && isNum(priceObj.a) && cur(priceObj.c) ? { a: priceObj.a, c: cur(priceObj.c)! } : undefined,
      headline: safe(o.headline),
      priceText: isStr(o.priceText) ? safe(o.priceText) : '',
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
          where: isStr(x.where) ? safe(x.where) || undefined : undefined,
          beds: isNum(x.beds) ? x.beds : undefined,
          cov: isNum(x.cov) ? x.cov : undefined,
          land: isNum(x.land) ? x.land : undefined,
          score: isNum(x.score) ? Math.max(0, Math.min(100, x.score)) : 0,
          reasons: strs(x.reasons, 4, 160),
          diffs: strs(x.diffs, 3, 160),
          fresh: isStr(x.fresh) ? safe(x.fresh, 160) || undefined : undefined,
          src: isStr(x.src) ? safe(x.src, 60) : '',
          url: safeUrl(x.url),
        }
      }),
      checks: arr(o.checks, 3).map(c => {
        const x = (c ?? {}) as Record<string, unknown>
        return { title: isStr(x.title) ? safe(x.title, 160) : '', reason: isStr(x.reason) ? safe(x.reason, 300) : '' }
      }).filter(c => c.title),
      missing: strs(o.missing, 10, 80),
      question: isStr(o.question) ? safe(o.question) || null : null,
    }
  } catch {
    return null
  }
}
