/**
 * Borradores del asistente. El modelo escribe el mensaje listo para revisar entre dos líneas marcadas;
 * el servidor lo separa de la explicación para que la pantalla lo muestre en su propia tarjeta con «Copiar».
 * VARA nunca envía el borrador: la persona lo revisa y lo manda por su cuenta.
 * Un solo borrador por respuesta: si el modelo escribe más de uno, se conserva el primero.
 */
const BLOCK = /^[ \t]*BORRADOR[ \t]*\n([\s\S]*?)\n[ \t]*FIN BORRADOR[ \t]*$/gim
// Línea que anuncia el borrador y termina en dos puntos («A continuación, te dejo un borrador:»): sobra, la tarjeta ya lo muestra.
const ANNOUNCE = /^[^\n]*:[ \t]*\n+(?=[ \t]*BORRADOR[ \t]*\n)/gim
const STRAY_MARKER = /^[ \t]*(?:FIN )?BORRADOR[ \t]*$/gim
const MAX_DRAFT = 1500

export function extractDraft(raw: string): { reply: string; draft?: string } {
  const text = raw.replace(/\r\n?/g, '\n')
  const blocks = [...text.matchAll(BLOCK)]
  const tidy = (value: string) => value.replace(STRAY_MARKER, '').replace(/\n{3,}/g, '\n\n').trim()
  if (blocks.length === 0) return { reply: tidy(text) }
  // El modelo a veces enmarca el borrador con rayas (---): son decoración, no parte del mensaje.
  const draft = blocks[0][1].replace(/^\s*(?:-{3,}|_{3,}|\*{3,})\s*$/gm, '').trim().slice(0, MAX_DRAFT)
  const reply = tidy(text.replace(ANNOUNCE, '').replace(BLOCK, ''))
  return { reply: reply || 'Te dejo un borrador para que lo revises.', draft: draft || undefined }
}
