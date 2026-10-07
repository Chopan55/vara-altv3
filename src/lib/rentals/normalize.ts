import type { RentalCountry, RentalInput, RentalJurisdiction } from './types'

/**
 * Helpers de lectura de datos del formulario. Toda la lógica del módulo pasa los
 * números por acá para no romperse con vacíos, NaN, negativos o strings.
 */

/** Importe válido: finito y positivo. Todo lo demás (null, NaN, negativo) es 0. */
export function amount(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

/** ¿El usuario declaró el dato? (0 cuenta como declarado; null/NaN no.) */
export function isDeclared(value: number | null | undefined): boolean {
  return typeof value === 'number' && Number.isFinite(value)
}

export const JURISDICTION_COUNTRY: Record<RentalJurisdiction, RentalCountry> = {
  AR_CABA: 'AR',
  MX_CDMX: 'MX',
}

/** País y jurisdicción tienen que ser coherentes; si no, no se aplica ninguna regla. */
export function isJurisdictionConsistent(input: Pick<RentalInput, 'country' | 'jurisdiction'>): boolean {
  return JURISDICTION_COUNTRY[input.jurisdiction] === input.country
}

/** Redondea a 2 decimales sin arrastrar error de punto flotante. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
