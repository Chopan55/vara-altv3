/**
 * Bridge local: Codex usa el plan de ChatGPT y Claude Code usa el plan de Claude.
 * Las claves OPENAI_API_KEY/ANTHROPIC_API_KEY se eliminan de los procesos de ambos agentes.
 */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createGhApi, PR_BASE, resolveResume } from './approvals'
import { createClaudeRunner } from './claude-runner'
import { buildSubscriptionEnv, createCodexManager, preflightLocalSubscriptions } from './codex-manager'
import { Git } from './git-state'
import { configFromResume, loadConfigFromEnv, nodeRunner, recordHumanStop, runBridge, withoutKeys, writeSummary, type BridgeDeps } from './index'
import { createLogger } from './logger'
import { BridgeError, type CommandRunner, type RunConfig } from './types'
import { collectSecretValues, isSafeAgentBranch } from './validations'

const PROVIDER_KEYS = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN'] as const

export function resolveClaudeExecutable(
  env: Record<string, string | undefined>,
  fileExists: (file: string) => boolean = existsSync,
): string {
  if (process.platform !== 'win32') return 'claude'
  const candidates = [
    env.USERPROFILE ? path.join(env.USERPROFILE, '.local', 'bin', 'claude.exe') : '',
    env.APPDATA ? path.join(env.APPDATA, 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe') : '',
  ].filter(Boolean)
  return candidates.find(fileExists) ?? 'claude.exe'
}

export function createLocalRunner(env: Record<string, string | undefined> = process.env): CommandRunner {
  const claudeExecutable = resolveClaudeExecutable(env)
  return (cmd, args, opts) => nodeRunner(cmd === 'claude' ? claudeExecutable : cmd, args, opts)
}

function localConfig(env: NodeJS.ProcessEnv, argv: string[]): RunConfig {
  const base = loadConfigFromEnv(env, argv)
  return {
    ...base,
    maxRounds: Number(env.MAX_AGENT_ROUNDS ?? 3) || 3,
    openaiModel: env.CODEX_MODEL ?? 'chatgpt-plan-default',
    claudeModel: env.CLAUDE_MODEL ?? 'sonnet',
  }
}

function read(root: string, relative: string): string {
  return readFileSync(path.join(root, relative), 'utf8')
}

export async function main(): Promise<number> {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
  const secrets = collectSecretValues(process.env)
  const logger = createLogger(secrets)
  const runner = createLocalRunner(process.env)
  const subscriptionEnv = buildSubscriptionEnv(process.env)
  let config = localConfig(process.env, process.argv)
  const resumeIssue = Number(process.env.RESUME_ISSUE) || null

  try {
    const git = new Git(runner, root)
    const gh = createGhApi(runner, { cwd: root })

    if (!(await git.isClean())) {
      throw new BridgeError('CONFIG', 'El repo tiene cambios sin guardar. Guardalos o hacé commit antes de iniciar el Bridge local.')
    }

    if (resumeIssue) {
      const resolution = await resolveResume(gh, { issueNumber: resumeIssue, source: 'dispatch' })
      if (resolution.kind === 'ignore') {
        logger.info(`No se reanudó: ${resolution.reason}.`)
        return 0
      }
      if (resolution.kind === 'stop') {
        recordHumanStop(resolution.state, resolution.command, new Date(), { logger, runsDir: root, secrets, issueUrl: resolution.issueUrl })
        return 0
      }
      config = configFromResume(resolution.state, {
        ...config,
        openaiModel: process.env.CODEX_MODEL ?? 'chatgpt-plan-default',
        claudeModel: process.env.CLAUDE_MODEL ?? 'sonnet',
      })
    } else {
      if (!config.goal) throw new BridgeError('CONFIG', 'Falta decir qué querés que hagan Claude y Codex.')
      const branch = await git.currentBranch()
      if (branch !== PR_BASE) {
        throw new BridgeError('UNSAFE_BRANCH', `El Bridge local arranca desde ${PR_BASE}; ahora estás en ${branch}.`)
      }
    }

    if (config.resume && !isSafeAgentBranch(config.resume.branch)) {
      throw new BridgeError('UNSAFE_BRANCH', 'El Issue no apunta a una rama de trabajo segura.')
    }

    const rules = ['agent/ORCHESTRATOR_RULES.md', 'agent/PRODUCT_PRINCIPLES.md', 'agent/RELEASE_RULES.md', 'agent/PRODUCT_CONTEXT.md', 'agent/CURRENT_STATE.json']
      .map(file => `# ${file}\n${read(root, file)}`)
      .join('\n\n')
    const claudeSchema = JSON.stringify(JSON.parse(read(root, 'agent/schemas/claude-result.schema.json')))
    const codexModel = process.env.CODEX_MODEL?.trim() || undefined
    const claudeOnPlan = createClaudeRunner(runner, {
      model: config.claudeModel,
      cwd: root,
      sourceEnv: subscriptionEnv,
      resultSchema: claudeSchema,
      systemPrompt: `${read(root, 'agent/PRODUCT_PRINCIPLES.md')}\n\n${read(root, 'agent/RELEASE_RULES.md')}`,
      secrets,
    })

    const deps: BridgeDeps = {
      preflight: async () => {
        const status = await preflightLocalSubscriptions(runner, { cwd: root, sourceEnv: process.env })
        logger.info(`Sesiones de suscripción encontradas: ChatGPT + Claude ${status.claude}.`)
      },
      manager: createCodexManager(runner, {
        cwd: root,
        instructions: rules,
        schemaPath: path.join(root, 'agent', 'schemas', 'manager-decision.schema.json'),
        model: codexModel,
        sourceEnv: process.env,
        secrets,
      }),
      claude: {
        async run(task, options) {
          const result = await claudeOnPlan.run(task, options)
          // Claude CLI informa a veces un equivalente API; no es un cargo en este modo.
          return result.usage ? { ...result, usage: { ...result.usage, costUsd: undefined } } : result
        },
      },
      git,
      gh,
      run: (cmd, args, options) => runner(cmd, args, { ...options, cwd: options?.cwd ?? root }),
      logger,
      now: () => new Date(),
      runsDir: root,
      secrets,
      validationEnv: withoutKeys(process.env, [...PROVIDER_KEYS, 'GITHUB_TOKEN', 'GH_TOKEN']),
      // El CLI puede informar un costo equivalente, pero en este modo cuenta contra el cupo del plan, no contra saldo API.
      maxCostUsd: Number.MAX_SAFE_INTEGER,
      approvalInstructions:
        'Comentá `APPROVE`, `CONTINUE`, `REJECT` o `STOP` como primera palabra. Después ejecutá `tools\\vara-agent\\vara-local.ps1 -ResumeIssue NUMERO` para retomar.',
    }

    const record = await runBridge(deps, config)
    writeSummary(record)
    console.log(`\nVARA Duo: ${record.final_status}${record.pr_url ? ` · PR ${record.pr_url}` : ''}${record.issue_url ? ` · decisión ${record.issue_url}` : ''}`)
    return record.final_status === 'FAILED' ? 1 : 0
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(code => process.exit(code))
}
