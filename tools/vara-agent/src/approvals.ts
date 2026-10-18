/**
 * Aprobación humana vía GitHub Issue "VARA Agent — Approval Required".
 * Solo se aceptan comandos (APPROVE/REJECT/CONTINUE/STOP) del actor Chopan55; el resto se ignora.
 * Callers: index.ts. GitHub se accede por la interfaz GitHubApi (gh CLI en producción, fake en tests).
 */

import { decodeState, encodeState } from './run-state'
import { BridgeError, type CommandRunner, type HumanDecision, type ResumeState, type RunRecord } from './types'

export const AUTHORIZED_ACTOR = 'Chopan55'
export const ISSUE_TITLE = 'VARA Agent — Approval Required'
export const PR_BASE = 'integracion'

export interface IssueComment {
  author: string
  body: string
  createdAt: string
}

export interface GitHubApi {
  findOpenApprovalIssue(): Promise<{ number: number; url: string; body: string } | null>
  createIssue(title: string, body: string): Promise<{ number: number; url: string }>
  updateIssue(number: number, body: string): Promise<void>
  commentIssue(number: number, body: string): Promise<void>
  listComments(number: number): Promise<IssueComment[]>
  createPullRequest(args: { title: string; body: string; head: string; base: string }): Promise<string>
}

const COMMAND_RE = /^\s*(APPROVE|REJECT|CONTINUE|STOP)\b[:\s-]*(.*)$/i

export function parseHumanCommand(body: string): { command: HumanDecision['command']; note: string } | null {
  const firstLine = body.split(/\r?\n/).find(l => l.trim())
  if (!firstLine) return null
  const m = COMMAND_RE.exec(firstLine)
  if (!m) return null
  return { command: m[1].toUpperCase() as HumanDecision['command'], note: m[2].trim() }
}

/** Toma el comando más reciente del actor autorizado. Los comentarios de otros usuarios se ignoran. */
export function pickHumanDecision(
  comments: IssueComment[],
  actor: string = AUTHORIZED_ACTOR,
): { decision: HumanDecision | null; ignored: number } {
  let decision: HumanDecision | null = null
  let ignored = 0
  const sorted = [...comments].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  for (const c of sorted) {
    const parsed = parseHumanCommand(c.body)
    if (!parsed) continue
    if (c.author.toLowerCase() !== actor.toLowerCase()) {
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
    `### Cómo responder\nComentá en este issue, en la primera línea, una sola palabra: \`APPROVE\`, \`REJECT\`, \`CONTINUE\` o \`STOP\` (podés agregar una nota después). Solo vale lo que comenta @${AUTHORIZED_ACTOR}.\nDespués corré el workflow **VARA Agent Bridge** con \`resume_issue\` = ${'`'}el número de este issue${'`'}.`,
    args.links.length ? `### Links\n${args.links.map(l => `- ${l}`).join('\n')}` : '',
    `<!-- vara-agent-state:${encodeState(args.state)} -->`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** Crea el issue de aprobación, o actualiza el abierto si ya existe. Devuelve su URL. */
export async function requestApproval(gh: GitHubApi, body: string): Promise<{ number: number; url: string }> {
  const existing = await gh.findOpenApprovalIssue()
  if (existing) {
    await gh.updateIssue(existing.number, body)
    await gh.commentIssue(existing.number, '[vara-agent] El agente actualizó la pregunta. Respondé con APPROVE, REJECT, CONTINUE o STOP.')
    return { number: existing.number, url: existing.url }
  }
  return gh.createIssue(ISSUE_TITLE, body)
}

// ───────────────────────── Implementación con gh CLI ─────────────────────────

export function createGhApi(run: CommandRunner, cwd?: string): GitHubApi {
  const gh = async (args: string[], input?: string): Promise<string> => {
    const r = await run('gh', args, { cwd, input, timeoutMs: 120_000 })
    if (r.code !== 0) throw new BridgeError('GITHUB_FAILURE', `gh ${args.slice(0, 2).join(' ')} falló: ${(r.stderr || r.stdout).trim().slice(0, 300)}`)
    return r.stdout.trim()
  }
  const numberFromUrl = (url: string) => Number(url.split('/').pop())
  return {
    async findOpenApprovalIssue() {
      const raw = await gh(['issue', 'list', '--state', 'open', '--search', `"${ISSUE_TITLE}" in:title`, '--json', 'number,url,body,title'])
      const list = (raw ? JSON.parse(raw) : []) as { number: number; url: string; body: string; title: string }[]
      const hit = list.find(i => i.title === ISSUE_TITLE)
      return hit ? { number: hit.number, url: hit.url, body: hit.body } : null
    },
    async createIssue(title, body) {
      const url = await gh(['issue', 'create', '--title', title, '--body-file', '-'], body)
      return { number: numberFromUrl(url), url }
    },
    async updateIssue(number, body) {
      await gh(['issue', 'edit', String(number), '--body-file', '-'], body)
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
        '.[] | {author: .user.login, body: .body, createdAt: .created_at}',
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
  }
}
