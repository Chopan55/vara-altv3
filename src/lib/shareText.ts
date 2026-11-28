import { copyText } from '@/components/buy-v3/format'

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed'

/**
 * En celular el menú de compartir del sistema es más confiable que abrir una pestaña vacía de wa.me.
 * - Si la persona cancela el menú, NO se copia nada a escondidas.
 * - Si no hay menú (compu) o falla de verdad, se copia; si tampoco se puede copiar, se informa `failed`.
 */
export async function shareText(text: string): Promise<ShareResult> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ text })
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    }
  }
  return (await copyText(text)) ? 'copied' : 'failed'
}

export const SHARE_NOTE: Record<ShareResult, string> = {
  shared: 'Listo: elegiste con quién compartirlo.',
  copied: 'Mensaje copiado. Pegalo en WhatsApp o donde quieras.',
  cancelled: '',
  failed: 'No pudimos copiar solos. Mantené apretado el mensaje de arriba, elegí Copiar y pegalo donde quieras.',
}
