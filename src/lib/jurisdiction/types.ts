import type { CountryCode, Currency, ProfessionalRole } from '@/types'

/**
 * JurisdictionPack — configuración de un país para VARA.
 *
 * Una instancia por país. El core de VARA nunca hardcodea strings AR-específicos;
 * los lee del pack activo. Para agregar un nuevo país: crear el pack, registrarlo
 * en index.ts.
 */
export interface JurisdictionPack {
  countryCode: CountryCode

  // ── Identidad ──────────────────────────────────────────────────────────────
  countryName: string
  locale: string        // BCP 47, ej. 'es-AR', 'es-MX'
  timezone: string      // IANA, ej. 'America/Argentina/Buenos_Aires'

  // ── Moneda ─────────────────────────────────────────────────────────────────
  localCurrency: Currency
  /** Monedas aceptadas en operaciones inmobiliarias */
  acceptedCurrencies: Currency[]

  // ── División territorial ────────────────────────────────────────────────────
  /** Nombre del nivel administrativo (provincia, estado, región, departamento) */
  subdivisionLabel: string
  subdivisionLabelPlural: string

  // ── Terminología profesional ────────────────────────────────────────────────
  /** Nombre local de cada rol profesional */
  professionalLabels: Record<ProfessionalRole, string>

  // ── Regulatoria ────────────────────────────────────────────────────────────
  /** Código de la jurisdicción default para regulaciones (ej. 'BUENOS_AIRES') */
  defaultProvinceCode: string
  /** Nombre de la etapa de cierre (ej. 'Escritura', 'Firma ante notario') */
  closingStageLabel: string
  /** Nombre del impuesto de transferencia (ej. 'ITI', 'ISR') */
  transferTaxLabel: string
  /** Nombre de la reserva/seña (ej. 'Reserva', 'Apartado') */
  depositLabel: string

  // ── UX copy ─────────────────────────────────────────────────────────────────
  /** Etiqueta para el campo de búsqueda de zona ('Barrio', 'Colonia', 'Zona') */
  neighborhoodLabel: string
  /** Etiqueta para precio ('Precio', 'Valor') */
  priceLabel: string
  /** Símbolo de moneda local ('$', 'S/', 'R$') */
  currencySymbol: string
}
