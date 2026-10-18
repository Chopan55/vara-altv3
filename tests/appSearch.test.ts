import { describe, it, expect } from 'vitest'
import { searchApp } from '@/lib/search/appSearch'

const sell = { journey: 'SELL' as const, operationId: 'op1' }
const buy = { journey: 'BUY' as const, operationId: 'op2' }

describe('búsqueda global', () => {
  it('sin texto no devuelve nada', () => {
    expect(searchApp('   ', sell)).toEqual([])
  })

  it('"documentos" encuentra los documentos de la operación y el checklist de venta, no solo la Guía', () => {
    const r = searchApp('documentos', sell)
    const labels = r.map(x => x.label)
    expect(labels).toContain('Documentos de mi operación')
    expect(labels).toContain('Checklist documental de venta')
    expect(r.find(x => x.label === 'Documentos de mi operación')!.href).toBe('/operacion/op1?tab=documentos')
    expect(r.some(x => x.kind === 'guide')).toBe(true)
    expect(r.some(x => x.kind === 'assistant')).toBe(true)
  })

  it('"costos" cambia según compres o vendas', () => {
    expect(searchApp('costos', buy).map(x => x.label)).toContain('Costos de compra')
    expect(searchApp('costos', buy).map(x => x.label)).not.toContain('Neto estimado de venta')
    expect(searchApp('costos', sell).map(x => x.label)).toContain('Neto estimado de venta')
  })

  it('"visitas" ofrece lo que corresponde al modo', () => {
    expect(searchApp('visitas', buy).map(x => x.label)).toContain('Checklist de visita')
    expect(searchApp('visitas', sell).map(x => x.label)).toContain('Visitas de vendedor')
    expect(searchApp('visitas', sell).map(x => x.label)).not.toContain('Checklist de visita')
  })

  it('ignora tildes y mayúsculas', () => {
    expect(searchApp('NEGOCIACIÓN', buy).map(x => x.label)).toContain('Negociación')
  })

  it('sin operación apunta al estado puente, no a una ruta rota', () => {
    const r = searchApp('riesgos', { journey: 'BUY', operationId: null })
    expect(r.find(x => x.label === 'Riesgos de mi operación')!.href).toBe('/operacion/inicio?tab=riesgos')
  })

  it('siempre cierra con Guía y asistente aunque no haya funciones', () => {
    const r = searchApp('zzzz', buy)
    expect(r.map(x => x.kind)).toEqual(['guide', 'assistant'])
  })
})

describe('consistencia del id de operación', () => {
  it('todos los destinos de operación usan el id activo recibido, nunca otro', () => {
    const ctx = { journey: 'BUY' as const, operationId: 'op-123' }
    const hrefs = ['documentos', 'riesgos', 'ofertas']
      .flatMap(q => searchApp(q, ctx))
      .map(r => r.href)
      .filter(h => h.startsWith('/operacion/'))
    expect(hrefs.length).toBeGreaterThan(0)
    for (const h of hrefs) expect(h.startsWith('/operacion/op-123')).toBe(true)
  })
})

describe('varias operaciones', () => {
  const ctx = {
    journey: 'BUY' as const,
    operationId: 'a1',
    operations: [{ id: 'a1', title: 'Mi compra' }, { id: 'b2', title: 'Mi venta' }],
  }
  it('"documentos" ofrece uno por operación, cada uno hacia su propio id', () => {
    const r = searchApp('documentos', ctx).filter(x => x.kind === 'function' && x.href.startsWith('/operacion/'))
    expect(r.map(x => x.label)).toEqual(['Documentos de Mi compra', 'Documentos de Mi venta'])
    expect(r.map(x => x.href)).toEqual(['/operacion/a1?tab=documentos', '/operacion/b2?tab=documentos'])
  })
  it('con una sola operación sigue siendo un único resultado', () => {
    const r = searchApp('riesgos', { ...ctx, operations: [ctx.operations[0]] })
    expect(r.filter(x => x.label.startsWith('Riesgos')).map(x => x.href)).toEqual(['/operacion/a1?tab=riesgos'])
  })
})
