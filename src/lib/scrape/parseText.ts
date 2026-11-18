/**
 * Lectura de un aviso pegado como texto, SIN inteligencia artificial.
 *
 * Es la red de seguridad cuando un portal bloquea la lectura automática y la
 * persona no tiene acceso a la lectura con IA: saca lo que se puede leer con
 * reglas (precio y moneda, m², ambientes, dormitorios, baños, expensas o cuota
 * de mantenimiento). Lo que no encuentra queda vacío: nunca adivina.
 */

import type { ScrapedData } from '@/app/api/scrape-property/route'

/** "185.000" → 185000 · "4,500,000" → 4500000 · "1.234,56" → 1234.56 · "95,5" → 95.5 */
export function parseAmount(raw: string): number | undefined {
  const s = raw.replace(/[^\d.,]/g, '')
  if (!s || !/\d/.test(s)) return undefined
  let n: number
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) {
    n = Number(s.replace(/[.,]/g, ''))
  } else if (s.includes('.') && s.includes(',')) {
    n = s.lastIndexOf(',') > s.lastIndexOf('.')
      ? Number(s.replace(/\./g, '').replace(',', '.'))
      : Number(s.replace(/,/g, ''))
  } else {
    n = Number(s.replace(',', '.'))
  }
  return Number.isFinite(n) && n > 0 ? n : undefined
}

type Cur = 'USD' | 'ARS' | 'MXN'

interface Money { amount: number; currency: Cur; index: number; expense: boolean }

const EXPENSE_HINT = /(expensas|mantenimiento|cuota|administraci[oó]n|abl|tasas|impuestos?)[^\d\n]{0,25}$/i

function findMoney(text: string, mx: boolean): Money[] {
  const out: Money[] = []
  // Moneda y monto en la misma línea: "[ \t]" y no "\s", para no pegar un número de la línea de arriba.
  const usd = /(?:USD|U\$S|US\$|u\$d|U\$D|d[oó]lares)[ \t]*([\d][\d.,]*)|([\d][\d.,]*)[ \t]*(?:USD|d[oó]lares)\b|(?:USD|U\$S|US\$)[ \t]*\r?\n[ \t]*([\d][\d.,]*)[ \t]*(?:\r?\n|$)/gi
  const local = mx
    ? /(?:MXN|MN|\$)[ \t]*([\d][\d.,]*)[ \t]*(?:MXN|MN|pesos)?|([\d][\d.,]*)[ \t]*(?:MXN|pesos)\b/gi
    : /(?:ARS|\$)[ \t]*([\d][\d.,]*)|([\d][\d.,]*)[ \t]*(?:ARS|pesos)\b/gi
  const push = (m: RegExpExecArray, currency: Cur) => {
    const amount = parseAmount(m[1] ?? m[2] ?? m[3] ?? '')
    if (!amount) return
    if (out.some(x => x.index === m.index)) return
    const before = text.slice(Math.max(0, m.index - 40), m.index)
    out.push({ amount, currency, index: m.index, expense: EXPENSE_HINT.test(before) })
  }
  for (const m of text.matchAll(usd)) push(m as RegExpExecArray, 'USD')
  for (const m of text.matchAll(local)) {
    // "US$ 185.000" ya se contó como USD: el "$" de adentro no es un precio en pesos.
    const prev = text.slice(Math.max(0, (m.index ?? 0) - 3), m.index)
    if (/(?:U|US|U\$)$/i.test(prev)) continue
    push(m as RegExpExecArray, mx ? 'MXN' : 'ARS')
  }
  return out.sort((a, b) => a.index - b.index)
}

const MIN_PRICE: Record<Cur, number> = { USD: 5_000, ARS: 1_000_000, MXN: 100_000 }

function firstInt(text: string, re: RegExp): number | undefined {
  const m = text.match(re)
  if (!m) return undefined
  const n = Number(m[1])
  return Number.isInteger(n) && n > 0 && n < 100 ? n : undefined
}

type SurfaceKind = 'total' | 'covered' | 'lot'
export interface FoundSurface { kind: SurfaceKind; m2: number; raw: string }

const AREA_UNIT = '(m²|m2|mts2?|mts|metros|ha|has|hect[aá]reas?)'

function toM2(n: number, unit: string): number {
  return /^h/i.test(unit) ? n * 10_000 : n
}

function kindOf(label: string): SurfaceKind {
  const l = label.toLowerCase()
  if (/cubiert|construid|construcci/.test(l)) return 'covered'
  if (/terreno|lote/.test(l)) return 'lot'
  return 'total'
}

/** Todas las superficies que el texto declara, con su unidad ya convertida a m². Sin filtrar valores raros. */
export function findSurfaces(text: string): FoundSurface[] {
  const out: FoundSurface[] = []
  const add = (rawNum: string, unit: string, label: string, raw: string) => {
    const n = parseAmount(rawNum)
    if (!n) return
    const m2 = toM2(n, unit)
    if (m2 < 10 || m2 > 1e10) return
    out.push({ kind: kindOf(label), m2, raw: raw.trim() })
  }
  // "Superficie total\n108 ha" · "Superficie cubierta: 120 m²" · "Superficie de terreno 1.066 m²"
  const labelled = new RegExp(`superficie\\s+(total|cubierta|construida|de[l]?\\s+terreno|de[l]?\\s+lote|terreno|lote)[ \\t]*[:\\n]?[ \\t]*([\\d][\\d.,]*)[ \\t]*${AREA_UNIT}`, 'gi')
  for (const m of text.matchAll(labelled)) add(m[2], m[3], m[1], m[0])
  // "250 m² totales" · "108 ha totales" · "180 m² cubiertos" · "1066 m² de terreno"
  const inline = new RegExp(`([\\d][\\d.,]*)[ \\t]*${AREA_UNIT}\\.?[ \\t]*(?:²)?[ \\t]*(totales|total|cubiertos?|cubierta|construid[oa]s?|de construcci[oó]n|de terreno|de lote|terreno|lote)?`, 'gi')
  for (const m of text.matchAll(inline)) {
    if (/^(?:metros)$/i.test(m[2]) && !m[3]) continue
    add(m[1], m[2], m[3] ?? '', m[0])
  }
  return out
}

export function parseListingText(raw: string, opts: { mx?: boolean } = {}): ScrapedData {
  const mx = !!opts.mx
  const text = raw.replace(/ /g, ' ').slice(0, 20_000)
  const data: ScrapedData = {}

  // Precio: el primer monto que no es expensas ni cuota, con el piso de cada moneda.
  // En dólares se prefiere USD; si no hay, la moneda local.
  const money = findMoney(text, mx)
  const prices = money.filter(m => !m.expense && m.amount >= MIN_PRICE[m.currency])
  const price = prices.find(m => m.currency === 'USD') ?? prices[0]
  if (price) { data.price = price.amount; data.currency = price.currency }
  const expense = money.find(m => m.expense && m.currency !== 'USD')
  if (expense) data.expenses = expense.amount

  // Superficies. Se leen en m² (las hectáreas se convierten) y SIN descartar las absurdas: eso lo decide
  // `reviewSurfaces`, que las aparta y avisa en vez de callar. Un aviso real de MercadoLibre trajo
  // "108 ha totales" y "1.080.000 m² cubiertos" para una casa en un lote de 1.066 m².
  for (const s of findSurfaces(text)) {
    if (s.kind === 'covered') data.coveredM2 ??= s.m2
    else if (s.kind === 'lot') data.lotM2 ??= s.m2
    else data.totalM2 ??= s.m2
  }

  data.rooms = firstInt(text, /(\d{1,2})\s*amb(?:ientes?|\.|\b)/i) ?? firstInt(text, /^[ \t]*ambientes?[ \t]*[:\n][ \t]*(\d{1,2})\b/im)
  data.bedrooms = firstInt(text, /(\d{1,2})\s*(?:dormitorios?|dorm\.?|habitaciones|rec[aá]maras?)\b/i) ?? firstInt(text, /^[ \t]*(?:dormitorios?|habitaciones|rec[aá]maras?)[ \t]*[:\n][ \t]*(\d{1,2})\b/im)
  data.bathrooms = firstInt(text, /(\d{1,2})\s*baños?\b/i) ?? firstInt(text, /^[ \t]*baños?[ \t]*[:\n][ \t]*(\d{1,2})\b/im)

  // Título: la primera línea con texto que no sea solo un precio.
  const firstLine = text.split('\n')
    .map(l => l.trim().replace(/^(?:title|t[ií]tulo)\s*:\s*/i, '').replace(/^#+\s*/, ''))
    .find(l => l.length >= 8 && l.length <= 140 && /[a-záéíóúñ]{3}/i.test(l) &&
      !/^(?:url|https?:)/i.test(l) && !/publicado\s+hace|^(?:casa|departamento|ph|terreno|lote|local|oficina)\s+en\s+(?:venta|alquiler)\s*\|/i.test(l) && !/^(?:USD|U\$S|US\$|MXN|ARS|\$)[ \t]*\d/i.test(l))
  if (firstLine) data.title = firstLine
  data.description = text.trim().slice(0, 1500)

  for (const k of Object.keys(data) as (keyof ScrapedData)[]) if (data[k] === undefined) delete data[k]
  return data
}
