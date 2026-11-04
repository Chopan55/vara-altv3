import type { ParticipantRoleDb } from '@/lib/supabase/types'

/**
 * Nombre de cada rol de participante. Una sola fuente para toda la app:
 * en México el profesional de cierre es notario y no hay martilleros.
 */
const BASE: Record<ParticipantRoleDb, string> = {
  COUNTERPARTY: 'La otra parte',
  NOTARY: 'Escribano/a',
  BROKER: 'Martillero / Inmobiliaria',
  LAWYER: 'Abogado/a',
  ACCOUNTANT: 'Contador/a',
  APPRAISER: 'Tasador/a',
  BANK: 'Banco',
  OTHER: 'Otro',
}

const MX: Partial<Record<ParticipantRoleDb, string>> = {
  NOTARY: 'Notario/a',
  BROKER: 'Asesor/a inmobiliario',
  APPRAISER: 'Perito valuador',
}

export const PARTICIPANT_ROLES = Object.keys(BASE) as ParticipantRoleDb[]

export function participantRoleLabels(country?: string | null): Record<ParticipantRoleDb, string> {
  return country === 'MX' ? { ...BASE, ...MX } : BASE
}

export function participantRoleLabel(role: string, country?: string | null): string {
  return participantRoleLabels(country)[role as ParticipantRoleDb] ?? role
}
