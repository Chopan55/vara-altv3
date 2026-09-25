/**
 * Datos de prueba para los tests de VARA Visit.
 *
 * IMPORTANTE: estos partners existen SOLO acá, en `tests/`. No se importan
 * desde `src/` ni se muestran en ninguna pantalla, y `vitest.config.ts`
 * restringe la ejecución a `tests/**`. Es la diferencia entre un fixture de
 * test y un mock de producto: el fixture nunca llega al usuario.
 *
 * Los nombres son deliberadamente genéricos ("Partner A") para que nadie
 * caiga en la tentación de copiarlos a una pantalla como si fueran reales.
 * Ese fue el hallazgo P0-1 de VARA_VISIT_AUDIT.md.
 */

import type { PartnerPublicProfile, PartnerMetrics } from '@/types/varaVisit'
import { EMPTY_METRICS } from '@/types/varaVisit'

export function metrics(over: Partial<PartnerMetrics> = {}): PartnerMetrics {
  return { ...EMPTY_METRICS, ...over }
}

/** Partner válido por defecto: activo, verificado y certificado. */
export function partner(over: Partial<PartnerPublicProfile> = {}): PartnerPublicProfile {
  return {
    id: 'p-a',
    displayName: 'Partner A',
    initials: 'PA',
    photoUrl: null,
    bio: null,
    profession: null,
    experienceYears: null,
    languages: ['Español'],
    homeZoneLabel: 'Pilar, Buenos Aires',
    coverageZones: ['Pilar', 'Del Viso'],
    maxTravelRadiusKm: 15,
    serviceTypes: ['SHOW_PROPERTY', 'ACCOMPANY_VISIT'],
    tier: 'VERIFIED',
    status: 'ACTIVE',
    metrics: metrics(),
    verifiedIdentity: true,
    verifiedDocument: true,
    verifiedPhone: true,
    verifiedEmail: true,
    certified: true,
    ratePerVisit: 30,
    currency: 'USD',
    memberSince: '2026-01-01T00:00:00.000Z',
    ...over,
  }
}
