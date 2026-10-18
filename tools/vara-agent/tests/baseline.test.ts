/** Correcciones del primer dry-run real: esquema sanitizado para Claude y baseline del working tree. */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildClaudeArgs, createClaudeRunner, sanitizeSchemaForClaude } from '../src/claude-runner'
import { Git, diffFingerprints, parseStatusZ } from '../src/git-state'
import { nodeRunner, runBridge } from '../src/index'
import type { CommandRunner } from '../src/types'
import { baseConfig, claudeResult, dec, doneDec, fakeClaude, fakeGh, fakeGit, fakeManager, makeDeps } from './helpers'

// Los tests con git real tardan ~1 s cada uno en Windows; margen amplio para CI lento.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 })

const DRY_GOAL ='Revisá el estado actual del proyecto VARA y proponé las 3 próximas tareas técnicas prioritarias. No modifiques código.'
const SCHEMA_PATH = fileURLToPath(new URL('../../../agent/schemas/claude-result.schema.json', import.meta.url))

describe('esquema sanitizado para Claude Code', () => {
  const original = readFileSync(SCHEMA_PATH, 'utf8')
  const parsed = JSON.parse(original) as Record<string, unknown>

  it('el esquema canónico del repo conserva $schema y $id', () => {
    expect(parsed.$schema).toBeTruthy()
    expect(parsed.$id).toBeTruthy()
  })

  it('la copia que recibe --json-schema no los contiene', () => {
    const args = buildClaudeArgs({ model: 'sonnet', resultSchema: original, systemPrompt: 's' }, { readOnly: true, maxTurns: 5 })
    const passed = args[args.indexOf('--json-schema') + 1]
    expect(passed).not.toContain('$schema')
    expect(passed).not.toContain('$id')
    expect(() => JSON.parse(passed)).not.toThrow()
  })

  it('es estructuralmente equivalente: solo faltan los metadatos', () => {
    const { $schema: _a, $id: _b, ...expected } = parsed
    const sanitized = JSON.parse(sanitizeSchemaForClaude(original)) as Record<string, unknown>
    expect(sanitized).toEqual(expected)
    for (const k of ['type', 'additionalProperties', 'required', 'properties']) expect(sanitized[k]).toEqual(parsed[k])
    expect((sanitized.properties as Record<string, { enum?: string[] }>).status.enum).toEqual(['COMPLETED', 'PARTIAL', 'BLOCKED'])
  })

  it('quita $schema/$id también en niveles anidados y no modifica el texto original', () => {
    const text = JSON.stringify({ $schema: 'x', $id: 'y', type: 'object', properties: { a: { $id: 'z', type: 'string', enum: ['A'] } } })
    const out = JSON.parse(sanitizeSchemaForClaude(text))
    expect(out).toEqual({ type: 'object', properties: { a: { type: 'string', enum: ['A'] } } })
    expect(text).toContain('$schema')
  })

  it('el runner real lanza claude con el esquema sanitizado', async () => {
    let seenArgs: string[] = []
    const run: CommandRunner = async (_c, args) => {
      seenArgs = args
      return { code: 0, stdout: JSON.stringify({ subtype: 'success', is_error: false, structured_output: claudeResult() }), stderr: '', timedOut: false }
    }
    await createClaudeRunner(run, { model: 'sonnet', resultSchema: original, systemPrompt: 's', sourceEnv: {} }).run('t', { readOnly: true, maxTurns: 3 })
    expect(seenArgs[seenArgs.indexOf('--json-schema') + 1]).not.toMatch(/\$schema|\$id/)
  })
})

describe('parseStatusZ', () => {
  it('lee rutas crudas, con espacios y unicode, y salta el origen de los renombres', () => {
    const raw = [' M a.txt', '?? 🗺️ Índice VARA.md', 'R  nuevo.txt', 'viejo.txt', '?? con espacio.md', ''].join('\0')
    expect(parseStatusZ(raw)).toEqual([
      { xy: ' M', file: 'a.txt' },
      { xy: '??', file: '🗺️ Índice VARA.md' },
      { xy: 'R ', file: 'nuevo.txt' },
      { xy: '??', file: 'con espacio.md' },
    ])
  })
})

describe('baseline del working tree (git real en un repo temporal)', () => {
  let dir: string
  let git: Git
  const sh = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' })
  const write = (f: string, content: string) => {
    mkdirSync(path.dirname(path.join(dir, f)), { recursive: true })
    writeFileSync(path.join(dir, f), content)
  }
  const read = (f: string) => readFileSync(path.join(dir, f), 'utf8')
  const UNICODE = '🗺️ Índice VARA.md'

  let baseline: Record<string, string>
  const delta = async () => diffFingerprints(baseline, await git.fingerprint())

  beforeEach(async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'vara-agent-baseline-'))
    sh('init', '-q', '-b', 'integracion')
    sh('config', 'user.email', 't@t.test')
    sh('config', 'user.name', 'test')
    sh('config', 'core.autocrlf', 'false')
    write('a.txt', 'a original\n')
    write('b.txt', 'b original\n')
    write('c.txt', 'c original\n')
    sh('add', '-A')
    sh('commit', '-q', '-m', 'base')
    // Estado previo a la corrida: un tracked modificado y tres sin versionar (uno con unicode)
    write('a.txt', 'a ya modificado antes\n')
    write('pre-untracked.md', 'ya estaba\n')
    write('pre-gone.txt', 'ya estaba, Claude lo borra\n')
    write(UNICODE, 'ya estaba, nadie lo toca\n')
    git = new Git(nodeRunner, dir)
    baseline = await git.fingerprint()
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('el baseline ve los 4 archivos previos', () => {
    expect(Object.keys(baseline).sort()).toEqual(['a.txt', 'pre-gone.txt', 'pre-untracked.md', UNICODE].sort())
  })

  it('preexistentes sin cambios adicionales → ignorados', async () => {
    expect(await delta()).toEqual([])
  })

  it('archivo nuevo creado por Claude', async () => {
    write('new.txt', 'nuevo\n')
    expect(await delta()).toEqual(['new.txt'])
  })

  it('archivo existente (limpio) modificado por Claude', async () => {
    write('b.txt', 'b cambiado por claude\n')
    expect(await delta()).toEqual(['b.txt'])
  })

  it('archivo preexistente sucio que Claude vuelve a modificar', async () => {
    write('a.txt', 'a modificado OTRA vez por claude\n')
    expect(await delta()).toEqual(['a.txt'])
    write('a.txt', 'a ya modificado antes\n')
    expect(await delta()).toEqual([])
  })

  it('archivo preexistente sin versionar que Claude modifica', async () => {
    write('pre-untracked.md', 'ya estaba\n+ una línea de claude\n')
    expect(await delta()).toEqual(['pre-untracked.md'])
  })

  it('archivo eliminado por Claude (versionado y preexistente sin versionar)', async () => {
    rmSync(path.join(dir, 'c.txt'))
    rmSync(path.join(dir, 'pre-gone.txt'))
    expect(await delta()).toEqual(['c.txt', 'pre-gone.txt'])
  })

  it('archivo sucio revertido por Claude también cuenta como cambio', async () => {
    sh('checkout', '--', 'a.txt')
    expect(await delta()).toEqual(['a.txt'])
  })

  it('el archivo con unicode que nadie toca sigue ignorado aunque Claude cambie otros', async () => {
    write('b.txt', 'x\n')
    write('new.txt', 'y\n')
    expect(await delta()).toEqual(['b.txt', 'new.txt'])
  })

  it('commitAll con paths no arrastra los archivos que ya estaban sucios', async () => {
    sh('checkout', '-q', '-b', 'agent/run-20261017-120000-baseline')
    write('new.txt', 'nuevo\n')
    const sha = await git.commitAll('feat: solo lo de la corrida', await delta())
    expect(sha).toMatch(/^[0-9a-f]{40}$/)
    expect(sh('show', '--name-only', '--format=', 'HEAD').trim().split('\n')).toEqual(['new.txt'])
    // Los 4 preexistentes siguen exactamente como estaban
    expect(Object.keys(await git.fingerprint()).sort()).toEqual(['a.txt', 'pre-gone.txt', 'pre-untracked.md', UNICODE].sort())
    expect(read('a.txt')).toBe('a ya modificado antes\n')
    expect(read('pre-untracked.md')).toBe('ya estaba\n')
    expect(existsSync(path.join(dir, UNICODE))).toBe(true)
  })

  it('commitAll con lista vacía no hace commit', async () => {
    sh('checkout', '-q', '-b', 'agent/run-20261017-120000-vacio')
    expect(await git.commitAll('nada', [])).toBeNull()
  })
})

describe('runBridge con archivos preexistentes sucios', () => {
  it('los preexistentes no generan falso positivo en una corrida de solo lectura', async () => {
    const git = fakeGit()
    git.pre = { '.vercel.stale-bak/README.txt': '??:h1', 'docs/VARA_DEPLOYMENT_AUDIT.md': '??:h2', 'public/vara/avatar-1024.png': '??:h3' }
    const manager = fakeManager([dec(), doneDec()])
    const claude = fakeClaude([claudeResult()])
    const { deps } = makeDeps({ manager, claude, git })
    const rec = await runBridge(deps, baseConfig({ goal: DRY_GOAL, dryRun: true }))
    expect(rec.final_status).toBe('DONE')
    expect(rec.rounds.every(r => r.changedFiles.length === 0)).toBe(true)
  })

  it('si Claude vuelve a tocar un preexistente en una corrida de solo lectura, se detecta', async () => {
    const git = fakeGit()
    git.pre = { 'docs/VARA_DEPLOYMENT_AUDIT.md': '??:h2' }
    const claude = fakeClaude([claudeResult()], () => {
      git.pre['docs/VARA_DEPLOYMENT_AUDIT.md'] = '??:OTRO'
    })
    const { deps } = makeDeps({ manager: fakeManager([dec(), doneDec()]), claude, git })
    const rec = await runBridge(deps, baseConfig({ goal: DRY_GOAL, dryRun: true }))
    expect(rec.final_status).toBe('WAITING_FOR_HUMAN')
    expect(rec.rounds[0].changedFiles).toEqual(['docs/VARA_DEPLOYMENT_AUDIT.md'])
  })

  it('un cambio real se commitea sin los preexistentes', async () => {
    const git = fakeGit()
    git.pre = { 'docs/VARA_DEPLOYMENT_AUDIT.md': '??:h2' }
    const claude = fakeClaude([claudeResult()], () => git.changed.push('docs/AGENT_BRIDGE_TEST.md'))
    const gh = fakeGh()
    const { deps } = makeDeps({ manager: fakeManager([dec(), doneDec()]), claude, git, gh })
    const rec = await runBridge(deps, baseConfig())
    expect(rec.final_status).toBe('DONE')
    expect(git.committedPaths).toEqual([['docs/AGENT_BRIDGE_TEST.md']])
  })
})
