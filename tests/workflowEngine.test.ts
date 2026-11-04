import { describe, it, expect } from 'vitest'
import { BUILT_IN_RULES, runWorkflows, type WorkflowSnapshot } from '@/lib/workflowEngine'

const NOW = new Date('2026-11-04T12:00:00').getTime()
const day = (n: number) => {
  const d = new Date(NOW); d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
const snap = (p: Partial<WorkflowSnapshot>): WorkflowSnapshot =>
  ({ operationId: 'op', type: 'SELL', tasks: [], docs: [], offers: [], ...p })
const ids = (s: WorkflowSnapshot) => runWorkflows(s, BUILT_IN_RULES, NOW).map(r => r.ruleId)

describe('runWorkflows', () => {
  it('tarea crítica vencida dispara la alerta (también con claves de compra)', () => {
    expect(ids(snap({ tasks: [{ key: 'docs', done: false, dueDate: day(-1) }] }))).toContain('wr-001')
    expect(ids(snap({ type: 'BUY', tasks: [{ key: 'boleto', done: false, dueDate: day(-1) }] }))).toContain('wr-001')
  })

  it('respeta el umbral de días: a 2 días avisa, a 10 no', () => {
    expect(ids(snap({ tasks: [{ key: 'docs', done: false, dueDate: day(2) }] }))).toContain('wr-002')
    expect(ids(snap({ tasks: [{ key: 'docs', done: false, dueDate: day(10) }] }))).not.toContain('wr-002')
  })

  it('oferta recibida de la contraparte esperando respuesta', () => {
    expect(ids(snap({ offers: [{ party: 'BUYER', status: 'SENT' }] }))).toContain('wr-005')
    expect(ids(snap({ offers: [{ party: 'BUYER', status: 'ACCEPTED' }] }))).not.toContain('wr-005')
  })

  it('operación estancada solo pasado el umbral', () => {
    expect(ids(snap({ lastActivityAt: NOW - 8 * 86_400_000 }))).toContain('wr-006')
    expect(ids(snap({ lastActivityAt: NOW - 2 * 86_400_000 }))).not.toContain('wr-006')
    expect(ids(snap({}))).not.toContain('wr-006')
  })

  it('no sugiere un paso que ya está hecho', () => {
    const base = { tasks: [{ key: 'offer', done: true }] }
    expect(ids(snap(base))).toContain('wr-007')
    expect(ids(snap({ tasks: [{ key: 'offer', done: true }, { key: 'escritura', done: true }] }))).not.toContain('wr-007')
  })

  it('documentación completa sugiere avanzar (venta)', () => {
    expect(ids(snap({ docs: [{ id: '1', name: 'A', status: 'APPROVED' }, { id: '2', name: 'B', status: 'RECEIVED' }] }))).toContain('wr-003')
    expect(ids(snap({ docs: [{ id: '1', name: 'A', status: 'PENDING' }] }))).not.toContain('wr-003')
  })

  it('una regla desactivada no dispara', () => {
    const off = BUILT_IN_RULES.map(r => r.id === 'wr-001' ? { ...r, enabled: false } : r)
    expect(runWorkflows(snap({ tasks: [{ key: 'docs', done: false, dueDate: day(-1) }] }), off, NOW).map(r => r.ruleId)).not.toContain('wr-001')
  })
})
