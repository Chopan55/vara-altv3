import type { NextAction } from '@/lib/nba/engine'

/**
 * Pedidos de IA para el "próximo paso".
 *
 * El motor de próximos pasos (engine.ts) decide QUÉ hay que hacer con reglas
 * deterministas y auditables. La IA no decide nada de eso: solo ayuda a hacerlo,
 * explicándolo en simple o redactando el mensaje. Por eso lo que se le manda es
 * exactamente lo que el motor ya calculó, y nada más.
 *
 * Todo lo de acá es puro y testeable; el fetch vive en el componente.
 */

export type OperationKind = 'BUY' | 'SELL'

type ActionBrief = Pick<NextAction, 'title' | 'why'>

const NOUN: Record<OperationKind, string> = { BUY: 'compra', SELL: 'venta' }

/**
 * /api/chat etiqueta sus respuestas por certeza ([HECHO], [ESTIMADO]…). En un
 * mensaje listo para mandarle a un escribano esas etiquetas sobran.
 */
export function stripCertaintyLabels(text: string): string {
  return text.replace(/\[(?:HECHO|ESTIMADO|RECOMENDACI[OÓ]N|CONSULTAR PROFESIONAL)\]\s*/gi, '').trim()
}

/**
 * Contexto para /api/chat. El endpoint deduce si hablar con un comprador o un
 * vendedor buscando "compr" o "vend" en este texto.
 */
export function agentContext(kind: OperationKind, province?: string): string {
  const who = kind === 'SELL' ? 'Soy vendedor' : 'Soy comprador'
  return `${who}. Estoy mirando el próximo paso de mi ${NOUN[kind]}${province ? ` en ${province}` : ''}.`
}

export function buildExplainPrompt(action: ActionBrief, kind: OperationKind): string {
  return [
    `Explicame en tres oraciones simples, sin jerga, qué significa este paso de mi ${NOUN[kind]} y por qué importa:`,
    `"${action.title}".`,
    `Dato que ya sé: ${action.why}`,
    'Cerrá diciendo qué conviene hacer primero. No uses títulos ni listas.',
  ].join(' ')
}

export function buildDraftPrompt(action: ActionBrief, kind: OperationKind): string {
  return [
    `Redactá un mensaje corto y cordial, en español rioplatense, listo para copiar y pegar (WhatsApp o mail),`,
    `para pedir esto en mi ${NOUN[kind]}: "${action.title}".`,
    `Motivo: ${action.why}`,
    'Dirigilo a quien corresponda (el vendedor, el escribano o la inmobiliaria).',
    'Dejá entre [corchetes] cualquier dato que solo yo conozca.',
    'Respondé SOLO con el mensaje: sin introducción, sin etiquetas y sin explicaciones.',
  ].join(' ')
}
