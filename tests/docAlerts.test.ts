import { describe, it, expect } from 'vitest'
import { buildOpDocStatus, mergeAndRankAlerts } from '@/lib/docAlerts'
import type { SellerTaskState } from '@/lib/supabase/sellerTasks'

const task = (key: string, extra: Partial<SellerTaskState> = {}): SellerTaskState =>
  ({ id: key, key, title: key, description: '', done: false, ...extra })

const inDays = (n: number) => {
  const d = new Date(); d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

describe('buildOpDocStatus', () => {
  it('cruza los documentos: vencido es crítico, rechazado alto, pendiente medio', () => {
    const s = buildOpDocStatus('op', 'Casa', 'BUY', [], [
      { id: 'a', name: 'Informe de dominio', status: 'EXPIRED' },
      { id: 'b', name: 'Libre deuda', status: 'REJECTED' },
      { id: 'c', name: 'Planos', status: 'PENDING' },
      { id: 'd', name: 'Escritura', status: 'APPROVED' },
    ])
    expect(s.alerts.map(a => [a.taskTitle, a.severity])).toEqual([
      ['Informe de dominio', 'CRITICAL'], ['Libre deuda', 'HIGH'], ['Planos', 'MEDIUM'],
    ])
    expect(s.docProblems).toBe(2)
    expect(s.light).toBe('RED')
  })

  it('en compras avisa por las tareas clave sin fecha (oferta, reserva, boleto, financiamiento)', () => {
    const s = buildOpDocStatus('op', 'Casa', 'BUY', ['financiamiento', 'oferta', 'reserva', 'boleto', 'visitas'].map(k => task(k)))
    expect(s.alerts.map(a => a.taskKey).sort()).toEqual(['boleto', 'financiamiento', 'oferta', 'reserva'])
    expect(s.noDate).toBe(4)
  })

  it('tareas: vencida, por vencer y hecha', () => {
    const s = buildOpDocStatus('op', 'Casa', 'SELL', [
      task('docs', { dueDate: inDays(-2) }), task('price', { dueDate: inDays(1) }), task('photos', { done: true }),
    ])
    expect(s.overdue).toBe(1)
    expect(s.dueSoon).toBe(1)
    expect(s.done).toBe(1)
    expect(s.light).toBe('RED')
  })

  it('sin documentos ni tareas pendientes queda en verde', () => {
    const s = buildOpDocStatus('op', 'Casa', 'SELL', [task('docs', { done: true })], [{ id: 'x', name: 'Escritura', status: 'APPROVED' }])
    expect(s.light).toBe('GREEN')
    expect(s.alerts).toEqual([])
  })
})

describe('mergeAndRankAlerts', () => {
  it('ordena por gravedad entre operaciones', () => {
    const a = buildOpDocStatus('1', 'A', 'BUY', [], [{ id: 'p', name: 'P', status: 'PENDING' }])
    const b = buildOpDocStatus('2', 'B', 'SELL', [], [{ id: 'e', name: 'E', status: 'EXPIRED' }])
    expect(mergeAndRankAlerts([a, b]).map(x => x.severity)).toEqual(['CRITICAL', 'MEDIUM'])
  })
})
