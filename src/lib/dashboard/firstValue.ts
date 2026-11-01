/**
 * Dashboard — primer valor.
 *
 * Una función pura arma TODO lo que el dashboard necesita para responder en 5 segundos:
 * qué operación, en qué estado, qué hacer ahora, por qué y cuál es la acción concreta.
 *
 *  - No recibe la sesión: invitado y cuenta ven exactamente lo mismo.
 *  - Compra y venta salen de la misma estructura; cambian los textos y las acciones.
 *  - No inventa datos: si falta algo (propiedad, precio, plan), lo dice en `uncertainties`
 *    y no muestra números en cero como si fueran un cálculo.
 *  - La acción de la compra la decide el motor de reglas (`nba/engine`), sin tocarlo.
 */

import { generateChecklist } from '@/lib/regulations'
import type { ProvinceCode } from '@/data/regulations/types'
import { computeNextActions, SETUP_ACTION, type NextAction } from '@/lib/nba/engine'
import type { Property, Transaction } from '@/types'

export type OperationKind = 'BUY' | 'SELL'
export type OperationHealth = 'NEW' | 'ON_TRACK' | 'ATTENTION' | 'BLOCKED'

/** Un paso del plan de venta (checklist remoto o tareas del motor regulatorio). */
export interface PlanStep {
  key: string
  title: string
  description: string
  done: boolean
}

/** Propiedad asociada a la operación. `incompleteFields` viene de las propiedades del usuario. */
export type DashboardProperty = Property & { incompleteFields?: string[] }

export interface Uncertainty {
  id: string
  text: string
  cta?: { label: string; href: string }
}

export interface AttentionItem {
  id: string
  label: string
  detail: string
  severity: 'HIGH' | 'MEDIUM'
}

export type BuyerCosts =
  | { known: false; reason: 'NO_PROPERTY' | 'NO_PRICE' | 'NOT_USD' }
  | {
      known: true
      price: number
      provinceName: string
      confidence: 'VERIFIED' | 'PARTIAL' | 'ESTIMATED'
      min: number
      max: number
      percentMin: number
      percentMax: number
      lines: { label: string; min: number; max: number }[]
      source: string
    }

export interface FirstValueInput {
  kind: OperationKind
  operationId: string
  transaction: Transaction | null
  property: DashboardProperty | null
  /** Plan de venta remoto, si existe. Si no, se arma con las tareas del motor regulatorio. */
  steps?: PlanStep[]
}

export interface FirstValue {
  kind: OperationKind
  kindLabel: 'Compra' | 'Venta'
  stage: { label: string; index: number; total: number } | null
  progress: number
  health: OperationHealth
  healthLabel: string
  healthReason: string
  /** La única acción que se muestra en grande. */
  primary: NextAction
  /** Las dos que siguen, compactas. */
  upNext: NextAction[]
  /** Lo que frena la operación (tareas bloqueadas, riesgos reales). Los documentos pendientes no cuentan como riesgo. */
  attention: AttentionItem[]
  /** Lo que no sabemos y por qué importa. */
  uncertainties: Uncertainty[]
  pendingDocs: number
  stepsDone: number
  stepsTotal: number
  costs: BuyerCosts
}

// ───────────────────────── Acciones de arranque ─────────────────────────

export const SETUP_PROPERTY_BUY: NextAction = {
  id: 'setup_property',
  priority: 1,
  category: 'SETUP',
  title: 'Cargá la propiedad que estás mirando',
  why: 'Con la propiedad VARA calcula cuánto te sale, detecta riesgos y ordena los papeles. Sin ella solo puedo darte el plan general.',
  evidence: ['Todavía no hay una propiedad asociada a esta operación'],
  cta: { label: 'Cargar la propiedad', href: '/propiedades' },
  blocking: false,
  blockingEntities: [],
}

const SETUP_PLAN_SELL: NextAction = {
  id: 'setup_plan_sell',
  priority: 1,
  category: 'SETUP',
  title: 'Empezá por preparar la venta',
  why: 'Juntá los papeles y definí el precio antes de publicar.',
  evidence: ['Todavía no hay un plan de tareas para esta venta'],
  cta: { label: 'Preparar la venta', href: '/preparar-venta' },
  blocking: false,
  blockingEntities: [],
}

function openOperationAction(operationId: string): NextAction {
  return {
    id: 'open_operation',
    priority: 5,
    category: 'REVIEW',
    title: 'Abrí tu operación',
    why: 'No pudimos armar el resumen de esta operación ahora, pero tus datos están guardados.',
    evidence: ['No se pudo cargar el detalle de la operación'],
    cta: { label: 'Abrir la operación', href: `/operacion/${operationId}` },
    blocking: false,
    blockingEntities: [],
  }
}

// ───────────────────────── Piezas puras ─────────────────────────

/** Asocia la propiedad a la operación para que el motor y los costos usen el precio real y no 0. */
export function withProperty(txn: Transaction, property: DashboardProperty | null): Transaction {
  return property ? { ...txn, property } : txn
}

/**
 * Qué propiedad corresponde mostrar. La vinculada a la operación manda; si no hay vínculo explícito,
 * en compra se usa la última que el usuario importó ("la que estás mirando") y en venta el borrador propio.
 */
export function pickDashboardProperty<T extends { source: string }>(
  kind: OperationKind,
  linked: T | null,
  all: T[],
): T | null {
  if (linked) return linked
  return (kind === 'BUY' ? all.find(p => p.source === 'imported') : all.find(p => p.source === 'draft')) ?? null
}

/** El estado vacío depende SOLO de que no haya operaciones (con o sin cuenta), y solo cuando ya se terminó de cargar. */
export function shouldShowEmptyState(s: { loaded: boolean; operationCount: number }): boolean {
  return s.loaded && s.operationCount === 0
}

export function stepsFromTransaction(txn: Transaction | null): PlanStep[] {
  return (txn?.stages ?? [])
    .flatMap(s => s.tasks)
    .map(t => ({ key: t.id, title: t.title, description: t.description, done: t.status === 'DONE' }))
}

/** Costos del comprador. Solo con precio real y en dólares: el motor calcula en USD y no convierte. */
export function computeBuyerCosts(txn: Transaction | null, property: DashboardProperty | null): BuyerCosts {
  if (!txn || !property) return { known: false, reason: 'NO_PROPERTY' }
  if (!(property.price > 0)) return { known: false, reason: 'NO_PRICE' }
  if (property.currency !== 'USD') return { known: false, reason: 'NOT_USD' }
  const checklist = generateChecklist(txn.provinceCode as ProvinceCode, txn.type, property.price)
  const c = checklist.costs
  return {
    known: true,
    price: property.price,
    provinceName: checklist.provinceName,
    confidence: checklist.dataConfidence === 'VERIFIED' ? 'VERIFIED' : checklist.dataConfidence === 'PARTIAL' ? 'PARTIAL' : 'ESTIMATED',
    min: c.totalBuyer.min,
    max: c.totalBuyer.max,
    percentMin: c.totalBuyer.percentMin,
    percentMax: c.totalBuyer.percentMax,
    lines: [c.stampTaxBuyer, c.notaryFeeBuyer, c.registryFee, c.certificates].map(l => ({ label: l.label, min: l.minAmount, max: l.maxAmount })),
    source: c.stampTaxBuyer.source,
  }
}

function attentionItems(txn: Transaction | null): AttentionItem[] {
  if (!txn) return []
  const items: AttentionItem[] = []
  const blocked = txn.stages.flatMap(s => s.tasks).filter(t => t.status === 'BLOCKED')
  for (const t of blocked) {
    items.push({ id: `task_${t.id}`, label: t.title, detail: t.why || 'Mientras esté bloqueada, la operación no avanza.', severity: 'HIGH' })
  }
  for (const r of txn.risks ?? []) {
    if (r.severity === 'HIGH' || r.severity === 'MEDIUM') {
      items.push({ id: `risk_${r.id}`, label: r.label, detail: r.detail, severity: r.severity })
    }
  }
  return items.slice(0, 4)
}

function healthOf(args: { blockedCount: number; highRisks: number; done: number; total: number }): Pick<FirstValue, 'health' | 'healthLabel' | 'healthReason'> {
  const { blockedCount, highRisks, done, total } = args
  if (blockedCount > 0) {
    return { health: 'BLOCKED', healthLabel: 'Bloqueada', healthReason: `${blockedCount} tarea${blockedCount > 1 ? 's' : ''} bloqueada${blockedCount > 1 ? 's' : ''}` }
  }
  if (highRisks > 0) {
    return { health: 'ATTENTION', healthLabel: 'Requiere atención', healthReason: `${highRisks} riesgo${highRisks > 1 ? 's' : ''} alto${highRisks > 1 ? 's' : ''} detectado${highRisks > 1 ? 's' : ''}` }
  }
  if (done === 0) {
    return { health: 'NEW', healthLabel: 'Recién empezada', healthReason: 'Todavía no marcaste ningún paso' }
  }
  return { health: 'ON_TRACK', healthLabel: 'En curso', healthReason: `${done} de ${total} pasos hechos` }
}

function stageOf(txn: Transaction | null): FirstValue['stage'] {
  if (!txn || txn.stages.length === 0) return null
  const idx = txn.stages.findIndex(s => s.id === txn.currentStageId)
  const i = idx >= 0 ? idx : 0
  return { label: txn.stages[i].label, index: i + 1, total: txn.stages.length }
}

function sellAction(step: PlanStep, index: number, total: number, done: number, operationId: string): NextAction {
  return {
    id: `sell_${step.key}`,
    priority: 50,
    category: 'TASK',
    title: step.title,
    why: step.description || 'Es el siguiente paso de tu venta.',
    evidence: [`Paso ${index + 1} de ${total} de tu venta`, `${done} de ${total} pasos hechos`],
    cta: { label: 'Ver el paso', href: `/operacion/${operationId}?tab=tareas` },
    blocking: false,
    blockingEntities: [step.key],
  }
}

function uncertaintiesFor(args: { kind: OperationKind; property: DashboardProperty | null; costs: BuyerCosts; hasPlan: boolean }): Uncertainty[] {
  const { kind, property, costs, hasPlan } = args
  const out: Uncertainty[] = []

  if (!property) {
    // En compra la acción principal ya pide cargarla: acá solo se explica qué no se puede mostrar.
    out.push(kind === 'BUY'
      ? { id: 'costs_unknown', text: 'Todavía no podemos decirte cuánto te sale: los costos se calculan sobre el precio de la propiedad.' }
      : { id: 'no_property', text: 'Todavía no cargaste los datos de tu propiedad: sin ellos no podemos orientarte con el precio ni detectar faltantes.', cta: { label: 'Preparar la venta', href: '/preparar-venta' } })
  } else {
    if (kind === 'BUY' && !costs.known && costs.reason === 'NO_PRICE') {
      out.push({ id: 'no_price', text: 'La propiedad no tiene precio cargado: los costos se calculan sobre el precio, así que no los mostramos.', cta: { label: 'Cargar el precio', href: `/propiedades/${property.id}` } })
    }
    if (kind === 'BUY' && !costs.known && costs.reason === 'NOT_USD') {
      out.push({ id: 'price_not_usd', text: 'El precio está en pesos. VARA calcula los costos en dólares y todavía no convierte, así que no mostramos un número que no sería confiable.' })
    }
    const missing = (property.incompleteFields ?? []).filter(f => f !== 'precio')
    if (missing.length > 0) {
      out.push({ id: 'incomplete_property', text: `A la ficha de la propiedad le falta: ${missing.join(', ')}. Con esos datos el análisis es más preciso.`, cta: { label: 'Completar la ficha', href: `/propiedades/${property.id}` } })
    }
  }

  if (kind === 'BUY' && costs.known && costs.confidence !== 'VERIFIED') {
    out.push({
      id: 'costs_estimated',
      text: costs.confidence === 'PARTIAL'
        ? `Los costos de ${costs.provinceName} son parcialmente verificados: confirmalos con tu escribano.`
        : `Los costos de ${costs.provinceName} son una estimación, sin fuente oficial confirmada: validalos con tu escribano.`,
    })
  }

  if (!hasPlan) {
    out.push({ id: 'no_plan', text: 'No pudimos armar el plan de pasos para esta operación.' })
  }
  return out
}

// ───────────────────────── Constructor principal ─────────────────────────

export function buildFirstValue(input: FirstValueInput): FirstValue {
  const { kind, operationId, property } = input
  const txn = input.transaction ? withProperty(input.transaction, property) : null
  const kindLabel = kind === 'BUY' ? 'Compra' : 'Venta'
  const attention = attentionItems(txn)
  const blockedCount = txn ? txn.stages.flatMap(s => s.tasks).filter(t => t.status === 'BLOCKED').length : 0
  const highRisks = (txn?.risks ?? []).filter(r => r.severity === 'HIGH').length
  const pendingDocs = txn ? txn.documents.filter(d => d.status === 'PENDING').length : 0
  const costs: BuyerCosts = kind === 'BUY' ? computeBuyerCosts(txn, property) : { known: false, reason: property ? 'NO_PRICE' : 'NO_PROPERTY' }

  if (kind === 'SELL') {
    const steps = input.steps && input.steps.length > 0 ? input.steps : stepsFromTransaction(txn)
    const done = steps.filter(s => s.done).length
    const total = steps.length
    const nextIdx = steps.findIndex(s => !s.done)
    const primary: NextAction =
      total === 0 ? SETUP_PLAN_SELL
      : nextIdx >= 0 ? sellAction(steps[nextIdx], nextIdx, total, done, operationId)
      : {
          id: 'sell_all_done', priority: 90, category: 'REVIEW', title: 'Completaste todos los pasos de tu venta',
          why: 'Revisá que todo siga en orden antes de cerrar la operación.', evidence: [`${done} de ${total} pasos hechos`],
          cta: { label: 'Ver mi operación', href: `/operacion/${operationId}` }, blocking: false, blockingEntities: [],
        }
    const upNext = steps
      .map((s, i) => ({ s, i }))
      .filter(({ s, i }) => !s.done && i !== nextIdx)
      .slice(0, 2)
      .map(({ s, i }) => sellAction(s, i, total, done, operationId))
    return {
      kind, kindLabel, stage: stageOf(txn), progress: total > 0 ? Math.round((done / total) * 100) : 0,
      ...healthOf({ blockedCount, highRisks, done, total }),
      primary, upNext, attention, pendingDocs, stepsDone: done, stepsTotal: total, costs,
      uncertainties: uncertaintiesFor({ kind, property, costs, hasPlan: total > 0 }),
    }
  }

  // Compra
  const all = txn ? computeNextActions({ transaction: txn }) : []
  const engineActions = all.filter(a => a.id !== 'all_clear' && a.id !== 'no_operation')
  const tasks = txn ? txn.stages.flatMap(s => s.tasks) : []
  const done = tasks.filter(t => t.status === 'DONE').length

  let primary: NextAction
  if (!txn) primary = openOperationAction(operationId)
  else if (!property) primary = SETUP_PROPERTY_BUY
  else primary = engineActions[0] ?? all[0] ?? SETUP_ACTION

  const health = healthOf({ blockedCount, highRisks, done, total: tasks.length })
  // En una operación recién empezada conseguir los primeros papeles es el comienzo, no algo que la "frene":
  // sin esto la tarjeta diría "Esto frena tu operación" justo debajo de "Recién empezada".
  if (health.health === 'NEW' && primary.blocking && primary.category !== 'BLOCKER' && primary.category !== 'RISK') {
    primary = { ...primary, blocking: false }
  }

  // Sin propiedad el motor pide "cargá el precio": ya lo dice la acción principal, no se repite.
  const rest = engineActions.filter(a => a.id !== primary.id && (property ? true : a.id !== 'missing_price'))
  return {
    kind, kindLabel, stage: stageOf(txn), progress: txn?.progress ?? 0,
    ...health,
    primary, upNext: rest.slice(0, 2), attention, pendingDocs, stepsDone: done, stepsTotal: tasks.length, costs,
    uncertainties: uncertaintiesFor({ kind, property, costs, hasPlan: Boolean(txn) && tasks.length > 0 }),
  }
}
