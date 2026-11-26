/**
 * Topes privados en el chat. Si la persona cuenta hasta cuánto pagaría o cuál es su piso, ese monto
 * no puede volver en una respuesta ni en un borrador pensado para la otra parte. El prompt ya lo pide,
 * pero una instrucción no es una garantía: acá se detectan las frases con un tope y la respuesta se
 * revisa con el mismo protector que usa la negociación.
 */
const LIMIT_HINT = /\b(tope|techo|m[aá]ximo|m[ií]nimo|l[ií]mite|piso|reserva|no pagar[ií]a|no pago m[aá]s|no puedo pagar m[aá]s|no vendo (?:por )?menos|no bajo de|hasta)\b/i

/** Frases de los mensajes de la persona que mencionan un tope (con monto o sin él). */
export function privateLimitText(messages: { role: string; content: string }[]): string {
  return messages
    .filter(m => m.role === 'user')
    .flatMap(m => m.content.split(/(?<=[.!?\n])\s+/))
    .filter(sentence => LIMIT_HINT.test(sentence) && /\d/.test(sentence))
    .join(' ')
}
