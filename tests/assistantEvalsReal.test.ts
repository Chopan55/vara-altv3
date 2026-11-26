/**
 * Evaluación REAL del asistente: los mismos 30 casos que el banco determinístico, pero contra el modelo de verdad,
 * pasando por la ruta real del chat (nada duplicado). NO corre en CI: se activa con
 *   OPENAI_API_KEY=... npm run eval:assistant
 * y deja el resultado en docs/evals/ultimo-resultado.md. La clave solo se lee de process.env.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { assistantCases, type AssistantEvalCase } from './evals/assistantCases'
import { scoreReply, type ScoredReply } from './evals/scoring'

const { from, operationQuery, documentsQuery, tasksQuery, propertiesQuery } = vi.hoisted(() => {
  const operationQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn() }
  const documentsQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), limit: vi.fn() }
  const tasksQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn() }
  const propertiesQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn() }
  return { from: vi.fn(), operationQuery, documentsQuery, tasksQuery, propertiesQuery }
})
vi.mock('@supabase/ssr', () => ({ createServerClient: () => ({ from }) }))
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [] }) }))
vi.mock('@/lib/api/aiAccess', () => ({ requireAiAccess: async () => ({ userId: 'owner-1' }) }))

import { POST } from '@/app/api/chat/route'

const enabled = process.env.EVAL_REAL === '1' && Boolean(process.env.OPENAI_API_KEY)
// Los casos 25 y 26 simulan a un modelo que se equivoca: solo tienen sentido con el modelo simulado.
const SIMULATED_ONLY = /^(25|26)-/

function configureSupabase(testCase: AssistantEvalCase) {
  from.mockImplementation(table => table === 'operations' ? operationQuery : table === 'operation_tasks' ? tasksQuery : table === 'properties' ? propertiesQuery : documentsQuery)
  operationQuery.maybeSingle.mockResolvedValue({ data: testCase.operation ?? null })
  documentsQuery.limit.mockResolvedValue(testCase.documentsError
    ? { error: { message: 'simulado' }, count: null, data: null }
    : { count: testCase.documents?.length ?? 0, data: testCase.documents ?? [] })
  tasksQuery.limit.mockResolvedValue(testCase.tasksError ? { error: { message: 'simulado' }, data: null } : { data: testCase.tasks ?? [] })
  propertiesQuery.maybeSingle.mockImplementation(async () => {
    if (testCase.propertyError) throw new Error('simulado')
    return { data: testCase.property ?? null }
  })
}

describe.runIf(enabled)('evaluación real del asistente (modelo de verdad)', () => {
  it('corre los casos y deja el informe', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://supabase.invalid')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'synthetic-anon-key')
    const results: ScoredReply[] = []
    const startedAt = new Date().toISOString()
    for (const testCase of assistantCases.filter(c => !SIMULATED_ONLY.test(c.id))) {
      configureSupabase(testCase)
      const started = performance.now()
      const res = await POST(new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({ messages: testCase.messages, context: testCase.screenContext, operationId: testCase.operationId, includeNextStep: testCase.includeNextStep }),
      }))
      const ms = Math.round(performance.now() - started)
      const body = await res.json() as { reply?: string; draft?: string; sources?: { kind: string }[] }
      const scored = res.status === 200 && body.reply
        ? scoreReply(testCase, { reply: body.reply, draft: body.draft, sources: body.sources })
        : { id: testCase.id, status: 'FAIL' as const, score: 0, failed: [`HTTP ${res.status}`], reply: '' }
      results.push({ ...scored, reply: `${scored.reply}\n\n(${ms} ms)` })
    }
    const pass = results.filter(r => r.status === 'PASS').length
    const fail = results.filter(r => r.status === 'FAIL').length
    const report = [
      '# Último resultado de evaluación real del asistente', '',
      `- Ejecutado: ${startedAt}`,
      `- Modelo: ${process.env.OPENAI_CHAT_MODEL?.trim() || 'gpt-5.4-mini (por defecto)'}`,
      `- Casos: ${results.length} · PASS ${pass} · WARN ${results.length - pass - fail} · FAIL ${fail}`,
      '', '| Caso | Estado | Puntaje | Reglas que falló |', '|---|---:|---:|---|',
      ...results.map(r => `| ${r.id} | ${r.status} | ${r.score} | ${r.failed.length ? r.failed.join('; ') : '—'} |`),
      '', '## Respuestas', '',
      ...results.flatMap(r => [`### ${r.id}`, '', r.reply, '']),
      'El puntaje usa reglas objetivas; no hay otro modelo actuando como juez.', '',
    ].join('\n')
    const out = resolve(process.cwd(), 'docs/evals/ultimo-resultado.md')
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, report, 'utf8')
    console.log(`PASS ${pass} · WARN ${results.length - pass - fail} · FAIL ${fail} de ${results.length}`)
    expect(fail, results.filter(r => r.status === 'FAIL').map(r => `${r.id}: ${r.failed.join('; ')}`).join('\n')).toBe(0)
  }, 900000)
})
