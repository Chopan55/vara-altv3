/** Hardening V1.1: auto-resume por comentario, un Issue por run, CI explícito y entorno de Claude por allowlist. */

import { describe, expect, it } from 'vitest'
import { ISSUE_TITLE, BOT_MARKER, extractStateFromIssueBody, issueTitleFor, resolveResume } from '../src/approvals'
import { CLAUDE_ENV_ALLOWLIST, buildClaudeEnv, createClaudeRunner } from '../src/claude-runner'
import { configFromResume, recordHumanStop, runBridge } from '../src/index'
import { createLogger } from '../src/logger'
import type { ManagerInput } from '../src/openai-manager'
import { decodeState, encodeState } from '../src/run-state'
import type { CommandRunner } from '../src/types'
import { askDec, baseConfig, claudeResult, dec, doneDec, fakeClaude, fakeGh, fakeGit, fakeManager, makeDeps, type FakeGh } from './helpers'

const GOAL = 'Objetivo ORIGINAL: agregá un archivo docs/AGENT_BRIDGE_TEST.md con una línea de prueba.'
const comment = (issueNumber: number, over: Record<string, string> = {}) => ({
  issueNumber,
  source: 'comment' as const,
  author: 'Chopan55',
  authorType: 'User',
  body: 'APPROVE',
  now: new Date('2026-10-17T15:00:00Z'),
  ...over,
})

/** Deja una corrida pausada en ASK_PANCHO y devuelve su Issue. */
async function pausedRun(gh: FakeGh, now = '2026-10-17T12:00:00Z', goal = GOAL) {
  const { deps } = makeDeps({ manager: fakeManager([askDec('¿Aplico el cambio?')]), claude: fakeClaude([claudeResult()]), gh, now: () => new Date(now) })
  const rec = await runBridge(deps, baseConfig({ goal }))
  return { rec, issue: gh.issues[gh.issues.length - 1] }
}

describe('auto-resume por comentario', () => {
  it('APPROVE de Chopan55 reanuda solo, sobre la misma rama y con el objetivo original', async () => {
    const gh = fakeGh()
    const { rec, issue } = await pausedRun(gh)
    expect(rec.final_status).toBe('WAITING_FOR_HUMAN')

    const res = await resolveResume(gh, comment(issue.number))
    expect(res.kind).toBe('continue')
    if (res.kind !== 'continue') return
    expect(res.command).toBe('APPROVE')

    const seen: ManagerInput[] = []
    const manager = {
      async decide(i: ManagerInput) {
        seen.push(i)
        return { raw: doneDec() }
      },
    }
    const git = fakeGit()
    const { deps } = makeDeps({ manager, claude: fakeClaude([claudeResult()]), gh, git })
    const done = await runBridge(deps, configFromResume(res.state, { dryRun: false }))
    expect(done.final_status).toBe('DONE')
    expect(done.run_id).toBe(rec.run_id)
    expect(git.checkedOut).toEqual([res.state.branch])
    expect(seen[0].goal).toBe(GOAL)
    expect(done.human_approvals.at(-1)?.command).toBe('APPROVE')
  })

  it('el modo manual (dispatch) lee la respuesta del Issue después del último mensaje del bridge', async () => {
    const gh = fakeGh()
    const { issue } = await pausedRun(gh)
    expect((await resolveResume(gh, { issueNumber: issue.number, source: 'dispatch' })).kind).toBe('ignore')
    gh.say(issue.number, 'Chopan55', 'CONTINUE seguí')
    const res = await resolveResume(gh, { issueNumber: issue.number, source: 'dispatch' })
    expect(res.kind).toBe('continue')
  })
})

describe('quién puede disparar la reanudación', () => {
  it('otro usuario es ignorado: el Issue sigue abierto y no se escribe nada', async () => {
    const gh = fakeGh()
    const { issue } = await pausedRun(gh)
    const before = gh.posted.length
    const res = await resolveResume(gh, comment(issue.number, { author: 'intruso' }))
    expect(res.kind).toBe('ignore')
    expect(issue.state).toBe('open')
    expect(issue.closedCount).toBe(0)
    expect(gh.posted.length).toBe(before)
  })

  it('el bot no genera loop: ni comentarios de bots ni los del propio bridge reanudan', async () => {
    const gh = fakeGh()
    const { issue } = await pausedRun(gh)
    expect((await resolveResume(gh, comment(issue.number, { author: 'github-actions[bot]', authorType: 'Bot' }))).kind).toBe('ignore')
    expect((await resolveResume(gh, comment(issue.number, { authorType: 'Bot' }))).kind).toBe('ignore')
    expect((await resolveResume(gh, comment(issue.number, { body: `${BOT_MARKER} APPROVE registrado` }))).kind).toBe('ignore')
    expect((await resolveResume(gh, comment(issue.number, { body: 'gracias!' }))).kind).toBe('ignore')
    expect(issue.state).toBe('open')
    // Todo lo que escribe el propio bridge empieza con la marca, así que nunca cuenta como comando
    expect(issue.comments.filter(c => c.authorType === 'Bot').every(c => c.body.startsWith(BOT_MARKER))).toBe(true)
  })

  it('un Issue ajeno al bridge o con estado inválido es ignorado', async () => {
    const gh = fakeGh()
    const ajeno = await gh.createIssue('Bug en el login', 'No anda')
    expect((await resolveResume(gh, comment(ajeno.number))).kind).toBe('ignore')

    const sinEstado = await gh.createIssue(`${ISSUE_TITLE} [run-x]`, 'sin marca de estado')
    expect((await resolveResume(gh, comment(sinEstado.number))).kind).toBe('ignore')

    const state = { runId: 'run-x', goal: 'g', branch: 'master', roundsUsed: 1, historySummary: '', humanDecisions: [] }
    const falso = await gh.createIssue(issueTitleFor('run-x'), `<!-- vara-agent-state:${encodeState(state)} -->`)
    expect((await resolveResume(gh, comment(falso.number))).kind).toBe('ignore')

    const otroRun = { ...state, runId: 'run-y', branch: 'agent/run-20261017-120000-x' }
    const noCoincide = await gh.createIssue(issueTitleFor('run-x'), `<!-- vara-agent-state:${encodeState(otroRun)} -->`)
    expect((await resolveResume(gh, comment(noCoincide.number))).kind).toBe('ignore')

    expect(await resolveResume(gh, comment(999))).toEqual({ kind: 'ignore', reason: 'el issue no existe' })
  })
})

describe('un Issue por run_id', () => {
  it('dos runs distintos tienen Issues separados con su propio estado', async () => {
    const gh = fakeGh()
    const a = await pausedRun(gh, '2026-10-17T12:00:00Z', 'Objetivo A')
    const b = await pausedRun(gh, '2026-10-17T12:05:00Z', 'Objetivo B')
    expect(gh.issues).toHaveLength(2)
    expect(a.rec.run_id).not.toBe(b.rec.run_id)
    expect(gh.issues[0].title).toBe(issueTitleFor(a.rec.run_id))
    expect(gh.issues[1].title).toBe(issueTitleFor(b.rec.run_id))
    expect(extractStateFromIssueBody(gh.issues[0].body)?.goal).toBe('Objetivo A')
    expect(extractStateFromIssueBody(gh.issues[1].body)?.goal).toBe('Objetivo B')

    // Responder al Issue de B no toca a A
    const res = await resolveResume(gh, comment(gh.issues[1].number))
    expect(res.kind).toBe('continue')
    expect(gh.issues[0].state).toBe('open')
    expect(gh.issues[1].state).toBe('closed')
  })

  it('si el mismo run vuelve a preguntar, reabre su Issue en vez de crear otro', async () => {
    const gh = fakeGh()
    const { rec, issue } = await pausedRun(gh)
    const res = await resolveResume(gh, comment(issue.number))
    expect(issue.state).toBe('closed')
    if (res.kind !== 'continue') throw new Error('debía continuar')
    const { deps } = makeDeps({ manager: fakeManager([askDec('Otra duda')]), claude: fakeClaude([claudeResult()]), gh })
    const again = await runBridge(deps, configFromResume(res.state))
    expect(again.run_id).toBe(rec.run_id)
    expect(again.final_status).toBe('WAITING_FOR_HUMAN')
    expect(gh.issues).toHaveLength(1)
    expect(gh.issues[0].state).toBe('open')
    expect(gh.issues[0].body).toContain('Otra duda')
  })
})

describe('el objetivo original se conserva', () => {
  it('queda en el estado del Issue y se usa tal cual al reanudar', async () => {
    const gh = fakeGh()
    const { issue } = await pausedRun(gh)
    const state = extractStateFromIssueBody(issue.body)
    expect(state?.goal).toBe(GOAL)
    const res = await resolveResume(gh, comment(issue.number))
    if (res.kind !== 'continue') throw new Error('debía continuar')
    expect(configFromResume(res.state).goal).toBe(GOAL)
  })

  it('un estado sin objetivo se rechaza', () => {
    const roto = { runId: 'r', branch: 'agent/run-20261017-120000-x', roundsUsed: 1, historySummary: 'Ronda 1: algo', humanDecisions: [] }
    expect(decodeState(encodeState(roto as never))).toBeNull()
  })
})

describe('ciclo de vida del Issue', () => {
  it('APPROVE registra, cierra y continúa', async () => {
    const gh = fakeGh()
    const { issue } = await pausedRun(gh)
    const res = await resolveResume(gh, comment(issue.number, { body: 'APPROVE dale' }))
    expect(res.kind).toBe('continue')
    expect(issue.state).toBe('closed')
    expect(issue.closedCount).toBe(1)
    expect(gh.posted.at(-1)).toMatch(/Registré tu decisión: APPROVE/)
    expect(gh.posted.at(-1)).toMatch(/Retomo/)
    if (res.kind === 'continue') expect(res.state.humanDecisions.at(-1)?.note).toBe('dale')
    // Un segundo APPROVE sobre el mismo Issue ya consumido no vuelve a disparar nada
    expect((await resolveResume(gh, comment(issue.number))).kind).toBe('ignore')
  })

  it.each(['STOP', 'REJECT'])('%s registra, cierra y termina', async command => {
    const gh = fakeGh()
    const { issue, rec } = await pausedRun(gh)
    const res = await resolveResume(gh, comment(issue.number, { body: command }))
    expect(res.kind).toBe('stop')
    expect(issue.state).toBe('closed')
    expect(gh.posted.at(-1)).toMatch(/Cierro la corrida/)
    if (res.kind !== 'stop') return
    const stopped = recordHumanStop(res.state, command, new Date('2026-10-17T15:00:00Z'), { logger: createLogger([], () => {}) })
    expect(stopped.final_status).toBe('STOPPED')
    expect(stopped.run_id).toBe(rec.run_id)
    expect(stopped.human_approvals.at(-1)?.command).toBe(command)
  })
})

describe('CI explícito en el PR', () => {
  const withChange = (decisions: unknown[], gh: FakeGh) => {
    const git = fakeGit()
    const claude = fakeClaude([claudeResult()], () => git.changed.push('docs/AGENT_BRIDGE_TEST.md'))
    return makeDeps({ manager: fakeManager(decisions), claude, git, gh })
  }

  it('después de abrir el PR dispara el CI sobre la rama y espera el resultado', async () => {
    const gh = fakeGh()
    const { deps, git } = withChange([dec(), doneDec()], gh)
    const rec = await runBridge(deps, baseConfig())
    expect(gh.prs).toHaveLength(1)
    expect(gh.ciDispatches).toEqual([git.created[0]])
    expect(rec.ci?.conclusion).toBe('success')
    expect(rec.final_status).toBe('DONE')
    expect(gh.prComments.at(-1)).toMatch(/Listo para revisión humana/)
  })

  it('si el CI falla no se declara READY_FOR_REVIEW', async () => {
    const gh = fakeGh()
    gh.ciResult = { conclusion: 'failure', url: 'https://github.com/x/y/actions/runs/2' }
    const { deps } = withChange([dec(), dec({ decision: 'READY_FOR_REVIEW', task_for_claude: '', summary: 'listo', reason: 'ok' })], gh)
    const rec = await runBridge(deps, baseConfig())
    expect(rec.final_status).toBe('FAILED')
    expect(rec.final_status).not.toBe('READY_FOR_REVIEW')
    expect(rec.ci?.conclusion).toBe('failure')
    expect(rec.error).toMatch(/CI/)
    expect(gh.prComments.at(-1)).toMatch(/NO lo declara listo/)
  })

  it('con CI en verde READY_FOR_REVIEW se mantiene; un CI que no termina (timeout) también bloquea', async () => {
    const ok = fakeGh()
    const a = withChange([dec(), dec({ decision: 'READY_FOR_REVIEW', task_for_claude: '', summary: 'listo', reason: 'ok' })], ok)
    expect((await runBridge(a.deps, baseConfig())).final_status).toBe('READY_FOR_REVIEW')

    const lento = fakeGh()
    lento.ciResult = { conclusion: 'timed_out', url: null }
    const b = withChange([dec(), doneDec()], lento)
    expect((await runBridge(b.deps, baseConfig())).final_status).toBe('FAILED')
  })

  it('en dry-run no se abre PR ni se dispara CI', async () => {
    const gh = fakeGh()
    const { deps } = makeDeps({ manager: fakeManager([doneDec()]), claude: fakeClaude([claudeResult()]), gh })
    await runBridge(deps, baseConfig({ dryRun: true }))
    expect(gh.ciDispatches).toEqual([])
    expect(gh.prs).toEqual([])
  })
})

describe('entorno de Claude por allowlist', () => {
  const source = {
    PATH: '/usr/bin',
    HOME: '/home/runner',
    ANTHROPIC_API_KEY: 'ak-123456789',
    OPENAI_API_KEY: 'sk-openai-secret',
    GH_TOKEN: 'ghs_token',
    GITHUB_TOKEN: 'ghs_token2',
    SUPABASE_SERVICE_ROLE_KEY: 'srv',
    SUPABASE_SECRET_KEY: 'sb_secret_x',
    BRIGHTDATA_API_KEY: 'bd',
    GEMINI_API_KEY: 'gem',
    CRON_SECRET: 'cron',
    ALGO_RARO: 'x',
  }

  it('solo pasa lo permitido y nunca secretos ajenos', () => {
    const env = buildClaudeEnv(source)
    expect(env).toEqual({ PATH: '/usr/bin', HOME: '/home/runner', ANTHROPIC_API_KEY: 'ak-123456789' })
    for (const k of ['OPENAI_API_KEY', 'GH_TOKEN', 'GITHUB_TOKEN', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY', 'BRIGHTDATA_API_KEY', 'GEMINI_API_KEY', 'CRON_SECRET', 'ALGO_RARO']) {
      expect(env).not.toHaveProperty(k)
    }
  })

  it('la lista blanca no incluye ningún secreto salvo la credencial de Claude', () => {
    const secretish = CLAUDE_ENV_ALLOWLIST.filter(k => /(KEY|TOKEN|SECRET|PASSWORD)/i.test(k))
    expect([...secretish].sort()).toEqual(['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN'])
  })

  it('el runner lanza `claude` con ese entorno filtrado, no con process.env', async () => {
    let seen: Record<string, string | undefined> | undefined
    const run: CommandRunner = async (_cmd, _args, opts) => {
      seen = opts?.env
      return { code: 0, stdout: JSON.stringify({ subtype: 'success', is_error: false, structured_output: claudeResult(), num_turns: 2 }), stderr: '', timedOut: false }
    }
    const claude = createClaudeRunner(run, { model: 'sonnet', resultSchema: '{}', systemPrompt: 's', sourceEnv: source })
    await claude.run('hacé algo', { readOnly: true })
    expect(Object.keys(seen ?? {}).sort()).toEqual(['ANTHROPIC_API_KEY', 'HOME', 'PATH'])
  })
})

describe('preflight del modelo', () => {
  it('es obligatorio: si falla, no se hace ningún trabajo', async () => {
    const manager = fakeManager([doneDec()])
    const git = fakeGit()
    const { deps } = makeDeps({
      manager,
      claude: fakeClaude([claudeResult()]),
      git,
      preflight: async () => {
        throw new Error('El modelo "gpt-5.6" no existe para esta cuenta.')
      },
    })
    const rec = await runBridge(deps, baseConfig({ dryRun: true, openaiModel: 'gpt-5.6' }))
    expect(rec.final_status).toBe('FAILED')
    expect(rec.error).toMatch(/no existe/)
    expect(manager.calls).toBe(0)
    expect(git.created).toEqual([])
  })
})
