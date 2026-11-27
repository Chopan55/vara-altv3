/**
 * Contexto que se le da a la voz cuando la persona tiene una operación verificada.
 * Pura: se prueba sin red. La arma el servidor; el navegador nunca elige qué se le cuenta a la voz.
 */
import { MX_ADDENDUM, MX_REMINDER, VERIFIED_USAGE_RULES, nameRule, type OperationContext } from './operationContext'

const VOICE_RULES = [
  'La persona ya tiene una operación en VARA y conocés su estado registrado.',
  'Hablá con naturalidad: no leas el JSON ni códigos como RESERVA o IN_REVIEW tal cual; decí «en la etapa de reserva» o «en revisión».',
  'Si preguntan por costos de escrituración, usá solo los valores de la calculadora de VARA de abajo y decí que son aproximados; no des porcentajes de memoria.',
  'Cuando la conversación recién empieza y todavía no hay mensajes, tu primera intervención es saludar en una sola frase corta y ofrecer el próximo paso según el estado registrado, con voz natural; no leas listas ni datos técnicos: decí lo más importante y preguntá por dónde quiere arrancar.',
  'Si piden un mensaje para el vendedor o la inmobiliaria, ofrecé dejarlo escrito en el chat para que lo revise y lo copie: por voz no se envía nada.',
].join('\n')

export function voiceContext(operation: OperationContext | null, costText: string | null): string | null {
  if (!operation) return null
  const parts = [VOICE_RULES]
  if (operation.country === 'MX') parts.push(MX_ADDENDUM)
  parts.push(operation.text, VERIFIED_USAGE_RULES)
  const who = nameRule(operation.firstName)
  if (who) parts.push(who + ' En el primer saludo, decile su nombre.')
  if (costText) parts.push(costText)
  if (operation.country === 'MX') parts.push(MX_REMINDER)
  return parts.join('\n\n')
}
