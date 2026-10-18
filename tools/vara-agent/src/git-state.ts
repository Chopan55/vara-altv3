/**
 * Estado y operaciones de git del bridge. Solo trabaja sobre ramas agent/run-*; nunca empuja a
 * master/main/integracion ni fuerza pushes. Callers: index.ts. Usa un CommandRunner inyectado.
 */

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { BridgeError, type CommandRunner, type GitState } from './types'
import { assertSafeAgentBranch, isProtectedBranch } from './validations'

const MAX_DIFF_CHARS = 20_000

/** Huella de cada archivo "sucio" del working tree: ruta → estado de git + hash del contenido. */
export type Fingerprint = Record<string, string>

export interface StatusEntry {
  xy: string
  file: string
}

/** Parsea `git status --porcelain -z`: rutas crudas (sin comillas ni escapes). Los renombres traen la ruta vieja como entrada extra. */
export function parseStatusZ(raw: string): StatusEntry[] {
  const parts = raw.split('\0')
  const out: StatusEntry[] = []
  for (let i = 0; i < parts.length; i++) {
    const entry = parts[i]
    if (entry.length < 4) continue
    const xy = entry.slice(0, 2)
    out.push({ xy, file: entry.slice(3) })
    if (xy.includes('R') || xy.includes('C')) i++
  }
  return out
}

/**
 * Archivos cuya huella cambió entre dos fotos del working tree: nuevos, modificados (incluso los que ya estaban sucios
 * y se volvieron a tocar), eliminados o revertidos. Los que no cambiaron desde el baseline se ignoran.
 */
export function diffFingerprints(baseline: Fingerprint, now: Fingerprint): string[] {
  const changed = new Set<string>()
  for (const f of Object.keys(now)) if (baseline[f] !== now[f]) changed.add(f)
  for (const f of Object.keys(baseline)) if (!(f in now)) changed.add(f)
  return [...changed].filter(f => !f.startsWith('.agent-runs/')).sort()
}

function hashFile(abs: string): string {
  try {
    return createHash('sha1').update(readFileSync(abs)).digest('hex')
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    return code === 'ENOENT' ? 'MISSING' : `UNREADABLE:${code ?? 'error'}`
  }
}

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

  private async statusEntries(): Promise<StatusEntry[]> {
    const r = await this.run('git', ['status', '--porcelain', '-uall', '-z'], { cwd: this.cwd, timeoutMs: 120_000 })
    if (r.code !== 0) throw new BridgeError('CONFIG', `git status falló: ${(r.stderr || r.stdout).trim().slice(0, 300)}`)
    return parseStatusZ(r.stdout).filter(e => !e.file.startsWith('.agent-runs/'))
  }

  /** Todos los archivos sucios ahora (incluye los que ya estaban antes de la corrida). */
  async changedFiles(): Promise<string[]> {
    return (await this.statusEntries()).map(e => e.file)
  }

  /** Foto del working tree para comparar contra el baseline y detectar solo lo que cambió durante la corrida. */
  async fingerprint(): Promise<Fingerprint> {
    const root = this.cwd ?? process.cwd()
    const fp: Fingerprint = {}
    for (const { xy, file } of await this.statusEntries()) fp[file] = `${xy}:${hashFile(path.join(root, file))}`
    return fp
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

  /**
   * Hace commit solo de `paths` (los archivos que cambió la corrida; los que ya estaban sucios antes no entran).
   * Sin `paths` hace commit de todo salvo .agent-runs. Devuelve el SHA o null si no había cambios.
   */
  async commitAll(message: string, paths?: string[]): Promise<string | null> {
    const branch = await this.currentBranch()
    assertSafeAgentBranch(branch)
    if (paths) {
      if (paths.length === 0) return null
      await this.out(['add', '-A', '--', ...paths])
    } else {
      await this.out(['add', '-A'])
    }
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
