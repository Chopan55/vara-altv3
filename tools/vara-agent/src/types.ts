/**
 * Tipos compartidos del bridge. Sin dependencias: se importan desde todos los módulos y los tests.
 */

export const DECISIONS = ['CONTINUE', 'FIX', 'ASK_PANCHO', 'READY_FOR_REVIEW', 'DONE'] as const
export type Decision = (typeof DECISIONS)[number]

export interface ManagerDecision {
  decision: Decision
  summary: string
  task_for_claude: string
  reason: string
  risks: string[]
  requires_human: boolean
  human_question: string | null
  confidence: number
}

export const CLAUDE_STATUSES = ['COMPLETED', 'PARTIAL', 'BLOCKED'] as const
export type ClaudeStatus = (typeof CLAUDE_STATUSES)[number]

export interface ClaudeResult {
  status: ClaudeStatus
  summary: string
  files_changed: string[]
  tests: { typecheck: string; lint: string; tests: string; build: string }
  risks: string[]
  questions: string[]
  suggested_next_step: string
}

export interface Usage {
  inputTokens: number
  outputTokens: number
  /** Costo informado por la API (Claude lo devuelve). OpenAI se estima si hay precios configurados. */
  costUsd?: number
}

export type CheckName = 'typecheck' | 'lint' | 'tests' | 'build'
export type CheckStatus = 'PASS' | 'FAIL' | 'SKIPPED'
export interface CheckEntry {
  status: CheckStatus
  /** Cola de la salida, ya redactada y recortada. */
  output: string
  durationMs: number
}
export type Validations = Record<CheckName, CheckEntry>

export interface GitState {
  branch: string
  head: string
  status: string
  changedFiles: string[]
  diff: string
  diffTruncated: boolean
  log: string
}

export interface HumanDecision {
  command: 'APPROVE' | 'REJECT' | 'CONTINUE' | 'STOP'
  actor: string
  at: string
  note?: string
}

export interface RoundRecord {
  round: number
  manager: { decision: ManagerDecision; usage?: Usage }
  claude?: { result: ClaudeResult; usage?: Usage; numTurns?: number; readOnly: boolean }
  validations?: Validations
  changedFiles: string[]
  notes: string[]
}

export type FinalStatus =
  | 'DONE'
  | 'READY_FOR_REVIEW'
  | 'READY_FOR_PRODUCTION'
  | 'WAITING_FOR_HUMAN'
  | 'STOPPED'
  | 'FAILED'

export interface RunConfig {
  goal: string
  maxRounds: number
  dryRun: boolean
  baseBranch: string
  openaiModel: string
  claudeModel: string
  /** Si es una reanudación tras una decisión humana. */
  resume?: ResumeState
}

export interface ResumeState {
  runId: string
  /** Objetivo original, textual. Al reanudar se usa tal cual; nunca se reconstruye. */
  goal: string
  branch: string
  roundsUsed: number
  historySummary: string
  humanDecisions: HumanDecision[]
  /** Costo acumulado en USD hasta la pausa (para que el tope de gasto valga entre reanudaciones). */
  costUsd?: number
  /** Límite vigente en USD; si Pancho aprueba tras una pausa por costo, sube una ventana. */
  costLimitUsd?: number
}

export interface RunRecord {
  run_id: string
  goal: string
  started_at: string
  ended_at: string | null
  branch: string | null
  dry_run: boolean
  max_rounds: number
  rounds: RoundRecord[]
  commits: string[]
  final_status: FinalStatus | null
  human_approvals: HumanDecision[]
  pr_url: string | null
  /** CI explícito disparado por el bridge sobre la rama del PR. */
  ci: { run_url: string | null; conclusion: string } | null
  issue_url: string | null
  human_question: string | null
  error: string | null
  usage: { openai: Usage; claude: Usage; estimated_cost_usd: number | null }
}

/** Ejecuta un comando sin shell (salvo npm/claude en Windows). Se inyecta para poder probar sin procesos reales. */
export interface CommandOptions {
  cwd?: string
  env?: Record<string, string | undefined>
  timeoutMs?: number
  input?: string
}
export interface CommandResult {
  code: number
  stdout: string
  stderr: string
  timedOut: boolean
}
export type CommandRunner = (cmd: string, args: string[], opts?: CommandOptions) => Promise<CommandResult>

export class BridgeError extends Error {
  constructor(
    public readonly code:
      | 'INVALID_JSON'
      | 'INVALID_MANAGER_OUTPUT'
      | 'INVALID_CLAUDE_OUTPUT'
      | 'OPENAI_FAILURE'
      | 'CLAUDE_FAILURE'
      | 'FORBIDDEN_ACTION'
      | 'UNSAFE_BRANCH'
      | 'GITHUB_FAILURE'
      | 'CONFIG',
    message: string,
  ) {
    super(message)
    this.name = 'BridgeError'
  }
}
