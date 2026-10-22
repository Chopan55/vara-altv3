/**
 * Acciones que el asistente muestra como botón debajo de una respuesta.
 *
 * Son SOLO navegación a pantallas de VARA: no envían mensajes, no crean ofertas, no modifican datos.
 * No las decide el modelo (no puede inventar destinos): salen de la pregunta de la persona y de lo que ya sabe
 * el contexto (operación, propiedad, próxima acción del motor). Texto y voz usan esta misma función.
 */

import type { ActionContext } from '@/lib/assistant/context'

export type ActionId =
  | 'next_step' | 'view_costs' | 'view_documents' | 'view_risks' | 'view_operation'
  | 'open_property' | 'complete_property' | 'analyze_property' | 'compare' | 'prepare_sale' | 'open_negotiation'

export interface AssistantAction {
  id: ActionId
  label: string
  href: string
}

export const MAX_ACTIONS = 2

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

interface Rule {
  test: RegExp
  build: (c: ActionContext) => AssistantAction | null
}

const tab = (c: ActionContext, t: string) => (c.operationId ? `/operacion/${c.operationId}?tab=${t}` : null)

// El orden es la prioridad: lo más específico primero.
const RULES: Rule[] = [
  {
    // "¿Qué tengo que hacer ahora?", "¿Qué harías vos?", "¿Por qué esta es la próxima acción?"
    test: /(que (tengo|debo|hago|hacer|harias|sigue)|proxim[ao]|siguiente paso|por que (es|esta|esa)|en mi lugar|ahora)/,
    build: c => (c.primary ? { id: 'next_step', label: c.primary.label, href: c.primary.href } : null),
  },
  {
    test: /(cost|gasto|cuanto (me )?(va a )?(cuesta|costar|salir|sale|pago)|escritur|sellos|honorario|impuesto|presupuesto)/,
    build: c => ({ id: 'view_costs', label: 'Ver costos', href: tab(c, 'costos') ?? '/costos' }),
  },
  {
    test: /(document|papel|certificado|que me falta|que falta)/,
    build: c => { const href = tab(c, 'documentos'); return href ? { id: 'view_documents', label: 'Ver documentos', href } : null },
  },
  {
    test: /(riesgo|peligro|alerta|problema|bloque|fren)/,
    build: c => { const href = tab(c, 'riesgos'); return href ? { id: 'view_risks', label: 'Ver riesgos', href } : null },
  },
  {
    test: /(que me falta|que falta|falta|complet|datos de la propiedad|ficha|no sabemos|no sabes|desconoc)/,
    build: c => (c.propertyId && c.propertyIncomplete ? { id: 'complete_property', label: 'Completar la propiedad', href: `/propiedades/${c.propertyId}` } : null),
  },
  {
    test: /(propiedad|depto|departamento|aviso|que sabemos|que sabes)/,
    build: c => (c.propertyId
      ? { id: 'open_property', label: 'Abrir la propiedad', href: `/propiedades/${c.propertyId}` }
      : { id: 'open_property', label: 'Cargar la propiedad', href: '/propiedades' }),
  },
  {
    test: /(analiz|vale la pena|buen precio|precio justo|conviene comprar)/,
    build: () => ({ id: 'analyze_property', label: 'Analizar propiedad', href: '/analizar' }),
  },
  {
    test: /(compar|otra propiedad|otro (depto|departamento|aviso)|alternativa)/,
    build: () => ({ id: 'compare', label: 'Ir a comparar', href: '/comparar' }),
  },
  {
    test: /(vender|venta|publicar|preparar la venta)/,
    build: c => (c.kind === 'BUY' ? null : { id: 'prepare_sale', label: 'Preparar la venta', href: '/preparar-venta' }),
  },
  {
    test: /(mensaje|redact|vendedor|negoci|oferta|contraoferta|regate)/,
    build: () => ({ id: 'open_negotiation', label: 'Abrir negociación', href: '/negociacion' }),
  },
  {
    test: /(mi operacion|ver operacion|etapa|avance|progreso|como voy)/,
    build: c => (c.operationId ? { id: 'view_operation', label: 'Ver mi operación', href: `/operacion/${c.operationId}` } : null),
  },
]

/** Hasta dos botones, en orden de relevancia, sin repetir destino. Sin pregunta no hay acciones. */
export function suggestActions(ctx: ActionContext, question: string): AssistantAction[] {
  const q = norm(question).trim()
  if (!q) return []
  const out: AssistantAction[] = []
  const seen = new Set<string>()
  for (const rule of RULES) {
    if (out.length >= MAX_ACTIONS) break
    if (!rule.test.test(q)) continue
    const action = rule.build(ctx)
    if (!action || seen.has(action.href)) continue
    seen.add(action.href)
    out.push(action)
  }
  return out
}

/** Solo se muestran destinos internos de VARA (por si un historial guardado llegara alterado). */
export function isSafeAction(a: unknown): a is AssistantAction {
  if (!a || typeof a !== 'object') return false
  const { id, label, href } = a as Record<string, unknown>
  return typeof id === 'string' && typeof label === 'string' && typeof href === 'string' && /^\/(?!\/)[A-Za-z0-9/_\-?=&%.]*$/.test(href)
}
