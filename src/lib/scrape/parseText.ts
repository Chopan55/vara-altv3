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
  const usd = /(?:USD|U\$S|US\$|u\$d|U\$D|d[oó]lares)[ \t]*([\d][\d.,]*)|([\d][\d.,]*)[ \t]*(?:USD|d[oó]lares)\b/gi
  const local = mx
    ? /(?:MXN|MN|\$)[ \t]*([\d][\d.,]*)[ \t]*(?:MXN|MN|pesos)?|([\d][\d.,]*)[ \t]*(?:MXN|pesos)\b/gi
    : /(?:ARS|\$)[ \t]*([\d][\d.,]*)|([\d][\d.,]*)[ \t]*(?:ARS|pesos)\b/gi
  const push = (m: RegExpExecArray, currency: Cur) => {
    const amount = parseAmount(m[1] ?? m[2] ?? '')
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

  // Superficies.
  for (const m of text.matchAll(/([\d][\d.,]*)\s*m(?:²|2|ts2|t2|ts\.?\s?2)?\s*(?:²)?\s*(totales|total|cubiertos?|cubierta|construid[oa]s?|de construcci[oó]n|de terreno|terreno)?/gi)) {
    if (!/m(?:²|2|ts|t)/i.test(m[0])) continue
    const n = parseAmount(m[1])
    if (!n || n < 10 || n > 100_000) continue
    const label = (m[2] ?? '').toLowerCase()
    if (/cubiert|construid|construcci/.test(label)) data.coveredM2 ??= n
    else if (/terreno/.test(label)) continue
    else data.totalM2 ??= n
  }

  data.rooms = firstInt(text, /(\d{1,2})\s*amb(?:ientes?|\.|\b)/i)
  data.bedrooms = firstInt(text, /(\d{1,2})\s*(?:dormitorios?|dorm\.?|habitaciones|rec[aá]maras?)\b/i)
  data.bathrooms = firstInt(text, /(\d{1,2})\s*baños?\b/i)

  // Título: la primera línea con texto que no sea solo un precio.
  const firstLine = text.split('\n')
    .map(l => l.trim().replace(/^(?:title|t[ií]tulo)\s*:\s*/i, '').replace(/^#+\s*/, ''))
    .find(l => l.length >= 8 && l.length <= 140 && /[a-záéíóúñ]{3}/i.test(l) &&
      !/^(?:url|https?:)/i.test(l) && !/^(?:USD|U\$S|US\$|MXN|ARS|\$)[ \t]*\d/i.test(l))
  if (firstLine) data.title = firstLine
  data.description = text.trim().slice(0, 1500)

  for (const k of Object.keys(data) as (keyof ScrapedData)[]) if (data[k] === undefined) delete data[k]
  return data
}
