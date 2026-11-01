/**
 * Dashboard — primer valor / Next Best Action.
 * Lógica pura (`buildFirstValue`) + componentes reales renderizados + guardas sobre la página:
 * una sola acción principal, estado y motivo, incertidumbre en vez de datos inventados, compra y venta,
 * y el mismo resultado para invitado y cuenta.
 */
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  AttentionCard, CostsCard, EmptyDashboard, OperationHeader, UncertaintyNotice, UpNextList,
} from '@/components/dashboard/DashboardParts'
import { NextStepAgent } from '@/components/operation/NextStepAgent'
import {
  SETUP_PROPERTY_BUY, buildFirstValue, computeBuyerCosts, pickDashboardProperty, shouldShowEmptyState, withProperty,
  type DashboardProperty,
} from '@/lib/dashboard/firstValue'
import { computeNextActions } from '@/lib/nba/engine'
import { buildTransaction, setTaskState } from '@/lib/operationFromChecklist'
import type { StoredOperation } from '@/lib/userOperations'
import type { Risk } from '@/types'

const store = new Map<string, string>()
;(globalThis as { localStorage?: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

const buyOp: StoredOperation = { id: 'op-buy-1', type: 'BUY', title: 'Mi compra', status: 'ACTIVE', province: 'Ciudad de Buenos Aires', provinceCode: 'CABA', city: 'Palermo', progress: 0, createdAt: 1 }
const sellOp: StoredOperation = { ...buyOp, id: 'op-sell-1', type: 'SELL', title: 'Mi venta' }

const prop = (over: Partial<DashboardProperty> = {}): DashboardProperty => ({
  id: 'prop-1', type: 'APARTMENT', operationType: 'sale', price: 150000, currency: 'USD', title: 'Depto en Palermo', address: 'Thames 1500', neighborhood: 'Palermo', city: 'CABA', province: 'Ciudad de Buenos Aires',
  surface: 70, rooms: 3, bedrooms: 2, bathrooms: 1, garage: false, description: '', images: [], features: [], incompleteFields: [], ...over,
})

beforeEach(() => store.clear())

describe('estado vacío', () => {
  it('depende SOLO de que no haya operaciones, con o sin cuenta, ya cargado', () => {
    expect(shouldShowEmptyState({ loaded: true, operationCount: 0 })).toBe(true)
    expect(shouldShowEmptyState({ loaded: true, operationCount: 2 })).toBe(false)
    expect(shouldShowEmptyState({ loaded: false, operationCount: 0 })).toBe(false) // mientras carga no se parpadea
    expect(read('src/app/dashboard/page.tsx')).not.toContain('onboardingDone') // la bandera del navegador ya no esconde operaciones reales
  })

  it('muestra una sola decisión y ninguna demo ni promoción', () => {
    const html = renderToStaticMarkup(createElement(EmptyDashboard))
    expect(html).toContain('Empezá tu operación')
    expect(html).toContain('href="/onboarding"')
    expect(html).toContain('Crear mi operación')
    expect(html).toContain('href="/analizar"')
    expect(html).not.toMatch(/demo|Labs|txn-001/i)
  })
})

describe('compra · operación nueva sin propiedad', () => {
  const fv = () => buildFirstValue({ kind: 'BUY', operationId: buyOp.id, transaction: buildTransaction(buyOp), property: null })

  it('la acción principal es cargar la propiedad y dice por qué y en qué se basa', () => {
    const { primary } = fv()
    expect(primary).toBe(SETUP_PROPERTY_BUY)
    expect(primary.title).toMatch(/propiedad/i)
    expect(primary.why.length).toBeGreaterThan(20)
    expect(primary.evidence.length).toBeGreaterThan(0)
    expect(primary.cta.href).toBe('/propiedades')
  })

  it('estado "Recién empezada" con su motivo, sin alarmas falsas', () => {
    const v = fv()
    expect(v.health).toBe('NEW')
    expect(v.healthLabel).toBe('Recién empezada')
    expect(v.healthReason).toBe('Todavía no marcaste ningún paso')
    expect(v.attention).toEqual([]) // los documentos pendientes no son un riesgo
    expect(v.pendingDocs).toBeGreaterThan(0)
    expect(v.stage?.index).toBe(1)
    expect(v.progress).toBe(0)
  })

  it('no inventa costos: dice que no puede calcularlos y no repite "cargá el precio"', () => {
    const v = fv()
    expect(v.costs).toEqual({ known: false, reason: 'NO_PROPERTY' })
    expect(v.uncertainties.map(u => u.id)).toContain('costs_unknown')
    expect(v.upNext.map(a => a.id)).not.toContain('missing_price')
    expect(v.upNext.length).toBeLessThanOrEqual(2)
    expect(v.upNext.map(a => a.id)).not.toContain(v.primary.id)
  })
})

describe('compra · con propiedad', () => {
  const run = (property: DashboardProperty | null, mutate?: (t: ReturnType<typeof buildTransaction>) => void) => {
    const txn = buildTransaction(buyOp)
    mutate?.(txn)
    return buildFirstValue({ kind: 'BUY', operationId: buyOp.id, transaction: txn, property })
  }

  it('asociar la propiedad hace que el motor use el precio real (antes pedía el precio siempre)', () => {
    const base = buildTransaction(buyOp)
    expect(computeNextActions({ transaction: base }).map(a => a.id)).toContain('missing_price')
    expect(computeNextActions({ transaction: withProperty(base, prop()) }).map(a => a.id)).not.toContain('missing_price')
  })

  it('una operación nueva no se presenta como "frenada": conseguir los primeros papeles es el comienzo', () => {
    const v = run(prop())
    expect(v.health).toBe('NEW')
    expect(v.primary.category).toBe('DOCUMENT')
    expect(v.primary.blocking).toBe(false)
    const html = renderToStaticMarkup(createElement(NextStepAgent, { action: v.primary, operationId: buyOp.id, kind: 'BUY' }))
    expect(html).not.toContain('Esto frena tu operación')
    expect(html).toContain('Lo siguiente para avanzar')
    // …pero una tarea bloqueada de verdad sí frena
    const blocked = run(prop(), txn => { txn.stages[0].tasks[0].status = 'BLOCKED' })
    expect(blocked.primary.blocking).toBe(true)
  })

  it('con precio en dólares calcula los costos con su rango, su detalle y su fuente', () => {
    const v = run(prop())
    expect(v.costs.known).toBe(true)
    if (!v.costs.known) return
    expect(v.costs.price).toBe(150000)
    expect(v.costs.min).toBeGreaterThan(0)
    expect(v.costs.max).toBeGreaterThanOrEqual(v.costs.min)
    expect(v.costs.lines).toHaveLength(4)
    expect(v.costs.source.length).toBeGreaterThan(0)
    expect(v.uncertainties.some(u => u.id === 'costs_estimated')).toBe(v.costs.confidence !== 'VERIFIED')
  })

  it('sin precio no muestra costos en cero: lo dice y ofrece cargarlo', () => {
    const v = run(prop({ price: 0, incompleteFields: ['precio', 'superficie'] }))
    expect(v.costs).toEqual({ known: false, reason: 'NO_PRICE' })
    const u = v.uncertainties.find(x => x.id === 'no_price')
    expect(u?.cta?.href).toBe('/propiedades/prop-1')
    expect(v.uncertainties.find(x => x.id === 'incomplete_property')?.text).toContain('superficie')
    expect(v.uncertainties.find(x => x.id === 'incomplete_property')?.text).not.toContain('precio,') // el precio ya se explicó aparte
  })

  it('un precio en pesos no se toma como dólares: no hay número y se explica', () => {
    const v = run(prop({ currency: 'ARS', price: 150000000 }))
    expect(v.costs).toEqual({ known: false, reason: 'NOT_USD' })
    expect(v.uncertainties.map(u => u.id)).toContain('price_not_usd')
    expect(computeBuyerCosts(buildTransaction(buyOp), prop({ currency: 'ARS' })).known).toBe(false)
  })

  it('una tarea bloqueada pasa a ser lo principal: estado Bloqueada, motivo y qué la frena', () => {
    const v = run(prop(), txn => { txn.stages[0].tasks[0].status = 'BLOCKED' })
    expect(v.health).toBe('BLOCKED')
    expect(v.healthLabel).toBe('Bloqueada')
    expect(v.healthReason).toBe('1 tarea bloqueada')
    expect(v.primary.id).toBe('blocked_tasks')
    expect(v.primary.blocking).toBe(true)
    expect(v.attention).toHaveLength(1)
    expect(v.attention[0].severity).toBe('HIGH')
  })

  it('un riesgo alto real pone la operación en "Requiere atención" y lo lista', () => {
    const risk: Risk = { id: 'r1', severity: 'HIGH', category: 'DOMINIAL', label: 'Inhibición del vendedor', detail: 'Figura una inhibición vigente.', recommendation: 'Pedí el certificado de inhibición.' }
    const v = run(prop(), txn => { txn.risks = [risk] })
    expect(v.health).toBe('ATTENTION')
    expect(v.healthReason).toBe('1 riesgo alto detectado')
    expect(v.attention.map(a => a.label)).toContain('Inhibición del vendedor')
  })

  it('al avanzar pasa a "En curso" con el conteo real de pasos', () => {
    const txn = buildTransaction(buyOp)
    const first = txn.stages[0].tasks[0]
    setTaskState(buyOp.id, first.id, 'DONE')
    const v = buildFirstValue({ kind: 'BUY', operationId: buyOp.id, transaction: buildTransaction(buyOp), property: prop() })
    expect(v.health).toBe('ON_TRACK')
    expect(v.healthReason).toMatch(/^1 de \d+ pasos hechos$/)
    expect(v.progress).toBeGreaterThan(0)
  })

  it('si no se pudo cargar el detalle lo dice: no inventa una operación', () => {
    const v = buildFirstValue({ kind: 'BUY', operationId: 'op-x', transaction: null, property: prop() })
    expect(v.primary.id).toBe('open_operation')
    expect(v.primary.cta.href).toBe('/operacion/op-x')
    expect(v.uncertainties.map(u => u.id)).toContain('no_plan')
  })
})

describe('venta', () => {
  it('sin plan remoto usa las tareas del motor regulatorio y explica el paso', () => {
    const v = buildFirstValue({ kind: 'SELL', operationId: sellOp.id, transaction: buildTransaction(sellOp), property: null })
    expect(v.kind).toBe('SELL')
    expect(v.kindLabel).toBe('Venta')
    expect(v.primary.id).toMatch(/^sell_/)
    expect(v.primary.evidence[0]).toMatch(/^Paso 1 de \d+ de tu venta$/)
    expect(v.primary.cta.href).toBe(`/operacion/${sellOp.id}?tab=tareas`)
    expect(v.upNext).toHaveLength(2)
    expect(v.health).toBe('NEW')
    const u = v.uncertainties.find(x => x.id === 'no_property')
    expect(u?.cta?.href).toBe('/preparar-venta')
  })

  it('con el plan de la cuenta, la acción es el primer paso sin hacer y el avance sale de los pasos', () => {
    const steps = [
      { key: 'docs', title: 'Juntar documentos', description: 'Escritura, DNI y libre deuda', done: true },
      { key: 'price', title: 'Definir el precio', description: 'Usá comparables reales', done: false },
      { key: 'photos', title: 'Sacar fotos', description: 'De día y con luz natural', done: false },
      { key: 'publish', title: 'Publicar', description: 'En los portales', done: false },
    ]
    const v = buildFirstValue({ kind: 'SELL', operationId: sellOp.id, transaction: buildTransaction(sellOp), property: prop(), steps })
    expect(v.primary.title).toBe('Definir el precio')
    expect(v.primary.why).toBe('Usá comparables reales')
    expect(v.primary.evidence).toEqual(['Paso 2 de 4 de tu venta', '1 de 4 pasos hechos'])
    expect(v.upNext.map(a => a.title)).toEqual(['Sacar fotos', 'Publicar'])
    expect(v.progress).toBe(25)
    expect(v.health).toBe('ON_TRACK')
    expect(v.uncertainties.map(u => u.id)).not.toContain('no_property')
  })

  it('todo hecho, o ni siquiera hay plan, también tienen una acción clara', () => {
    const done = buildFirstValue({ kind: 'SELL', operationId: 'o', transaction: null, property: null, steps: [{ key: 'a', title: 'A', description: '', done: true }] })
    expect(done.primary.id).toBe('sell_all_done')
    const none = buildFirstValue({ kind: 'SELL', operationId: 'o', transaction: null, property: null })
    expect(none.primary.id).toBe('setup_plan_sell')
    expect(none.primary.cta.href).toBe('/preparar-venta')
    expect(none.uncertainties.map(u => u.id)).toContain('no_plan')
  })
})

describe('qué propiedad se muestra', () => {
  const imported = { source: 'imported', id: 'imp' }
  const draft = { source: 'draft', id: 'dr' }
  it('la vinculada manda; si no, compra usa la importada y venta el borrador', () => {
    const linked = { source: 'imported', id: 'linked' }
    expect(pickDashboardProperty('BUY', linked, [draft, imported])?.id).toBe('linked')
    expect(pickDashboardProperty('BUY', null, [draft, imported])?.id).toBe('imp')
    expect(pickDashboardProperty('SELL', null, [imported, draft])?.id).toBe('dr')
    expect(pickDashboardProperty('SELL', null, [imported])).toBeNull()
    expect(pickDashboardProperty('BUY', null, [])).toBeNull()
  })
})

describe('invitado y cuenta ven la misma lógica', () => {
  it('buildFirstValue no mira la sesión y es determinístico', () => {
    const input = { kind: 'BUY' as const, operationId: buyOp.id, transaction: buildTransaction(buyOp), property: prop() }
    expect(buildFirstValue(input)).toEqual(buildFirstValue({ ...input, transaction: buildTransaction(buyOp) }))
    expect(read('src/lib/dashboard/firstValue.ts')).not.toMatch(/getUser|hasSession|supabase|session/i)
  })
})

describe('la pantalla se lee en 5 segundos', () => {
  const fv = buildFirstValue({ kind: 'BUY', operationId: buyOp.id, transaction: buildTransaction(buyOp), property: null })
  const screen = renderToStaticMarkup(createElement('main', null,
    createElement(OperationHeader, { fv, title: 'Mi compra', place: 'Palermo, Ciudad de Buenos Aires', operations: [{ id: buyOp.id, title: 'Mi compra', type: 'BUY' as const, progress: 0 }], activeId: buyOp.id, onSelect: () => {} }),
    createElement(NextStepAgent, { action: fv.primary, operationId: buyOp.id, kind: 'BUY', province: 'Ciudad de Buenos Aires' }),
    createElement(UncertaintyNotice, { items: fv.uncertainties }),
    createElement(UpNextList, { actions: fv.upNext }),
    createElement(AttentionCard, { items: fv.attention }),
    createElement(CostsCard, { costs: fv.costs }),
  ))

  it('en orden: qué operación → estado y motivo → acción con su porqué y su CTA → lo que falta → después', () => {
    const at = (s: string) => screen.indexOf(s)
    expect(at('Compra')).toBeGreaterThan(-1)
    // Encabezado: "Compra · estado" (arriba) → título → motivo; después la acción, lo que falta y lo que sigue.
    const order = ['Recién empezada', 'Mi compra', 'Todavía no marcaste ningún paso', 'Cargá la propiedad que estás mirando', 'En qué me baso', 'Cargar la propiedad', 'Lo que falta saber', 'Después de esto']
    const positions = order.map(at)
    expect(positions.every(p => p > -1)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
    expect(screen).toContain('href="/propiedades"')
  })

  it('la acción principal aparece una sola vez y no hay números en cero', () => {
    expect(screen.split('Cargá la propiedad que estás mirando').length - 1).toBe(1)
    expect(screen.match(/<h1/g)).toHaveLength(1)
    expect(screen).not.toMatch(/\$\s?0\b|USD\s?0\b|~0K|NaN|Infinity/)
    expect(screen).not.toContain('Cuánto te sale') // sin precio no hay tarjeta de costos
  })
})

describe('la página ya no repite ni inventa', () => {
  const page = read('src/app/dashboard/page.tsx') + read('src/components/dashboard/DashboardParts.tsx')
  it('una sola tarjeta de acción principal y nada de bloques decorativos', () => {
    expect(read('src/app/dashboard/page.tsx').match(/<NextStepAgent/g)).toHaveLength(1)
    for (const gone of ['Tiempo estimado', 'Qué cambió', 'VARA te acompaña', 'Bienvenido de vuelta', 'Ver demo', 'RightRail', 'GuidanceBanner', 'Buenos Aires Prov.', 'mockUserOperations']) {
      expect(page, gone).not.toContain(gone)
    }
  })

  it('compra y venta pasan por la misma lógica', () => {
    const p = read('src/app/dashboard/page.tsx')
    expect(p).toContain('buildFirstValue')
    expect(p.match(/buildFirstValue\(/g)).toHaveLength(1)
  })
})
