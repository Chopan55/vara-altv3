import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildCodexArgs, buildSubscriptionEnv, createCodexManager, preflightLocalSubscriptions } from '../src/codex-manager'
import { buildClaudeArgs, createClaudeRunner } from '../src/claude-runner'
import type { ManagerInput } from '../src/openai-manager'
import type { CommandRunner } from '../src/types'
import { doneDec } from './helpers'

const managerInput: ManagerInput = {
  goal: 'Revisá el estado',
  round: 1,
  maxRounds: 3,
  dryRun: true,
  readOnly: true,
  gitSummary: 'limpio',
  lastClaude: null,
  validations: null,
  history: '',
  humanDecisions: [],
  notes: [],
}

describe('Bridge local por suscripción', () => {
  it('codex exec queda efímero, en solo lectura y con salida estructurada', () => {
    const args = buildCodexArgs(
      { cwd: 'C:/repo', instructions: 'reglas', schemaPath: 'C:/repo/schema.json' },
      'C:/temp/decision.json',
    )
    expect(args).toContain('exec')
    expect(args).toContain('--ephemeral')
    expect(args.slice(args.indexOf('--sandbox'), args.indexOf('--sandbox') + 2)).toEqual(['--sandbox', 'read-only'])
    expect(args).toContain('--output-schema')
    expect(args).toContain('--output-last-message')
    expect(args).not.toContain('--dangerously-bypass-approvals-and-sandbox')
    expect(args.at(-1)).toBe('-')
  })

  it('no hereda ninguna clave de API aunque exista en la terminal', () => {
    const env = buildSubscriptionEnv({
      PATH: 'C:/bin',
      USERPROFILE: 'C:/Users/test',
      CODEX_HOME: 'C:/Users/test/.codex',
      OPENAI_API_KEY: 'sk-api',
      ANTHROPIC_API_KEY: 'sk-ant',
      CLAUDE_CODE_OAUTH_TOKEN: 'oauth-api',
      GH_TOKEN: 'github',
    })
    expect(env).toEqual({ PATH: 'C:/bin', USERPROFILE: 'C:/Users/test', CODEX_HOME: 'C:/Users/test/.codex' })
  })

  it('el Manager lee el JSON final escrito por Codex', async () => {
    let seenEnv: Record<string, string | undefined> | undefined
    const run: CommandRunner = async (cmd, args, opts) => {
      expect(cmd).toBe('codex')
      seenEnv = opts?.env
      const output = args[args.indexOf('--output-last-message') + 1]
      writeFileSync(output, JSON.stringify(doneDec()))
      return { code: 0, stdout: '', stderr: '', timedOut: false }
    }
    const manager = createCodexManager(run, {
      cwd: 'C:/repo',
      instructions: 'reglas',
      schemaPath: 'C:/repo/schema.json',
      sourceEnv: { PATH: 'C:/bin', OPENAI_API_KEY: 'no-debe-pasar' },
    })
    expect((await manager.decide(managerInput)).raw).toEqual(doneDec())
    expect(seenEnv).not.toHaveProperty('OPENAI_API_KEY')
  })

  it('acepta únicamente los logins de ChatGPT y claude.ai', async () => {
    const ok: CommandRunner = async (cmd, args) => {
      if (cmd === 'codex') return { code: 0, stdout: 'Logged in using ChatGPT', stderr: '', timedOut: false }
      if (cmd === 'claude') {
        return {
          code: 0,
          stdout: JSON.stringify({ loggedIn: true, authMethod: 'claude.ai', subscriptionType: 'pro' }),
          stderr: '',
          timedOut: false,
        }
      }
      expect(args).toEqual(['auth', 'status'])
      return { code: 0, stdout: '', stderr: 'github.com OK', timedOut: false }
    }
    await expect(preflightLocalSubscriptions(ok, { cwd: 'C:/repo', sourceEnv: {} })).resolves.toEqual({ codex: 'chatgpt', claude: 'pro' })

    const apiCodex: CommandRunner = async () => ({ code: 0, stdout: 'Logged in using an API key', stderr: '', timedOut: false })
    await expect(preflightLocalSubscriptions(apiCodex, { cwd: 'C:/repo', sourceEnv: {} })).rejects.toThrow(/ChatGPT/)
  })

  it('Claude por suscripción no recibe el tope monetario de la API', () => {
    const args = buildClaudeArgs({ model: 'sonnet', resultSchema: '{}', systemPrompt: 'reglas' }, { readOnly: false })
    expect(args).not.toContain('--max-budget-usd')
    expect(args).not.toContain('--dangerously-skip-permissions')
  })

  it('si venció OAuth, pide renovar Claude y no comprar créditos', async () => {
    const expired: CommandRunner = async () => ({
      code: 1,
      stdout: JSON.stringify({ subtype: 'success', is_error: true, result: 'Failed to authenticate. OAuth access token has expired.' }),
      stderr: '',
      timedOut: false,
    })
    const claude = createClaudeRunner(expired, { model: 'sonnet', resultSchema: '{}', systemPrompt: 's', sourceEnv: {} })
    await expect(claude.run('prueba', { readOnly: true })).rejects.toThrow(/claude auth login.*no hace falta comprar créditos/i)
  })
})
