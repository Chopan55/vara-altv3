/**
 * Texto de un PDF, página por página, en el servidor (sin enviar el archivo a ningún tercero).
 * Un PDF escaneado (solo imagen) devuelve páginas vacías: el lector lo informa como «no legible».
 */
import { extractText, getDocumentProxy } from 'unpdf'

export const MAX_PDF_BYTES = 15 * 1024 * 1024
export const MAX_PDF_PAGES = 200

export class TooManyPagesError extends Error {
  constructor(readonly pages: number) { super('too_many_pages') }
}

export async function extractPages(data: Uint8Array): Promise<string[]> {
  const pdf = await getDocumentProxy(data)
  // Se mira la cantidad ANTES de extraer: un PDF enorme no consume CPU ni memoria y nunca se recorta en silencio.
  if (pdf.numPages > MAX_PDF_PAGES) throw new TooManyPagesError(pdf.numPages)
  const { text } = await extractText(pdf, { mergePages: false })
  return Array.isArray(text) ? text : [text]
}
