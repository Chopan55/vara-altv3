/**
 * Texto de un PDF, página por página, en el servidor (sin enviar el archivo a ningún tercero).
 * Un PDF escaneado (solo imagen) devuelve páginas vacías: el lector lo informa como «no legible».
 */
import { extractText, getDocumentProxy } from 'unpdf'

export const MAX_PDF_BYTES = 15 * 1024 * 1024
export const MAX_PDF_PAGES = 200

export async function extractPages(data: Uint8Array): Promise<string[]> {
  const pdf = await getDocumentProxy(data)
  const { text } = await extractText(pdf, { mergePages: false })
  const pages = Array.isArray(text) ? text : [text]
  return pages.slice(0, MAX_PDF_PAGES)
}
