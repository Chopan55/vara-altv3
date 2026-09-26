import type { JurisdictionPack } from './types'

export const AR_PACK: JurisdictionPack = {
  countryCode: 'AR',
  countryName: 'Argentina',
  locale: 'es-AR',
  timezone: 'America/Argentina/Buenos_Aires',

  localCurrency: 'ARS',
  acceptedCurrencies: ['USD', 'ARS'],

  subdivisionLabel: 'Provincia',
  subdivisionLabelPlural: 'Provincias',

  professionalLabels: {
    CLOSING_PROFESSIONAL: 'Escribano/a',
    LEGAL_ADVISOR: 'Abogado/a',
    SURVEYOR: 'Agrimensor/a',
    APPRAISER: 'Tasador/a',
    INSPECTOR: 'Inspector/a',
    BROKER: 'Inmobiliaria',
    FIELD_AGENT: 'Agente de campo',
    OTHER: 'Otro profesional',
  },

  defaultProvinceCode: 'BUENOS_AIRES',
  closingStageLabel: 'Escritura',
  transferTaxLabel: 'ITI',
  depositLabel: 'Reserva',

  neighborhoodLabel: 'Barrio',
  priceLabel: 'Precio',
  currencySymbol: '$',
}
