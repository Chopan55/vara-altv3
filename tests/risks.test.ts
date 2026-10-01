/**
 * Riesgos.
 *
 * Lo que se protege acá: que **ningún riesgo exista sin evidencia**. Decirle
 * a alguien "riesgo dominial alto" sin mostrarle de dónde sale lo deja peor
 * que no decirle nada — no puede verificarlo ni discutirlo, solo asustarse.
 *
 * Y lo segundo: que un riesgo desaparezca solo cuando deja de ser cierto.
 * Un riesgo que sobrevive al hecho que lo generó es ruido que entrena a la
 * gente a ignorar las alertas.
 */

import { describe, it, expect } from 'vitest'
import {
  computeRisks, highRiskCount, groupByLevel,
  type RiskInput,
} from '@/lib/risks/engine'
import type { OperationDocument } from '@/lib/documents/model'
import type { Offer } from '@/lib/offers/model'

const TODAY = '2026-03-20'

function doc(over: Partial<OperationDocument> = {}): OperationDocument {
  return {
    id: 'd-1', operationId: 'op-1', name: 'Escritura',
    category: 'ESCRITURA', status: 'PENDING', version: 1,
    createdAt: 1_700_000_000_000,
    ...over,
  }
}

function offer(over: Partial<Offer> = {}): Offer {
  return {
    id: 'of-1', operationId: 'op-1', party: 'BUYER', status: 'SENT',
    amount: 185_000, currency: 'USD', conditions: [],
    createdAt: 1_700_000_000_000,
    ...over,
  }
}

function input(over: Partial<RiskInput> = {}): RiskInput {
  return {
    documents: [], offers: [], propertyPrice: 200_000,
    dataConfidence: 'VERIFIED', today: TODAY,
    documentsLoaded: true,
    ...over,
  }
}

describe('la regla de oro', () => {
  it('TODO riesgo trae evidencia, sin excepción', () => {
    // Un escenario con todos los problemas a la vez.
    const risks = computeRisks(input({
      documents: [doc(), doc({ id: 'd-2', name: 'Informe', category: 'INFORMES', status: 'REJECTED', storagePath: 'x' })],
      offers: [offer({ validUntil: '2026-03-01' })],
      propertyPrice: 0,
      dataConfidence: 'ESTIMATED',
      provinceName: 'Córdoba',
    }))

    expect(risks.length).toBeGreaterThan(0)
    for (const r of risks) {
      expect(r.evidence.length).toBeGreaterThan(0)
      expect(r.evidence.every(e => e.trim().length > 0)).toBe(true)
    }
  })

  it('todo riesgo dice qué hacer, no solo qué pasa', () => {
    const risks = computeRisks(input({ documents: [doc()] }))
    for (const r of risks) {
      expect(r.action.trim().length).toBeGreaterThan(0)
    }
  })

  it('sin problemas, no inventa riesgos', () => {
    expect(computeRisks(input())).toEqual([])
  })
})

describe('documentos', () => {
  it('un documento crítico sin archivo es riesgo alto', () => {
    const risks = computeRisks(input({ documents: [doc()] }))
    const r = risks.find(x => x.id === 'doc.critical.missing')
    expect(r?.level).toBe('HIGH')
    expect(r?.area).toBe('DOMINIAL')
  })

  it('subir el archivo hace desaparecer el riesgo', () => {
    // El estado no es un campo que alguien marca: es si el hecho sigue dándose.
    const risks = computeRisks(input({
      documents: [doc({ storagePath: 'u/1.pdf', status: 'RECEIVED' })],
    }))
    expect(risks.find(r => r.id === 'doc.critical.missing')).toBeUndefined()
  })

  it('un documento NO crítico que falta no genera riesgo alto', () => {
    const risks = computeRisks(input({
      documents: [doc({ category: 'EXPENSAS', name: 'Expensas' })],
    }))
    expect(risks.find(r => r.id === 'doc.critical.missing')).toBeUndefined()
  })

  it('la evidencia nombra cada documento que falta', () => {
    const risks = computeRisks(input({
      documents: [doc({ name: 'Escritura madre' }), doc({ id: 'd-2', name: 'Informe de dominio', category: 'INFORMES' })],
    }))
    const r = risks.find(x => x.id === 'doc.critical.missing')
    expect(r?.evidence.join(' ')).toMatch(/Escritura madre/)
    expect(r?.evidence.join(' ')).toMatch(/Informe de dominio/)
  })

  it('un rechazado pesa más que uno que falta, porque parecía estar', () => {
    const risks = computeRisks(input({
      documents: [doc({ status: 'REJECTED', storagePath: 'u/1.pdf' })],
    }))
    const r = risks.find(x => x.id === 'doc.rejected')
    expect(r?.level).toBe('HIGH')
    expect(r?.evidence[0]).toMatch(/rechazado/)
  })

  it('distingue vencido de rechazado en la evidencia', () => {
    const risks = computeRisks(input({
      documents: [doc({ status: 'EXPIRED', storagePath: 'u/1.pdf' })],
    }))
    expect(risks.find(x => x.id === 'doc.rejected')?.evidence[0]).toMatch(/vencido/)
  })
})

describe('ofertas', () => {
  it('avisa cuando una oferta está por vencerse', () => {
    const risks = computeRisks(input({ offers: [offer({ validUntil: '2026-03-22' })] }))
    const r = risks.find(x => x.id === 'offer.expiring')
    expect(r?.label).toMatch(/2 días/)
    expect(r?.area).toBe('TEMPORAL')
  })

  it('una que vence hoy se dice distinto', () => {
    const risks = computeRisks(input({ offers: [offer({ validUntil: TODAY })] }))
    expect(risks.find(x => x.id === 'offer.expiring')?.label).toMatch(/hoy/)
  })

  it('una que vence dentro de un mes no alarma', () => {
    const risks = computeRisks(input({ offers: [offer({ validUntil: '2026-04-30' })] }))
    expect(risks.find(x => x.id === 'offer.expiring')).toBeUndefined()
  })

  it('una ya vencida es otro riesgo distinto', () => {
    const risks = computeRisks(input({ offers: [offer({ validUntil: '2026-03-01' })] }))
    expect(risks.find(x => x.id === 'offer.expired')).toBeDefined()
    expect(risks.find(x => x.id === 'offer.expiring')).toBeUndefined()
  })

  it('una oferta cerrada no genera riesgo de vencimiento', () => {
    const risks = computeRisks(input({
      offers: [offer({ status: 'ACCEPTED', validUntil: '2026-03-22' })],
    }))
    expect(risks.find(x => x.id === 'offer.expiring')).toBeUndefined()
  })

  it('la evidencia dice el monto y la fecha', () => {
    const risks = computeRisks(input({ offers: [offer({ validUntil: '2026-03-21' })] }))
    const e = risks.find(x => x.id === 'offer.expiring')?.evidence[0] ?? ''
    expect(e).toMatch(/185/)
    expect(e).toMatch(/2026-03-21/)
  })
})

describe('datos faltantes', () => {
  it('sin precio lo dice, con el rango de costos en juego', () => {
    const risks = computeRisks(input({ propertyPrice: 0 }))
    const r = risks.find(x => x.id === 'data.no_price')
    expect(r?.area).toBe('DATOS')
    expect(r?.detail).toMatch(/%/)
  })

  it('con precio no molesta', () => {
    expect(computeRisks(input({ propertyPrice: 150_000 })).find(r => r.id === 'data.no_price'))
      .toBeUndefined()
  })

  it('avisa si las alícuotas de la provincia no están verificadas', () => {
    const risks = computeRisks(input({ dataConfidence: 'ESTIMATED', provinceName: 'Formosa' }))
    const r = risks.find(x => x.id === 'data.province_confidence')
    expect(r?.level).toBe('LOW')
    expect(r?.label).toMatch(/Formosa/)
  })

  it('una provincia verificada no genera aviso', () => {
    expect(computeRisks(input({ dataConfidence: 'VERIFIED' }))
      .find(r => r.id === 'data.province_confidence')).toBeUndefined()
  })
})

describe('prioridad', () => {
  it('lo dominial va antes que la confianza del dato', () => {
    const risks = computeRisks(input({
      documents: [doc()],
      dataConfidence: 'ESTIMATED',
    }))
    expect(risks[0].id).toBe('doc.critical.missing')
    expect(risks[risks.length - 1].id).toBe('data.province_confidence')
  })

  it('cuenta los que frenan de verdad', () => {
    const risks = computeRisks(input({
      documents: [doc()],
      propertyPrice: 0,
      dataConfidence: 'ESTIMATED',
    }))
    expect(highRiskCount(risks)).toBe(1)
  })

  it('agrupa por nivel sin perder ninguno', () => {
    const risks = computeRisks(input({
      documents: [doc()],
      propertyPrice: 0,
      dataConfidence: 'ESTIMATED',
    }))
    const g = groupByLevel(risks)
    expect(g.HIGH.length + g.MEDIUM.length + g.LOW.length).toBe(risks.length)
    expect(g.HIGH).toHaveLength(1)
  })
})
