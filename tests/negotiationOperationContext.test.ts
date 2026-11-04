import { describe, it, expect } from 'vitest'
import { buildOperationNegContext, formatOffer, NO_OFFERS, type ContextOffer } from '@/lib/negotiation/operationContext'

const op = { id: 'op-1', type: 'BUY_PROPERTY' as const, title: 'Depto Palermo', province: 'CABA' }
const offer = (amount: number, party: 'BUYER' | 'SELLER', created_at: string, status: ContextOffer['status'] = 'SENT'): ContextOffer =>
  ({ amount, currency: 'USD', party, status, created_at })

describe('buildOperationNegContext', () => {
  it('sin datos, lo dice en vez de inventar', () => {
    const c = buildOperationNegContext(op, [], [], [])
    expect(c.offerSummary).toBe(NO_OFFERS)
    expect(c.offerHistory).toBe(NO_OFFERS)
    expect(c.pendingDocsSummary).toBe('Documentación completa')
    expect(c.pendingTasksSummary).toBe('Sin tareas pendientes')
    expect(c.closingDate).toBeNull()
    expect(c.journeyType).toBe('Comprador')
  })

  it('historial cronológico y última oferta primero en la consulta', () => {
    const offers = [offer(420_000, 'SELLER', '2026-10-05T00:00:00Z', 'COUNTERED'), offer(390_000, 'BUYER', '2026-10-01T00:00:00Z')]
    const c = buildOperationNegContext(op, offers, [], [])
    expect(c.offerHistory.indexOf('Comprador')).toBeLessThan(c.offerHistory.indexOf('Vendedor'))
    expect(c.offerSummary).toContain('Vendedor: USD 420.000')
    expect(c.offerSummary).toContain('contraofertada')
  })

  it('usa los estados reales de la base (mayúsculas)', () => {
    const c = buildOperationNegContext(op, [],
      [{ title: 'Pedir informe de dominio', status: 'TODO', due_date: null }, { title: 'Tasación', status: 'DONE', due_date: null }],
      [{ name: 'Escritura', status: 'PENDING' }, { name: 'DNI', status: 'APPROVED' }, { name: 'Plano', status: 'IN_REVIEW' }],
    )
    expect(c.pendingTasksSummary).toBe('Pedir informe de dominio')
    expect(c.pendingDocsSummary).toBe('Escritura')
    expect(c.rawForPrompt).toContain('Documentos pendientes: Escritura')
  })

  it('vendedor según el tipo de operación', () => {
    expect(buildOperationNegContext({ ...op, type: 'SELL_PROPERTY' }, [], [], []).journeyType).toBe('Vendedor')
  })

  it('nunca menciona un precio de retiro', () => {
    const c = buildOperationNegContext(op, [offer(1, 'BUYER', '2026-10-01T00:00:00Z')], [], [])
    expect(c.rawForPrompt.toLowerCase()).not.toMatch(/walk|retiro|m[aá]ximo/)
  })

  it('una oferta sin monto no muestra 0', () => {
    expect(formatOffer(offer(0, 'BUYER', '2026-10-01T00:00:00Z'))).toContain('sin monto')
  })
})
