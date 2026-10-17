/**
 * Voz de VARA: qué texto se lee y con qué tono.
 *
 * La voz solo lee respuestas que el chat ya produjo (y validó contra el análisis);
 * acá se limpia el texto y se acota para que el gasto de audio sea previsible.
 */

export const SPEECH_MAX_CHARS = 800

export const SPEECH_INSTRUCTIONS =
  'Hablá en español rioplatense, con voz cálida, clara y profesional, a un ritmo natural y tranquilo. ' +
  'Leé las cifras con claridad y sin dramatizar.'

/** Texto listo para leer en voz alta, o null si no hay nada razonable que leer. */
export function sanitizeSpeechText(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const text = input
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_`#>~]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length < 2) return null
  if (text.length <= SPEECH_MAX_CHARS) return text

  // Se corta en el último final de oración para no dejar una frase a medias.
  const cut = text.slice(0, SPEECH_MAX_CHARS)
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '))
  return end > SPEECH_MAX_CHARS * 0.5 ? cut.slice(0, end + 1) : cut
}
