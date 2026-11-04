import type { JurisdictionPack } from './types'

/**
 * Colombia — EN VALIDACIÓN.
 * Solo terminología. No hay datos de costos: el motor regulatorio no calcula
 * nada para Colombia hasta validarlo con un notario o abogado colombiano.
 */
export const CO_PACK: JurisdictionPack = {
  countryCode: 'CO',
  readiness: 'validation',
  hasCostEngine: false,
  readinessNote: 'Terminología cargada. Costos e impuestos pendientes de validar con una notaría de Colombia.',
  countryName: 'Colombia',
  locale: 'es-CO',
  timezone: 'America/Bogota',

  localCurrency: 'COP',
  acceptedCurrencies: ['COP', 'USD'],

  subdivisionLabel: 'Departamento',
  subdivisionLabelPlural: 'Departamentos',

  professionalLabels: {
    CLOSING_PROFESSIONAL: 'Notario/a',
    LEGAL_ADVISOR: 'Abogado/a',
    SURVEYOR: 'Topógrafo/a',
    APPRAISER: 'Avaluador/a',
    INSPECTOR: 'Inspector/a',
    BROKER: 'Inmobiliaria',
    FIELD_AGENT: 'Asesor/a inmobiliario',
    OTHER: 'Otro profesional',
  },

  defaultProvinceCode: 'CO_BOGOTA',
  closingStageLabel: 'Escritura pública en notaría',
  transferTaxLabel: 'Impuestos de la compraventa',
  depositLabel: 'Promesa de compraventa',

  neighborhoodLabel: 'Barrio',
  priceLabel: 'Precio',
  currencySymbol: '$',
}
