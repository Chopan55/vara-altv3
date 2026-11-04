import type { JurisdictionPack } from './types'

/**
 * Chile — EN VALIDACIÓN.
 * Solo terminología. No hay datos de costos: el motor regulatorio no calcula
 * nada para Chile hasta validarlo con un notario o abogado chileno.
 */
export const CL_PACK: JurisdictionPack = {
  countryCode: 'CL',
  readiness: 'validation',
  hasCostEngine: false,
  readinessNote: 'Terminología cargada. Costos e impuestos pendientes de validar con un notario de Chile.',
  countryName: 'Chile',
  locale: 'es-CL',
  timezone: 'America/Santiago',

  localCurrency: 'CLP',
  acceptedCurrencies: ['CLP', 'USD'],

  subdivisionLabel: 'Región',
  subdivisionLabelPlural: 'Regiones',

  professionalLabels: {
    CLOSING_PROFESSIONAL: 'Notario/a',
    LEGAL_ADVISOR: 'Abogado/a',
    SURVEYOR: 'Topógrafo/a',
    APPRAISER: 'Tasador/a',
    INSPECTOR: 'Inspector/a',
    BROKER: 'Corredora de propiedades',
    FIELD_AGENT: 'Corredor/a de propiedades',
    OTHER: 'Otro profesional',
  },

  defaultProvinceCode: 'CL_RM',
  closingStageLabel: 'Escritura ante notario',
  transferTaxLabel: 'Impuestos de la compraventa',
  depositLabel: 'Promesa de compraventa',

  neighborhoodLabel: 'Comuna',
  priceLabel: 'Precio',
  currencySymbol: '$',
}
