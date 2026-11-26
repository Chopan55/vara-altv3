/**
 * Topes privados en el chat. Si la persona cuenta hasta cuánto pagaría o cuál es su piso, ese monto
 * no puede volver en una respuesta ni en un borrador pensado para la otra parte. El prompt ya lo pide,
 * pero una instrucción no es una garantía: acá se detectan las frases en primera persona con un tope y la
 * respuesta se revisa con el mismo protector que usa la negociación. Montos de otros («el vendedor acepta
 * hasta USD 150.000», «la reserva es USD 10.000») no se tocan.
 */
const LIMIT_HINT = new RegExp([
  // «mi tope», «mi techo», «mi máximo», «mi límite», «mi piso»
  String.raw`\bmi\s+(?:tope|techo|m[aá]ximo|l[ií]mite|piso)\b`,
  // «no pagaría más», «no pago más», «no puedo pagar más», «no subo de», «no vendo por menos», «no bajo de»
  String.raw`\bno\s+(?:pagar[ií]a|pago|puedo\s+pagar|subo|subir[ií]a|vendo|vender[ií]a|bajo|bajar[ií]a)\b`,
  // «puedo pagar hasta», «llego hasta», «pagaría hasta»
  String.raw`\b(?:puedo|podr[ií]a|llego|pagar[ií]a)\s+(?:pagar\s+)?hasta\b`,
].join('|'), 'i')

/** Frases de los mensajes de la persona que mencionan un tope (con monto o sin él). */
export function privateLimitText(messages: { role: string; content: string }[]): string {
  return messages
    .filter(m => m.role === 'user')
    .flatMap(m => m.content.split(/(?<=[.!?\n])\s+/))
    .filter(sentence => LIMIT_HINT.test(sentence) && /\d/.test(sentence))
    .join(' ')
}
