/** Dobles de prueba del bridge: ninguno usa red, procesos ni GitHub reales. */

import { ISSUE_TITLE, type CiOutcome, type GitHubApi, type IssueComment, type IssueInfo } from '../src/approvals'
import type { ClaudeClient } from '../src/claude-runner'
import type { BridgeDeps, GitPort } from '../src/index'
import { createLogger } from '../src/logger'
import type { ManagerClient } from '../src/openai-manager'
import type { ClaudeResult, CommandRunner, GitState, ManagerDecision, RunConfig, Usage } from '../src/types'

export function dec(over: Partial<ManagerDecision> = {}): ManagerDecision {
  return {
    decision: 'CONTINUE',
    summary: 'Siguiente paso',
    task_for_claude: 'Revisá el estado del proyecto.',
    reason: 'Falta información',
    risks: [],
    requires_human: false,
    human_question: null,
    confidence: 0.8,
    ...over,
  }
}

export function askDec(question = '¿Sigo?'): ManagerDecision {
  return dec({ decision: 'ASK_PANCHO', requires_human: true, human_question: question, task_for_claude: '', summary: 'Necesito tu OK', reason: 'Decisión de producto' })
}

export function doneDec(): ManagerDecision {
  return dec({ decision: 'DONE', task_for_claude: '', summary: 'ok', reason: 'ok' })
}

export function claudeResult(over: Partial<ClaudeResult> = {}): ClaudeResult {
  return {
    status: 'COMPLETED',
    summary: 'Listo',
    files_changed: [],
    tests: { typecheck: 'NOT_RUN', lint: 'NOT_RUN', tests: 'NOT_RUN', build: 'NOT_RUN' },
    risks: [],
    questions: [],
    suggested_next_step: 'Cerrar',
    ...over,
  }
}

type Step<T> = T | Error | string

/** Manager que responde una lista de pasos (objeto, texto crudo o error). El último se repite. */
export function fakeManager(steps: Step<unknown>[]): ManagerClient & { calls: number } {
  const m = {
    calls: 0,
    async decide() {
      const step = steps[Math.min(m.calls, steps.length - 1)]
      m.calls++
      if (step instanceof Error) throw step
      return { raw: step, usage: { inputTokens: 100, outputTokens: 20 } as Usage }
    },
  }
  return m
}

export function fakeClaude(
  steps: Step<ClaudeResult | Record<string, unknown>>[],
  onRun?: (n: number) => void,
): ClaudeClient & { calls: number; tasks: string[] } {
  const c = {
    calls: 0,
    tasks: [] as string[],
    async run(task: string) {
      const step = steps[Math.min(c.calls, steps.length - 1)]
      c.calls++
      c.tasks.push(task)
      onRun?.(c.calls)
      if (step instanceof Error) throw step
      return { raw: step, numTurns: 3, usage: { inputTokens: 500, outputTokens: 100, costUsd: 0.05 } as Usage }
    },
  }
  return c
}

export interface FakeGit extends GitPort {
  /** Archivos que ya estaban sucios antes de la corrida: ruta → huella (cambiarla simula que Claude lo volvió a tocar). */
  pre: Record<string, string>
  committedPaths: (string[] | undefined)[]
  changed: string[]
  branch: string
  created: string[]
  checkedOut: string[]
  commits: string[]
  pushed: string[]
}

export function fakeGit(branch = 'integracion'): FakeGit {
  const g: FakeGit = {
    pre: {},
    committedPaths: [],
    changed: [],
    branch,
    created: [],
    checkedOut: [],
    commits: [],
    pushed: [],
    currentBranch: async () => g.branch,
    head: async () => 'abc1234',
    async createWorkBranch(name) {
      g.created.push(name)
      g.branch = name
    },
    async checkoutWorkBranch(name) {
      g.checkedOut.push(name)
      g.branch = name
    },
    async snapshot(): Promise<GitState> {
      return { branch: g.branch, head: 'abc1234', status: '', changedFiles: [...g.changed], diff: '', diffTruncated: false, log: '' }
    },
    changedFiles: async () => [...Object.keys(g.pre), ...g.changed],
    fingerprint: async () => ({ ...g.pre, ...Object.fromEntries(g.changed.map(f => [f, `M:${f}`])) }),
    async commitAll(message, paths) {
      if (g.changed.length === 0) return null
      g.committedPaths.push(paths)
      g.commits.push(message)
      return 'def5678'
    },
    async push(b) {
      g.pushed.push(b)
    },
  }
  return g
}

export interface FakeIssue extends IssueInfo {
  comments: IssueComment[]
  closedCount: number
}

export interface FakeGh extends GitHubApi {
  issues: FakeIssue[]
  prs: { title: string; body: string; head: string; base: string }[]
  prComments: string[]
  ciDispatches: string[]
  ciResult: CiOutcome
  posted: string[]
  /** Simula un comentario humano en un Issue. */
  say(issueNumber: number, author: string, body: string, authorType?: string): void
}

export function fakeGh(): FakeGh {
  const find = (n: number) => g.issues.find(i => i.number === n)
  const g: FakeGh = {
    issues: [],
    prs: [],
    prComments: [],
    ciDispatches: [],
    ciResult: { conclusion: 'success', url: 'https://github.com/x/y/actions/runs/1' },
    posted: [],
    say(n, author, body, authorType = 'User') {
      find(n)?.comments.push({ author, authorType, body, createdAt: new Date(Date.UTC(2026, 9, 17, 12, 0, find(n)!.comments.length + 1)).toISOString() })
    },
    async findApprovalIssue(runId) {
      return g.issues.find(i => i.title === `${ISSUE_TITLE} [${runId}]`) ?? null
    },
    async getIssue(n) {
      return find(n) ?? null
    },
    async createIssue(title, body) {
      const number = g.issues.length + 1
      g.issues.push({ number, url: `https://github.com/x/y/issues/${number}`, title, body, state: 'open', comments: [], closedCount: 0 })
      return { number, url: `https://github.com/x/y/issues/${number}` }
    },
    async updateIssue(n, body) {
      find(n)!.body = body
    },
    async reopenIssue(n) {
      find(n)!.state = 'open'
    },
    async closeIssue(n) {
      const i = find(n)!
      i.state = 'closed'
      i.closedCount++
    },
    async commentIssue(n, body) {
      g.posted.push(body)
      find(n)?.comments.push({ author: 'github-actions[bot]', authorType: 'Bot', body, createdAt: new Date(Date.UTC(2026, 9, 17, 13, 0, find(n)!.comments.length + 1)).toISOString() })
    },
    async listComments(n) {
      return find(n)?.comments ?? []
    },
    async createPullRequest(args) {
      g.prs.push(args)
      return 'https://github.com/x/y/pull/9'
    },
    async commentPullRequest(_url, body) {
      g.prComments.push(body)
    },
    async dispatchCi(branch) {
      g.ciDispatches.push(branch)
    },
    async waitForCi() {
      return g.ciResult
    },
  }
  return g
}

/** Runner de validaciones: pasan todas salvo las que se indiquen en `failing` (por nombre de script). */
export function fakeRunner(failing: string[] = []): CommandRunner {
  return async (_cmd, args) => {
    const script = args[args.length - 1]
    const fail = failing.includes(script)
    return { code: fail ? 1 : 0, stdout: fail ? '' : 'ok', stderr: fail ? `${script} falló` : '', timedOut: false }
  }
}

export function baseConfig(over: Partial<RunConfig> = {}): RunConfig {
  return {
    goal: 'Agregá un archivo docs/AGENT_BRIDGE_TEST.md con una línea de prueba.',
    maxRounds: 4,
    dryRun: false,
    baseBranch: 'integracion',
    openaiModel: 'gpt-5.5',
    claudeModel: 'sonnet',
    ...over,
  }
}

export function makeDeps(parts: Partial<BridgeDeps> & Pick<BridgeDeps, 'manager' | 'claude'>) {
  const git = (parts.git as FakeGit | undefined) ?? fakeGit()
  const gh = (parts.gh as FakeGh | undefined) ?? fakeGh()
  const deps: BridgeDeps = {
    git,
    gh,
    run: fakeRunner(),
    logger: createLogger(parts.secrets ?? [], () => {}),
    now: () => new Date('2026-10-17T12:00:00Z'),
    preflight: async () => {},
    ...parts,
  }
  return { deps, git: git as FakeGit, gh: gh as FakeGh }
}
