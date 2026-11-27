/**
 * Lector de documentos con citas por página: parte pura, sin red.
 *
 * Idea: el modelo propone hallazgos con la frase TEXTUAL del documento y la página; acá se comprueba
 * que esa frase exista de verdad en esa página. Lo que no se puede comprobar se descarta.
 *
 * Límites que esta capa NO resuelve (y la pantalla no debe insinuar lo contrario):
 *  - Que una frase aparezca no prueba que su interpretación jurídica sea correcta ni que el documento esté vigente.
 *  - Que el modelo no cite algo NO significa que ese algo no exista: «no encontrado» es «no demostrado», nunca «ausente».
 *  - El texto del documento es entrada no confiable: una instrucción dentro del PDF no cambia nada de este flujo.
 */

export const FINDING_KINDS = [
  'holder',           // titular o parte
  'domain_condition', // condición/carácter del dominio
  'registry_id',      // matrícula, partida, nomenclatura catastral
  'mortgage',         // hipoteca
  'embargo',
  'inhibition',
  'usufruct',         // usufructo, uso, habitación
  'easement',         // servidumbre, restricción de dominio
  'surface',          // superficie, medidas
  'civil_status',     // estado civil, asentimiento conyugal
  'debt',             // expensas, ABL, impuestos
  'other',
] as const
export type FindingKind = typeof FINDING_KINDS[number]

export interface CitedFinding {
  kind: FindingKind
  /** Página real (1..n) donde se comprobó la frase. */
  page: number
  /** Frase textual del documento. Es lo único que se muestra como contenido: el modelo no escribe afirmaciones propias. */
  quote: string
}

export type Coverage = 'full' | 'partial' | 'unreadable'

export interface CitedSummary {
  /** `unreadable`: no se pudo extraer texto (p. ej. un escaneo). Nunca se interpreta como «sin cargas». */
  coverage: Coverage
  pageCount: number
  /** Páginas que se le mostraron al modelo. */
  pagesRead: number
  findings: CitedFinding[]
  /** Hallazgos que el modelo propuso y no se pudieron comprobar en el texto: se descartaron. */
  discarded: number
}

/** Sin tildes, en minúsculas y con los espacios colapsados. NO toca dígitos, puntuación ni guiones: «12/03» ≠ «12-03». */
export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export const MIN_QUOTE_CHARS = 20
export const MIN_QUOTE_WORDS = 3

/** Una cita tiene que ser lo bastante larga como para no «verificar» cualquier cosa (p. ej. «hipoteca» o «DNI»). */
export function isUsableQuote(quote: string): boolean {
  const n = normalizeText(quote)
  return n.length >= MIN_QUOTE_CHARS && n.split(' ').length >= MIN_QUOTE_WORDS
}

export function verifyQuote(pageText: string, quote: string): boolean {
  if (!isUsableQuote(quote)) return false
  return normalizeText(pageText).includes(normalizeText(quote))
}

/**
 * Página donde está la cita. Si la declarada la contiene, es esa. Si no, solo se reasigna cuando
 * hay UNA sola página que la contiene; si hay varias (ambiguo) o ninguna, devuelve null.
 */
export function locateQuote(pages: string[], declaredPage: number, quote: string): number | null {
  if (!isUsableQuote(quote)) return null
  const q = normalizeText(quote)
  const norm = pages.map(normalizeText)
  const declaredIdx = declaredPage - 1
  if (Number.isInteger(declaredPage) && declaredIdx >= 0 && declaredIdx < norm.length && norm[declaredIdx].includes(q)) return declaredPage
  const hits: number[] = []
  norm.forEach((p, i) => { if (p.includes(q)) hits.push(i + 1) })
  return hits.length === 1 ? hits[0] : null
}

export interface PagedText {
  text: string
  readable: boolean
  /** Páginas incluidas en el texto (las demás se cortaron por tamaño). */
  pagesIncluded: number
}

/** Caracteres con contenido real (letras o números): una página de puros espacios o símbolos no cuenta como texto. */
function contentChars(s: string): number {
  return (s.match(/[\p{L}\p{N}]/gu) ?? []).length
}

export const MIN_READABLE_CHARS = 200

export function buildPagedText(pages: string[], opts: { maxCharsPerPage?: number; maxTotalChars?: number } = {}): PagedText {
  const perPage = opts.maxCharsPerPage ?? 12_000
  const total = opts.maxTotalChars ?? 120_000
  const readable = pages.reduce((n, p) => n + contentChars(p), 0) >= MIN_READABLE_CHARS
  if (!readable) return { text: '', readable: false, pagesIncluded: 0 }
  const parts: string[] = []
  let used = 0
  let included = 0
  for (let i = 0; i < pages.length; i++) {
    // Un «[Página 99]» dentro del documento no puede hacerse pasar por un separador real.
    const body = pages[i].replace(/\[\s*p[aá]gina/gi, '(Página').slice(0, perPage)
    const block = `[Página ${i + 1}]\n${body}`
    if (used + block.length > total) break
    parts.push(block)
    used += block.length + 2
    included = i + 1
  }
  return { text: parts.join('\n\n'), readable: true, pagesIncluded: included }
}

/**
 * Cada tipo exige que la frase hable de eso (sobre texto normalizado). Así el modelo no puede
 * etiquetar como «hipoteca» una frase que dice otra cosa.
 */
const KIND_GATE: Record<FindingKind, RegExp | null> = {
  holder: /\b(senor|senora|sr|sra|titular|propietari|vendedor|comprador|adquirent|transmitent|cedente|cesionari|condomin|dni|nacid|argentin|casad|solter|divorciad|viud|domicili)/,
  domain_condition: /(dominio|propiedad|condominio|nuda|fiduciar|bien de familia|ganancial|propio)/,
  registry_id: /(matricul|partida|nomenclatura|catastr|folio|tomo|inscript)/,
  mortgage: /hipotec/,
  embargo: /embarg/,
  inhibition: /inhibi/,
  usufruct: /(usufruct|habitacion|\buso\b)/,
  easement: /(servidumbre|restriccion|inalienab)/,
  surface: /(superficie|m2|\bm\b|metros|hectarea|\blote\b|medidas|cubiert)/,
  civil_status: /(casad|solter|divorciad|viud|conyug|asentimiento|union convivencial|estado civil)/,
  debt: /(expensas|\babl\b|impuesto|deuda|tasa|municipal|inmobiliario)/,
  other: null,
}

/** Tipos que la pantalla marca como riesgo. Una frase que los NIEGA o los da por terminados no se muestra como riesgo. */
const RISK_KINDS: FindingKind[] = ['mortgage', 'embargo', 'inhibition', 'usufruct', 'easement', 'debt']
const NEGATION = /\b(no|sin|libre|libres|ningun|ninguna|inexistente|inexistentes|cancelad[ao]s?|levantad[ao]s?|extinguid[ao]s?|desafectad[ao]s?)\b/

/** Si la frase pasa la regla de su tipo. Si el tipo es de riesgo y la frase lo niega, baja a «otro dato» (neutro). */
export function classifyQuote(kind: FindingKind, quote: string): FindingKind | null {
  const n = normalizeText(quote)
  const gate = KIND_GATE[kind]
  if (gate && !gate.test(n)) return null
  if (RISK_KINDS.includes(kind) && NEGATION.test(n)) return 'other'
  return kind
}

const MAX_FINDINGS = 40
const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '')

/**
 * Reconstruye el resultado campo por campo (la respuesta del modelo es entrada no confiable)
 * y se queda solo con lo que se pudo comprobar en el texto de las páginas.
 */
export function sanitizeCitedSummary(raw: unknown, pages: string[], pagesRead: number): CitedSummary {
  const pageCount = pages.length
  const paged = buildPagedText(pages)
  if (!paged.readable) return { coverage: 'unreadable', pageCount, pagesRead: 0, findings: [], discarded: 0 }

  const list = raw && typeof raw === 'object' && Array.isArray((raw as { findings?: unknown }).findings)
    ? (raw as { findings: unknown[] }).findings
    : []
  const findings: CitedFinding[] = []
  const seen = new Set<string>()
  let discarded = 0
  for (const item of list.slice(0, 120)) {
    const o = item && typeof item === 'object' ? item as Record<string, unknown> : null
    const rawKind = o && FINDING_KINDS.includes(o.kind as FindingKind) ? o.kind as FindingKind : null
    const quote = clip(o?.quote, 500)
    const declared = typeof o?.page === 'number' ? o.page : NaN
    if (!o || !rawKind) { discarded++; continue }
    const page = locateQuote(pages.slice(0, pagesRead), declared, quote)
    if (page === null) { discarded++; continue }
    const kind = classifyQuote(rawKind, quote)
    if (kind === null) { discarded++; continue }
    const key = `${kind}|${page}|${normalizeText(quote)}`
    if (seen.has(key)) continue
    seen.add(key)
    if (findings.length >= MAX_FINDINGS) { discarded++; continue }
    findings.push({ kind, page, quote })
  }
  findings.sort((a, b) => a.page - b.page)
  return { coverage: pagesRead >= pageCount ? 'full' : 'partial', pageCount, pagesRead, findings, discarded }
}
