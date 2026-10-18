/**
 * Estado y operaciones de git del bridge. Solo trabaja sobre ramas agent/run-*; nunca empuja a
 * master/main/integracion ni fuerza pushes. Callers: index.ts. Usa un CommandRunner inyectado.
 */

import { BridgeError, type CommandRunner, type GitState } from './types'
import { assertSafeAgentBranch, isProtectedBranch } from './validations'

const MAX_DIFF_CHARS = 20_000

export function timestamp(now: Date): string {
  const p = (n: number, l = 2) => String(n).padStart(l, '0')
  return `${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}-${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}`
}

export function slugify(goal: string): string {
  const slug = goal
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')
  return slug || 'tarea'
}

export function makeBranchName(now: Date, goal: string): string {
  return `agent/run-${timestamp(now)}-${slugify(goal)}`
}

const AUTHOR = ['-c', 'user.name=vara-agent', '-c', 'user.email=vara-agent@users.noreply.github.com']

export class Git {
  constructor(
    private readonly run: CommandRunner,
    private readonly cwd?: string,
  ) {}

  private async out(args: string[], allowFail = false): Promise<string> {
    const r = await this.run('git', args, { cwd: this.cwd, timeoutMs: 120_000 })
    if (r.code !== 0 && !allowFail) {
      throw new BridgeError('CONFIG', `git ${args[0]} falló: ${(r.stderr || r.stdout).trim().slice(0, 300)}`)
    }
    return r.stdout.trim()
  }

  currentBranch(): Promise<string> {
    return this.out(['rev-parse', '--abbrev-ref', 'HEAD'])
  }

  head(): Promise<string> {
    return this.out(['rev-parse', 'HEAD'])
  }

  async changedFiles(): Promise<string[]> {
    const raw = await this.out(['status', '--porcelain', '-uall'])
    return raw
      .split(/\r?\n/)
      .filter(Boolean)
      .map(l => l.slice(3).replace(/^.* -> /, '').replace(/^"|"$/g, ''))
      .filter(f => !f.startsWith('.agent-runs/'))
  }

  async isClean(): Promise<boolean> {
    return (await this.changedFiles()).length === 0
  }

  /** Crea la rama de trabajo desde la base. Falla si el nombre no es una rama agent/run-* segura. */
  async createWorkBranch(name: string, base: string): Promise<void> {
    assertSafeAgentBranch(name)
    await this.out(['checkout', '-b', name, base])
  }

  async checkoutWorkBranch(name: string): Promise<void> {
    assertSafeAgentBranch(name)
    await this.out(['checkout', name])
  }

  async snapshot(baseRef = 'HEAD'): Promise<GitState> {
    const [branch, head, status, files, log] = await Promise.all([
      this.currentBranch(),
      this.head(),
      this.out(['status', '--short']),
      this.changedFiles(),
      this.out(['log', '--oneline', '-n', '5'], true),
    ])
    const diff = await this.out(['diff', baseRef, '--stat', '--patch', '--', '.', ':(exclude).agent-runs'], true)
    return {
      branch,
      head,
      status,
      changedFiles: files,
      diff: diff.slice(0, MAX_DIFF_CHARS),
      diffTruncated: diff.length > MAX_DIFF_CHARS,
      log,
    }
  }

  /** Hace commit de todo salvo .agent-runs. Devuelve el SHA o null si no había cambios. */
  async commitAll(message: string): Promise<string | null> {
    const branch = await this.currentBranch()
    assertSafeAgentBranch(branch)
    await this.out(['add', '-A'])
    await this.out(['reset', '-q', '--', '.agent-runs'], true)
    const staged = await this.run('git', ['diff', '--cached', '--quiet'], { cwd: this.cwd })
    if (staged.code === 0) return null
    await this.out([...AUTHOR, 'commit', '-m', message])
    return this.head()
  }

  /** Push sin force, solo de ramas agent/run-*. */
  async push(branch: string): Promise<void> {
    if (isProtectedBranch(branch)) throw new BridgeError('UNSAFE_BRANCH', `No se puede empujar a ${branch}.`)
    assertSafeAgentBranch(branch)
    await this.out(['push', '-u', 'origin', branch])
  }
}
