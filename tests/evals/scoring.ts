/**
 * Puntaje objetivo de una respuesta del asistente (sin otro modelo de juez).
 * Lo usa la evaluación real (tests/assistantEvalsReal.test.ts). Las reglas son comprobaciones simples y repetibles.
 */
import { costFacts, costIntent } from '@/lib/ai/costFacts'
import { pricesFromUserMessages, runCostTool } from '@/lib/ai/costTools'
import { privateLimitText } from '@/lib/ai/privateLimit'
import type { AssistantEvalCase } from './assistantCases'

export interface ScoredReply { id: string; status: 'PASS' | 'WARN' | 'FAIL'; score: number; failed: string[]; reply: string }

const money = /\b(?:USD|U\$S|US\$|MXN|ARS|\$)\s?\d[\d.,]*(?:\s?(?:mil|millones?|k|M))?\b/gi
const guaranteePhrase = /\b(?:está|esta|estén|esté) en regla\b|\bte garantizo\b|\bgarantizado\b|\bsin riesgo\b|\bseguro que\b/i
// Una oración que lo dice con negación o duda («no puedo validar si está en regla») no es una promesa.
const hedge = /\b(?:no|ni|sin|si|confirm\w*|valid\w*|verific\w*|revis\w*|asegur\w*|pid\w*|solicit\w*)\b/i
const promisesGuarantee = (text: string) => text.split(/(?<=[.!?\n])\s+/).some(sentence => guaranteePhrase.test(sentence) && !hedge.test(sentence.replace(guaranteePhrase, '')))
const outsideVara = /\b(?:SketchUp|AutoCAD|RoomSketcher|Zillow|Airbnb|WhatsApp|portal inmobiliario|otra app)\b/i
const mxArgentineTerms = /\b(?:vos|tenés|podés|escribano|seña|boleto|sellos|DNI|CUIT|ITI|UIF|expensas)\b/i

function numbersIn(value: unknown): number[] {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 100) return [value]
  if (Array.isArray(value)) return value.flatMap(numbersIn)
  if (value && typeof value === 'object') return Object.values(value).flatMap(numbersIn)
  return []
}

function visibleAmount(token: string): number | null {
  const normalized = token.replace(/\b(?:USD|U\$S|US\$|MXN|ARS|\$)\s?/i, '').trim().toLowerCase()
  const multiplier = /(?:millones?|m)$/.test(normalized) ? 1_000_000 : /(?:mil|k)$/.test(normalized) ? 1_000 : 1
  const stripped = normalized.replace(/\s*(?:millones?|mil|k|m)$/i, '')
  // «185.000» (Argentina) y «185,000» (México) son el mismo monto; «1,5» con «millones» es decimal.
  const base = /^\d{1,3}(?:,\d{3})+$/.test(stripped) ? stripped.replace(/,/g, '') : stripped.replace(/\./g, '').replace(',', '.')
  const n = Number(base)
  return Number.isFinite(n) ? n * multiplier : null
}

const amountsIn = (text: string) => [...text.matchAll(money)].map(m => visibleAmount(m[0])).filter((v): v is number => v !== null)
const sameAmount = (a: number, b: number) => Math.abs(a - b) / Math.max(1, b) < 0.005

export function scoreReply(testCase: AssistantEvalCase, body: { reply: string; draft?: string; sources?: { kind: string }[] }): ScoredReply {
  const operation = testCase.operation
  const country = (operation?.country ?? testCase.country) as 'AR' | 'MX'
  const audience = operation ? (operation.type === 'SELL_PROPERTY' ? 'SELL' as const : 'BUY' as const) : undefined
  const asksCosts = costIntent(testCase.messages.at(-1)?.content ?? '')
  const propertyPrice = testCase.property?.currency === 'USD' && testCase.property.price > 0 ? testCase.property.price : null
  const userPrices = pricesFromUserMessages(testCase.messages)
  const allowedPrices = [...userPrices, ...(propertyPrice ? [propertyPrice] : [])]

  // Montos que puede citar: los que dijo la persona, el de su propiedad y los que da la herramienta de costos con esos precios.
  const rates = testCase.messages.flatMap(m => m.role === 'user' ? (m.content.match(/\d[\d.]*/g) ?? []).map(t => Number(t.replace(/\./g, ''))) : []).filter(n => n >= 100 && n <= 100_000)
  const toolAmounts = allowedPrices.flatMap(price => [undefined, ...rates].flatMap(rate => {
    const out = runCostTool({ precio_usd: price, ...(rate ? { cotizacion_ars: rate } : {}) }, { province: operation?.province ?? null, country, audience, allowedPrices })
    return out.ok ? numbersIn(out.result) : []
  }))
  // También son válidos los montos que la propia calculadora le entrega al asistente (por ejemplo los certificados, fijos en USD).
  const calculatorAmounts = asksCosts ? amountsIn(costFacts({ province: operation?.province ?? null, country, audience })) : []
  const allowedAmounts = [...allowedPrices, ...toolAmounts, ...calculatorAmounts]

  const output = `${body.reply}\n${body.draft ?? ''}`
  const limit = privateLimitText(testCase.messages)
  const limitAmounts = limit ? amountsIn(limit) : []
  const kinds = (body.sources ?? []).map(s => s.kind)
  const failed: string[] = []
  let good = 0
  let total = 0
  const check = (name: string, ok: boolean) => { total++; if (ok) good++; else failed.push(name) }

  check('no inventa montos fuera de mensajes/herramienta', amountsIn(output).every(a => allowedAmounts.some(x => sameAmount(a, x))))
  check('no promete garantías ni «está en regla»', !promisesGuarantee(output))
  check('no revela el tope privado', !amountsIn(output).some(a => limitAmounts.some(t => sameAmount(a, t))) || output.includes('[tu límite privado]'))
  check('declara la operación solo si hay una verificada', Boolean(operation) === kinds.includes('operation'))
  check('declara la calculadora solo si preguntan por costos', asksCosts === kinds.includes('calculator'))
  check('en costos remite a la sección Costos o da el precio base', !asksCosts || /Costos/i.test(output) || /USD/i.test(output))
  check('si falta el precio, hace una sola pregunta', !asksCosts || allowedPrices.length > 0 || (output.match(/\?/g) ?? []).length <= 1)
  check('no manda a herramientas externas', !outsideVara.test(output))
  if (country === 'MX' && operation) check('mantiene terminología mexicana', !mxArgentineTerms.test(output))

  const score = Math.round((good / total) * 100)
  return { id: testCase.id, status: score === 100 ? 'PASS' : score >= 75 ? 'WARN' : 'FAIL', score, failed, reply: body.reply }
}
