/**
 * Aprobación humana vía GitHub Issue, uno por run_id: "VARA Agent — Approval Required [run-…]".
 * Solo se aceptan comandos (APPROVE/REJECT/CONTINUE/STOP) del actor Chopan55; el resto se ignora.
 * Al consumir la decisión el Issue se registra y se cierra; el workflow se reanuda solo por issue_comment.
 * Callers: index.ts. GitHub se accede por la interfaz GitHubApi (gh CLI en producción, fake en tests).
 */

import { decodeState, encodeState } from './run-state'
import { BridgeError, type CommandRunner, type HumanDecision, type ResumeState, type RunRecord } from './types'
import { isSafeAgentBranch } from './validations'

export const AUTHORIZED_ACTOR = 'Chopan55'
export const ISSUE_TITLE = 'VARA Agent — Approval Required'
export const PR_BASE = 'integracion'
/** Todo comentario del bridge empieza así; nunca se interpreta como orden y evita loops. */
export const BOT_MARKER = '[vara-agent]'

export const issueTitleFor = (runId: string) => `${ISSUE_TITLE} [${runId}]`

export interface IssueComment {
  author: string
  authorType?: string
  body: string
  createdAt: string
}

export interface IssueInfo {
  number: number
  url: string
  title: string
  body: string
  state: 'open' | 'closed'
}

export interface CiOutcome {
  conclusion: 'success' | 'failure' | 'cancelled' | 'timed_out' | 'unknown'
  url: string | null
}

export interface GitHubApi {
  /** Busca el Issue de ese run_id, esté abierto o cerrado. */
  findApprovalIssue(runId: string): Promise<IssueInfo | null>
  getIssue(number: number): Promise<IssueInfo | null>
  createIssue(title: string, body: string): Promise<{ number: number; url: string }>
  updateIssue(number: number, body: string): Promise<void>
  reopenIssue(number: number): Promise<void>
  closeIssue(number: number): Promise<void>
  commentIssue(number: number, body: string): Promise<void>
  listComments(number: number): Promise<IssueComment[]>
  createPullRequest(args: { title: string; body: string; head: string; base: string }): Promise<string>
  commentPullRequest(prUrl: string, body: string): Promise<void>
  /** Dispara el workflow CI sobre la rama (los push/PR con GITHUB_TOKEN no lo disparan solos). */
  dispatchCi(branch: string): Promise<void>
  waitForCi(branch: string, sha: string, timeoutMs: number): Promise<CiOutcome>
}

const COMMAND_RE = /^\s*(APPROVE|REJECT|CONTINUE|STOP)\b[:\s-]*(.*)$/i

export function parseHumanCommand(body: string): { command: HumanDecision['command']; note: string } | null {
  const firstLine = body.split(/\r?\n/).find(l => l.trim())
  if (!firstLine) return null
  const m = COMMAND_RE.exec(firstLine)
  if (!m) return null
  return { command: m[1].toUpperCase() as HumanDecision['command'], note: m[2].trim() }
}

const isActor = (login: string | undefined, actor: string) => !!login && login.toLowerCase() === actor.toLowerCase()

/** Toma el comando más reciente del actor autorizado. Los comentarios de otros usuarios se ignoran. */
export function pickHumanDecision(
  comments: IssueComment[],
  actor: string = AUTHORIZED_ACTOR,
): { decision: HumanDecision | null; ignored: number } {
  let decision: HumanDecision | null = null
  let ignored = 0
  const sorted = [...comments].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  for (const c of sorted) {
    if (c.body.trim().startsWith(BOT_MARKER)) continue
    const parsed = parseHumanCommand(c.body)
    if (!parsed) continue
    if (!isActor(c.author, actor) || c.authorType === 'Bot') {
      ignored++
      continue
    }
    decision = { command: parsed.command, actor: c.author, at: c.createdAt, note: parsed.note || undefined }
  }
  return { decision, ignored }
}

const STATE_RE = /<!--\s*vara-agent-state:([A-Za-z0-9+/=]+)\s*-->/

export function extractStateFromIssueBody(body: string): ResumeState | null {
  const m = STATE_RE.exec(body)
  return m ? decodeState(m[1]) : null
}

export function buildIssueBody(args: {
  record: RunRecord
  question: string
  recommendation: string
  whatGpt: string
  whatClaude: string
  tests: string
  problem: string
  links: string[]
  state: ResumeState
  /** Instrucción alternativa para modos sin reanudación automática (por ejemplo, el Bridge local). */
  howToRespond?: string
}): string {
  const { record: r } = args
  return [
    `**Objetivo:** ${r.goal}`,
    `**Run:** \`${r.run_id}\` · rama \`${r.branch ?? '—'}\``,
    `### Qué hizo GPT\n${args.whatGpt}`,
    `### Qué hizo Claude\n${args.whatClaude}`,
    `### Tests\n${args.tests}`,
    `### Problema\n${args.problem}`,
    `### Recomendación\n${args.recommendation}`,
    `### Pregunta\n**${args.question}**`,
    `### Cómo responder\n${
      args.howToRespond ??
      `Comentá en este issue, en la primera línea, una sola palabra: \`APPROVE\`, \`CONTINUE\`, \`REJECT\` o \`STOP\` (podés sumar una nota después). Solo vale lo que comenta @${AUTHORIZED_ACTOR}. El agente retoma solo: no hace falta lanzar nada a mano.`
    }`,
    args.links.length ? `### Links\n${args.links.map(l => `- ${l}`).join('\n')}` : '',
    `<!-- vara-agent-state:${encodeState(args.state)} -->`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** Crea el Issue de este run_id, o actualiza (y reabre si hace falta) el que ya tiene. Nunca comparte Issue entre runs. */
export async function requestApproval(gh: GitHubApi, runId: string, body: string): Promise<{ number: number; url: string }> {
  const existing = await gh.findApprovalIssue(runId)
  if (existing) {
    await gh.updateIssue(existing.number, body)
    if (existing.state === 'closed') await gh.reopenIssue(existing.number)
    await gh.commentIssue(existing.number, `${BOT_MARKER} El agente tiene una nueva pregunta. Respondé con APPROVE, CONTINUE, REJECT o STOP.`)
    return { number: existing.number, url: existing.url }
  }
  return gh.createIssue(issueTitleFor(runId), body)
}

// ───────────────────── Reanudación automática ─────────────────────

export interface ResumeEvent {
  issueNumber: number
  /** 'comment': evento issue_comment (viene el comentario). 'dispatch': relanzado a mano (se lee el Issue). */
  source: 'comment' | 'dispatch'
  author?: string
  authorType?: string
  body?: string
  now?: Date
}

export type ResumeResolution =
  | { kind: 'ignore'; reason: string }
  | { kind: 'continue' | 'stop'; command: HumanDecision['command']; state: ResumeState; issueUrl: string }

/**
 * Decide qué hacer con un comentario en un Issue. Ignora: otros usuarios, bots, comentarios del propio
 * bridge, Issues que no son del bridge, Issues sin estado o con rama no permitida, e Issues ya cerrados.
 * Si procede, registra la decisión, cierra el Issue y devuelve el estado para retomar (o terminar).
 */
export async function resolveResume(gh: GitHubApi, ev: ResumeEvent, actor: string = AUTHORIZED_ACTOR): Promise<ResumeResolution> {
  let fromComment: { command: HumanDecision['command']; note: string } | null = null
  if (ev.source === 'comment') {
    if (!isActor(ev.author, actor)) return { kind: 'ignore', reason: 'comentario de un usuario no autorizado' }
    if (ev.authorType === 'Bot') return { kind: 'ignore', reason: 'comentario de un bot' }
    if ((ev.body ?? '').trim().startsWith(BOT_MARKER)) return { kind: 'ignore', reason: 'comentario del propio bridge' }
    fromComment = parseHumanCommand(ev.body ?? '')
    if (!fromComment) return { kind: 'ignore', reason: 'el comentario no es un comando' }
  }

  const issue = await gh.getIssue(ev.issueNumber)
  if (!issue) return { kind: 'ignore', reason: 'el issue no existe' }
  if (!issue.title.startsWith(`${ISSUE_TITLE} [`)) return { kind: 'ignore', reason: 'no es un issue del bridge' }
  if (issue.state !== 'open') return { kind: 'ignore', reason: 'el issue ya estaba cerrado (decisión consumida)' }
  const state = extractStateFromIssueBody(issue.body)
  if (!state) return { kind: 'ignore', reason: 'el issue no tiene estado de corrida' }
  if (issue.title !== issueTitleFor(state.runId)) return { kind: 'ignore', reason: 'el título no coincide con el run_id' }
  if (!isSafeAgentBranch(state.branch)) return { kind: 'ignore', reason: 'la rama del estado no es una rama de trabajo permitida' }

  let decision: HumanDecision
  if (fromComment) {
    decision = { command: fromComment.command, actor: ev.author as string, at: (ev.now ?? new Date()).toISOString(), note: fromComment.note || undefined }
  } else {
    const comments = await gh.listComments(ev.issueNumber)
    let from = 0
    comments.forEach((c, i) => {
      if (c.body.trim().startsWith(BOT_MARKER)) from = i + 1
    })
    const picked = pickHumanDecision(comments.slice(from), actor)
    if (!picked.decision) return { kind: 'ignore', reason: `todavía no hay respuesta de @${actor}` }
    decision = picked.decision
  }

  const stops = decision.command === 'STOP' || decision.command === 'REJECT'
  await gh.commentIssue(
    ev.issueNumber,
    `${BOT_MARKER} Registré tu decisión: ${decision.command} (@${decision.actor}). ${stops ? 'Cierro la corrida.' : 'Retomo la corrida.'}`,
  )
  await gh.closeIssue(ev.issueNumber)
  state.humanDecisions = [...state.humanDecisions, decision]
  return { kind: stops ? 'stop' : 'continue', command: decision.command, state, issueUrl: issue.url }
}

// ───────────────────────── Implementación con gh CLI ─────────────────────────

export interface GhOptions {
  cwd?: string
  sleep?: (ms: number) => Promise<void>
  pollMs?: number
}

export function createGhApi(run: CommandRunner, opts: GhOptions = {}): GitHubApi {
  const { cwd } = opts
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>(r => setTimeout(r, ms)))
  const pollMs = opts.pollMs ?? 20_000
  const gh = async (args: string[], input?: string): Promise<string> => {
    const r = await run('gh', args, { cwd, input, timeoutMs: 120_000 })
    if (r.code !== 0) throw new BridgeError('GITHUB_FAILURE', `gh ${args.slice(0, 2).join(' ')} falló: ${(r.stderr || r.stdout).trim().slice(0, 300)}`)
    return r.stdout.trim()
  }
  const numberFromUrl = (url: string) => Number(url.split('/').pop())
  const toInfo = (i: { number: number; url: string; title: string; body: string; state: string }): IssueInfo => ({
    number: i.number,
    url: i.url,
    title: i.title,
    body: i.body ?? '',
    state: i.state.toLowerCase() === 'open' ? 'open' : 'closed',
  })
  return {
    async findApprovalIssue(runId) {
      const title = issueTitleFor(runId)
      const raw = await gh(['issue', 'list', '--state', 'all', '--search', `"${runId}" in:title`, '--limit', '20', '--json', 'number,url,body,title,state'])
      const list = (raw ? JSON.parse(raw) : []) as { number: number; url: string; body: string; title: string; state: string }[]
      const hit = list.find(i => i.title === title)
      return hit ? toInfo(hit) : null
    },
    async getIssue(number) {
      const r = await run('gh', ['issue', 'view', String(number), '--json', 'number,url,body,title,state'], { cwd, timeoutMs: 120_000 })
      if (r.code !== 0 || !r.stdout.trim()) return null
      return toInfo(JSON.parse(r.stdout))
    },
    async createIssue(title, body) {
      const url = await gh(['issue', 'create', '--title', title, '--body-file', '-'], body)
      return { number: numberFromUrl(url), url }
    },
    async updateIssue(number, body) {
      await gh(['issue', 'edit', String(number), '--body-file', '-'], body)
    },
    async reopenIssue(number) {
      await gh(['issue', 'reopen', String(number)])
    },
    async closeIssue(number) {
      await gh(['issue', 'close', String(number)])
    },
    async commentIssue(number, body) {
      await gh(['issue', 'comment', String(number), '--body-file', '-'], body)
    },
    async listComments(number) {
      const raw = await gh([
        'api',
        `repos/{owner}/{repo}/issues/${number}/comments`,
        '--paginate',
        '--jq',
        '.[] | {author: .user.login, authorType: .user.type, body: .body, createdAt: .created_at}',
      ])
      return raw
        .split(/\r?\n/)
        .filter(Boolean)
        .map(l => JSON.parse(l) as IssueComment)
    },
    async createPullRequest({ title, body, head, base }) {
      if (base !== PR_BASE) throw new BridgeError('UNSAFE_BRANCH', `Los PRs del agente solo van a ${PR_BASE}, no a ${base}.`)
      return gh(['pr', 'create', '--base', base, '--head', head, '--title', title, '--body-file', '-'], body)
    },
    async commentPullRequest(prUrl, body) {
      await gh(['pr', 'comment', prUrl, '--body-file', '-'], body)
    },
    async dispatchCi(branch) {
      await gh(['workflow', 'run', 'ci.yml', '--ref', branch])
    },
    async waitForCi(branch, sha, timeoutMs) {
      const deadline = Date.now() + timeoutMs
      for (;;) {
        const raw = await gh(['run', 'list', '--workflow', 'ci.yml', '--branch', branch, '--event', 'workflow_dispatch', '--limit', '10', '--json', 'status,conclusion,headSha,url'])
        const runs = (raw ? JSON.parse(raw) : []) as { status: string; conclusion: string | null; headSha: string; url: string }[]
        const mine = runs.find(r => r.headSha === sha)
        if (mine && mine.status === 'completed') {
          const c = mine.conclusion ?? 'unknown'
          const conclusion = c === 'success' || c === 'failure' || c === 'cancelled' ? c : 'unknown'
          return { conclusion, url: mine.url }
        }
        if (Date.now() >= deadline) return { conclusion: 'timed_out', url: mine?.url ?? null }
        await sleep(pollMs)
      }
    },
  }
}
