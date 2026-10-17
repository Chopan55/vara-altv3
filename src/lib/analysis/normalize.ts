/**
 * Capa B — Normalización.
 *
 * Convierte lo que traen los importadores (y los comparables ya existentes) al
 * mismo formato, `ListingFacts`, con procedencia por campo.
 *
 * Regla de oro: solo se normaliza lo que el aviso realmente dice. Lo que no
 * está queda UNKNOWN con valor null; no se rellena con un promedio ni con una
 * suposición. "No menciona pileta" no es "no tiene pileta".
 */

import type { ScrapeResult } from '@/app/api/scrape-property/route'
import type { Comparable } from '@/lib/comparables/model'
import type {
  ExtractionMethod, ExtractionQuality, Field, FieldStatus, ListingFacts,
  PropertyCondition, PropertyKind, Provenance, SubjectProperty,
} from './types'

/** Minúsculas, sin tildes ni signos: para comparar nombres de lugares. */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const METHOD_CONFIDENCE: Record<ExtractionMethod, number> = {
  'meli-api': 0.95, user: 1, 'json-ld': 0.85, meta: 0.7,
  reader: 0.65, ai: 0.6, paste: 0.6, derived: 0.5,
}

function statusFor(method: ExtractionMethod, derived = false): FieldStatus {
  if (derived || method === 'derived') return 'INFERRED'
  return method === 'user' ? 'CONFIRMED' : 'EXTRACTED'
}

function mk<T>(
  value: T | null | undefined,
  prov: Provenance,
  derived = false,
): Field<NonNullable<T>> {
  if (value === null || value === undefined || value === '' || (typeof value === 'number' && !(value > 0 || value === 0))) {
    return { value: null, status: 'UNKNOWN' }
  }
  return {
    value: value as NonNullable<T>,
    status: statusFor(prov.method, derived),
    provenance: prov,
    confidence: derived ? Math.min(0.55, METHOD_CONFIDENCE[prov.method]) : METHOD_CONFIDENCE[prov.method],
  }
}

// ───────────────────────── Detección en texto ─────────────────────────

export function detectKind(text: string): PropertyKind | undefined {
  const t = norm(text)
  if (/\b(lote|terreno)\b/.test(t) && !/\bcasa\b/.test(t)) return 'lot'
  if (/\bph\b/.test(t)) return 'ph'
  if (/\b(departamento|depto|dpto|monoambiente|loft)\b/.test(t)) return 'apartment'
  if (/\b(casa|chalet|duplex|quinta)\b/.test(t)) return 'house'
  return undefined
}

const COMMUNITY_RE =
  /(?:[Bb]arrio\s+(?:[Cc]errado|[Pp]rivado)|[Cc]ountry|[Cc]lub\s+[Dd]e\s+[Cc]ampo|[Cc]omplejo)\s+(?:de\s+|en\s+|el\s+|la\s+)?([A-ZÁÉÍÓÚÑ][\wáéíóúñ]+(?:\s+(?:de\s+|del\s+|la\s+|las\s+|los\s+)?[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+){0,3})/

/** "Mayling Cc", "Highland Park Country", "Mayling Club de Campo": el nombre va antes de la sigla. */
const COMMUNITY_SUFFIX_RE =
  /([A-ZÁÉÍÓÚÑ][\wáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+){0,2})\s+(?:Cc|C\.C\.?|Country(?:\s+Club)?|Club\s+de\s+Campo)\b/

/** Palabras de título que el patrón puede arrastrar como si fueran parte del nombre. */
const TITLE_WORDS = new Set([
  'casa', 'venta', 'lote', 'terreno', 'departamento', 'excelente', 'hermosa', 'gran',
  'propiedad', 'oportunidad', 'impecable', 'moderna', 'en', 'el', 'la',
])

function cleanCommunityName(raw: string): string | undefined {
  const words = raw.trim().split(/\s+/)
  while (words.length && TITLE_WORDS.has(words[0].toLowerCase())) words.shift()
  const name = words.join(' ')
  return name.length >= 3 ? name : undefined
}

export function detectCommunity(text: string): string | undefined {
  const suffix = text.match(COMMUNITY_SUFFIX_RE)
  if (suffix) {
    const name = cleanCommunityName(suffix[1])
    if (name) return name
  }
  const prefix = text.match(COMMUNITY_RE)
  return prefix ? cleanCommunityName(prefix[1]) : undefined
}

function detectCondition(text: string): PropertyCondition | undefined {
  const t = norm(text)
  if (/a estrenar|estreno/.test(t)) return 'new'
  if (/a refaccionar|para refaccionar|a reciclar|para reciclar|a renovar/.test(t)) return 'to_renovate'
  if (/excelente estado|impecable|totalmente (refaccionad|renovad)/.test(t)) return 'excellent'
  if (/muy buen estado|buen estado/.test(t)) return 'good'
  if (/a actualizar|necesita (mantenimiento|arreglos)/.test(t)) return 'to_refresh'
  return undefined
}

/**
 * Dormitorios mencionados en el texto ("5 dormitorios"). Se usa solo cuando el
 * importador no los devolvió y siempre queda marcado como INFERRED: el texto
 * puede hablar de dormitorios de servicio o "en suite" aparte.
 */
export function detectBedrooms(text: string): number | undefined {
  const m = norm(text).match(/\b(\d{1,2}) (?:dormitorios?|habitaciones|cuartos)\b/)
  const n = m ? Number(m[1]) : NaN
  return isFinite(n) && n > 0 && n <= 20 ? n : undefined
}

function detectAge(text: string): number | undefined {
  const t = norm(text)
  if (/a estrenar/.test(t)) return 0
  const m = t.match(/(\d{1,3}) anos de antiguedad|antiguedad (?:de )?(\d{1,3}) anos/)
  const v = m ? Number(m[1] ?? m[2]) : NaN
  return isFinite(v) ? v : undefined
}

const AMENITY_PATTERNS: [RegExp, string][] = [
  [/pileta|piscina/, 'pileta'], [/quincho/, 'quincho'], [/parrilla/, 'parrilla'],
  [/jardin|parque/, 'jardín'], [/escritorio|oficina/, 'escritorio'],
  [/cochera|garage|garaje/, 'cochera'], [/seguridad/, 'seguridad'],
  [/gimnasio|gym/, 'gimnasio'], [/sum\b|salon de usos multiples/, 'SUM'],
]

export function detectAmenities(text: string): string[] {
  const t = norm(text)
  return AMENITY_PATTERNS.filter(([re]) => re.test(t)).map(([, name]) => name)
}

// ───────────────────────── Scrape → SubjectProperty ─────────────────────────

function methodOf(m: ScrapeResult['method']): ExtractionMethod {
  return m === 'none' ? 'ai' : m
}

export function subjectFromScrape(scrape: ScrapeResult, now: Date = new Date()): SubjectProperty {
  const d = scrape.data
  const method = methodOf(scrape.method)
  const prov: Provenance = {
    source: scrape.portal ?? 'aviso', method, url: scrape.url, observedAt: now.toISOString(),
  }
  const derivedProv: Provenance = { ...prov, method: 'derived' }

  const text = [d.title, d.description, d.address, ...(d.features ?? [])].filter(Boolean).join(' . ')
  const amenities = detectAmenities(text)
  const community = detectCommunity(text)
  const kind = detectKind(d.propertyType ?? '') ?? detectKind(d.title ?? '')
  const hasPool = amenities.includes('pileta')

  const price = typeof d.price === 'number' && d.price > 0 ? d.price : undefined
  const currency = d.currency === 'ARS' ? 'ARS' : d.currency === 'USD' ? 'USD' : undefined

  return {
    id: scrape.url,
    url: scrape.url,
    source: scrape.portal ?? 'aviso',
    country: 'AR',
    priceProvenance: price ? 'ASKING_PRICE' : 'UNKNOWN',
    photos: scrape.photos,
    fields: {
      title: mk(d.title, prov),
      city: mk(d.city, prov),
      neighborhood: mk(d.neighborhood, prov),
      address: mk(d.address, prov),
      community: mk(community, derivedProv, true),
      kind: mk(kind, d.propertyType ? prov : derivedProv, !d.propertyType),
      price: mk(price, prov),
      // Moneda desconocida no se asume USD: UNKNOWN hasta que el aviso lo diga.
      currency: mk(currency, prov),
      bedrooms: d.bedrooms ? mk(d.bedrooms, prov) : mk(detectBedrooms(text), derivedProv, true),
      bathrooms: mk(d.bathrooms, prov),
      coveredArea: mk(d.coveredM2, prov),
      totalArea: mk(d.totalM2, prov),
      landArea: { value: null, status: 'UNKNOWN' },
      ageYears: mk(detectAge(text), derivedProv, true),
      condition: mk(detectCondition(text), derivedProv, true),
      // Solo afirmamos pileta si el texto la menciona; el silencio queda UNKNOWN.
      pool: hasPool ? mk(true, derivedProv, true) : { value: null, status: 'UNKNOWN' },
      amenities: amenities.length ? mk(amenities, derivedProv, true) : { value: null, status: 'UNKNOWN' },
      expenses: mk(d.expenses, prov),
      description: mk(d.description, prov),
    },
  }
}

// ───────────────────────── SubjectProperty → ListingFacts ─────────────────────────

export function flattenSubject(s: SubjectProperty, now: Date = new Date()): ListingFacts {
  const v = <K extends keyof SubjectProperty['fields']>(k: K) =>
    (s.fields[k]?.value ?? undefined) as NonNullable<SubjectProperty['fields'][K]>['value'] extends infer U ? Exclude<U, null> | undefined : never

  return {
    id: s.id,
    url: s.url,
    source: s.source,
    country: s.country,
    priceProvenance: s.priceProvenance,
    status: 'unknown',
    observedAt: now.toISOString(),
    title: v('title'), city: v('city'), neighborhood: v('neighborhood'),
    microzone: v('microzone'), community: v('community'), communityType: v('communityType'),
    address: v('address'), kind: v('kind'), price: v('price'), currency: v('currency'),
    bedrooms: v('bedrooms'), bathrooms: v('bathrooms'),
    coveredArea: v('coveredArea'), totalArea: v('totalArea'), landArea: v('landArea'),
    parking: v('parking'), ageYears: v('ageYears'), condition: v('condition'),
    pool: v('pool'), amenities: v('amenities'), expenses: v('expenses'),
    orientation: v('orientation'), description: v('description'),
    publishedAt: v('publishedAt'), lastUpdatedAt: v('lastUpdatedAt'), priceChangedAt: v('priceChangedAt'),
  }
}

/** Un aviso que pegó la persona, listo para usarse como comparable. */
export function listingFromScrape(scrape: ScrapeResult, now: Date = new Date()): ListingFacts {
  return flattenSubject(subjectFromScrape(scrape, now), now)
}

/** Adaptador desde el `Comparable` plano que ya usa el resto del producto. */
export function listingFromComparable(c: Comparable, now: Date = new Date()): ListingFacts {
  return {
    id: c.id,
    url: c.url,
    source: c.portal ?? (c.source === 'meli' ? 'MercadoLibre' : 'usuario'),
    title: c.title,
    country: 'AR',
    city: c.city,
    neighborhood: c.neighborhood,
    community: detectCommunity(c.title),
    kind: detectKind(c.title),
    price: c.price,
    currency: c.currency,
    priceProvenance: 'ASKING_PRICE',
    bedrooms: c.bedrooms,
    // El comparable plano no distingue cubierta de total: va como total.
    totalArea: c.surface,
    status: 'unknown',
    observedAt: now.toISOString(),
  }
}

// ───────────────────────── Datos confirmados por la persona ─────────────────────────

export interface UserOverrides {
  price?: number
  currency?: 'USD' | 'ARS'
  bedrooms?: number
  bathrooms?: number
  coveredArea?: number
  totalArea?: number
  landArea?: number
  ageYears?: number
  expenses?: number
  condition?: PropertyCondition
}

/** "LA SÉ": lo que la persona confirma pasa a CONFIRMED, con procedencia "usuario". */
export function applyUserOverrides(
  s: SubjectProperty,
  overrides: UserOverrides,
  now: Date = new Date(),
): SubjectProperty {
  const prov: Provenance = { source: 'usuario', method: 'user', observedAt: now.toISOString() }
  const fields: Record<string, unknown> = { ...s.fields }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) continue
    fields[key] = { value, status: 'CONFIRMED', provenance: prov, confidence: 1 } satisfies Field<unknown>
  }
  const typed = fields as SubjectProperty['fields']
  return { ...s, fields: typed, priceProvenance: typed.price?.value ? 'ASKING_PRICE' : s.priceProvenance }
}

// ───────────────────────── Calidad de extracción ─────────────────────────

const KEY_FIELDS: { key: keyof SubjectProperty['fields']; label: string; anyOf?: (keyof SubjectProperty['fields'])[] }[] = [
  { key: 'price', label: 'precio' },
  { key: 'kind', label: 'tipo de propiedad' },
  { key: 'neighborhood', label: 'ubicación', anyOf: ['neighborhood', 'city'] },
  { key: 'bedrooms', label: 'dormitorios' },
  { key: 'coveredArea', label: 'superficie cubierta' },
  { key: 'bathrooms', label: 'baños' },
  { key: 'ageYears', label: 'antigüedad' },
  { key: 'condition', label: 'estado de conservación' },
]

export function evaluateExtraction(s: SubjectProperty): ExtractionQuality {
  const present: string[] = []
  const missing: string[] = []
  for (const k of KEY_FIELDS) {
    const keys = k.anyOf ?? [k.key]
    const has = keys.some(key => s.fields[key]?.value != null)
    ;(has ? present : missing).push(k.label)
  }

  const methods = Object.values(s.fields)
    .map(f => f?.provenance?.method)
    .filter((m): m is ExtractionMethod => !!m && m !== 'derived')
  const counts = new Map<ExtractionMethod, number>()
  methods.forEach(m => counts.set(m, (counts.get(m) ?? 0) + 1))
  const method = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'none'

  const warnings: string[] = []
  if (s.fields.price?.value != null && s.fields.currency?.value == null) {
    warnings.push('El aviso no aclara la moneda del precio.')
  }
  if (method === 'ai' || method === 'paste') {
    warnings.push('Los datos fueron leídos del texto del aviso: conviene verificarlos.')
  }

  return {
    completeness: Math.round((present.length / KEY_FIELDS.length) * 100) / 100,
    present, missing, method, warnings,
  }
}
