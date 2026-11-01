/**
 * Limpia la respuesta del chat antes de mostrarla. El modelo etiqueta por certeza
 * ([HECHO], [ESTIMADO]…) y usa formato markdown (**negrita**), pero las pantallas
 * muestran texto plano: sin esto el usuario ve corchetes y asteriscos crudos.
 *
 * Las etiquetas se traducen a palabras en vez de borrarse, salvo [HECHO] que es
 * lo normal y no necesita aviso.
 */
const LABELS: [RegExp, string][] = [
  [/\[HECHO\]\s*/gi, ''],
  [/\[ESTIMADO\]\s*/gi, 'Aproximado: '],
  [/\[RECOMENDACI[OÓ]N\]\s*/gi, 'Recomendación: '],
  [/\[CONSULTAR PROFESIONAL\]\s*/gi, 'Consultá con un profesional: '],
]

export function cleanChatReply(text: string): string {
  let out = text
  for (const [re, to] of LABELS) out = out.replace(re, to)
  return out
    .replace(/\*\*([\s\S]+?)\*\*/g, '$1')
    .replace(/__([\s\S]+?)__/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
