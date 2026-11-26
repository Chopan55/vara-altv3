/**
 * Contexto que se le da a la voz cuando la persona tiene una operación verificada.
 * Pura: se prueba sin red. La arma el servidor; el navegador nunca elige qué se le cuenta a la voz.
 */
import { MX_ADDENDUM, VERIFIED_USAGE_RULES, type OperationContext } from './operationContext'

/** Lo que VARA dice al abrir la conversación cuando ya conoce la operación. */
export const GREETING_INSTRUCTIONS =
  'Saludá en una sola frase corta y ofrecé el próximo paso según el estado registrado de la operación, con voz natural. No leas listas ni datos técnicos: decí lo más importante y preguntá por dónde quiere arrancar.'

const VOICE_RULES = [
  'La persona ya tiene una operación en VARA y conocés su estado registrado.',
  'Hablá con naturalidad: no leas el JSON ni códigos como RESERVA o IN_REVIEW tal cual; decí «en la etapa de reserva» o «en revisión».',
  'Si preguntan por costos de escrituración, usá solo los valores de la calculadora de VARA de abajo y decí que son aproximados; no des porcentajes de memoria.',
  'Si piden un mensaje para el vendedor o la inmobiliaria, ofrecé dejarlo escrito en el chat para que lo revise y lo copie: por voz no se envía nada.',
].join('\n')

export function voiceContext(operation: OperationContext | null, costText: string | null): string | null {
  if (!operation) return null
  const parts = [VOICE_RULES]
  if (operation.country === 'MX') parts.push(MX_ADDENDUM)
  parts.push(operation.text, VERIFIED_USAGE_RULES)
  if (costText) parts.push(costText)
  return parts.join('\n\n')
}
