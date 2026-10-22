/**
 * Asistente VARA — contexto de la operación + acciones.
 * El contexto sale de los motores de VARA (no se recalcula), mantiene separados hecho / extraído / inferencia /
 * estimación / recomendación / desconocido, es compacto, y es el MISMO para texto y voz. Las acciones son solo
 * navegación. Datos sintéticos, sin red.
 */
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import { buildFirstValue, computeBuyerCosts, type DashboardProperty, type PlanStep } from '@/lib/dashboard/firstValue'
import { buildTransaction } from '@/lib/operationFromChecklist'
import {
  CONTEXT_RULES, MAX_CONTEXT_CHARS, NO_OPERATION_CONTEXT, buildAssistantContext, contextBlock, renderContext, sanitizeContextText,
  type ActionContext,
} from '@/lib/assistant/context'
import { MAX_ACTIONS, isSafeAction, suggestActions } from '@/lib/assistant/actions'
import { buildRealtimeSession, VOICE_INSTRUCTIONS } from '@/lib/assistant/realtimeSession'
import type { StoredOperation } from '@/lib/userOperations'
import type { UserOperationSummary } from '@/types'

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

const buyStored: StoredOperation = { id: 'op-buy-1', type: 'BUY', title: 'Mi compra', status: 'ACTIVE', province: 'Ciudad de Buenos Aires', provinceCode: 'CABA', city: 'Palermo', progress: 0, createdAt: 1 }
const sellStored: StoredOperation = { ...buyStored, id: 'op-sell-1', type: 'SELL', title: 'Mi venta' }
const summary = (s: StoredOperation, over: Partial<UserOperationSummary> = {}): UserOperationSummary => ({
  id: s.id, type: s.type, title: s.title, status: 'ACTIVE', progress: 0, province: s.province, city: s.city, createdAt: '2026-10-20', ...over,
})

const prop = (over: Record<string, unknown> = {}): DashboardProperty => ({
  id: 'prop-1', type: 'APARTMENT', operationType: 'sale', price: 150000, currency: 'USD', title: 'Depto en Palermo', address: 'Thames 1500', neighborhood: 'Palermo', city: 'CABA', province: 'Ciudad de Buenos Aires',
  surface: 70, rooms: 3, bedrooms: 2, bathrooms: 1, garage: false, description: '', images: [], features: [], incompleteFields: [], source: 'imported', ...over,
} as DashboardProperty)

function buyContext(property: DashboardProperty | null, opOver: Partial<UserOperationSummary> = {}) {
  const transaction = buildTransaction(buyStored)
  const fv = buildFirstValue({ kind: 'BUY', operationId: buyStored.id, transaction, property })
  const op = summary(buyStored, opOver)
  return { fv, transaction, ctx: buildAssistantContext({ op, fv, property, transaction }) }
}
const certainties = (ctx: { lines: { certainty: string }[] }) => new Set(ctx.lines.map(l => l.certainty))

beforeEach(() => store.clear())

describe('contexto: usa lo que ya calculan los motores', () => {
  it('la recomendación es la próxima acción del motor, tal cual', () => {
    const { fv, ctx } = buyContext(prop(), { propertyId: 'prop-1' })
    const rec = ctx.lines.filter(l => l.certainty === 'RECOMMENDATION')
    expect(rec[0].text).toContain(fv.primary.title)
    expect(rec[0].text).toContain(fv.primary.why)
    expect(ctx.actionContext.primary).toEqual({ label: fv.primary.cta.label, href: fv.primary.cta.href })
  })

  it('los costos son los del motor (no se recalculan) y se marcan como ESTIMATE, nunca como hecho', () => {
    const property = prop()
    const { ctx } = buyContext(property, { propertyId: 'prop-1' })
    const costs = computeBuyerCosts(buildTransaction(buyStored), property)
    expect(costs.known).toBe(true)
    if (!costs.known) return
    const est = ctx.lines.filter(l => l.certainty === 'ESTIMATE').map(l => l.text).join('\n').replace(/\./g, '')
    expect(est).toContain(String(Math.round(costs.min)))
    expect(est).toContain(String(Math.round(costs.max)))
    expect(ctx.lines.filter(l => l.certainty === 'FACT').some(l => /costos del comprador/i.test(l.text))).toBe(false)
  })

  it('lo leído de un aviso es EXTRACTED y una propiedad sin vínculo explícito es INFERENCE', () => {
    const { ctx } = buyContext(prop()) // sin propertyId en la operación
    const byCert = (c: string) => ctx.lines.filter(l => l.certainty === c).map(l => l.text).join('\n')
    expect(byCert('EXTRACTED')).toContain('Depto en Palermo')
    expect(byCert('FACT')).not.toContain('Depto en Palermo')
    expect(byCert('INFERENCE')).toMatch(/no está vinculada/)
  })

  it('una propiedad cargada a mano es FACT y, vinculada, no genera inferencia', () => {
    const { ctx } = buyContext(prop({ source: 'draft' }), { propertyId: 'prop-1' })
    expect(ctx.lines.find(l => l.certainty === 'FACT' && l.text.includes('Depto en Palermo'))).toBeTruthy()
    expect(certainties(ctx).has('INFERENCE')).toBe(false)
  })

  it('sin propiedad: no hay números de costos, sí hay UNKNOWN y la acción es cargarla', () => {
    const { ctx, fv } = buyContext(null)
    expect(certainties(ctx).has('ESTIMATE')).toBe(false)
    expect(certainties(ctx).has('UNKNOWN')).toBe(true)
    expect(ctx.lines.find(l => l.certainty === 'RECOMMENDATION')!.text).toContain(fv.primary.title)
  })

  it('lo que falta en la ficha es UNKNOWN', () => {
    const { ctx } = buyContext(prop({ incompleteFields: ['superficie', 'antigüedad'] }), { propertyId: 'prop-1' })
    expect(ctx.lines.find(l => l.certainty === 'UNKNOWN' && /superficie, antigüedad/.test(l.text))).toBeTruthy()
    expect(ctx.actionContext.propertyIncomplete).toBe(true)
  })

  it('venta: usa el plan de venta del motor y nunca muestra costos de compra', () => {
    const steps: PlanStep[] = [
      { key: 'docs', title: 'Juntar la documentación', description: 'Escritura y planos', done: true },
      { key: 'price', title: 'Definir el precio', description: 'Con comparables', done: false },
    ]
    const transaction = buildTransaction(sellStored)
    const fv = buildFirstValue({ kind: 'SELL', operationId: sellStored.id, transaction, property: null, steps })
    const ctx = buildAssistantContext({ op: summary(sellStored), fv, property: null, transaction })
    const text = renderContext(ctx)
    expect(text).toContain('Venta')
    expect(text).toContain('Definir el precio')
    expect(text).toContain('Pasos hechos: 1 de 2')
    expect(certainties(ctx).has('ESTIMATE')).toBe(false)
  })

  it('no hay operación: un solo UNKNOWN y sin acciones de operación', () => {
    expect(NO_OPERATION_CONTEXT.lines).toHaveLength(1)
    expect(NO_OPERATION_CONTEXT.lines[0].certainty).toBe('UNKNOWN')
    expect(NO_OPERATION_CONTEXT.actionContext.operationId).toBeNull()
  })
})

describe('contexto: compacto y sin datos inventados', () => {
  it('formato por etiquetas, tope de largo y nada de NaN, undefined ni USD 0', () => {
    for (const property of [null, prop(), prop({ price: 0 })]) {
      const { ctx } = buyContext(property, property ? { propertyId: 'prop-1' } : {})
      const text = renderContext(ctx)
      expect(text.length).toBeLessThanOrEqual(MAX_CONTEXT_CHARS)
      expect(text).toMatch(/^\[(FACT|EXTRACTED|INFERENCE|ESTIMATE|RECOMMENDATION|UNKNOWN)\] /m)
      expect(text).not.toMatch(/NaN|undefined|null|USD 0\b|\$ ?0\b/)
      expect(ctx.lines.length).toBeLessThanOrEqual(30)
    }
  })

  it('un contexto enorme se recorta', () => {
    const big = { lines: Array.from({ length: 30 }, () => ({ certainty: 'FACT' as const, text: 'x'.repeat(320) })), actionContext: NO_OPERATION_CONTEXT.actionContext }
    expect(renderContext(big).length).toBeLessThanOrEqual(MAX_CONTEXT_CHARS)
  })

  it('el servidor acepta solo texto acotado y limpio', () => {
    expect(sanitizeContextText(undefined)).toBeNull()
    expect(sanitizeContextText({ a: 1 })).toBeNull()
    expect(sanitizeContextText('   ')).toBeNull()
    expect(sanitizeContextText('[FACT] ok\u0000\u0007 listo')).toBe('[FACT] ok listo')
    expect(sanitizeContextText('a'.repeat(50_000))!.length).toBe(MAX_CONTEXT_CHARS)
  })

  it('las reglas separan las seis certezas y prohíben enviar, crear ofertas o inventar', () => {
    for (const k of ['FACT', 'EXTRACTED', 'INFERENCE', 'ESTIMATE', 'RECOMMENDATION', 'UNKNOWN']) expect(CONTEXT_RULES).toContain(`[${k}]`)
    expect(CONTEXT_RULES).toMatch(/Nunca presentes una inferencia o una estimación como un hecho/)
    expect(CONTEXT_RULES).toMatch(/no se envió nada/)
    expect(CONTEXT_RULES).toMatch(/nunca recalcules/i)
  })
})

describe('texto y voz: una sola inteligencia', () => {
  it('la voz recibe el mismo bloque de contexto que el chat de texto', () => {
    const { ctx } = buyContext(prop(), { propertyId: 'prop-1' })
    const text = renderContext(ctx)
    const voice = buildRealtimeSession(undefined, text).session.instructions
    expect(voice).toContain(VOICE_INSTRUCTIONS)
    expect(voice).toContain(contextBlock(text))
    expect(buildRealtimeSession().session.instructions).toBe(VOICE_INSTRUCTIONS) // sin contexto, igual funciona
  })

  it('las dos rutas toman el contexto con la misma función y el hook lo pide al mismo constructor', () => {
    const chat = read('src/app/api/chat/route.ts')
    const rt = read('src/app/api/assistant/realtime/route.ts')
    const hook = read('src/hooks/useRealtimeVoice.ts')
    const page = read('src/app/asistente/page.tsx')
    expect(chat).toContain('sanitizeContextText(assistantContext)')
    expect(chat).toContain('contextBlock(opContext)')
    expect(rt).toContain('sanitizeContextText(')
    expect(rt).toContain('buildRealtimeSession(process.env.OPENAI_REALTIME_MODEL, context)')
    expect(hook).toContain('context: opts.current.getContext()')
    expect(page).toContain('assistantContext: ac.text')
    expect(page).toContain('getContext: () => acRef.current.text')
    // el navegador sigue sin elegir modelo, voz ni reglas
    expect(rt).not.toMatch(/instructions|model:/)
  })

  it('no se duplican cálculos: el contexto usa buildFirstValue y no recalcula costos ni acciones', () => {
    const ctxSrc = read('src/lib/assistant/context.ts')
    const hook = read('src/hooks/useAssistantContext.ts')
    expect(hook).toContain('buildFirstValue(')
    expect(ctxSrc).not.toMatch(/generateChecklist|computeNextActions|computeBuyerCosts/)
    expect(ctxSrc).not.toMatch(/from '@\/lib\/regulations'|from '@\/lib\/nba/)
  })
})

describe('acciones del chat', () => {
  const full: ActionContext = {
    operationId: 'op-1', kind: 'BUY', propertyId: 'prop-1', propertyIncomplete: true,
    primary: { label: 'Ver documentos', href: '/operacion/op-1?tab=documentos' },
  }
  const hrefs = (q: string, c: ActionContext = full) => suggestActions(c, q).map(a => a.href)

  it('"qué tengo que hacer ahora" y "por qué esta es la próxima acción" llevan a la acción del motor', () => {
    expect(hrefs('¿Qué tengo que hacer ahora?')).toEqual(['/operacion/op-1?tab=documentos'])
    expect(hrefs('Explicame por qué esta es la próxima acción')[0]).toBe('/operacion/op-1?tab=documentos')
    expect(hrefs('¿Qué harías vos en mi lugar?')[0]).toBe('/operacion/op-1?tab=documentos')
  })

  it('costos, documentos, riesgos, propiedad, comparar, venta y negociación', () => {
    expect(hrefs('¿Cuánto me va a costar?')).toEqual(['/operacion/op-1?tab=costos'])
    expect(hrefs('¿Qué documentos me faltan?')).toContain('/operacion/op-1?tab=documentos')
    expect(hrefs('¿Qué riesgo tengo?')).toEqual(['/operacion/op-1?tab=riesgos'])
    expect(hrefs('¿Qué sabemos de esta propiedad?')).toEqual(['/propiedades/prop-1'])
    expect(hrefs('Quiero comparar esta propiedad con otra')).toContain('/comparar')
    expect(hrefs('Redactame el mensaje para el vendedor')).toEqual(['/negociacion'])
    expect(hrefs('quiero vender mi casa', { ...full, kind: 'SELL' })).toEqual(['/preparar-venta'])
    expect(hrefs('quiero vender mi casa', { ...full, kind: 'BUY' })).toEqual([])
  })

  it('"qué me falta" ofrece completar la propiedad solo si de verdad está incompleta', () => {
    expect(hrefs('¿Qué me falta?')).toContain('/propiedades/prop-1')
    expect(hrefs('¿Qué me falta?', { ...full, propertyIncomplete: false })).not.toContain('/propiedades/prop-1')
  })

  it('sin operación: costos van a la calculadora general y no hay botones que dependan de una operación', () => {
    const none = NO_OPERATION_CONTEXT.actionContext
    expect(hrefs('¿Cuánto cuesta escriturar?', none)).toEqual(['/costos'])
    expect(hrefs('¿Qué documentos me faltan?', none)).toEqual([])
    expect(hrefs('¿Qué tengo que hacer ahora?', none)).toEqual([])
    expect(hrefs('¿Qué sabemos de esta propiedad?', none)).toEqual(['/propiedades'])
  })

  it('máximo dos botones, sin repetir destino, y ninguno sin pregunta', () => {
    expect(suggestActions(full, '¿Qué documentos, costos, riesgos y propiedad comparar con mensaje?').length).toBeLessThanOrEqual(MAX_ACTIONS)
    expect(suggestActions(full, '')).toEqual([])
    expect(suggestActions(full, 'hola')).toEqual([])
    const all = suggestActions(full, '¿Qué documentos me faltan?')
    expect(new Set(all.map(a => a.href)).size).toBe(all.length)
  })

  it('solo hay navegación interna: ninguna acción envía, crea ni modifica nada', () => {
    const questions = ['¿Cuánto cuesta?', '¿Qué riesgo tengo?', 'Redactame el mensaje para el vendedor', 'comparar', 'vender', '¿Qué hago?']
    for (const q of questions) for (const a of suggestActions({ ...full, kind: 'SELL' }, q)) expect(isSafeAction(a)).toBe(true)
    expect(isSafeAction({ id: 'x', label: 'x', href: 'https://evil.example' })).toBe(false)
    expect(isSafeAction({ id: 'x', label: 'x', href: '//evil.example' })).toBe(false)
    expect(isSafeAction({ id: 'x', label: 'x', href: 'javascript:alert(1)' })).toBe(false)
    expect(isSafeAction(null)).toBe(false)
    const src = read('src/lib/assistant/actions.ts')
    expect(src).not.toMatch(/fetch\(|method:|XMLHttpRequest|localStorage|supabase/i)
  })

  it('/asistente muestra el botón debajo de la respuesta y filtra el historial guardado', () => {
    const page = read('src/app/asistente/page.tsx')
    expect(page).toContain('aria-label="Acciones sugeridas"')
    expect(page).toContain('<Link key={a.id} href={a.href}')
    expect(page).toContain('actions: suggestActions(ac.actionContext, msg)') // texto
    expect(page).toContain('actions: suggestActions(acRef.current.actionContext, lastUser)') // voz
    expect(page).toContain('m.actions.filter(isSafeAction)')
  })
})

describe('sprint: casos de aceptación', () => {
  const base = () => buyContext(prop(), { propertyId: 'prop-1' })
  const withCosts = (confidence: 'VERIFIED' | 'PARTIAL' | 'ESTIMATED') => {
    const { fv, transaction } = base()
    const costs = { known: true as const, price: 150000, provinceName: 'Ciudad de Buenos Aires', confidence, min: 4000, max: 6000, percentMin: 2.7, percentMax: 4, lines: [{ label: 'Sellos', min: 2000, max: 3000 }], source: 'fuente' }
    return buildAssistantContext({ op: summary(buyStored, { propertyId: 'prop-1' }), fv: { ...fv, costs }, property: prop(), transaction })
  }

  it('costos verificados vs parcialmente verificados vs estimados: siempre ESTIMATE, con su confianza dicha', () => {
    const text = (c: ReturnType<typeof withCosts>) => c.lines.filter(l => l.certainty === 'ESTIMATE').map(l => l.text).join(' ')
    expect(text(withCosts('VERIFIED'))).toContain('fuente verificada')
    expect(text(withCosts('PARTIAL'))).toContain('parcialmente verificado')
    expect(text(withCosts('ESTIMATED'))).toContain('sin fuente oficial confirmada')
    for (const c of ['VERIFIED', 'PARTIAL', 'ESTIMATED'] as const) {
      expect(withCosts(c).lines.some(l => l.certainty === 'FACT' && /USD 4/.test(l.text))).toBe(false)
    }
  })

  it('un riesgo real y una tarea bloqueada entran como FACT, con su severidad', () => {
    const { fv, transaction } = base()
    const attention = [
      { id: 'risk_r1', label: 'Inhibición del vendedor', detail: 'Pedir certificado de inhibiciones.', severity: 'HIGH' as const },
      { id: 'task_t1', label: 'Certificado de dominio', detail: 'Bloqueada hasta tener el informe.', severity: 'HIGH' as const },
    ]
    const ctx = buildAssistantContext({ op: summary(buyStored, { propertyId: 'prop-1' }), fv: { ...fv, attention }, property: prop(), transaction })
    const facts = ctx.lines.filter(l => l.certainty === 'FACT').map(l => l.text)
    expect(facts.some(t => t.startsWith('Riesgo registrado (alto): Inhibición del vendedor'))).toBe(true)
    expect(facts.some(t => t.startsWith('Tarea bloqueada: Certificado de dominio'))).toBe(true)
  })

  it('el precio es de publicación y no se presenta como cerrado; las reglas lo prohíben', () => {
    const line = base().ctx.lines.find(l => /^(Datos leídos del aviso\. )?Propiedad:/.test(l.text))!
    expect(line.text).toContain('Precio de publicación (no es precio cerrado)')
    expect(CONTEXT_RULES).toMatch(/precio cerrado/)
    expect(CONTEXT_RULES).toMatch(/no una obligación/)
    expect(CONTEXT_RULES).toMatch(/conclusión[\s\S]*evidencia[\s\S]*no sabe[\s\S]*próxima acción/i)
  })

  it('una inferencia nunca queda como FACT', () => {
    const { ctx } = buyContext(prop()) // sin vínculo explícito
    const inference = ctx.lines.find(l => l.certainty === 'INFERENCE')!
    expect(inference).toBeTruthy()
    expect(ctx.lines.filter(l => l.certainty === 'FACT').some(l => l.text.includes(inference.text))).toBe(false)
  })

  it('"qué tengo que hacer ahora y por qué": una sola acción principal, la del motor', () => {
    const { ctx, fv } = base()
    const actions = suggestActions(ctx.actionContext, '¿Qué tengo que hacer ahora y por qué?')
    expect(actions).toHaveLength(1)
    expect(actions[0].href).toBe(fv.primary.cta.href)
  })

  it('"qué está frenando mi operación", "qué no sabemos" y "analizar" llevan a pantallas internas reales', () => {
    const c: ActionContext = { operationId: 'op-1', kind: 'BUY', propertyId: 'prop-1', propertyIncomplete: true, primary: null }
    expect(suggestActions(c, '¿Qué está frenando mi operación?').map(a => a.href)[0]).toBe('/operacion/op-1?tab=riesgos')
    expect(suggestActions(c, '¿Qué no sabemos todavía?').map(a => a.href)).toEqual(['/propiedades/prop-1'])
    expect(suggestActions(c, '¿Me conviene analizar esta propiedad?').map(a => a.href)).toContain('/analizar')
  })

  it('solo existen las acciones permitidas: ninguna envía, ofrece, reserva ni paga', () => {
    const allowed = new Set(['next_step', 'view_costs', 'view_documents', 'view_risks', 'view_operation', 'open_property', 'complete_property', 'analyze_property', 'compare', 'prepare_sale', 'open_negotiation'])
    const c: ActionContext = { operationId: 'op-1', kind: 'SELL', propertyId: 'prop-1', propertyIncomplete: true, primary: { label: 'Ver', href: '/operacion/op-1' } }
    const qs = ['qué hago ahora', 'cuánto cuesta', 'documentos', 'riesgos', 'mi operación', 'propiedad', 'qué falta', 'analizar', 'comparar', 'vender', 'mensaje al vendedor', 'quiero hacer una oferta y reservar y pagar la seña']
    for (const q of qs) {
      const actions = suggestActions(c, q)
      expect(actions.length).toBeLessThanOrEqual(MAX_ACTIONS)
      for (const a of actions) {
        expect(allowed.has(a.id)).toBe(true)
        expect(isSafeAction(a)).toBe(true)
        expect(a.id).not.toMatch(/send|offer|pay|reserve|delete/i)
      }
    }
  })

  it('venta y compra sin propiedad: el contexto sigue siendo honesto sobre lo que no sabe', () => {
    const { ctx } = buyContext(null)
    const unknown = ctx.lines.filter(l => l.certainty === 'UNKNOWN').map(l => l.text).join(' ')
    expect(unknown).toMatch(/costos|precio/i)
    expect(ctx.lines.some(l => l.certainty === 'FACT' && /precio de publicación/i.test(l.text))).toBe(false)
  })
})
