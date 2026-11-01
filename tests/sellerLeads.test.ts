import { describe, it, expect, beforeEach } from 'vitest'
import { addLead, leadCounts, loadLeads, removeLead, setLeadStatus } from '@/lib/sellerLeads'

const store = new Map<string, string>()
;(globalThis as { localStorage?: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(), key: () => null, length: 0,
} as Storage

describe('interesados de una venta', () => {
  beforeEach(() => store.clear())

  it('arranca vacío y no agrega personas sin nombre', () => {
    expect(loadLeads('op1')).toEqual([])
    expect(addLead('op1', { name: '   ', source: 'Portal' })).toEqual([])
  })

  it('agrega, cambia de etapa y quita', () => {
    const [l] = addLead('op1', { name: ' Ana ', source: 'Portal', note: 'Pregunta por expensas' })
    expect(l.name).toBe('Ana')
    expect(l.status).toBe('INQUIRY')
    expect(setLeadStatus('op1', l.id, 'VISIT')[0].status).toBe('VISIT')
    expect(removeLead('op1', l.id)).toEqual([])
  })

  it('cada operación tiene su propia lista', () => {
    addLead('opA', { name: 'Ana', source: 'Portal' })
    expect(loadLeads('opB')).toEqual([])
  })

  it('cuenta consultas, visitas y ofertas', () => {
    let leads = addLead('op1', { name: 'A', source: 'Portal' }, 1)
    leads = addLead('op1', { name: 'B', source: 'WhatsApp' }, 2)
    leads = addLead('op1', { name: 'C', source: 'Cartel' }, 3)
    leads = setLeadStatus('op1', leads[0].id, 'OFFER')
    leads = setLeadStatus('op1', leads[1].id, 'VISIT')
    leads = setLeadStatus('op1', leads[2].id, 'DISCARDED')
    expect(leadCounts(leads)).toEqual({ inquiries: 3, visits: 2, offers: 1, active: 2 })
  })
})
