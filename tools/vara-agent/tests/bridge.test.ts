import { describe, expect, it } from 'vitest'
import { prepareResume, runBridge } from '../src/index'
import { createLogger } from '../src/logger'
import { createRunRecord, decodeState, encodeState, toResumeState } from '../src/run-state'
import { BridgeError } from '../src/types'
import { baseConfig, claudeResult, dec, fakeClaude, fakeGit, fakeManager, fakeRunner, makeDeps } from './helpers'

const DRY_GOAL = 'Revisá el estado actual del proyecto VARA y proponé las 3 próximas tareas técnicas prioritarias. No modifiques código.'

describe('corrida exitosa (DONE)', () => {
  it('dry-run de solo análisis: GPT → Claude → GPT → DONE sin cambios, sin rama, sin PR', async () => {
    const manager = fakeManager([dec(), dec({ decision: 'DONE', task_for_claude: '', reason: 'Listo', summary: 'Tareas propuestas' })])
    const claude = fakeClaude([claudeResult({ summary: 'Propuse 3 tareas' })])
    const { deps, git, gh } = makeDeps({ manager, claude })
    const rec = await runBridge(deps, baseConfig({ goal: DRY_GOAL, dryRun: true }))
    expect(rec.final_status).toBe('DONE')
    expect(manager.calls).toBe(2)
    expect(claude.calls).toBe(1)
    expect(git.created).toEqual([])
    expect(git.commits).toEqual([])
    expect(gh.prs).toEqual([])
    expect(rec.rounds).toHaveLength(2)
    expect(rec.usage.estimated_cost_usd).toBeGreaterThan(0)
  })

  it('con cambios: rama agent/run-*, validaciones, commit, push y PR a integracion', async () => {
    const git = fakeGit()
    const manager = fakeManager([dec(), dec({ decision: 'DONE', task_for_claude: '', reason: 'ok', summary: 'Archivo creado' })])
    const claude = fakeClaude([claudeResult({ files_changed: ['docs/AGENT_BRIDGE_TEST.md'] })], () => git.changed.push('docs/AGENT_BRIDGE_TEST.md'))
    const { deps, gh } = makeDeps({ manager, claude, git })
    const rec = await runBridge(deps, baseConfig())
    expect(rec.final_status).toBe('DONE')
    expect(git.created[0]).toMatch(/^agent\/run-\d{8}-\d{6}-/)
    expect(rec.rounds[0].validations?.build.status).toBe('PASS')
    expect(git.pushed).toEqual([git.created[0]])
    expect(gh.prs).toHaveLength(1)
    expect(gh.prs[0].base).toBe('integracion')
    expect(gh.prs[0].body).toContain('## Human decisions')
    expect(rec.pr_url).toContain('/pull/')
  })

  it('un objetivo que menciona producción termina en READY_FOR_PRODUCTION y se detiene', async () => {
    const manager = fakeManager([dec({ decision: 'DONE', task_for_claude: '', summary: 'ok', reason: 'ok' })])
    const { deps } = makeDeps({ manager, claude: fakeClaude([claudeResult()]) })
    const rec = await runBridge(deps, baseConfig({ goal: 'Dejá listo para producción el cambio X', dryRun: true }))
    expect(rec.final_status).toBe('READY_FOR_PRODUCTION')
  })
})

describe('JSON inválido', () => {
  it('reintenta una vez y se recupera', async () => {
    const manager = fakeManager(['esto no es json', dec({ decision: 'DONE', task_for_claude: '', summary: 'ok', reason: 'ok' })])
    const { deps } = makeDeps({ manager, claude: fakeClaude([claudeResult()]) })
    const rec = await runBridge(deps, baseConfig({ dryRun: true }))
    expect(rec.final_status).toBe('DONE')
    expect(manager.calls).toBe(2)
  })

  it('falla si el Manager sigue sin devolver una decisión válida', async () => {
    const manager = fakeManager(['basura', { decision: 'TAL_VEZ' }])
    const claude = fakeClaude([claudeResult()])
    const { deps } = makeDeps({ manager, claude })
    const rec = await runBridge(deps, baseConfig({ dryRun: true }))
    expect(rec.final_status).toBe('FAILED')
    expect(rec.error).toMatch(/decisión válida/)
    expect(claude.calls).toBe(0)
  })
})

describe('fallas de proveedores', () => {
  it('Claude falla → FAILED sin seguir', async () => {
    const manager = fakeManager([dec()])
    const claude = fakeClaude([new BridgeError('CLAUDE_FAILURE', 'Claude Code superó el tiempo máximo.')])
    const { deps } = makeDeps({ manager, claude })
    const rec = await runBridge(deps, baseConfig({ dryRun: true }))
    expect(rec.final_status).toBe('FAILED')
    expect(rec.error).toMatch(/Claude/)
    expect(manager.calls).toBe(1)
  })

  it('Claude devuelve un resultado inválido → FAILED', async () => {
    const { deps } = makeDeps({ manager: fakeManager([dec()]), claude: fakeClaude([{ status: 'COMPLETED' }]) })
    const rec = await runBridge(deps, baseConfig({ dryRun: true }))
    expect(rec.final_status).toBe('FAILED')
    expect(rec.error).toMatch(/inválido/)
  })

  it('OpenAI falla → FAILED', async () => {
    const manager = fakeManager([new BridgeError('OPENAI_FAILURE', 'Falló la llamada a OpenAI: 500')])
    const claude = fakeClaude([claudeResult()])
    const { deps } = makeDeps({ manager, claude })
    const rec = await runBridge(deps, baseConfig({ dryRun: true }))
    expect(rec.final_status).toBe('FAILED')
    expect(rec.error).toMatch(/OpenAI/)
    expect(claude.calls).toBe(0)
  })
})

describe('límites de rondas y bloqueos', () => {
  it('nunca pasa de 4 rondas aunque se pida más y termina en ASK_PANCHO', async () => {
    let n = 0
    const manager = {
      calls: 0,
      async decide() {
        manager.calls++
        n++
        return { raw: dec({ task_for_claude: `Tarea distinta número ${n}` }) }
      },
    }
    const claude = fakeClaude([claudeResult()])
    const { deps, gh } = makeDeps({ manager, claude })
    const rec = await runBridge(deps, baseConfig({ dryRun: false, maxRounds: 99, goal: 'Algo grande' }))
    expect(manager.calls).toBe(4)
    expect(rec.rounds).toHaveLength(4)
    expect(rec.final_status).toBe('WAITING_FOR_HUMAN')
    expect(gh.issues).toHaveLength(1)
    expect(gh.issues[0].title).toBe('VARA Agent — Approval Required')
  })

  it('el mismo bloqueo dos veces → ASK_PANCHO sin llamar de nuevo a Claude', async () => {
    const fix = dec({ decision: 'FIX', task_for_claude: 'Arreglá el test', reason: 'El test de auth falla con 401' })
    const manager = fakeManager([fix, fix, fix])
    const claude = fakeClaude([claudeResult({ status: 'PARTIAL' })])
    const { deps, gh } = makeDeps({ manager, claude })
    const rec = await runBridge(deps, baseConfig({ goal: 'Arreglar auth' }))
    expect(rec.final_status).toBe('WAITING_FOR_HUMAN')
    expect(claude.calls).toBe(1)
    expect(manager.calls).toBe(2)
    expect(gh.issues[0].body).toContain('dos veces')
  })
})

describe('ASK_PANCHO', () => {
  it('crea el issue con la pregunta concreta y guarda el estado de la corrida', async () => {
    const manager = fakeManager([
      dec({ decision: 'ASK_PANCHO', requires_human: true, human_question: '¿Aplico la migración en staging?', task_for_claude: '', summary: 'Hace falta tu OK', reason: 'Toca la base' }),
    ])
    const { deps, gh } = makeDeps({ manager, claude: fakeClaude([claudeResult()]) })
    const rec = await runBridge(deps, baseConfig({ goal: 'Migrar tabla' }))
    expect(rec.final_status).toBe('WAITING_FOR_HUMAN')
    expect(rec.human_question).toBe('¿Aplico la migración en staging?')
    expect(rec.issue_url).toContain('/issues/')
    expect(gh.issues[0].body).toContain('¿Aplico la migración en staging?')
    expect(gh.issues[0].body).toContain('vara-agent-state:')
    expect(gh.issues[0].body).toContain('Chopan55')
  })

  it('reanuda solo con la respuesta de Chopan55', async () => {
    const manager = fakeManager([dec({ decision: 'ASK_PANCHO', requires_human: true, human_question: '¿Sigo?', task_for_claude: '', summary: 's', reason: 'r' })])
    const { deps, gh } = makeDeps({ manager, claude: fakeClaude([claudeResult()]) })
    await runBridge(deps, baseConfig({ goal: 'Algo' }))
    gh.comments[1] = [{ author: 'intruso', body: 'APPROVE', createdAt: '2026-10-17T13:00:00Z' }]
    await expect(prepareResume(gh, 1)).rejects.toThrowError(/Todavía no hay respuesta/)
    gh.comments[1].push({ author: 'Chopan55', body: 'CONTINUE dale', createdAt: '2026-10-17T14:00:00Z' })
    const { state, command } = await prepareResume(gh, 1)
    expect(command).toBe('CONTINUE')
    expect(state.humanDecisions.at(-1)?.actor).toBe('Chopan55')
    expect(state.roundsUsed).toBe(1)
  })
})

describe('acciones prohibidas', () => {
  it('producción: la tarea nunca llega a Claude y se pregunta a Pancho', async () => {
    const manager = fakeManager([dec({ task_for_claude: 'Hacé vercel deploy --prod y aplicá la migración' })])
    const claude = fakeClaude([claudeResult()])
    const { deps, gh } = makeDeps({ manager, claude })
    const rec = await runBridge(deps, baseConfig({ goal: 'Publicar' }))
    expect(claude.calls).toBe(0)
    expect(rec.final_status).toBe('WAITING_FOR_HUMAN')
    expect(gh.issues[0].body).toMatch(/prohibida/)
  })

  it('master: se bloquea git push a master y arrancar desde master', async () => {
    const manager = fakeManager([dec({ task_for_claude: 'Hacé git push origin master con los cambios' })])
    const claude = fakeClaude([claudeResult()])
    const a = makeDeps({ manager, claude })
    const r1 = await runBridge(a.deps, baseConfig({ goal: 'Subir cambios' }))
    expect(claude.calls).toBe(0)
    expect(r1.final_status).toBe('WAITING_FOR_HUMAN')

    const b = makeDeps({ manager: fakeManager([dec()]), claude: fakeClaude([claudeResult()]), git: fakeGit('master') })
    const r2 = await runBridge(b.deps, baseConfig())
    expect(r2.final_status).toBe('FAILED')
    expect(r2.error).toMatch(/master/)
    expect(b.git.created).toEqual([])
  })

  it('archivos protegidos o corrida de solo lectura con cambios → se pregunta a Pancho', async () => {
    const git = fakeGit()
    const claude = fakeClaude([claudeResult()], () => git.changed.push('tools/vara-agent/src/index.ts'))
    const { deps } = makeDeps({ manager: fakeManager([dec()]), claude, git })
    const rec = await runBridge(deps, baseConfig({ goal: 'Mejorar algo' }))
    expect(rec.final_status).toBe('WAITING_FOR_HUMAN')
    expect(rec.human_question).toMatch(/agente|reglas|workflow/i)

    const git2 = fakeGit()
    const claude2 = fakeClaude([claudeResult()], () => git2.changed.push('src/a.ts'))
    const r2 = makeDeps({ manager: fakeManager([dec()]), claude: claude2, git: git2 })
    const rec2 = await runBridge(r2.deps, baseConfig({ goal: DRY_GOAL }))
    expect(rec2.final_status).toBe('WAITING_FOR_HUMAN')
  })

  it('validaciones fallidas impiden cerrar como DONE', async () => {
    const git = fakeGit()
    const manager = fakeManager([dec(), dec({ decision: 'DONE', task_for_claude: '', summary: 'ok', reason: 'ok' })])
    const claude = fakeClaude([claudeResult()], () => git.changed.push('src/a.ts'))
    const { deps, gh } = makeDeps({ manager, claude, git, run: fakeRunner(['lint']) })
    const rec = await runBridge(deps, baseConfig({ goal: 'Cambiar a.ts', maxRounds: 2 }))
    expect(rec.final_status).not.toBe('DONE')
    expect(gh.prs).toEqual([])
  })
})

describe('secretos', () => {
  it('no aparecen en el registro, el error ni los logs', async () => {
    const key = 'sk-proj-SECRETSECRETSECRETSECRET123456'
    const manager = fakeManager([new BridgeError('OPENAI_FAILURE', `401 con la clave ${key}`)])
    const lines: string[] = []
    const logger = createLogger([key], l => lines.push(l))
    const { deps } = makeDeps({ manager, claude: fakeClaude([claudeResult()]), logger, secrets: [key] })
    const rec = await runBridge(deps, baseConfig({ dryRun: true }))
    expect(JSON.stringify(rec)).not.toContain('SECRETSECRET')
    expect(lines.join('\n')).not.toContain('SECRETSECRET')
  })
})

describe('registro de la corrida', () => {
  it('el estado de reanudación se codifica y se recupera', () => {
    const rec = createRunRecord('run-1', baseConfig(), new Date('2026-10-17T12:00:00Z'))
    rec.branch = 'agent/run-20261017-120000-x'
    const state = toResumeState(rec, 2)
    expect(decodeState(encodeState(state))?.roundsUsed).toBe(2)
  })
})
