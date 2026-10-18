/** Dobles de prueba del bridge: ninguno usa red, procesos ni GitHub reales. */

import type { GitHubApi, IssueComment } from '../src/approvals'
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
  changed: string[]
  branch: string
  created: string[]
  commits: string[]
  pushed: string[]
}

export function fakeGit(branch = 'integracion'): FakeGit {
  const g: FakeGit = {
    changed: [],
    branch,
    created: [],
    commits: [],
    pushed: [],
    currentBranch: async () => g.branch,
    head: async () => 'abc1234',
    async createWorkBranch(name) {
      g.created.push(name)
      g.branch = name
    },
    async checkoutWorkBranch(name) {
      g.branch = name
    },
    async snapshot(): Promise<GitState> {
      return { branch: g.branch, head: 'abc1234', status: '', changedFiles: [...g.changed], diff: '', diffTruncated: false, log: '' }
    },
    changedFiles: async () => [...g.changed],
    async commitAll(message) {
      if (g.changed.length === 0) return null
      g.commits.push(message)
      return 'def5678'
    },
    async push(b) {
      g.pushed.push(b)
    },
  }
  return g
}

export interface FakeGh extends GitHubApi {
  issues: { title: string; body: string }[]
  prs: { title: string; body: string; head: string; base: string }[]
  comments: Record<number, IssueComment[]>
  posted: string[]
}

export function fakeGh(): FakeGh {
  const g: FakeGh = {
    issues: [],
    prs: [],
    comments: {},
    posted: [],
    async findOpenApprovalIssue() {
      const i = g.issues[0]
      return i ? { number: 1, url: 'https://github.com/x/y/issues/1', body: i.body } : null
    },
    async createIssue(title, body) {
      g.issues.push({ title, body })
      return { number: g.issues.length, url: `https://github.com/x/y/issues/${g.issues.length}` }
    },
    async updateIssue(_n, body) {
      g.issues[0].body = body
    },
    async commentIssue(_n, body) {
      g.posted.push(body)
    },
    async listComments(n) {
      return g.comments[n] ?? []
    },
    async createPullRequest(args) {
      g.prs.push(args)
      return 'https://github.com/x/y/pull/9'
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
    ...parts,
  }
  return { deps, git: git as FakeGit, gh: gh as FakeGh }
}
