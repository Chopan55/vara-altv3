/**
 * VARA Agent Bridge V1 — orquestador.
 * Pancho da un objetivo → Manager (OpenAI) decide → Claude Code implementa → el bridge valida →
 * el Manager revisa. Máximo 4 rondas por corrida. Nunca toca producción ni master.
 * Entrada: `npm start` (variables de entorno) o runBridge() desde los tests con dependencias falsas.
 */

import { spawn } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { BOT_MARKER, PR_BASE, buildIssueBody, createGhApi, requestApproval, resolveResume, type GitHubApi } from './approvals'
import { createClaudeRunner, type ClaudeClient } from './claude-runner'
import { Git, diffFingerprints, makeBranchName, type Fingerprint } from './git-state'
import { createLogger, type Logger } from './logger'
import { createOpenAIManager, preflightModel, type ManagerClient, type ManagerInput } from './openai-manager'
import {
  addUsage,
  createRunRecord,
  estimateCost,
  historySummary,
  newRunId,
  pricesFromEnv,
  renderPrBody,
  saveRun,
  toResumeState,
  type Prices,
} from './run-state'
import {
  BridgeError,
  type ClaudeResult,
  type CommandOptions,
  type CommandResult,
  type CommandRunner,
  type FinalStatus,
  type GitState,
  type ManagerDecision,
  type ResumeState,
  type RoundRecord,
  type RunConfig,
  type RunRecord,
  type Usage,
  type Validations,
} from './types'
import {
  allValidationsPassed,
  collectSecretValues,
  extractJson,
  findForbiddenActions,
  isProtectedBranch,
  isReadOnlyGoal,
  mentionsProduction,
  normalizeBlocker,
  redactSecrets,
  runValidations,
  skippedValidations,
  touchedProtectedPaths,
  validateClaudeResult,
  validateManagerDecision,
  validationsSummary,
} from './validations'

/** Tope absoluto de rondas por corrida y, sumando reanudaciones, por objetivo. */
export const MAX_ROUNDS_PER_RUN = 4
export const MAX_ROUNDS_TOTAL = 8

export interface GitPort {
  currentBranch(): Promise<string>
  head(): Promise<string>
  createWorkBranch(name: string, base: string): Promise<void>
  checkoutWorkBranch(name: string): Promise<void>
  snapshot(baseRef?: string): Promise<GitState>
  changedFiles(): Promise<string[]>
  /** Foto del working tree (ruta → estado + hash) para separar lo que ya estaba sucio de lo que cambia la corrida. */
  fingerprint(): Promise<Fingerprint>
  commitAll(message: string, paths?: string[]): Promise<string | null>
  push(branch: string): Promise<void>
}

export interface BridgeDeps {
  manager: ManagerClient
  claude: ClaudeClient
  git: GitPort
  gh: GitHubApi
  /** Ejecuta npm run typecheck/lint/test/build. */
  run: CommandRunner
  logger: Logger
  now: () => Date
  /** Carpeta donde se guarda .agent-runs/. Si falta, no se escribe a disco. */
  runsDir?: string
  secrets?: string[]
  prices?: Prices
  validationEnv?: Record<string, string | undefined>
  claudeMaxTurns?: number
  /** Verifica que el modelo de OpenAI exista para la cuenta. Obligatorio: corre antes de cualquier trabajo. */
  preflight: () => Promise<void>
  /** Espera máxima por el CI del PR (por defecto 30 min). */
  ciTimeoutMs?: number
}

type Escalation = { reason: string; question: string; recommendation: string }

export async function runBridge(deps: BridgeDeps, config: RunConfig): Promise<RunRecord> {
  const { logger, git } = deps
  const secrets = deps.secrets ?? []
  const maxRounds = Math.max(1, Math.min(Math.floor(config.maxRounds) || MAX_ROUNDS_PER_RUN, MAX_ROUNDS_PER_RUN))
  const roundsBefore = config.resume?.roundsUsed ?? 0
  const readOnly = config.dryRun || isReadOnlyGoal(config.goal)
  const rec = createRunRecord(config.resume?.runId ?? newRunId(deps.now()), { ...config, maxRounds }, deps.now())

  const blockers = new Map<string, number>()
  const bump = (text: string) => {
    const key = normalizeBlocker(text)
    blockers.set(key, (blockers.get(key) ?? 0) + 1)
    return blockers.get(key) ?? 0
  }

  let lastClaude: ClaudeResult | null = null
  let lastValidations: Validations | null = null
  let notes: string[] = []
  let baseRef = 'HEAD'
  /** Foto del working tree al empezar: lo que ya estaba sucio antes no cuenta como cambio de esta corrida. */
  let baseline: Fingerprint | null = null
  const newChanges = async (): Promise<string[]> => (baseline ? diffFingerprints(baseline, await git.fingerprint()) : [])

  const finish = (status: FinalStatus, error: string | null = null): RunRecord => {
    rec.final_status = status
    rec.error = error ? redactSecrets(error, secrets) : null
    rec.ended_at = deps.now().toISOString()
    rec.usage.estimated_cost_usd = estimateCost(rec, deps.prices)
    logger.info(`Corrida ${rec.run_id} terminó: ${status}`)
    if (deps.runsDir) {
      try {
        saveRun(rec, deps.runsDir, secrets, logger.lines)
      } catch (e) {
        logger.warn(`No se pudo guardar el registro de la corrida: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    return rec
  }

  /** Guarda el trabajo en curso en la rama y le pregunta a Pancho por un Issue. */
  const escalate = async (e: Escalation, round: RoundRecord | null): Promise<RunRecord> => {
    rec.human_question = e.question
    if (round) round.notes.push(`Se pidió decisión humana: ${e.reason}`)
    logger.warn(`Se necesita a Pancho: ${e.reason}`)
    if (config.dryRun) {
      notes.push('dry-run: no se crea el Issue.')
      return finish('WAITING_FOR_HUMAN')
    }
    try {
      if (rec.branch) {
        const sha = await git.commitAll(`wip(agent): ${rec.run_id} pausado para decisión humana`, await newChanges())
        if (sha) {
          rec.commits.push(sha)
          await git.push(rec.branch)
        }
      }
      const used = roundsBefore + rec.rounds.length
      const body = buildIssueBody({
        record: rec,
        question: e.question,
        recommendation: e.recommendation,
        whatGpt: rec.rounds.at(-1)?.manager.decision.summary ?? '—',
        whatClaude: lastClaude?.summary ?? '—',
        tests: lastValidations ? validationsSummary(lastValidations) : 'Sin validaciones todavía.',
        problem: e.reason,
        links: rec.branch ? [`Rama: ${rec.branch}`] : [],
        state: toResumeState(rec, used),
      })
      const issue = await requestApproval(deps.gh, rec.run_id, body)
      rec.issue_url = issue.url
      return finish('WAITING_FOR_HUMAN')
    } catch (err) {
      return finish('FAILED', err instanceof Error ? err.message : String(err))
    }
  }

  try {
    // ─── Preflight del modelo (obligatorio, también en dry-run) ───
    await deps.preflight()

    // ─── Preparación de la rama ───
    const current = await git.currentBranch()
    if (config.resume) {
      await git.checkoutWorkBranch(config.resume.branch)
      rec.branch = config.resume.branch
    } else {
      if (isProtectedBranch(current) && current !== PR_BASE) {
        throw new BridgeError('UNSAFE_BRANCH', `El bridge no arranca desde "${current}". Usá la rama ${PR_BASE}.`)
      }
      if (!config.dryRun) {
        const name = makeBranchName(deps.now(), config.goal)
        await git.createWorkBranch(name, 'HEAD')
        rec.branch = name
      }
    }
    baseRef = await git.head()
    baseline = await git.fingerprint()
    const preexisting = Object.keys(baseline)
    if (preexisting.length > 0) logger.info(`Working tree con ${preexisting.length} archivo(s) ya sucios antes de empezar; se ignoran como baseline.`)
    logger.info(`Objetivo: ${config.goal} · rama ${rec.branch ?? '(dry-run, sin rama)'} · solo lectura=${readOnly}`)

    // ─── Bucle Manager ↔ Claude ───
    for (let k = 1; k <= maxRounds; k++) {
      const roundNo = roundsBefore + k
      if (roundNo > MAX_ROUNDS_TOTAL) {
        return await escalate(
          {
            reason: `Se alcanzó el tope total de ${MAX_ROUNDS_TOTAL} rondas para este objetivo.`,
            question: '¿Cerramos acá (STOP) o querés que reformule el objetivo en uno más chico?',
            recommendation: 'STOP y reformular en tareas más chicas.',
          },
          null,
        )
      }

      const snapshot = await git.snapshot(baseRef)
      const changedSoFar = await newChanges()
      const gitSummary = [`Rama: ${snapshot.branch}`, `Archivos cambiados por esta corrida: ${changedSoFar.join(', ') || '(ninguno)'}`, snapshot.diff].join('\n')
      const input: ManagerInput = {
        goal: config.goal,
        round: roundNo,
        maxRounds: roundsBefore + maxRounds,
        dryRun: config.dryRun,
        readOnly,
        gitSummary,
        lastClaude,
        validations: lastValidations,
        history: [config.resume?.historySummary, historySummary(rec)].filter(Boolean).join('\n'),
        humanDecisions: rec.human_approvals,
        notes,
      }
      notes = []

      const { decision, usage } = await getDecision(deps.manager, input, logger)
      addUsage(rec, 'openai', usage)
      const round: RoundRecord = { round: roundNo, manager: { decision, usage }, changedFiles: changedSoFar, notes: [] }
      rec.rounds.push(round)
      logger.info(`Ronda ${roundNo}: GPT → ${decision.decision}: ${decision.summary}`)

      if (decision.decision === 'ASK_PANCHO') {
        return await escalate(
          { reason: decision.reason, question: decision.human_question ?? decision.summary, recommendation: decision.summary },
          round,
        )
      }

      if (decision.decision === 'DONE' || decision.decision === 'READY_FOR_REVIEW') {
        const changed = changedSoFar
        if (changed.length > 0 && !config.dryRun && !readOnly) {
          if (!lastValidations || !allValidationsPassed(lastValidations)) {
            lastValidations = await runValidations(deps.run, { env: deps.validationEnv, secrets })
            round.validations = lastValidations
          }
          if (!allValidationsPassed(lastValidations)) {
            notes.push(`El Manager cerró pero las validaciones fallan: ${validationsSummary(lastValidations)}. Corregir antes de cerrar.`)
            round.notes.push('Cierre rechazado por validaciones fallidas.')
            continue
          }
        }
        return await finalizeSuccess(deps, config, rec, decision, changed, readOnly, finish)
      }

      // CONTINUE o FIX → trabaja Claude
      if (decision.decision === 'FIX' && bump(decision.reason) >= 2) {
        return await escalate(
          {
            reason: `El mismo problema apareció dos veces: ${decision.reason}`,
            question: '¿Cómo seguimos con este bloqueo repetido?',
            recommendation: 'Revisar a mano el bloqueo, o STOP.',
          },
          round,
        )
      }
      const forbidden = findForbiddenActions(decision.task_for_claude)
      if (forbidden.length > 0) {
        const what = forbidden.map(f => f.description).join('; ')
        round.notes.push(`Tarea bloqueada por el bridge: ${what}`)
        return await escalate(
          {
            reason: `La tarea pedía una acción prohibida (${what}). No se envió a Claude.`,
            question: 'El Manager pidió algo que el bridge no permite. ¿Lo hacés vos a mano o paramos?',
            recommendation: 'STOP; esa acción la hace Pancho, no el agente.',
          },
          round,
        )
      }

      let claudeRaw: { raw: unknown; usage?: Usage; numTurns?: number }
      try {
        claudeRaw = await deps.claude.run(decision.task_for_claude, {
          readOnly,
          maxTurns: deps.claudeMaxTurns ?? (readOnly ? 15 : 30),
        })
      } catch (e) {
        const err = e instanceof BridgeError ? e : new BridgeError('CLAUDE_FAILURE', String(e))
        logger.error(`Claude falló: ${err.message}`)
        return finish('FAILED', err.message)
      }
      addUsage(rec, 'claude', claudeRaw.usage)
      const checked = validateClaudeResult(claudeRaw.raw)
      if (!checked.ok) {
        const msg = `Claude devolvió un resultado inválido: ${checked.errors.join('; ')}`
        round.notes.push(msg)
        return finish('FAILED', msg)
      }
      lastClaude = checked.value
      round.claude = { result: lastClaude, usage: claudeRaw.usage, numTurns: claudeRaw.numTurns, readOnly }
      logger.info(`Ronda ${roundNo}: Claude → ${lastClaude.status}: ${lastClaude.summary.slice(0, 200)}`)

      const changed = await newChanges()
      round.changedFiles = changed

      if (readOnly && changed.length > 0) {
        return await escalate(
          {
            reason: `La corrida era de solo lectura pero hay archivos modificados: ${changed.join(', ')}`,
            question: '¿Descartamos esos cambios (REJECT) o los revisás vos?',
            recommendation: 'REJECT: la tarea era de solo análisis.',
          },
          round,
        )
      }
      const protectedTouched = touchedProtectedPaths(changed)
      if (protectedTouched.length > 0) {
        return await escalate(
          {
            reason: `Se tocaron archivos protegidos: ${protectedTouched.join(', ')}`,
            question: 'Un agente no puede cambiar reglas, workflow del bridge ni .env. ¿Los descartás?',
            recommendation: 'REJECT y revisar a mano.',
          },
          round,
        )
      }

      if (!config.dryRun && !readOnly && changed.length > 0) {
        lastValidations = await runValidations(deps.run, { env: deps.validationEnv, secrets })
      } else {
        lastValidations = skippedValidations(config.dryRun ? 'dry-run' : 'sin cambios para validar')
      }
      round.validations = lastValidations
      logger.info(`Validaciones: ${validationsSummary(lastValidations)}`)

      if (lastClaude.status === 'BLOCKED' && bump(lastClaude.summary) >= 2) {
        return await escalate(
          {
            reason: `Claude quedó bloqueado dos veces por lo mismo: ${lastClaude.summary}`,
            question: lastClaude.questions[0] ?? '¿Cómo destrabamos esto?',
            recommendation: 'Decidir a mano o STOP.',
          },
          round,
        )
      }
    }

    return await escalate(
      {
        reason: `Se alcanzó el máximo de ${maxRounds} rondas sin terminar.`,
        question: '¿Seguimos con otras rondas (CONTINUE) o cerramos (STOP)?',
        recommendation: 'Revisar el avance y recién después dar CONTINUE.',
      },
      rec.rounds.at(-1) ?? null,
    )
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e))
    logger.error(`Error: ${err.message}`)
    return finish('FAILED', err.message)
  }
}

async function getDecision(
  manager: ManagerClient,
  input: ManagerInput,
  logger: Logger,
): Promise<{ decision: ManagerDecision; usage?: Usage }> {
  let lastErrors: string[] = []
  const usage: Usage = { inputTokens: 0, outputTokens: 0 }
  for (let attempt = 1; attempt <= 2; attempt++) {
    const withHint = attempt === 1 ? input : { ...input, notes: [...input.notes, `Tu respuesta anterior fue inválida (${lastErrors.join('; ')}). Respondé solo el JSON del esquema.`] }
    try {
      const { raw, usage: u } = await manager.decide(withHint)
      if (u) {
        usage.inputTokens += u.inputTokens
        usage.outputTokens += u.outputTokens
      }
      const parsed = typeof raw === 'string' ? extractJson(raw) : raw
      const checked = validateManagerDecision(parsed)
      if (checked.ok) return { decision: checked.value, usage }
      lastErrors = checked.errors
    } catch (e) {
      if (e instanceof BridgeError && e.code === 'INVALID_JSON') lastErrors = [e.message]
      else throw e
    }
    logger.warn(`El Manager devolvió una decisión inválida (intento ${attempt}): ${lastErrors.join('; ')}`)
  }
  throw new BridgeError('INVALID_MANAGER_OUTPUT', `El Manager no devolvió una decisión válida: ${lastErrors.join('; ')}`)
}

async function finalizeSuccess(
  deps: BridgeDeps,
  config: RunConfig,
  rec: RunRecord,
  decision: ManagerDecision,
  changed: string[],
  readOnly: boolean,
  finish: (s: FinalStatus, e?: string | null) => RunRecord,
): Promise<RunRecord> {
  const { git, gh, logger } = deps
  const status: FinalStatus =
    decision.decision === 'READY_FOR_REVIEW' ? 'READY_FOR_REVIEW' : mentionsProduction(config.goal) ? 'READY_FOR_PRODUCTION' : 'DONE'

  if (config.dryRun || readOnly || changed.length === 0 || !rec.branch) {
    if (changed.length > 0 && config.dryRun) logger.warn('dry-run: hay cambios en disco, no se hace commit ni PR.')
    return finish(status)
  }
  try {
    const sha = await git.commitAll(`feat(agent): ${config.goal.slice(0, 60)}`, changed)
    if (sha) rec.commits.push(sha)
    await git.push(rec.branch)
    rec.final_status = status
    rec.pr_url = await gh.createPullRequest({
      title: `VARA Agent: ${config.goal.slice(0, 70)}`,
      body: renderPrBody(rec),
      head: rec.branch,
      base: PR_BASE,
    })
    logger.info(`PR abierto hacia ${PR_BASE}: ${rec.pr_url}`)

    // CI explícito: los push y PR creados con GITHUB_TOKEN no lo disparan solos.
    const head = await git.head()
    await gh.dispatchCi(rec.branch)
    logger.info(`CI disparado sobre ${rec.branch} (${head.slice(0, 7)}); esperando resultado…`)
    const ci = await gh.waitForCi(rec.branch, head, deps.ciTimeoutMs ?? 30 * 60_000)
    rec.ci = { run_url: ci.url, conclusion: ci.conclusion }
    const ciNote = `${BOT_MARKER} CI: ${ci.conclusion}${ci.url ? ` (${ci.url})` : ''}.`
    if (ci.conclusion !== 'success') {
      await gh.commentPullRequest(rec.pr_url, `${ciNote} El agente NO lo declara listo para revisión.`).catch(() => undefined)
      return finish('FAILED', `El CI terminó en "${ci.conclusion}"; no se declara ${status}.`)
    }
    await gh.commentPullRequest(rec.pr_url, `${ciNote} Listo para revisión humana; no se mergea solo.`).catch(() => undefined)
    return finish(status)
  } catch (e) {
    return finish('FAILED', e instanceof Error ? e.message : String(e))
  }
}

// ───────────────────────── Reanudación tras decisión humana ─────────────────────────

/** Pasa el estado guardado en el Issue a la configuración de una corrida. El objetivo es el original, textual. */
export function configFromResume(state: ResumeState, base: Partial<RunConfig> = {}): RunConfig {
  return {
    maxRounds: MAX_ROUNDS_PER_RUN,
    dryRun: false,
    baseBranch: PR_BASE,
    openaiModel: 'gpt-5.5',
    claudeModel: 'sonnet',
    ...base,
    goal: state.goal,
    resume: state,
  }
}

/** Registro de una corrida que Pancho cerró con STOP o REJECT (no se trabaja más). */
export function recordHumanStop(
  state: ResumeState,
  command: string,
  now: Date,
  opts: { logger: Logger; runsDir?: string; secrets?: string[]; issueUrl?: string },
): RunRecord {
  const rec = createRunRecord(state.runId, configFromResume(state), now)
  rec.branch = state.branch
  rec.issue_url = opts.issueUrl ?? null
  rec.final_status = 'STOPPED'
  rec.ended_at = now.toISOString()
  opts.logger.info(`Pancho respondió ${command}: la corrida ${state.runId} se cierra sin más trabajo.`)
  if (opts.runsDir) saveRun(rec, opts.runsDir, opts.secrets ?? [], opts.logger.lines)
  return rec
}

// ───────────────────────────── Entorno real ─────────────────────────────

export const nodeRunner: CommandRunner = (cmd: string, args: string[], opts: CommandOptions = {}) =>
  new Promise<CommandResult>(resolve => {
    const useShell = process.platform === 'win32' && /^(npm|npx)$/.test(cmd)
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: (opts.env ?? process.env) as NodeJS.ProcessEnv,
      shell: useShell,
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const timer = opts.timeoutMs
      ? setTimeout(() => {
          timedOut = true
          child.kill('SIGKILL')
        }, opts.timeoutMs)
      : null
    child.stdout.on('data', d => (stdout += String(d)))
    child.stderr.on('data', d => (stderr += String(d)))
    child.on('error', err => {
      if (timer) clearTimeout(timer)
      resolve({ code: 127, stdout, stderr: `${stderr}${err.message}`, timedOut })
    })
    child.on('close', code => {
      if (timer) clearTimeout(timer)
      resolve({ code: code ?? 1, stdout, stderr, timedOut })
    })
    if (opts.input !== undefined) child.stdin.end(opts.input)
    else child.stdin.end()
  })

export function withoutKeys(env: NodeJS.ProcessEnv, drop: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = { ...env }
  for (const k of drop) delete out[k]
  return out
}

const readText = (p: string) => readFileSync(p, 'utf8')

export function loadConfigFromEnv(env: NodeJS.ProcessEnv, argv: string[]): RunConfig {
  const goal = (env.GOAL ?? argv.slice(2).join(' ')).trim()
  const asBool = (v?: string) => /^(1|true|yes|si|sí)$/i.test((v ?? '').trim())
  return {
    goal,
    maxRounds: Number(env.MAX_AGENT_ROUNDS ?? env.MAX_ROUNDS ?? MAX_ROUNDS_PER_RUN) || MAX_ROUNDS_PER_RUN,
    dryRun: asBool(env.DRY_RUN),
    baseBranch: env.BASE_BRANCH ?? PR_BASE,
    openaiModel: env.OPENAI_MODEL ?? 'gpt-5.5',
    claudeModel: env.CLAUDE_MODEL ?? 'sonnet',
  }
}

function writeSummary(rec: RunRecord): void {
  const file = process.env.GITHUB_STEP_SUMMARY
  if (!file) return
  const lines = [
    `## VARA Agent — ${rec.final_status}`,
    `- Run: \`${rec.run_id}\` · rondas: ${rec.rounds.length}/${rec.max_rounds}`,
    `- Rama: ${rec.branch ?? '—'}`,
    rec.pr_url ? `- PR: ${rec.pr_url}` : '',
    rec.issue_url ? `- Pregunta a Pancho: ${rec.issue_url}` : '',
    rec.error ? `- Error: ${rec.error}` : '',
    `- Costo estimado: ${rec.usage.estimated_cost_usd === null ? 'n/d' : `USD ${rec.usage.estimated_cost_usd}`}`,
  ].filter(Boolean)
  try {
    appendFileSync(file, `${lines.join('\n')}\n`)
  } catch {
    /* el resumen es opcional */
  }
}

export async function main(): Promise<number> {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
  const secrets = collectSecretValues(process.env)
  const logger = createLogger(secrets)
  let config = loadConfigFromEnv(process.env, process.argv)
  const fromComment = process.env.EVENT_NAME === 'issue_comment'
  const resumeIssue = Number(fromComment ? process.env.ISSUE_NUMBER : process.env.RESUME_ISSUE) || null

  try {
    const git = new Git(nodeRunner, root)
    const gh = createGhApi(nodeRunner, { cwd: root })

    // ─── Reanudación: por comentario de Pancho (automática) o por relanzamiento manual ───
    if (fromComment && !resumeIssue) throw new BridgeError('CONFIG', 'Evento issue_comment sin número de issue.')
    if (resumeIssue) {
      const res = await resolveResume(gh, {
        issueNumber: resumeIssue,
        source: fromComment ? 'comment' : 'dispatch',
        author: process.env.COMMENT_AUTHOR,
        authorType: process.env.COMMENT_AUTHOR_TYPE,
        body: process.env.COMMENT_BODY,
      })
      if (res.kind === 'ignore') {
        logger.info(`Evento ignorado: ${res.reason}.`)
        return 0
      }
      if (res.kind === 'stop') {
        recordHumanStop(res.state, res.command, new Date(), { logger, runsDir: root, secrets, issueUrl: res.issueUrl })
        return 0
      }
      config = configFromResume(res.state, config)
    } else if (!config.goal) {
      throw new BridgeError('CONFIG', 'Falta el objetivo (input goal).')
    }

    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) throw new BridgeError('CONFIG', 'Falta el secreto OPENAI_API_KEY.')
    if (!process.env.ANTHROPIC_API_KEY && !process.env.CLAUDE_CODE_OAUTH_TOKEN) {
      throw new BridgeError('CONFIG', 'Falta ANTHROPIC_API_KEY o CLAUDE_CODE_OAUTH_TOKEN.')
    }

    const read = (p: string) => readText(path.join(root, p))
    const rules = ['agent/ORCHESTRATOR_RULES.md', 'agent/PRODUCT_PRINCIPLES.md', 'agent/RELEASE_RULES.md', 'agent/PRODUCT_CONTEXT.md', 'agent/CURRENT_STATE.json']
      .map(f => `# ${f}\n${read(f)}`)
      .join('\n\n')
    const managerSchema = JSON.parse(read('agent/schemas/manager-decision.schema.json')) as Record<string, unknown>
    const claudeSchema = JSON.stringify(JSON.parse(read('agent/schemas/claude-result.schema.json')))

    const deps: BridgeDeps = {
      preflight: () => preflightModel(openaiKey, config.openaiModel),
      manager: createOpenAIManager({ apiKey: openaiKey, model: config.openaiModel, instructions: rules, schema: managerSchema }),
      claude: createClaudeRunner(nodeRunner, {
        model: config.claudeModel,
        cwd: root,
        sourceEnv: process.env,
        resultSchema: claudeSchema,
        systemPrompt: `${read('agent/PRODUCT_PRINCIPLES.md')}\n\n${read('agent/RELEASE_RULES.md')}`,
        secrets,
      }),
      git,
      gh,
      run: (cmd, args, o) => nodeRunner(cmd, args, { ...o, cwd: o?.cwd ?? root }),
      logger,
      now: () => new Date(),
      runsDir: root,
      secrets,
      prices: pricesFromEnv(process.env),
      validationEnv: withoutKeys(process.env, ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN', 'GITHUB_TOKEN', 'GH_TOKEN']),
    }

    const rec = await runBridge(deps, config)
    writeSummary(rec)
    return rec.final_status === 'FAILED' ? 1 : 0
  } catch (e) {
    logger.error(e instanceof Error ? e.message : String(e))
    return 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(code => process.exit(code))
}
