/**
 * Next Best Action — el motor que responde "¿qué tengo que hacer ahora?".
 *
 * Tres reglas que lo gobiernan:
 *
 * 1. **Determinístico, no generativo.** El workflow inmobiliario tiene reglas;
 *    no se le pregunta a un modelo qué sigue cuando la respuesta se deduce del
 *    estado. La IA explica y resume; el orden lo decide esto.
 *
 * 2. **Toda acción cita su evidencia.** Si VARA dice "conseguí el informe de
 *    dominio", tiene que poder decir en qué se basa. Una recomendación sin
 *    evidencia es indistinguible de una inventada — que es exactamente el
 *    problema que tenía `useGuidance` leyendo `mockTransaction`.
 *
 * 3. **Sin datos, silencio.** Si no hay operación devuelve la acción de
 *    arranque y nada más. Nunca rellena con consejos genéricos disfrazados
 *    de personalizados.
 *
 * Todo es puro y testeable sin base ni navegador.
 */

import type { Transaction, Task, Document } from '@/types'

export type ActionCategory =
  | 'SETUP'      // falta configurar algo para que VARA pueda ayudar
  | 'BLOCKER'    // algo impide avanzar
  | 'RISK'       // hay un riesgo que resolver
  | 'DOCUMENT'   // falta un papel
  | 'TASK'       // el siguiente paso del proceso
  | 'REVIEW'     // revisar / confirmar

export interface NextAction {
  id: string
  /** Menor = más urgente. Los huecos son a propósito: dejan lugar a reglas nuevas. */
  priority: number
  category: ActionCategory
  /** Qué hacer. Imperativo, corto, sin jerga. */
  title: string
  /** Por qué importa. La consecuencia concreta de no hacerlo. */
  why: string
  /** En qué nos basamos. Se muestra al usuario: hace auditable la recomendación. */
  evidence: string[]
  cta: { label: string; href: string }
  /** true cuando la operación no puede avanzar hasta resolverlo. */
  blocking: boolean
  /** Ids de las entidades que originan la acción (tareas, docs, riesgos). */
  blockingEntities: string[]
}

export interface NbaInput {
  transaction: Transaction | null
  /** Ruta actual, para no recomendar ir donde el usuario ya está. */
  route?: string
}

/** Documentos sin los cuales una compraventa no cierra. */
const CRITICAL_DOC_CATEGORIES: readonly string[] = ['ESCRITURA', 'PLANOS']

const PENDING_DOC_STATUSES: readonly string[] = ['PENDING', 'REJECTED', 'EXPIRED']

function isPending(d: Document): boolean {
  return PENDING_DOC_STATUSES.includes(d.status)
}

function isCritical(d: Document): boolean {
  return CRITICAL_DOC_CATEGORIES.includes(d.category)
}

function allTasks(txn: Transaction): Task[] {
  return txn.stages.flatMap(s => s.tasks ?? [])
}

function opHref(txn: Transaction, tab?: string): string {
  return tab ? `/operacion/${txn.id}?tab=${tab}` : `/operacion/${txn.id}`
}

// ─────────────────────────── Reglas ───────────────────────────

/**
 * Cada regla mira el estado real y devuelve una acción o null.
 * El orden del array NO define la prioridad: la define el campo `priority`.
 * Así se puede agregar una regla en el medio sin reordenar nada.
 */
type Rule = (txn: Transaction) => NextAction | null

const ruleBlockedTasks: Rule = txn => {
  const blocked = allTasks(txn).filter(t => t.status === 'BLOCKED')
  if (blocked.length === 0) return null
  const first = blocked[0]

  /*
   * `blockedBy` guarda ids de tareas ("t-07"). Mostrarlos tal cual le filtra
   * al usuario una matricula interna que no significa nada para el.
   * Los resolvemos a titulos; si alguno no resuelve, esa dependencia
   * simplemente no se menciona. Un id suelto es peor que una linea menos.
   */
  const byId = new Map(allTasks(txn).map(t => [t.id, t.title]))
  const blockerTitles = (first.blockedBy ?? [])
    .map(id => byId.get(id))
    .filter((t): t is string => typeof t === 'string' && t.length > 0)

  return {
    id: 'blocked_tasks',
    priority: 10,
    category: 'BLOCKER',
    title: first.title,
    why: first.why || 'Mientras esta tarea esté bloqueada, la operación no avanza.',
    evidence: [
      `${blocked.length} tarea${blocked.length > 1 ? 's' : ''} bloqueada${blocked.length > 1 ? 's' : ''}`,
      ...(blockerTitles.length > 0 ? [`Depende de: ${blockerTitles.join(', ')}`] : []),
    ],
    cta: { label: 'Ver qué la bloquea', href: opHref(txn, 'tareas') },
    blocking: true,
    blockingEntities: blocked.map(t => t.id),
  }
}

/**
 * Riesgo alto que se resuelve con un documento que además está pendiente.
 * Es el caso más accionable: hay un problema Y se sabe exactamente qué lo cierra.
 */
const ruleHighRiskWithDocument: Rule = txn => {
  const highRisks = (txn.risks ?? []).filter(r => r.severity === 'HIGH')
  if (highRisks.length === 0) return null

  const pendingCritical = txn.documents.filter(d => isPending(d) && isCritical(d))
  if (pendingCritical.length === 0) return null

  const risk = highRisks[0]
  const doc = pendingCritical[0]
  return {
    id: `risk_doc_${doc.category.toLowerCase()}`,
    priority: 20,
    category: 'RISK',
    title: `Conseguí ${doc.name.toLowerCase()}`,
    why: risk.recommendation || risk.detail,
    evidence: [
      `Riesgo alto: ${risk.label}`,
      ...(risk.evidence ? [risk.evidence] : []),
      `${doc.name}: ${doc.status === 'PENDING' ? 'sin recibir' : doc.status.toLowerCase()}`,
    ],
    cta: { label: 'Ver documentos y riesgos', href: opHref(txn, 'documentos') },
    blocking: true,
    blockingEntities: [risk.id, doc.id],
  }
}

/** Riesgo alto sin documento crítico asociado: igual hay que mirarlo. */
const ruleHighRisk: Rule = txn => {
  const highRisks = (txn.risks ?? []).filter(r => r.severity === 'HIGH')
  if (highRisks.length === 0) return null
  const risk = highRisks[0]
  return {
    id: 'high_risk',
    priority: 25,
    category: 'RISK',
    title: risk.recommendation ? risk.recommendation : `Resolvé: ${risk.label}`,
    why: risk.detail,
    evidence: [
      `Riesgo alto detectado: ${risk.label}`,
      ...(risk.evidence ? [risk.evidence] : []),
    ],
    cta: { label: 'Ver riesgos', href: opHref(txn, 'documentos') },
    blocking: true,
    blockingEntities: highRisks.map(r => r.id),
  }
}

const ruleCriticalDocs: Rule = txn => {
  const pending = txn.documents.filter(d => isPending(d) && isCritical(d))
  if (pending.length === 0) return null
  const doc = pending[0]
  return {
    id: `critical_doc_${doc.category.toLowerCase()}`,
    priority: 30,
    category: 'DOCUMENT',
    title: `Conseguí ${doc.name.toLowerCase()}`,
    why: 'Sin este documento no se puede verificar la titularidad ni avanzar a la escritura.',
    evidence: pending.map(
      d => `${d.name}: ${d.status === 'PENDING' ? 'sin recibir' : d.status.toLowerCase()}`,
    ),
    cta: { label: 'Ver documentos', href: opHref(txn, 'documentos') },
    blocking: true,
    blockingEntities: pending.map(d => d.id),
  }
}

/**
 * Sin precio no hay costos posibles.
 * Va después de lo bloqueante pero antes de las tareas: es un dato que VARA
 * necesita para servir, no un paso del proceso.
 */
const ruleMissingPrice: Rule = txn => {
  const price = txn.property?.price ?? 0
  if (price > 0) return null
  return {
    id: 'missing_price',
    priority: 40,
    category: 'SETUP',
    title: 'Cargá el precio de la propiedad',
    why: 'Los sellos, honorarios y aranceles se calculan sobre el precio. Sin ese dato no podemos decirte cuánto te sale.',
    evidence: ['La operación no tiene precio cargado'],
    cta: {
      label: 'Cargar el precio',
      href: txn.propertyId ? `/propiedades/${txn.propertyId}` : '/propiedades',
    },
    blocking: false,
    blockingEntities: [],
  }
}

/** El siguiente paso del proceso, dentro de la etapa actual. */
const ruleNextTask: Rule = txn => {
  const stage = txn.stages.find(s => s.id === txn.currentStageId)
  const next = (stage?.tasks ?? []).find(
    t => t.status === 'IN_PROGRESS' || t.status === 'TODO',
  )
  if (!next) return null
  return {
    id: `task_${next.id}`,
    priority: 50,
    category: 'TASK',
    title: next.title,
    why: next.why || next.description,
    evidence: [
      ...(stage ? [`Etapa actual: ${stage.label}`] : []),
      ...(next.responsibleRole ? [`Responsable: ${next.responsibleRole}`] : []),
      ...(next.documentsRequired.length > 0
        ? [`Necesita: ${next.documentsRequired.join(', ')}`]
        : []),
    ],
    cta: { label: 'Ver la tarea', href: opHref(txn, 'tareas') },
    blocking: false,
    blockingEntities: [next.id],
  }
}

/** Documentos no críticos pendientes. Última prioridad accionable. */
const ruleOtherDocs: Rule = txn => {
  const pending = txn.documents.filter(d => isPending(d) && !isCritical(d))
  if (pending.length === 0) return null
  return {
    id: 'other_docs',
    priority: 60,
    category: 'DOCUMENT',
    title: `Juntá ${pending.length} documento${pending.length > 1 ? 's' : ''} pendiente${pending.length > 1 ? 's' : ''}`,
    why: 'Tenerlos antes de firmar evita frenar la operación sobre la fecha.',
    evidence: pending.slice(0, 4).map(d => d.name),
    cta: { label: 'Ver documentos', href: opHref(txn, 'documentos') },
    blocking: false,
    blockingEntities: pending.map(d => d.id),
  }
}

/** Todo al día — solo cuando realmente no hay nada pendiente en NINGUNA etapa (H09). */
const ruleAllClear: Rule = txn => {
  const anyPending = allTasks(txn).some(t => t.status === 'TODO' || t.status === 'IN_PROGRESS')
  if (anyPending) {
    // Hay tareas pendientes pero no están en la etapa actual: apuntar a la siguiente etapa con trabajo.
    const nextStageWithWork = txn.stages.find(
      s => s.id !== txn.currentStageId && s.tasks.some(t => t.status === 'TODO' || t.status === 'IN_PROGRESS')
    )
    if (nextStageWithWork) {
      return {
        id: 'continue_next_stage',
        priority: 55,
        category: 'TASK',
        title: `Continuá con: ${nextStageWithWork.label}`,
        why: 'Hay tareas pendientes en la siguiente etapa.',
        evidence: [`${nextStageWithWork.tasks.filter(t => t.status === 'TODO' || t.status === 'IN_PROGRESS').length} tarea(s) pendiente(s)`],
        cta: { label: 'Ver tareas', href: opHref(txn, 'tareas') },
        blocking: false,
        blockingEntities: [],
      }
    }
    return null
  }
  return {
    id: 'all_clear',
    priority: 90,
    category: 'REVIEW',
    title: 'No hay nada pendiente de tu lado',
    why: 'Revisá el estado de la operación para confirmar que todo sigue en orden.',
    evidence: ['Sin tareas bloqueadas', 'Sin riesgos altos', 'Sin documentos pendientes'],
    cta: { label: 'Ver mi operación', href: opHref(txn) },
    blocking: false,
    blockingEntities: [],
  }
}

const RULES: Rule[] = [
  ruleBlockedTasks,
  ruleHighRiskWithDocument,
  ruleHighRisk,
  ruleCriticalDocs,
  ruleMissingPrice,
  ruleNextTask,
  ruleOtherDocs,
  ruleAllClear,
]

// ─────────────────────────── API ───────────────────────────

/** Acción para quien todavía no tiene operación. No es un consejo: es el arranque. */
export const SETUP_ACTION: NextAction = {
  id: 'no_operation',
  priority: 0,
  category: 'SETUP',
  title: 'Empezá tu operación',
  why: 'Con tu propiedad y tu provincia, VARA arma el plan completo: qué documentos necesitás, qué riesgos mirar y cuánto te sale.',
  evidence: ['Todavía no tenés ninguna operación activa'],
  cta: { label: 'Crear mi operación', href: '/onboarding' },
  blocking: false,
  blockingEntities: [],
}

/**
 * Todas las acciones pendientes, ordenadas por urgencia real.
 *
 * `ruleAllClear` se excluye cuando hay otras: solo aparece si de verdad no
 * quedó nada. Si no, diría "no hay nada pendiente" al lado de tres pendientes.
 */
export function computeNextActions(input: NbaInput): NextAction[] {
  const { transaction } = input
  if (!transaction) return [SETUP_ACTION]

  const actions = RULES
    .map(rule => rule(transaction))
    .filter((a): a is NextAction => a !== null)

  const real = actions.filter(a => a.id !== 'all_clear')
  const result = real.length > 0 ? real : actions

  return result.sort((a, b) => a.priority - b.priority)
}

/** La única acción que se muestra en grande. */
export function primaryAction(input: NbaInput): NextAction | null {
  return computeNextActions(input)[0] ?? null
}

/** Cuántas cosas bloquean la operación. Para el contador de "requiere atención". */
export function blockingCount(input: NbaInput): number {
  return computeNextActions(input).filter(a => a.blocking).length
}

export const CATEGORY_LABELS: Record<ActionCategory, string> = {
  SETUP: 'Configuración',
  BLOCKER: 'Bloqueante',
  RISK: 'Riesgo',
  DOCUMENT: 'Documentación',
  TASK: 'Siguiente paso',
  REVIEW: 'Revisión',
}
