/**
 * Contexto de la operación para el asistente (texto y voz comparten ESTE mismo contexto).
 *
 * No calcula nada: toma lo que ya decidieron los motores de VARA (`buildFirstValue`: estado, próxima acción,
 * costos, incertidumbres) y lo arma como un texto corto y etiquetado. Cada línea dice qué tan firme es:
 *
 *   FACT            dato registrado en la operación o cargado por la persona
 *   EXTRACTED       leído de un aviso (puede tener errores)
 *   INFERENCE       supuesto de VARA, no confirmado
 *   ESTIMATE        cálculo con rango, no exacto
 *   RECOMMENDATION  sugerencia del motor de VARA
 *   UNKNOWN         lo que VARA no sabe
 *
 * Así el modelo no presenta una inferencia como un hecho. Sin volcados: topes de líneas y de largo.
 */

import type { DashboardProperty, FirstValue, OperationKind } from '@/lib/dashboard/firstValue'
import type { Transaction, UserOperationSummary } from '@/types'

export type Certainty = 'FACT' | 'EXTRACTED' | 'INFERENCE' | 'ESTIMATE' | 'RECOMMENDATION' | 'UNKNOWN'

export interface ContextLine {
  certainty: Certainty
  text: string
}

/** Lo mínimo para armar las acciones del chat (ver `actions.ts`). */
export interface ActionContext {
  operationId: string | null
  kind: OperationKind | null
  propertyId: string | null
  propertyIncomplete: boolean
  primary: { label: string; href: string } | null
}

export interface AssistantContext {
  lines: ContextLine[]
  actionContext: ActionContext
}

export const MAX_CONTEXT_CHARS = 4_000
const MAX_LINE_CHARS = 320
const MAX_LINES = 30

const clip = (s: string, n = MAX_LINE_CHARS) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)
const money = (n: number) => Math.round(n).toLocaleString('es-AR')
const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim()

export const NO_OPERATION_CONTEXT: AssistantContext = {
  lines: [
    { certainty: 'UNKNOWN', text: 'No hay una operación activa: no sé si la persona compra o vende, ni qué propiedad mira. Si hace falta, preguntalo en una línea.' },
  ],
  actionContext: { operationId: null, kind: null, propertyId: null, propertyIncomplete: false, primary: null },
}

export interface BuildContextInput {
  op: UserOperationSummary
  fv: FirstValue
  property: DashboardProperty | null
  transaction: Transaction | null
}

export function buildAssistantContext({ op, fv, property, transaction }: BuildContextInput): AssistantContext {
  const lines: ContextLine[] = []
  const add = (certainty: Certainty, text: string) => lines.push({ certainty, text: clip(oneLine(text)) })

  // ── Operación ──
  const place = [op.city, op.province].filter(Boolean).join(', ')
  add('FACT', `Operación activa: ${fv.kindLabel} "${op.title}"${place ? ` en ${place}` : ''}.`)
  if (fv.stage) add('FACT', `Etapa actual: ${fv.stage.label} (etapa ${fv.stage.index} de ${fv.stage.total}). Avance: ${fv.progress}%.`)
  else add('FACT', `Avance: ${fv.progress}%.`)
  add('FACT', `Estado: ${fv.healthLabel} — ${fv.healthReason}.`)
  if (fv.stepsTotal > 0) add('FACT', `Pasos hechos: ${fv.stepsDone} de ${fv.stepsTotal}.`)

  const pendingDocs = (transaction?.documents ?? []).filter(d => d.status === 'PENDING').map(d => d.name)
  if (fv.pendingDocs > 0) {
    add('FACT', `Documentos pendientes: ${fv.pendingDocs}${pendingDocs.length ? ` (${pendingDocs.slice(0, 5).join('; ')}${pendingDocs.length > 5 ? '; …' : ''})` : ''}.`)
  }
  for (const a of fv.attention) {
    add('FACT', `${a.id.startsWith('task_') ? 'Tarea bloqueada' : `Riesgo registrado (${a.severity === 'HIGH' ? 'alto' : 'medio'})`}: ${a.label} — ${a.detail}`)
  }

  // ── Propiedad ──
  if (property) {
    const where = [property.address, property.neighborhood, property.city].filter(Boolean).join(', ')
    const price = property.price > 0 ? `${property.currency} ${money(property.price)}` : 'sin precio cargado'
    const specs = [property.surface > 0 ? `${property.surface} m²` : '', property.rooms > 0 ? `${property.rooms} amb.` : ''].filter(Boolean).join(', ')
    const desc = `Propiedad: ${property.title || 'sin título'}${where ? `, ${where}` : ''}. Precio: ${price}${specs ? `. ${specs}` : ''}.`
    const imported = (property as { source?: string }).source === 'imported'
    add(imported ? 'EXTRACTED' : 'FACT', imported ? `Datos leídos del aviso. ${desc}` : desc)
    if (!op.propertyId) add('INFERENCE', 'La propiedad no está vinculada explícitamente a la operación: VARA asume que es la última que la persona cargó o importó.')
    const missing = (property.incompleteFields ?? []).filter(f => f !== 'precio')
    if (missing.length) add('UNKNOWN', `A la ficha de la propiedad le falta: ${missing.join(', ')}.`)
  }

  // ── Costos (motor de VARA; el asistente no recalcula) ──
  if (fv.costs.known) {
    const c = fv.costs
    const conf = c.confidence === 'VERIFIED' ? 'fuente verificada' : c.confidence === 'PARTIAL' ? 'parcialmente verificado' : 'sin fuente oficial confirmada'
    add('ESTIMATE', `Costos del comprador en ${c.provinceName} sobre USD ${money(c.price)}: USD ${money(c.min)} a ${money(c.max)} (${c.percentMin}% a ${c.percentMax}% del precio), ${conf}.`)
    add('ESTIMATE', `Desglose: ${c.lines.map(l => `${l.label} USD ${money(l.min)}–${money(l.max)}`).join('; ')}.`)
  }

  // ── Lo que VARA no sabe ──
  for (const u of fv.uncertainties) add(u.id === 'costs_estimated' ? 'ESTIMATE' : 'UNKNOWN', u.text)

  // ── Recomendación del motor ──
  const p = fv.primary
  add('RECOMMENDATION', `Próxima acción: "${p.title}". Por qué: ${p.why}${p.evidence.length ? ` Se basa en: ${p.evidence.slice(0, 3).join('; ')}.` : ''}${p.blocking ? ' Bloquea el avance de la operación.' : ''} (Botón: "${p.cta.label}".)`)
  if (fv.upNext.length) add('RECOMMENDATION', `Después: ${fv.upNext.map(a => `"${a.title}"`).join('; ')}.`)

  return {
    lines: lines.slice(0, MAX_LINES),
    actionContext: {
      operationId: op.id,
      kind: fv.kind,
      propertyId: property?.id ?? null,
      propertyIncomplete: (property?.incompleteFields ?? []).some(f => f !== 'precio') || Boolean(property && !(property.price > 0)),
      primary: { label: p.cta.label, href: p.cta.href },
    },
  }
}

/** Texto compacto para el modelo. Mismo formato para el chat de texto y para la voz. */
export function renderContext(ctx: AssistantContext): string {
  const text = ctx.lines.map(l => `[${l.certainty}] ${l.text}`).join('\n')
  return text.length > MAX_CONTEXT_CHARS ? `${text.slice(0, MAX_CONTEXT_CHARS - 1)}…` : text
}

/** Lo que el servidor acepta del cliente: texto plano, acotado y sin caracteres de control. */
export function sanitizeContextText(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const clean = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim()
  if (!clean) return null
  return clean.length > MAX_CONTEXT_CHARS ? clean.slice(0, MAX_CONTEXT_CHARS) : clean
}

/** Cómo usar el contexto. Lo comparten el chat de texto y la voz: una sola inteligencia. */
export const CONTEXT_RULES = `CÓMO USAR EL CONTEXTO DE LA OPERACIÓN:
- Cada línea tiene una etiqueta de certeza: [FACT] dato registrado; [EXTRACTED] leído de un aviso, puede tener errores; [INFERENCE] supuesto de VARA, no confirmado; [ESTIMATE] cálculo con rango, no exacto; [RECOMMENDATION] sugerencia del motor de VARA; [UNKNOWN] lo que VARA no sabe.
- Mantené separado lo que es hecho de lo que no. Nunca presentes una inferencia o una estimación como un hecho: decí "VARA estima…", "asumo que…", "según el aviso…". Si algo es UNKNOWN, decilo y decí cómo completarlo.
- "¿Qué hago ahora?" y "¿por qué esa acción?": apoyate en la RECOMMENDATION y explicá su porqué con la evidencia; no inventes otra distinta. Si te piden tu opinión ("¿qué harías vos?"), decí qué harías y por qué, apoyándote en esas mismas líneas.
- Costos: usá solo los números del contexto, nunca recalcules ni inventes montos. Si no hay costos, explicá qué falta para calcularlos.
- Riesgos y faltantes: resumí solo los que figuran en el contexto.
- Mensajes (por ejemplo al vendedor): redactá un borrador listo para copiar, con los datos reales del contexto, y aclará que es un borrador y que no se envió nada. Nunca digas que enviaste algo, creaste una oferta o modificaste datos.
- Comparar propiedades: decí que se hace en la sección Comparar de VARA; no armes la comparación sin datos de las dos propiedades.
- No inventes nada que no esté en el contexto ni en el material de VARA.`

/** Bloque completo que se agrega a las instrucciones del modelo. */
export function contextBlock(text: string): string {
  return `${CONTEXT_RULES}\n\nCONTEXTO DE LA OPERACIÓN (armado por los motores de VARA; es lo único que sabés de ella):\n${text}`
}
