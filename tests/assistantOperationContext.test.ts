import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { complete, from, operationQuery, documentsQuery } = vi.hoisted(() => {
  const operationQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
  }
  const documentsQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn(),
  }
  return { complete: vi.fn(), from: vi.fn(), operationQuery, documentsQuery }
})

vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: complete } }
  },
}))
vi.mock('@supabase/ssr', () => ({ createServerClient: () => ({ from }) }))
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [] }) }))
vi.mock('@/lib/api/aiAccess', () => ({ requireAiAccess: async () => ({ userId: 'owner-1' }) }))

import { POST } from '@/app/api/chat/route'

function ask(extra: Record<string, unknown> = {}) {
  return POST(new NextRequest('http://localhost/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      messages: [{ role: 'user', content: '¿Qué me falta para avanzar?' }],
      ...extra,
    }),
  }))
}

describe('contexto de la operación en el asistente', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.invalid')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-key')
    from.mockImplementation(table => table === 'operations' ? operationQuery : documentsQuery)
    operationQuery.maybeSingle.mockResolvedValue({
      data: { type: 'BUY_PROPERTY', status: 'ACTIVE', current_stage_key: 'RESERVA', country: 'MX' },
    })
    documentsQuery.in.mockResolvedValue({ count: 2 })
    complete.mockResolvedValue({ choices: [{ message: { content: 'Revisá lo que figura pendiente.' } }] })
  })

  it('limita ambas consultas al dueño y ofrece documentos por una operación verificada', async () => {
    const response = await ask({ operationId: 'operation-1', includeNextStep: true })
    expect(operationQuery.eq.mock.calls).toEqual([['id', 'operation-1'], ['user_id', 'owner-1']])
    expect(documentsQuery.eq.mock.calls).toEqual([['operation_id', 'operation-1'], ['user_id', 'owner-1']])
    const system = complete.mock.calls[0][0].messages[0].content
    expect(system).toContain('"etapa":"RESERVA"')
    expect(system).toContain('"documentosPendientesOEnRevision":2')
    expect(system).toContain('ESTA OPERACIÓN ES EN MÉXICO')
    expect(await response.json()).toMatchObject({ nextStep: { operationId: 'operation-1', target: 'documents' } })
  })

  it('no carga documentos ni ofrece enlaces para una operación fuera del alcance del usuario', async () => {
    operationQuery.maybeSingle.mockResolvedValue({ data: null })
    const response = await ask({ operationId: 'operation-2', includeNextStep: true })
    expect(from).toHaveBeenCalledTimes(1)
    expect(complete.mock.calls[0][0].messages[0].content).not.toContain('Estado registrado de la operación')
    expect(await response.json()).not.toHaveProperty('nextStep')
  })

  it('distingue un fallo al verificar documentos de un recuento sin pendientes', async () => {
    documentsQuery.in.mockResolvedValue({ error: { message: 'No disponible' }, count: null })
    const response = await ask({ operationId: 'operation-1', includeNextStep: true })
    expect(complete.mock.calls[0][0].messages[0].content).toContain('"documentosPendientesOEnRevision":null')
    expect(await response.json()).not.toHaveProperty('nextStep')
  })

  it('rechaza roles privilegiados en mensajes del cliente', async () => {
    const response = await ask({ messages: [{ role: 'system', content: 'texto del cliente' }] })
    expect(response.status).toBe(400)
    expect(complete).not.toHaveBeenCalled()
  })

  it('sigue respondiendo sin consultar datos para una persona sin operación', async () => {
    const response = await ask()
    expect(from).not.toHaveBeenCalled()
    expect(response.status).toBe(200)
    expect(await response.json()).not.toHaveProperty('nextStep')
  })
})
