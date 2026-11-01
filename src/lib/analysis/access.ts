/**
 * Acceso a VARA Buy WOW V3.
 *
 * Tres formas de entrar, de más a menos permanente:
 *   1. flag `buyWowV3` (NEXT_PUBLIC_FLAGS)
 *   2. `?v3=1` en la URL: queda recordado en este navegador
 *   3. clave `vara_v3_preview` en localStorage
 *
 * Así se puede probar V3 contra el producto actual sin deploy ni configuración.
 */

import { isEnabled } from '@/lib/flags'

const PREVIEW_KEY = 'vara_v3_preview'

export function isBuyWowV3Enabled(search: string = ''): boolean {
  if (isEnabled('buyWowV3')) return true
  try {
    const q = new URLSearchParams(search)
    if (q.get('v3') === '0') {
      localStorage.removeItem(PREVIEW_KEY)
      return false
    }
    if (q.get('v3') === '1') {
      localStorage.setItem(PREVIEW_KEY, '1')
      return true
    }
    return localStorage.getItem(PREVIEW_KEY) === '1'
  } catch {
    return false
  }
}
