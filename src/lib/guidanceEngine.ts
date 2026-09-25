// VARA Guidance Engine
// Principio: RULES DETERMINE WHAT. AI IMPROVES HOW.
// La lógica de qué mostrar es determinística. El texto puede enriquecerse con IA.

import type { VaraState } from '@/hooks/useVaraState'

export type GuidanceActionType = 'navigate' | 'dismiss' | 'open_vara_visit' | 'ask_ai' | 'none'

export interface GuidanceAction {
  label: string
  type: GuidanceActionType
  payload?: string       // href para navigate, prompt para ask_ai
  primary?: boolean
  varaVisit?: boolean
}

export type GuidanceStepType = 'question' | 'action' | 'warning' | 'info' | 'resume'

export interface GuidanceStep {
  id: string
  priority: number        // menor número = mayor prioridad
  journeyFilter?: 'BUY' | 'SELL' | 'BOTH'
  type: GuidanceStepType
  headline: string
  subtext: string
  actions: GuidanceAction[]
  targetElementId?: string  // id del elemento a destacar visualmente
  dismissible: boolean
  skippable: boolean
}

export interface GuidanceContext {
  mode: 'BUY' | 'SELL'
  route: string
  province: string
  propertyUrl: string
  onboardingDone: boolean
  operationId: string
  dismissedGuidanceIds: string[]
  // computados desde mockTransaction
  currentStageId: string
  pendingDocCategories: string[]
  blockedTaskCount: number
  highRiskCount: number
  completedTaskCount: number
  totalTaskCount: number
}

// Reglas en orden de prioridad (menor number = mayor prioridad)
const GUIDANCE_RULES: GuidanceStep[] = [
  // ----- BUYER RULES -----
  {
    id: 'buy_no_property',
    priority: 10,
    journeyFilter: 'BUY',
    type: 'question',
    headline: '¿Ya encontraste una propiedad?',
    subtext: 'Cuando tengas una propiedad en mente, VARA puede analizarla: documentación, riesgos, costos reales y más.',
    actions: [
      { label: 'Buscar propiedades', type: 'navigate', payload: '/propiedades', primary: true },
      { label: 'Tengo una en mente', type: 'navigate', payload: '/dashboard', primary: false },
    ],
    targetElementId: 'property-url-input',
    dismissible: true,
    skippable: true,
  },
  {
    id: 'buy_docs_pending',
    priority: 20,
    journeyFilter: 'BUY',
    type: 'warning',
    headline: 'Documentación crítica pendiente',
    subtext: 'Para avanzar en la operación necesitás la escritura y los planos. Sin ellos no se puede escriturar.',
    actions: [
      { label: 'Ver documentación', type: 'navigate', payload: '/operacion/txn-001', primary: true },
      { label: 'Más info', type: 'ask_ai', payload: '¿Qué documentos necesito para comprar una propiedad en Argentina?', primary: false },
    ],
    targetElementId: 'docs-section',
    dismissible: true,
    skippable: false,
  },
  {
    id: 'buy_blocked_tasks',
    priority: 15,
    journeyFilter: 'BUY',
    type: 'warning',
    headline: 'Hay tareas que no pueden avanzar',
    subtext: 'Algunas tareas están bloqueadas y necesitan atención para no frenar la operación.',
    actions: [
      { label: 'Ver operación', type: 'navigate', payload: '/operacion/txn-001', primary: true },
      { label: 'Ignorar por ahora', type: 'dismiss', primary: false },
    ],
    targetElementId: 'tasks-section',
    dismissible: true,
    skippable: true,
  },
  {
    id: 'buy_visit_pending',
    priority: 40,
    journeyFilter: 'BUY',
    type: 'question',
    headline: '¿Coordinaste la visita a la propiedad?',
    subtext: 'Antes de avanzar en la documentación, es importante conocer la propiedad en persona.',
    actions: [
      { label: 'Ver checklist de visita', type: 'navigate', payload: '/visitas', primary: true },
      { label: 'Contratar acompañamiento', type: 'open_vara_visit', varaVisit: true, primary: false },
      { label: 'Ya la visité', type: 'dismiss', primary: false },
    ],
    targetElementId: 'visit-section',
    dismissible: true,
    skippable: true,
  },
  {
    id: 'buy_costs_pending',
    priority: 50,
    journeyFilter: 'BUY',
    type: 'info',
    headline: 'Conocé los costos reales de esta operación',
    subtext: 'Sellos, honorarios, registro y más. VARA calcula todo según la provincia y el valor de la propiedad.',
    actions: [
      { label: 'Ver calculadora de costos', type: 'navigate', payload: '/costos', primary: true },
      { label: 'Después', type: 'dismiss', primary: false },
    ],
    dismissible: true,
    skippable: true,
  },

  // ----- SELLER RULES -----
  {
    id: 'sell_no_property',
    priority: 10,
    journeyFilter: 'SELL',
    type: 'question',
    headline: '¿Cargaste los datos de tu propiedad?',
    subtext: 'Con los datos de tu propiedad, VARA puede preparar la documentación, calcular costos y ayudarte a publicarla.',
    actions: [
      { label: 'Cargar propiedad', type: 'navigate', payload: '/publicar', primary: true },
    ],
    targetElementId: 'property-input',
    dismissible: false,
    skippable: false,
  },
  {
    id: 'sell_not_published',
    priority: 20,
    journeyFilter: 'SELL',
    type: 'action',
    headline: 'Tu propiedad todavía no está publicada',
    subtext: 'Publicá en los principales portales con un solo clic desde VARA.',
    actions: [
      { label: 'Publicar ahora', type: 'navigate', payload: '/publicar', primary: true },
      { label: 'Más tarde', type: 'dismiss', primary: false },
    ],
    targetElementId: 'publish-section',
    dismissible: true,
    skippable: true,
  },
  {
    id: 'sell_show_property',
    priority: 30,
    journeyFilter: 'SELL',
    type: 'question',
    headline: '¿Quién va a mostrar tu propiedad?',
    subtext: 'Cuando lleguen interesados, necesitás tener esto definido. VARA Visit puede encargarse si no querés estar vos.',
    actions: [
      { label: 'Lo muestro yo', type: 'dismiss', primary: false },
      { label: 'Contratar VARA Visit', type: 'open_vara_visit', varaVisit: true, primary: true },
    ],
    dismissible: true,
    skippable: true,
  },
  {
    id: 'sell_docs_pending',
    priority: 15,
    journeyFilter: 'SELL',
    type: 'warning',
    headline: 'Documentación necesaria antes de publicar',
    subtext: 'Tener la escritura y el libre deuda listo acelera la operación cuando llegue un comprador serio.',
    actions: [
      { label: 'Ver documentos', type: 'navigate', payload: '/operacion/txn-001', primary: true },
      { label: 'Entendido', type: 'dismiss', primary: false },
    ],
    targetElementId: 'docs-section',
    dismissible: true,
    skippable: true,
  },
]

export function buildGuidanceContext(
  vara: Pick<VaraState, 'journeyType' | 'propertyUrl' | 'province' | 'onboardingDone' | 'operationId' | 'dismissedGuidanceIds'>,
  route: string,
  txnData?: {
    currentStageId: string
    pendingDocCategories: string[]
    blockedTaskCount: number
    highRiskCount: number
    completedTaskCount: number
    totalTaskCount: number
  }
): GuidanceContext {
  return {
    mode: vara.journeyType === 'SELL_PROPERTY' ? 'SELL' : 'BUY',
    route,
    province: vara.province,
    propertyUrl: vara.propertyUrl,
    onboardingDone: vara.onboardingDone,
    operationId: vara.operationId,
    dismissedGuidanceIds: vara.dismissedGuidanceIds,
    currentStageId: txnData?.currentStageId ?? '',
    pendingDocCategories: txnData?.pendingDocCategories ?? [],
    blockedTaskCount: txnData?.blockedTaskCount ?? 0,
    highRiskCount: txnData?.highRiskCount ?? 0,
    completedTaskCount: txnData?.completedTaskCount ?? 0,
    totalTaskCount: txnData?.totalTaskCount ?? 0,
  }
}

function stepMatchesContext(step: GuidanceStep, ctx: GuidanceContext): boolean {
  if (step.journeyFilter && step.journeyFilter !== 'BOTH' && step.journeyFilter !== ctx.mode) {
    return false
  }
  if (ctx.dismissedGuidanceIds.includes(step.id)) {
    return false
  }
  return true
}

function evaluateCondition(step: GuidanceStep, ctx: GuidanceContext): boolean {
  switch (step.id) {
    // BUYER
    case 'buy_no_property':
      return !ctx.propertyUrl && ctx.mode === 'BUY'
    case 'buy_docs_pending':
      return (
        ctx.mode === 'BUY' &&
        ctx.pendingDocCategories.some(c => ['ESCRITURA', 'PLANOS'].includes(c))
      )
    case 'buy_blocked_tasks':
      return ctx.mode === 'BUY' && ctx.blockedTaskCount > 0
    case 'buy_visit_pending':
      return (
        ctx.mode === 'BUY' &&
        !!ctx.propertyUrl &&
        ['stage-01', 'stage-02', 'stage-03'].includes(ctx.currentStageId)
      )
    case 'buy_costs_pending':
      return ctx.mode === 'BUY' && !!ctx.propertyUrl

    // SELLER
    case 'sell_no_property':
      return ctx.mode === 'SELL' && !ctx.propertyUrl
    case 'sell_not_published':
      return (
        ctx.mode === 'SELL' &&
        !!ctx.propertyUrl &&
        ctx.currentStageId !== 'stage-published'
      )
    case 'sell_show_property':
      return ctx.mode === 'SELL' && !!ctx.propertyUrl
    case 'sell_docs_pending':
      return (
        ctx.mode === 'SELL' &&
        ctx.pendingDocCategories.some(c => ['ESCRITURA', 'PLANOS'].includes(c))
      )

    default:
      return false
  }
}

// Retorna el paso de mayor prioridad aplicable, o null si no hay nada relevante
export function getNextGuidanceStep(ctx: GuidanceContext): GuidanceStep | null {
  const applicable = GUIDANCE_RULES
    .filter(step => stepMatchesContext(step, ctx) && evaluateCondition(step, ctx))
    .sort((a, b) => a.priority - b.priority)

  return applicable[0] ?? null
}

// Retorna todos los pasos aplicables, ordenados por prioridad
export function getAllGuidanceSteps(ctx: GuidanceContext): GuidanceStep[] {
  return GUIDANCE_RULES
    .filter(step => stepMatchesContext(step, ctx) && evaluateCondition(step, ctx))
    .sort((a, b) => a.priority - b.priority)
}

export interface GuidanceSummary {
  completedItems: string[]
  pendingItems: string[]
  nextStep: GuidanceStep | null
  progressPct: number
  mode: 'BUY' | 'SELL'
}

export function buildGuidanceSummary(ctx: GuidanceContext): GuidanceSummary {
  const completed: string[] = []
  const pending: string[] = []

  if (ctx.mode === 'BUY') {
    if (ctx.propertyUrl) completed.push('Propiedad agregada')
    else pending.push('Agregar propiedad')

    if (ctx.completedTaskCount > 0) completed.push(`${ctx.completedTaskCount} tareas completadas`)

    if (ctx.pendingDocCategories.length === 0 && ctx.completedTaskCount > 0) {
      completed.push('Documentación completa')
    } else if (ctx.pendingDocCategories.length > 0) {
      pending.push(`${ctx.pendingDocCategories.length} documentos pendientes`)
    }

    if (ctx.blockedTaskCount > 0) pending.push(`${ctx.blockedTaskCount} tareas bloqueadas`)
    if (ctx.highRiskCount > 0) pending.push(`${ctx.highRiskCount} riesgo${ctx.highRiskCount > 1 ? 's' : ''} alto${ctx.highRiskCount > 1 ? 's' : ''}`)
  } else {
    if (ctx.propertyUrl) completed.push('Propiedad cargada')
    else pending.push('Cargar datos de la propiedad')

    if (ctx.completedTaskCount > 0) completed.push(`${ctx.completedTaskCount} tareas completadas`)
    if (ctx.pendingDocCategories.length > 0) pending.push('Documentación pendiente')
  }

  const pct = ctx.totalTaskCount > 0
    ? Math.round((ctx.completedTaskCount / ctx.totalTaskCount) * 100)
    : ctx.propertyUrl ? 20 : 5

  return {
    completedItems: completed,
    pendingItems: pending,
    nextStep: getNextGuidanceStep(ctx),
    progressPct: pct,
    mode: ctx.mode,
  }
}
