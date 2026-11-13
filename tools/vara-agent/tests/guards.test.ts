/** Último hardening: tope de gasto de Claude (por llamada y acumulado) y typecheck del bridge en el CI. */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { extractStateFromIssueBody, resolveResume } from '../src/approvals'
import { DEFAULT_CLAUDE_MAX_BUDGET_USD, DEFAULT_MAX_AGENT_COST_USD, buildClaudeArgs, createClaudeRunner, readBudgets } from '../src/claude-runner'
import { configFromResume, runBridge } from '../src/index'
import type { CommandRunner } from '../src/types'
import { baseConfig, claudeResult, dec, doneDec, fakeClaude, fakeGh, fakeGit, fakeManager, makeDeps } from './helpers'

const step = (n: number) => dec({ task_for_claude: `Tarea distinta número ${n}` })
const varying = () => {
  let n = 0
  const m = {
    calls: 0,
    async decide() {
      m.calls++
      n++
      return { raw: step(n) }
    },
  }
  return m
}
const comment = (issueNumber: number, body = 'APPROVE') => ({
  issueNumber,
  source: 'comment' as const,
  author: 'Chopan55',
  authorType: 'User',
  body,
  now: new Date('2026-10-18T15:00:00Z'),
})

describe('--max-budget-usd por llamada a Claude', () => {
  const cfg = { model: 'sonnet', resultSchema: '{}', systemPrompt: 's' }

  it('los valores por defecto son 2.50 por llamada y 8.00 acumulado', () => {
    expect(DEFAULT_CLAUDE_MAX_BUDGET_USD).toBe(2.5)
    expect(DEFAULT_MAX_AGENT_COST_USD).toBe(8)
    expect(readBudgets({})).toEqual({ claudeMaxBudgetUsd: 2.5, maxAgentCostUsd: 8 })
  })

  it('CLAUDE_MAX_BUDGET_USD y MAX_AGENT_COST_USD son configurables; los valores inválidos vuelven al default', () => {
    expect(readBudgets({ CLAUDE_MAX_BUDGET_USD: '1.25', MAX_AGENT_COST_USD: '4' })).toEqual({ claudeMaxBudgetUsd: 1.25, maxAgentCostUsd: 4 })
    for (const bad of ['', 'abc', '0', '-3', 'NaN']) {
      expect(readBudgets({ CLAUDE_MAX_BUDGET_USD: bad, MAX_AGENT_COST_USD: bad })).toEqual({ claudeMaxBudgetUsd: 2.5, maxAgentCostUsd: 8 })
    }
  })

  it('cuando está configurado, cada llamada lleva --max-budget-usd con el valor', () => {
    const args = buildClaudeArgs({ ...cfg, maxBudgetUsd: 2.5 }, { readOnly: true })
    expect(args[args.indexOf('--max-budget-usd') + 1]).toBe('2.5')
  })

  it('sin configurar no se pasa el flag', () => {
    expect(buildClaudeArgs(cfg, { readOnly: true })).not.toContain('--max-budget-usd')
  })

  it('no pasa --max-turns: el presupuesto, el timeout y las rondas son los topes confiables', () => {
    expect(buildClaudeArgs({ ...cfg, maxBudgetUsd: 2.5 }, { readOnly: false })).not.toContain('--max-turns')
  })

  it('el runner real lo pasa en cada llamada', async () => {
    const seen: string[][] = []
    const run: CommandRunner = async (_c, args) => {
      seen.push(args)
      return { code: 0, stdout: JSON.stringify({ subtype: 'success', is_error: false, structured_output: claudeResult() }), stderr: '', timedOut: false }
    }
    const claude = createClaudeRunner(run, { ...cfg, maxBudgetUsd: 1.5, sourceEnv: {} })
    await claude.run('uno', { readOnly: true })
    await claude.run('dos', { readOnly: false })
    expect(seen.map(a => a[a.indexOf('--max-budget-usd') + 1])).toEqual(['1.5', '1.5'])
  })
})

describe('guarda de costo acumulado del bridge', () => {
  it('al superar el límite pausa en WAITING_FOR_HUMAN y le pregunta a Pancho por el costo', async () => {
    const gh = fakeGh()
    const claude = fakeClaude([claudeResult()], undefined, 0.05)
    const { deps } = makeDeps({ manager: varying(), claude, gh, maxCostUsd: 0.08 })
    const rec = await runBridge(deps, baseConfig({ goal: 'Algo largo' }))
    expect(rec.final_status).toBe('WAITING_FOR_HUMAN')
    expect(rec.rounds).toHaveLength(2)
    expect(claude.calls).toBe(2)
    expect(rec.usage.claude.costUsd).toBeCloseTo(0.1, 5)
    expect(rec.human_question).toMatch(/otra ventana/)
    expect(gh.issues).toHaveLength(1)
    expect(gh.issues[0].body).toMatch(/costo acumulado/i)
  })

  it('no inicia otra llamada a Claude (ni otra ronda del Manager) después de excederlo', async () => {
    const manager = varying()
    const claude = fakeClaude([claudeResult()], undefined, 0.05)
    const { deps } = makeDeps({ manager, claude, maxCostUsd: 0.04 })
    const rec = await runBridge(deps, baseConfig({ goal: 'Algo largo' }))
    expect(rec.final_status).toBe('WAITING_FOR_HUMAN')
    expect(claude.calls).toBe(1)
    expect(manager.calls).toBe(1)
  })

  it('llegar justo al límite no lo excede: la corrida sigue', async () => {
    const manager = fakeManager([step(1), doneDec()])
    const claude = fakeClaude([claudeResult()], undefined, 0.05)
    const { deps } = makeDeps({ manager, claude, maxCostUsd: 0.05 })
    const rec = await runBridge(deps, baseConfig({ dryRun: true }))
    expect(rec.final_status).toBe('DONE')
    expect(claude.calls).toBe(1)
  })

  it('al reanudar con el límite ya superado no llama a Claude', async () => {
    const gh = fakeGh()
    const state = {
      runId: 'run-20261018-120000',
      goal: 'Objetivo original',
      branch: 'agent/run-20261018-120000-objetivo-original',
      roundsUsed: 2,
      historySummary: '',
      humanDecisions: [],
      costUsd: 9,
      costLimitUsd: 8,
    }
    const claude = fakeClaude([claudeResult()])
    const { deps } = makeDeps({ manager: fakeManager([step(1)]), claude, gh })
    const rec = await runBridge(deps, configFromResume(state))
    expect(rec.final_status).toBe('WAITING_FOR_HUMAN')
    expect(claude.calls).toBe(0)
  })

  it('el costo se arrastra entre reanudaciones y aprobar otorga una ventana nueva, no un cheque en blanco', async () => {
    const gh = fakeGh()
    const first = makeDeps({ manager: varying(), claude: fakeClaude([claudeResult()], undefined, 0.05), gh, maxCostUsd: 0.04 })
    const rec1 = await runBridge(first.deps, baseConfig({ goal: 'Algo largo' }))
    expect(rec1.final_status).toBe('WAITING_FOR_HUMAN')

    const saved = extractStateFromIssueBody(gh.issues[0].body)
    expect(saved?.costUsd).toBeCloseTo(0.05, 5)
    expect(saved?.costLimitUsd).toBeCloseTo(0.09, 5)

    const res = await resolveResume(gh, comment(gh.issues[0].number))
    if (res.kind !== 'continue') throw new Error('debía continuar')
    const claude2 = fakeClaude([claudeResult()], undefined, 0.05)
    const second = makeDeps({ manager: varying(), claude: claude2, gh, git: fakeGit(), maxCostUsd: 0.04 })
    const rec2 = await runBridge(second.deps, configFromResume(res.state))
    // Con la ventana nueva puede hacer una llamada más, pero 0.05 + 0.05 > 0.09: vuelve a pausar
    expect(claude2.calls).toBe(1)
    expect(rec2.final_status).toBe('WAITING_FOR_HUMAN')
    const saved2 = extractStateFromIssueBody(gh.issues[0].body)
    expect(saved2?.costUsd).toBeCloseTo(0.1, 5)
    expect(saved2?.costLimitUsd).toBeCloseTo(0.14, 5)
    expect(gh.issues).toHaveLength(1)
  })
})

describe('CI del proyecto', () => {
  const ci = readFileSync(fileURLToPath(new URL('../../../.github/workflows/ci.yml', import.meta.url)), 'utf8').replace(/\r\n/g, '\n')

  it('typecheckea el bridge además del proyecto, y el CI no continúa si falla', () => {
    const project = ci.indexOf('run: npm run typecheck\n')
    const bridge = ci.indexOf('run: npm run typecheck --prefix tools/vara-agent')
    expect(project).toBeGreaterThan(-1)
    expect(bridge).toBeGreaterThan(project)
    expect(ci).toContain('run: npm ci --prefix tools/vara-agent')
    expect(ci.indexOf('npm ci --prefix tools/vara-agent')).toBeLessThan(bridge)
    expect(ci).not.toMatch(/continue-on-error/)
  })

  it('corre para los PR hacia integracion y acepta disparo manual', () => {
    expect(ci).toMatch(/pull_request:\s*\n\s*branches: \[[^\]]*integracion/)
    expect(ci).toContain('workflow_dispatch:')
  })
})
