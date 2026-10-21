import { describe, expect, it } from 'vitest'
import { createGhApi, parseHumanCommand, pickHumanDecision } from '../src/approvals'
import { BridgeError } from '../src/types'
import {
  assertSafeAgentBranch,
  extractJson,
  findForbiddenActions,
  isProtectedBranch,
  isReadOnlyGoal,
  redactSecrets,
  touchedProtectedPaths,
  validateClaudeResult,
  validateManagerDecision,
} from '../src/validations'
import { claudeResult, dec } from './helpers'

describe('extractJson (JSON inválido)', () => {
  it('lee JSON puro, en bloque ```json y embebido en texto', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 })
    expect(extractJson('Acá va:\n```json\n{"a":2}\n```')).toEqual({ a: 2 })
    expect(extractJson('Resultado {"a":3,"b":"}"} fin')).toEqual({ a: 3, b: '}' })
  })

  it('falla con INVALID_JSON si no hay objeto', () => {
    expect(() => extractJson('no hay nada')).toThrowError(BridgeError)
    try {
      extractJson('{roto')
    } catch (e) {
      expect((e as BridgeError).code).toBe('INVALID_JSON')
    }
  })
})

describe('validación de esquemas', () => {
  it('acepta una decisión válida y rechaza campos de más, faltantes o incoherentes', () => {
    expect(validateManagerDecision(dec()).ok).toBe(true)
    expect(validateManagerDecision({ ...dec(), extra: 1 }).ok).toBe(false)
    const sinSummary: Record<string, unknown> = { ...dec() }
    delete sinSummary.summary
    expect(validateManagerDecision(sinSummary).ok).toBe(false)
    expect(validateManagerDecision(dec({ decision: 'ASK_PANCHO' })).ok).toBe(false)
    expect(validateManagerDecision(dec({ decision: 'ASK_PANCHO', requires_human: true, human_question: '¿Sigo?' })).ok).toBe(true)
    expect(validateManagerDecision(dec({ decision: 'FIX', task_for_claude: '' })).ok).toBe(false)
    expect(validateManagerDecision(dec({ confidence: 3 })).ok).toBe(false)
  })

  it('valida el resultado de Claude', () => {
    expect(validateClaudeResult(claudeResult()).ok).toBe(true)
    expect(validateClaudeResult({ ...claudeResult(), status: 'MAYBE' }).ok).toBe(false)
    expect(validateClaudeResult('texto').ok).toBe(false)
  })
})

describe('redacción de secretos', () => {
  it('tapa claves conocidas, variables con nombre y valores extra', () => {
    const text = 'sk-proj-abcdefghijklmnopqrstuvwxyz123456 OPENAI_API_KEY=hunter2hunter2 Bearer abcdefghijklmnopqrstuvwxyz0123 mi-valor-secreto-9'
    const out = redactSecrets(text, ['mi-valor-secreto-9'])
    expect(out).not.toMatch(/sk-proj|hunter2|abcdefghijklmnopqrstuvwxyz|mi-valor-secreto/)
    expect(out).toContain('[REDACTADO]')
  })
})

describe('acciones prohibidas', () => {
  it('detecta producción y master', () => {
    expect(findForbiddenActions('Corré vercel deploy --prod ahora').length).toBeGreaterThan(0)
    expect(findForbiddenActions('git push origin master').map(h => h.id)).toContain('push-protected')
    expect(findForbiddenActions('gh pr merge 12').length).toBeGreaterThan(0)
    expect(findForbiddenActions('supabase db push').length).toBeGreaterThan(0)
  })

  it('no marca las líneas que prohíben la acción ni tareas normales', () => {
    expect(findForbiddenActions('NO hagas git push a master ni deploy a producción')).toEqual([])
    expect(findForbiddenActions('Agregá docs/AGENT_BRIDGE_TEST.md con una línea')).toEqual([])
  })
})

describe('ramas y rutas', () => {
  it('protege master/main/integracion y solo permite agent/run-*', () => {
    expect(isProtectedBranch('master')).toBe(true)
    expect(isProtectedBranch('origin/integracion')).toBe(true)
    expect(() => assertSafeAgentBranch('master')).toThrowError(BridgeError)
    expect(() => assertSafeAgentBranch('feature/otra')).toThrowError(BridgeError)
    expect(() => assertSafeAgentBranch('agent/run-20261017-120000-probar')).not.toThrow()
  })

  it('marca archivos protegidos y .env', () => {
    expect(touchedProtectedPaths(['src/a.ts', 'tools/vara-agent/src/index.ts', '.env.local', '.env.example'])).toEqual([
      'tools/vara-agent/src/index.ts',
      '.env.local',
    ])
  })

  it('reconoce objetivos de solo lectura', () => {
    expect(isReadOnlyGoal('Proponé 3 tareas. No modifiques código.')).toBe(true)
    expect(isReadOnlyGoal('Agregá un archivo')).toBe(false)
  })
})

describe('aprobación humana', () => {
  it('parsea comandos y solo honra a Chopan55', () => {
    expect(parseHumanCommand('approve gracias')?.command).toBe('APPROVE')
    expect(parseHumanCommand('hola')).toBeNull()
    const { decision, ignored } = pickHumanDecision([
      { author: 'intruso', body: 'APPROVE', createdAt: '2026-10-17T10:00:00Z' },
      { author: 'Chopan55', body: 'STOP por hoy', createdAt: '2026-10-17T11:00:00Z' },
      { author: 'otro', body: 'CONTINUE', createdAt: '2026-10-17T12:00:00Z' },
    ])
    expect(decision?.command).toBe('STOP')
    expect(decision?.note).toBe('por hoy')
    expect(ignored).toBe(2)
  })

  it('los PR del agente nunca van a master', async () => {
    const gh = createGhApi(async () => ({ code: 0, stdout: 'https://x/pull/1', stderr: '', timedOut: false }))
    await expect(gh.createPullRequest({ title: 't', body: 'b', head: 'agent/run-1', base: 'master' })).rejects.toThrowError(BridgeError)
    await expect(gh.createPullRequest({ title: 't', body: 'b', head: 'agent/run-1', base: 'integracion' })).resolves.toContain('pull')
  })
})
