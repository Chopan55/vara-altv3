/**
 * Interesados de una venta: solo lo necesario (quién, de dónde vino, en qué etapa
 * está y una nota). No es un CRM. Se guarda en el navegador por operación.
 */
export const LEAD_STATUSES = [
  { id: 'INQUIRY', label: 'Consultó' },
  { id: 'VISIT', label: 'Visita' },
  { id: 'OFFER', label: 'Oferta' },
  { id: 'DISCARDED', label: 'Descartado' },
] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]['id']

export const LEAD_SOURCES = ['Portal', 'WhatsApp', 'Cartel', 'Conocido', 'Otro'] as const

export interface Lead {
  id: string
  name: string
  source: string
  status: LeadStatus
  note: string
  createdAt: number
}

const KEY = 'vara_leads_'

export function loadLeads(opId: string): Lead[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY + opId) ?? '[]') as Lead[]
    return Array.isArray(raw) ? raw : []
  } catch { return [] }
}

function persist(opId: string, leads: Lead[]): Lead[] {
  try { localStorage.setItem(KEY + opId, JSON.stringify(leads)) } catch {}
  return leads
}

export function addLead(opId: string, input: { name: string; source: string; note?: string }, now = Date.now()): Lead[] {
  const name = input.name.trim().slice(0, 80)
  if (!name) return loadLeads(opId)
  const lead: Lead = { id: `ld-${now}-${Math.random().toString(36).slice(2, 7)}`, name, source: input.source || 'Otro', status: 'INQUIRY', note: (input.note ?? '').trim().slice(0, 300), createdAt: now }
  return persist(opId, [lead, ...loadLeads(opId)])
}

export function setLeadStatus(opId: string, id: string, status: LeadStatus): Lead[] {
  return persist(opId, loadLeads(opId).map(l => (l.id === id ? { ...l, status } : l)))
}

export function removeLead(opId: string, id: string): Lead[] {
  return persist(opId, loadLeads(opId).filter(l => l.id !== id))
}

/** Totales para el seguimiento: los descartados no cuentan como interés activo. */
export function leadCounts(leads: Lead[]): { inquiries: number; visits: number; offers: number; active: number } {
  const live = leads.filter(l => l.status !== 'DISCARDED')
  return {
    inquiries: leads.length,
    visits: leads.filter(l => l.status === 'VISIT' || l.status === 'OFFER').length,
    offers: leads.filter(l => l.status === 'OFFER').length,
    active: live.length,
  }
}
