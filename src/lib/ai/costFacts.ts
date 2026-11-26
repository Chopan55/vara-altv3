/**
 * Costos de escrituración para el asistente.
 *
 * Cuando alguien pregunta por costos, el modelo NO los recuerda de memoria (inventaba porcentajes):
 * se le entregan los valores que calcula la misma función que usa la pantalla de Costos
 * (`generateChecklist`), con su jurisdicción, nivel de confianza y fecha de actualización.
 * Son proporciones sobre el precio, salvo los certificados, que son un monto fijo en USD.
 */
import { generateChecklist, resolveProvinceCode } from '@/lib/regulations'
import type { CountryCode } from '@/types'

/** Preguntas que tocan costos, impuestos o gastos de la operación. */
const COST_INTENT = /\b(cost[oa]s?|gast[oa]s?|sell[oa]s?|sellad[oa]|escriban[oa-z]*|notari[oa-z]*|honorari[oa-z]*|registro de la propiedad|isai|escritur[a-z]*|impuesto[s]?|cu[aá]nto (?:sale|cuesta|cuestan|pago|se paga))\b/i

export function costIntent(text: string): boolean {
  return COST_INTENT.test(text)
}

/** Provincia o estado que figura en el contexto de pantalla («Recorrido: compra · Provincia: Córdoba»). */
export function provinceFromContext(context: unknown): string | null {
  if (typeof context !== 'string') return null
  const match = /Provincia:\s*([^·\n]+)/i.exec(context)
  return match ? match[1].trim().slice(0, 60) || null : null
}

const REFERENCE_PRICE_USD = 100_000

const pct = (amount: number) => (amount / REFERENCE_PRICE_USD) * 100
const fmt = (n: number) => n.toFixed(2).replace(/\.?0+$/, '').replace('.', ',')
const range = (min: number, max: number, unit: string) =>
  Math.abs(max - min) < 0.005 ? `${fmt(min)}${unit}` : `${fmt(min)}${unit} a ${fmt(max)}${unit}`

export interface CostSource { jurisdiction: string; confidence: string; updatedAt: string }

export function costFacts(opts: { province: string | null; country: CountryCode; audience?: 'BUY' | 'SELL' | 'BOTH' }): string {
  return costFactsWithSource(opts).text
}

export function costFactsWithSource(opts: { province: string | null; country: CountryCode; audience?: 'BUY' | 'SELL' | 'BOTH' }): { text: string; source: CostSource } {
  const { province, country, audience } = opts
  const code = province ? resolveProvinceCode(province, country) : resolveProvinceCode('', country)
  const checklist = generateChecklist(code, 'BUY_PROPERTY', REFERENCE_PRICE_USD, country)
  const c = checklist.costs
  const mx = country === 'MX'
  const notary = mx ? 'notario' : 'escribano'

  const buyer = [
    `Comprador (sobre el precio de la propiedad): ${mx ? 'ISAI' : 'sellos'} ${range(pct(c.stampTaxBuyer.minAmount), pct(c.stampTaxBuyer.maxAmount), '%')}; honorarios del ${notary} ${range(pct(c.notaryFeeBuyer.minAmount), pct(c.notaryFeeBuyer.maxAmount), '%')}; inscripción en el registro ${range(pct(c.registryFee.minAmount), pct(c.registryFee.maxAmount), '%')}; certificados y gestiones: monto fijo de USD ${Math.round(c.certificates.minAmount)} a ${Math.round(c.certificates.maxAmount)}. Total aproximado del comprador: ${range(c.totalBuyer.percentMin, c.totalBuyer.percentMax, '%')} del precio (con certificados incluidos para un precio de USD 100.000).`,
  ]
  const seller = [
    `Vendedor (sobre el precio de la propiedad): ${mx ? 'ISAI' : 'sellos'} ${range(pct(c.stampTaxSeller.minAmount), pct(c.stampTaxSeller.maxAmount), '%')}; honorarios del ${notary} ${range(pct(c.notaryFeeSeller.minAmount), pct(c.notaryFeeSeller.maxAmount), '%')}. Total aproximado del vendedor: ${range(c.totalSeller.percentMin, c.totalSeller.percentMax, '%')} del precio.`,
  ]

  const text = [
    'CALCULADORA DE VARA (los únicos valores que podés usar para costos de escrituración):',
    `Jurisdicción usada: ${checklist.provinceName}${province ? '' : ' (no se informó la provincia: se usó la jurisdicción por defecto, avisalo)'}.`,
    `Confianza de los datos: ${checklist.dataConfidence}. Última actualización: ${checklist.lastUpdated}.`,
    ...(audience === 'SELL' ? seller : audience === 'BUY' ? buyer : [...buyer, ...seller]),
    ...c.notes.filter(Boolean).map(n => `Nota: ${n}`),
    'REGLAS PARA COSTOS: usá solo estos valores. No cites otros porcentajes, montos ni provincias de memoria. Si la persona dio un precio, multiplicá la proporción por ese precio y mostrá la cuenta; si no lo dio, respondé con el rango en porcentaje y pedí el precio en una línea. Decí qué jurisdicción usaste y, si la confianza no es VERIFIED, que conviene confirmarlo con el profesional. No incluyas comisión inmobiliaria, ganancias ni gastos del crédito: no están en estos valores. Cerrá indicando la sección Costos de VARA.',
  ].join('\n')
  return { text, source: { jurisdiction: checklist.provinceName, confidence: String(checklist.dataConfidence), updatedAt: String(checklist.lastUpdated) } }
}
