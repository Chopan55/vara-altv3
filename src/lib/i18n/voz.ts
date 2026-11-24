/**
 * Español según el país: Argentina con voseo (vos, tenés, escribano) y México con
 * tuteo (tú, tienes, notario). Regla de Pancho (2026-11-23): lo que ve alguien de
 * México no va en voseo. `voz(país, textoAR, textoMX)`.
 */
export type Pais = string | null | undefined

export const isMX = (country: Pais) => (country ?? '').toUpperCase() === 'MX'

export function voz<T>(country: Pais, ar: T, mx: T): T {
  return isMX(country) ? mx : ar
}
