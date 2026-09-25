/**
 * Comparables de mercado.
 *
 * Qué es esto y qué NO es.
 *
 * Es: un puñado de avisos publicados hoy, parecidos al tuyo, con su precio
 * por m². Sirve para saber si estás pidiendo mucho o poco **respecto de lo
 * que se publica**.
 *
 * No es: una tasación. Y la diferencia importa mucho más de lo que parece:
 *
 *  - Un aviso muestra el precio **pedido**, no el precio al que se vendió.
 *    En Argentina la brecha entre uno y otro es real y a veces grande.
 *  - No sabemos hace cuánto está publicado cada aviso. Uno que lleva ocho
 *    meses sin venderse dice algo muy distinto de uno de ayer, y esa
 *    información no está.
 *  - Dos casas del mismo barrio y los mismos metros pueden valer distinto
 *    por estado, orientación o frente.
 *
 * Por eso este módulo no devuelve nunca "tu casa vale X". Devuelve dónde cae
 * tu precio dentro de lo publicado, y lo dice con esas palabras.
 */

/**
 * De dónde salió el aviso.
 *
 * Importa mostrarlo: MeLi lo buscamos nosotros, y los demás portales los
 * traés vos pegando el link porque bloquean la lectura automática. Un
 * comparable que elegiste vos suele ser MÁS relevante que uno que encontró
 * una búsqueda, no menos — por eso se muestran juntos y no separados en
 * "los buenos" y "los otros".
 */
export type ComparableSource = 'meli' | 'manual'

export interface Comparable {
  id: string
  source: ComparableSource
  /** Portal de origen cuando lo pegó el usuario: "zonaprop", "argenprop". */
  portal?: string
  title: string
  price: number
  currency: 'USD' | 'ARS'
  /** Superficie total en m². Ausente si el aviso no la declara. */
  surface?: number
  neighborhood?: string
  city?: string
  rooms?: number
  bedrooms?: number
  url: string
  /** Precio por m². Solo cuando hay precio y superficie. */
  pricePerM2?: number
}

/**
 * Menos que esto no es un mercado, es anécdota.
 *
 * Con tres avisos cualquier outlier mueve la mediana entera. Preferimos decir
 * "no alcanza para comparar" antes que dar un rango que suene autorizado y
 * no lo sea.
 */
export const MIN_COMPARABLES = 5

// ─────────────────────── Normalización desde MeLi ───────────────────────

interface MeliAttribute {
  id?: string
  value_struct?: { number?: number; unit?: string } | null
  value_name?: string | null
}

export interface MeliItem {
  id?: string
  title?: string
  price?: number
  currency_id?: string
  permalink?: string
  attributes?: MeliAttribute[]
  address?: { neighborhood?: string | null; city_name?: string | null } | null
}

/**
 * El id de un aviso a partir de su link.
 *
 * MeLi cerró su búsqueda (403 con cualquier token de aplicación) pero dejó
 * abierta la lectura de un aviso puntual — medido: `/items/{id}` devuelve 404
 * "not found", no 403. Así que el camino es el mismo que con Zonaprop: la
 * persona pega el link. La diferencia es que acá leemos la API oficial en vez
 * de scrapear HTML, y los datos vienen limpios.
 *
 * Los permalinks vienen como ".../MLA-862376292-casa-en-pilar-_JM".
 */
export function meliItemIdFromUrl(url: string): string | null {
  if (!/mercadolibre\.com/i.test(url)) return null
  const m = url.match(/MLA-?(\d{6,})/i)
  return m ? `MLA${m[1]}` : null
}

function numericAttribute(item: MeliItem, ids: string[]): number | undefined {
  for (const attr of item.attributes ?? []) {
    if (!attr.id || !ids.includes(attr.id)) continue

    const n = attr.value_struct?.number
    if (typeof n === 'number' && isFinite(n) && n > 0) return n

    // Algunos avisos traen el número solo como texto: "120 m²".
    const parsed = parseFloat((attr.value_name ?? '').replace(',', '.'))
    if (isFinite(parsed) && parsed > 0) return parsed
  }
  return undefined
}

/**
 * Convierte un item de MeLi en un comparable.
 *
 * Devuelve `null` cuando falta lo mínimo para comparar. Un aviso sin precio o
 * sin superficie no es un comparable a medias: no es un comparable.
 */
export function fromMeliItem(item: MeliItem): Comparable | null {
  const price = item.price
  if (typeof price !== 'number' || !isFinite(price) || price <= 0) return null
  if (!item.id || !item.permalink) return null

  const currency: 'USD' | 'ARS' = item.currency_id === 'ARS' ? 'ARS' : 'USD'
  const surface = numericAttribute(item, ['TOTAL_AREA', 'COVERED_AREA'])
  const rooms = numericAttribute(item, ['ROOMS'])
  const bedrooms = numericAttribute(item, ['BEDROOMS'])

  return {
    id: item.id,
    source: 'meli',
    title: item.title ?? 'Aviso sin título',
    price,
    currency,
    surface,
    rooms,
    bedrooms,
    neighborhood: item.address?.neighborhood ?? undefined,
    city: item.address?.city_name ?? undefined,
    url: item.permalink,
    pricePerM2: surface && surface > 0 ? Math.round(price / surface) : undefined,
  }
}

// ─────────── Avisos que pega el usuario (Zonaprop, Argenprop…) ───────────

/**
 * Esos portales bloquean la búsqueda automática, así que no hay forma de
 * traer comparables de ahí por nuestra cuenta. Lo que sí funciona es leer un
 * aviso puntual cuando la persona pega el link — y si el portal también
 * bloquea eso, pegando el texto.
 *
 * No es una limitación que haya que esconder: un aviso que eligió el usuario
 * suele ser mejor comparable que uno que encontró una búsqueda por palabras.
 */
export interface ScrapedListing {
  url: string
  portal?: string | null
  data?: {
    title?: string
    price?: number
    currency?: string
    totalM2?: number
    coveredM2?: number
    rooms?: number
    bedrooms?: number
    neighborhood?: string
    city?: string
  }
}

export function fromScrapedListing(listing: ScrapedListing): Comparable | null {
  const d = listing.data ?? {}
  const price = d.price
  if (typeof price !== 'number' || !isFinite(price) || price <= 0) return null
  if (!listing.url) return null

  const surface = d.totalM2 && d.totalM2 > 0 ? d.totalM2
    : d.coveredM2 && d.coveredM2 > 0 ? d.coveredM2
    : undefined

  return {
    id: listing.url,
    source: 'manual',
    portal: listing.portal ?? undefined,
    title: d.title || 'Aviso sin título',
    price,
    currency: d.currency === 'ARS' ? 'ARS' : 'USD',
    surface,
    rooms: d.rooms,
    bedrooms: d.bedrooms,
    neighborhood: d.neighborhood,
    city: d.city,
    url: listing.url,
    pricePerM2: surface ? Math.round(price / surface) : undefined,
  }
}

// ─────────────────────── Análisis ───────────────────────

export type MarketVerdict =
  | 'NOT_ENOUGH_DATA'
  | 'BELOW'
  | 'WITHIN'
  | 'ABOVE'

export interface MarketPosition {
  verdict: MarketVerdict
  /** Cuántos avisos comparables se usaron. */
  sampleSize: number
  /** Precio por m² de la propiedad del usuario. */
  yourPricePerM2?: number
  /** Mediana del mercado. La mediana y no el promedio: un outlier no la mueve. */
  medianPricePerM2?: number
  minPricePerM2?: number
  maxPricePerM2?: number
  /** Diferencia porcentual contra la mediana, a un decimal. */
  differencePercent?: number
  /** Una línea lista para mostrar. Siempre dice de qué está hablando. */
  label: string
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid]
}

/**
 * Dónde cae tu precio dentro de lo publicado.
 *
 * "Dentro del rango" es ±10% de la mediana. No es una constante sagrada:
 * es un margen que reconoce que dos propiedades parecidas nunca son iguales,
 * y que fingir precisión al 1% sobre precios pedidos sería falso.
 */
export const WITHIN_RANGE_TOLERANCE = 0.1

export function analyzeMarketPosition(
  yourPrice: number,
  yourSurface: number,
  comparables: Comparable[],
  currency: 'USD' | 'ARS' = 'USD',
): MarketPosition {
  // Solo comparan los del mismo signo monetario y con precio por m².
  const usable = comparables
    .filter(c => c.currency === currency && typeof c.pricePerM2 === 'number')
    .map(c => c.pricePerM2 as number)

  if (usable.length < MIN_COMPARABLES) {
    return {
      verdict: 'NOT_ENOUGH_DATA',
      sampleSize: usable.length,
      label: usable.length === 0
        ? 'No encontramos avisos parecidos para comparar.'
        : `Solo ${usable.length} aviso${usable.length > 1 ? 's' : ''} parecido${usable.length > 1 ? 's' : ''}: muy poco para hablar de mercado.`,
    }
  }

  if (!(yourPrice > 0) || !(yourSurface > 0)) {
    return {
      verdict: 'NOT_ENOUGH_DATA',
      sampleSize: usable.length,
      medianPricePerM2: Math.round(median(usable)),
      minPricePerM2: Math.min(...usable),
      maxPricePerM2: Math.max(...usable),
      label: 'Falta el precio o la superficie de tu propiedad para poder compararla.',
    }
  }

  const yours = Math.round(yourPrice / yourSurface)
  const med = Math.round(median(usable))
  const diff = Math.round(((yours - med) / med) * 1000) / 10

  const verdict: MarketVerdict =
    Math.abs(diff) <= WITHIN_RANGE_TOLERANCE * 100 ? 'WITHIN'
    : diff < 0 ? 'BELOW'
    : 'ABOVE'

  const label =
    verdict === 'WITHIN'
      ? `En línea con lo publicado: ${currency} ${yours.toLocaleString('es-AR')}/m² contra una mediana de ${currency} ${med.toLocaleString('es-AR')}/m².`
      : verdict === 'BELOW'
        ? `${Math.abs(diff)}% por debajo de lo que se publica en la zona.`
        : `${diff}% por encima de lo que se publica en la zona.`

  return {
    verdict,
    sampleSize: usable.length,
    yourPricePerM2: yours,
    medianPricePerM2: med,
    minPricePerM2: Math.min(...usable),
    maxPricePerM2: Math.max(...usable),
    differencePercent: diff,
    label,
  }
}

/**
 * La advertencia que acompaña siempre al resultado.
 *
 * No es letra chica legal: es la diferencia entre usar bien y usar mal este
 * número, y por eso se muestra junto al dato y no escondida abajo.
 */
export const MARKET_CAVEAT =
  'Son precios pedidos en avisos publicados, no precios de venta. No sabemos ' +
  'hace cuánto está publicado cada uno ni en qué estado está la propiedad.'
