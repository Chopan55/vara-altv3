/** Opciones compartidas por el onboarding clásico y la entrada conversacional (/empezar). */
export const COUNTRIES = [
  { code: 'AR', label: 'Argentina' },
  { code: 'MX', label: 'México' },
] as const

export const PROVINCES_BY_COUNTRY: Record<string, string[]> = {
  AR: ['Buenos Aires', 'CABA', 'Córdoba', 'Santa Fe', 'Mendoza', 'Otro'],
  MX: ['Ciudad de México', 'Jalisco', 'Nuevo León', 'Estado de México', 'Querétaro', 'Puebla', 'Guanajuato', 'Chihuahua', 'Baja California', 'Yucatán', 'Otro MX'],
}
