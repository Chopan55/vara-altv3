import type { JurisdictionPack } from './types'

export const MX_PACK: JurisdictionPack = {
  countryCode: 'MX',
  countryName: 'México',
  locale: 'es-MX',
  timezone: 'America/Mexico_City',

  localCurrency: 'MXN',
  acceptedCurrencies: ['USD', 'MXN'],

  subdivisionLabel: 'Estado',
  subdivisionLabelPlural: 'Estados',

  professionalLabels: {
    CLOSING_PROFESSIONAL: 'Notario/a',
    LEGAL_ADVISOR: 'Abogado/a',
    SURVEYOR: 'Perito valuador',
    APPRAISER: 'Valuador/a',
    INSPECTOR: 'Inspector/a',
    BROKER: 'Inmobiliaria',
    FIELD_AGENT: 'Agente inmobiliario',
    OTHER: 'Otro profesional',
  },

  defaultProvinceCode: 'CDMX',
  closingStageLabel: 'Firma ante notario',
  transferTaxLabel: 'ISR',
  depositLabel: 'Apartado',

  neighborhoodLabel: 'Colonia',
  priceLabel: 'Precio',
  currencySymbol: '$',
}
