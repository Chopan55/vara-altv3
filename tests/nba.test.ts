/**
 * Next Best Action.
 *
 * Lo que más importa acá no es que recomiende bien, sino que **no recomiende
 * nada cuando no sabe**. El motor anterior leía una operación ficticia y le
 * daba consejos específicos a gente real; estos tests existen para que eso
 * no pueda volver a pasar.
 */

import { describe, it, expect } from 'vitest'
import {
  computeNextActions, primaryAction, blockingCount, SETUP_ACTION,
} from '@/lib/nba/engine'
import type { Transaction, Task, Document, Risk, TransactionStage } from '@/types'

function task(over: Partial<Task> = {}): Task {
  return {
    id: 't-1', title: 'Solicitar informe de dominio', description: 'Pedirlo al Registro',
    why: 'Confirma quién es el titular', status: 'TODO', priority: 'HIGH',
    responsibleRole: 'Comprador', documentsRequired: [], stageId: 's-1', ...over,
  }
}

function doc(over: Partial<Document> = {}): Document {
  return {
    id: 'd-1', name: 'Escritura', category: 'ESCRITURA', status: 'PENDING',
    transactionId: 'tx-1', version: 1, ...over,
  }
}

function risk(over: Partial<Risk> = {}): Risk {
  return {
    id: 'r-1', severity: 'HIGH', category: 'DOMINIAL',
    label: 'Escritura no recibida', detail: 'No se puede validar la titularidad',
    evidence: 'Documento d-01 en estado PENDING',
    recommendation: 'Solicitar la escritura al vendedor', ...over,
  }
}

function stage(over: Partial<TransactionStage> = {}): TransactionStage {
  return {
    id: 's-1', key: 'docs', label: 'Documentación', description: '',
    order: 1, status: 'CURRENT', tasks: [], ...over,
  }
}

function txn(over: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1', type: 'BUY_PROPERTY', title: 'Compra', subtitle: '',
    userId: 'u-1', stages: [stage()], currentStageId: 's-1', progress: 0,
    province: 'Buenos Aires', provinceCode: 'PBA', city: 'Pilar',
    participants: [], documents: [], costs: [], timeline: [], risks: [],
    property: { price: 200000 } as Transaction['property'],
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }
}

describe('sin operación', () => {
  it('devuelve la acción de arranque, no un consejo inventado', () => {
    const actions = computeNextActions({ transaction: null })
    expect(actions).toEqual([SETUP_ACTION])
    expect(actions[0].cta.href).toBe('/onboarding')
  })

  it('la acción de arranque dice en qué se basa', () => {
    expect(SETUP_ACTION.evidence).toContain('Todavía no tenés ninguna operación activa')
  })

  it('no hay nada bloqueante cuando no hay operación', () => {
    expect(blockingCount({ transaction: null })).toBe(0)
  })
})

describe('prioridad: lo bloqueante primero', () => {
  it('una tarea bloqueada le gana a todo lo demás', () => {
    const t = txn({
      stages: [stage({ tasks: [task({ status: 'BLOCKED' })] })],
      documents: [doc()],
      risks: [risk()],
    })
    const first = primaryAction({ transaction: t })
    expect(first?.category).toBe('BLOCKER')
    expect(first?.blocking).toBe(true)
  })

  it('resuelve las dependencias a títulos, no a ids internos', () => {
    // "Depende de: t-07" no significa nada para una persona.
    const bloqueante = task({ id: 't-07', title: 'Solicitar la escritura', status: 'TODO' })
    const bloqueada = task({ id: 't-99', title: 'Verificar inhibiciones', status: 'BLOCKED', blockedBy: ['t-07'] })
    const t = txn({ stages: [stage({ tasks: [bloqueante, bloqueada] })] })

    const first = primaryAction({ transaction: t })
    expect(first?.evidence).toContain('Depende de: Solicitar la escritura')
    expect(first?.evidence.join(' ')).not.toContain('t-07')
  })

  it('una dependencia que no resuelve se omite en vez de mostrar el id', () => {
    const t = txn({
      stages: [stage({ tasks: [task({ status: 'BLOCKED', blockedBy: ['t-inexistente'] })] })],
    })
    const first = primaryAction({ transaction: t })
    expect(first?.evidence.some(e => e.startsWith('Depende de:'))).toBe(false)
    expect(first?.evidence.join(' ')).not.toContain('t-inexistente')
  })

  it('un riesgo alto con documento pendiente le gana a la tarea siguiente', () => {
    const t = txn({
      stages: [stage({ tasks: [task()] })],
      documents: [doc()],
      risks: [risk()],
    })
    const first = primaryAction({ transaction: t })
    expect(first?.category).toBe('RISK')
    expect(first?.priority).toBe(20)
  })

  it('sin riesgos ni docs críticos, gana la tarea de la etapa actual', () => {
    const t = txn({ stages: [stage({ tasks: [task()] })] })
    const first = primaryAction({ transaction: t })
    expect(first?.category).toBe('TASK')
    expect(first?.title).toBe('Solicitar informe de dominio')
  })
})

describe('evidencia', () => {
  it('toda acción cita en qué se basa', () => {
    const t = txn({
      stages: [stage({ tasks: [task({ status: 'BLOCKED' })] })],
      documents: [doc(), doc({ id: 'd-2', name: 'Planos', category: 'PLANOS' })],
      risks: [risk()],
    })
    for (const a of computeNextActions({ transaction: t })) {
      expect(a.evidence.length).toBeGreaterThan(0)
      expect(a.evidence.every(e => e.trim().length > 0)).toBe(true)
    }
  })

  it('el riesgo arrastra su propia evidencia', () => {
    const t = txn({ documents: [doc()], risks: [risk()] })
    const first = primaryAction({ transaction: t })
    expect(first?.evidence).toContain('Documento d-01 en estado PENDING')
  })

  it('cada acción apunta a las entidades que la originan', () => {
    const t = txn({ documents: [doc()], risks: [risk()] })
    const first = primaryAction({ transaction: t })
    expect(first?.blockingEntities).toContain('r-1')
    expect(first?.blockingEntities).toContain('d-1')
  })
})

describe('precio faltante', () => {
  it('lo pide cuando no hay precio', () => {
    const t = txn({ property: undefined })
    const ids = computeNextActions({ transaction: t }).map(a => a.id)
    expect(ids).toContain('missing_price')
  })

  it('no lo pide cuando hay precio', () => {
    const ids = computeNextActions({ transaction: txn() }).map(a => a.id)
    expect(ids).not.toContain('missing_price')
  })

  it('no es bloqueante: se puede avanzar sin el precio', () => {
    const t = txn({ property: undefined })
    const a = computeNextActions({ transaction: t }).find(x => x.id === 'missing_price')
    expect(a?.blocking).toBe(false)
  })
})

describe('documentos', () => {
  it('distingue críticos de no críticos', () => {
    const t = txn({
      documents: [
        doc({ id: 'd-1', name: 'Escritura', category: 'ESCRITURA' }),
        doc({ id: 'd-9', name: 'Expensas', category: 'EXPENSAS' }),
      ],
    })
    const actions = computeNextActions({ transaction: t })
    const critical = actions.find(a => a.id.startsWith('critical_doc'))
    const other = actions.find(a => a.id === 'other_docs')
    expect(critical?.blocking).toBe(true)
    expect(other?.blocking).toBe(false)
    expect(critical?.priority ?? 99).toBeLessThan(other?.priority ?? 0)
  })

  it('un documento aprobado no genera acción', () => {
    const t = txn({ documents: [doc({ status: 'APPROVED' })] })
    const ids = computeNextActions({ transaction: t }).map(a => a.id)
    expect(ids.some(i => i.startsWith('critical_doc'))).toBe(false)
  })

  it('un documento rechazado o vencido sí la genera', () => {
    for (const status of ['REJECTED', 'EXPIRED'] as const) {
      const t = txn({ documents: [doc({ status })] })
      const ids = computeNextActions({ transaction: t }).map(a => a.id)
      expect(ids.some(i => i.startsWith('critical_doc'))).toBe(true)
    }
  })
})

describe('todo al día', () => {
  it('lo dice explícitamente cuando no queda nada', () => {
    const t = txn({ stages: [stage({ tasks: [task({ status: 'DONE' })] })] })
    const actions = computeNextActions({ transaction: t })
    expect(actions).toHaveLength(1)
    expect(actions[0].id).toBe('all_clear')
    expect(blockingCount({ transaction: t })).toBe(0)
  })

  it('NO dice "no hay nada pendiente" cuando sí hay', () => {
    // El error clásico: mostrar "todo en orden" al lado de tres pendientes.
    const t = txn({ documents: [doc()], stages: [stage({ tasks: [task()] })] })
    const ids = computeNextActions({ transaction: t }).map(a => a.id)
    expect(ids).not.toContain('all_clear')
  })
})

describe('el consejo cambia con el estado', () => {
  it('resolver el bloqueo cambia la recomendación', () => {
    const blocked = txn({ stages: [stage({ tasks: [task({ status: 'BLOCKED' })] })] })
    const unblocked = txn({ stages: [stage({ tasks: [task({ status: 'TODO' })] })] })

    const a = primaryAction({ transaction: blocked })
    const b = primaryAction({ transaction: unblocked })

    expect(a?.id).not.toBe(b?.id)
    expect(a?.category).toBe('BLOCKER')
    expect(b?.category).toBe('TASK')
  })

  it('dos operaciones distintas producen consejos distintos', () => {
    // Esto es lo que el motor viejo no podía hacer: leía siempre el mismo mock.
    const conDocs = txn({ id: 'tx-a', documents: [doc()] })
    const sinDocs = txn({ id: 'tx-b', stages: [stage({ tasks: [task()] })] })
    expect(primaryAction({ transaction: conDocs })?.id)
      .not.toBe(primaryAction({ transaction: sinDocs })?.id)
  })

  it('los CTA apuntan a la operación correcta', () => {
    const t = txn({ id: 'tx-abc', documents: [doc()] })
    expect(primaryAction({ transaction: t })?.cta.href).toContain('tx-abc')
  })
})
