/**
 * Borradores del asistente. El modelo escribe el mensaje listo para revisar entre dos líneas marcadas;
 * el servidor lo separa de la explicación para que la pantalla lo muestre en su propia tarjeta con «Copiar».
 * VARA nunca envía el borrador: la persona lo revisa y lo manda por su cuenta.
 */
const BLOCK = /^[ \t]*BORRADOR[ \t]*\n([\s\S]*?)\n[ \t]*FIN BORRADOR[ \t]*$/im
const MAX_DRAFT = 1500

export function extractDraft(text: string): { reply: string; draft?: string } {
  const match = BLOCK.exec(text)
  if (!match) return { reply: text.replace(/^[ \t]*(FIN )?BORRADOR[ \t]*$/gim, '').replace(/\n{3,}/g, '\n\n').trim() }
  const draft = match[1].trim().slice(0, MAX_DRAFT)
  const reply = (text.slice(0, match.index) + text.slice(match.index + match[0].length)).replace(/\n{3,}/g, '\n\n').trim()
  return { reply: reply || 'Te dejo un borrador para que lo revises.', draft: draft || undefined }
}
