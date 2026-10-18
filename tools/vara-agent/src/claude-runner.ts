/**
 * Ejecuta Claude Code en modo no interactivo (`claude -p`) con permisos acotados.
 * Nunca usa --dangerously-skip-permissions. Claude NO hace commit ni push: lo hace el bridge.
 * Callers: index.ts. Usa un CommandRunner inyectado.
 */

import { extractJson, redactSecrets } from './validations'
import { BridgeError, type CommandRunner, type Usage } from './types'

export interface ClaudeClient {
  run(task: string, opts: { readOnly: boolean; maxTurns: number }): Promise<{ raw: unknown; usage?: Usage; numTurns?: number }>
}

export const READ_ONLY_TOOLS = ['Read', 'Glob', 'Grep', 'Bash(git status *)', 'Bash(git diff *)', 'Bash(git log *)', 'Bash(git ls-files *)']

export const WRITE_TOOLS = [
  ...READ_ONLY_TOOLS,
  'Edit',
  'Write',
  'Bash(npm run typecheck *)',
  'Bash(npm run lint *)',
  'Bash(npm run test *)',
  'Bash(npm run build *)',
  'Bash(npx vitest *)',
  'Bash(npx tsc *)',
]

export const DISALLOWED_TOOLS = [
  'WebFetch',
  'WebSearch',
  'Bash(git push *)',
  'Bash(git commit *)',
  'Bash(git checkout *)',
  'Bash(git switch *)',
  'Bash(git merge *)',
  'Bash(git rebase *)',
  'Bash(git reset *)',
  'Bash(gh *)',
  'Bash(vercel *)',
  'Bash(supabase *)',
  'Bash(curl *)',
  'Bash(wget *)',
  'Bash(rm *)',
  'Bash(del *)',
  'Bash(printenv *)',
  'Bash(env *)',
  'Read(.env*)',
  'Edit(.env*)',
  'Write(.env*)',
  'Edit(.github/workflows/vara-agent.yml)',
  'Write(.github/workflows/vara-agent.yml)',
  'Edit(tools/vara-agent/**)',
  'Write(tools/vara-agent/**)',
]

/**
 * Variables de entorno que Claude Code puede ver. Lista blanca: todo lo demás (OPENAI_API_KEY, GH_TOKEN,
 * GITHUB_TOKEN, Supabase, Bright Data, Gemini, cualquier otro secreto) NO se hereda.
 */
export const CLAUDE_ENV_ALLOWLIST = [
  // Autenticación de Claude (una de las dos)
  'ANTHROPIC_API_KEY',
  'CLAUDE_CODE_OAUTH_TOKEN',
  // Sistema y shell
  'PATH',
  'Path',
  'PATHEXT',
  'HOME',
  'USER',
  'USERNAME',
  'USERPROFILE',
  'APPDATA',
  'LOCALAPPDATA',
  'SYSTEMROOT',
  'SystemRoot',
  'windir',
  'COMSPEC',
  'ProgramFiles',
  'ProgramData',
  'SHELL',
  'TERM',
  'LANG',
  'LC_ALL',
  'TZ',
  'CI',
  // Temporales y caché
  'TEMP',
  'TMP',
  'TMPDIR',
  'XDG_CONFIG_HOME',
  'XDG_CACHE_HOME',
  'XDG_DATA_HOME',
] as const

export function buildClaudeEnv(source: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of CLAUDE_ENV_ALLOWLIST) {
    const v = source[key]
    if (v !== undefined && v !== '') out[key] = v
  }
  return out
}

export interface ClaudeRunnerConfig {
  model: string
  cwd?: string
  /** Entorno de origen (por defecto process.env). Claude recibe solo lo que permite CLAUDE_ENV_ALLOWLIST. */
  sourceEnv?: Record<string, string | undefined>
  /** JSON Schema (texto) de claude-result.schema.json. */
  resultSchema: string
  systemPrompt: string
  timeoutMs?: number
  secrets?: string[]
}

export function buildClaudeArgs(cfg: ClaudeRunnerConfig, opts: { readOnly: boolean; maxTurns: number }): string[] {
  return [
    '-p',
    '--output-format',
    'json',
    '--model',
    cfg.model,
    '--max-turns',
    String(opts.maxTurns),
    '--permission-mode',
    'dontAsk',
    '--allowedTools',
    (opts.readOnly ? READ_ONLY_TOOLS : WRITE_TOOLS).join(','),
    '--disallowedTools',
    DISALLOWED_TOOLS.join(','),
    '--json-schema',
    cfg.resultSchema,
    '--no-session-persistence',
    '--append-system-prompt',
    cfg.systemPrompt,
  ]
}

export function buildClaudePrompt(task: string, readOnly: boolean): string {
  return [
    'Sos el implementador de VARA. Hacé SOLO la tarea que sigue.',
    readOnly
      ? 'Esta tarea es de SOLO LECTURA: no crees, edites ni borres archivos.'
      : 'Podés editar archivos del repo. No hagas commit ni push: lo hace el bridge.',
    'Prohibido: tocar producción, master/main, Supabase producción, secretos, .env, el propio bridge.',
    'Al terminar, tu respuesta final es el objeto JSON del esquema (status, summary, files_changed, tests, risks, questions, suggested_next_step).',
    '',
    'TAREA:',
    task,
  ].join('\n')
}

interface CliOutput {
  is_error?: boolean
  subtype?: string
  result?: string
  structured_output?: unknown
  num_turns?: number
  total_cost_usd?: number
  usage?: { input_tokens?: number; output_tokens?: number }
}

export function createClaudeRunner(run: CommandRunner, cfg: ClaudeRunnerConfig): ClaudeClient {
  const secrets = cfg.secrets ?? []
  return {
    async run(task, opts) {
      const r = await run('claude', buildClaudeArgs(cfg, opts), {
        cwd: cfg.cwd,
        env: buildClaudeEnv(cfg.sourceEnv ?? process.env),
        input: buildClaudePrompt(task, opts.readOnly),
        timeoutMs: cfg.timeoutMs ?? 20 * 60_000,
      })
      if (r.timedOut) throw new BridgeError('CLAUDE_FAILURE', 'Claude Code superó el tiempo máximo.')
      let out: CliOutput
      try {
        out = JSON.parse(r.stdout) as CliOutput
      } catch {
        throw new BridgeError('CLAUDE_FAILURE', redactSecrets(`Claude Code no devolvió JSON (código ${r.code}): ${(r.stderr || r.stdout).slice(0, 300)}`, secrets))
      }
      if (r.code !== 0 || out.is_error || (out.subtype && out.subtype !== 'success')) {
        throw new BridgeError('CLAUDE_FAILURE', redactSecrets(`Claude Code terminó con error (${out.subtype ?? r.code}): ${(out.result ?? r.stderr).slice(0, 300)}`, secrets))
      }
      const raw = out.structured_output ?? extractJson(out.result ?? '')
      return {
        raw,
        numTurns: out.num_turns,
        usage: {
          inputTokens: out.usage?.input_tokens ?? 0,
          outputTokens: out.usage?.output_tokens ?? 0,
          costUsd: out.total_cost_usd,
        },
      }
    },
  }
}
