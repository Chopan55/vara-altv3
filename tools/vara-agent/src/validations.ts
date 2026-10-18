/**
 * Validaciones y guardas de seguridad del bridge. Todo acá es determinístico y se prueba sin red:
 * - lectura robusta de JSON de los modelos,
 * - validación de la decisión del Manager y del resultado de Claude,
 * - redacción de secretos,
 * - detección de acciones prohibidas (producción, master, secretos),
 * - ramas y rutas protegidas,
 * - ejecución de las validaciones del proyecto (typecheck, lint, tests, build).
 */

import {
  BridgeError,
  CLAUDE_STATUSES,
  DECISIONS,
  type CheckEntry,
  type CheckName,
  type ClaudeResult,
  type CommandRunner,
  type ManagerDecision,
  type Validations,
} from './types'

// ───────────────────────────── JSON ─────────────────────────────

/** Saca un objeto JSON de una respuesta de modelo: JSON puro, bloque ```json o primer objeto balanceado. */
export function extractJson(text: string): unknown {
  const t = text.trim()
  const attempt = (s: string): unknown => {
    try {
      return JSON.parse(s)
    } catch {
      return undefined
    }
  }
  let v = attempt(t)
  if (v !== undefined) return v

  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) {
    v = attempt(fenced[1].trim())
    if (v !== undefined) return v
  }

  const start = t.indexOf('{')
  if (start >= 0) {
    let depth = 0
    let inString = false
    let escaped = false
    for (let i = start; i < t.length; i++) {
      const c = t[i]
      if (inString) {
        if (escaped) escaped = false
        else if (c === '\\') escaped = true
        else if (c === '"') inString = false
        continue
      }
      if (c === '"') inString = true
      else if (c === '{') depth++
      else if (c === '}') {
        depth--
        if (depth === 0) {
          v = attempt(t.slice(start, i + 1))
          if (v !== undefined) return v
          break
        }
      }
    }
  }
  throw new BridgeError('INVALID_JSON', 'No se encontró un objeto JSON válido en la respuesta.')
}

// ─────────────────────── Validación de esquemas ───────────────────────

export type Check<T> = { ok: true; value: T } | { ok: false; errors: string[] }

const isString = (v: unknown): v is string => typeof v === 'string'
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isString)
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

function exactKeys(o: Record<string, unknown>, allowed: readonly string[], errors: string[]): void {
  for (const k of Object.keys(o)) if (!allowed.includes(k)) errors.push(`campo no permitido: ${k}`)
  for (const k of allowed) if (!(k in o)) errors.push(`falta el campo: ${k}`)
}

const MANAGER_KEYS = ['decision', 'summary', 'task_for_claude', 'reason', 'risks', 'requires_human', 'human_question', 'confidence'] as const

export function validateManagerDecision(raw: unknown): Check<ManagerDecision> {
  const errors: string[] = []
  if (!isRecord(raw)) return { ok: false, errors: ['la respuesta no es un objeto'] }
  exactKeys(raw, MANAGER_KEYS, errors)

  const decision = raw.decision
  if (!isString(decision) || !(DECISIONS as readonly string[]).includes(decision)) {
    errors.push(`decision inválida (debe ser una de ${DECISIONS.join(', ')})`)
  }
  if (!isString(raw.summary) || !raw.summary.trim()) errors.push('summary debe ser un texto no vacío')
  if (!isString(raw.reason) || !raw.reason.trim()) errors.push('reason debe ser un texto no vacío')
  if (!isString(raw.task_for_claude)) errors.push('task_for_claude debe ser texto')
  if (!isStringArray(raw.risks)) errors.push('risks debe ser una lista de textos')
  if (typeof raw.requires_human !== 'boolean') errors.push('requires_human debe ser true o false')
  if (raw.human_question !== null && !isString(raw.human_question)) errors.push('human_question debe ser texto o null')
  if (typeof raw.confidence !== 'number' || !Number.isFinite(raw.confidence) || raw.confidence < 0 || raw.confidence > 1) {
    errors.push('confidence debe ser un número entre 0 y 1')
  }

  if (errors.length === 0) {
    const d = decision as ManagerDecision['decision']
    const task = (raw.task_for_claude as string).trim()
    const question = raw.human_question as string | null
    if ((d === 'CONTINUE' || d === 'FIX') && !task) errors.push(`${d} requiere task_for_claude`)
    if (d === 'ASK_PANCHO') {
      if (raw.requires_human !== true) errors.push('ASK_PANCHO requiere requires_human=true')
      if (!question || !question.trim()) errors.push('ASK_PANCHO requiere human_question')
    } else {
      if (raw.requires_human !== false) errors.push('requires_human solo puede ser true con ASK_PANCHO')
      if (question !== null) errors.push('human_question debe ser null salvo con ASK_PANCHO')
    }
  }
  if (errors.length) return { ok: false, errors }
  return {
    ok: true,
    value: {
      decision: raw.decision as ManagerDecision['decision'],
      summary: (raw.summary as string).trim(),
      task_for_claude: (raw.task_for_claude as string).trim(),
      reason: (raw.reason as string).trim(),
      risks: raw.risks as string[],
      requires_human: raw.requires_human as boolean,
      human_question: raw.human_question as string | null,
      confidence: raw.confidence as number,
    },
  }
}

const CLAUDE_KEYS = ['status', 'summary', 'files_changed', 'tests', 'risks', 'questions', 'suggested_next_step'] as const
const TEST_KEYS = ['typecheck', 'lint', 'tests', 'build'] as const

export function validateClaudeResult(raw: unknown): Check<ClaudeResult> {
  const errors: string[] = []
  if (!isRecord(raw)) return { ok: false, errors: ['la respuesta no es un objeto'] }
  exactKeys(raw, CLAUDE_KEYS, errors)

  if (!isString(raw.status) || !(CLAUDE_STATUSES as readonly string[]).includes(raw.status)) {
    errors.push(`status inválido (debe ser uno de ${CLAUDE_STATUSES.join(', ')})`)
  }
  if (!isString(raw.summary)) errors.push('summary debe ser texto')
  if (!isStringArray(raw.files_changed)) errors.push('files_changed debe ser una lista de textos')
  if (!isStringArray(raw.risks)) errors.push('risks debe ser una lista de textos')
  if (!isStringArray(raw.questions)) errors.push('questions debe ser una lista de textos')
  if (!isString(raw.suggested_next_step)) errors.push('suggested_next_step debe ser texto')
  if (!isRecord(raw.tests)) {
    errors.push('tests debe ser un objeto')
  } else {
    exactKeys(raw.tests, TEST_KEYS, errors)
    for (const k of TEST_KEYS) if (k in raw.tests && !isString(raw.tests[k])) errors.push(`tests.${k} debe ser texto`)
  }
  if (errors.length) return { ok: false, errors }
  return { ok: true, value: raw as unknown as ClaudeResult }
}

// ───────────────────────── Secretos ─────────────────────────

const SECRET_PATTERNS: RegExp[] = [
  /sk-ant-[A-Za-z0-9_-]{20,}/g,
  /sk-proj-[A-Za-z0-9_-]{20,}/g,
  /sk-[A-Za-z0-9_-]{20,}/g,
  /sb_secret_[A-Za-z0-9_-]{16,}/g,
  /sb_publishable_[A-Za-z0-9_-]{16,}/g,
  /gh[pousr]_[A-Za-z0-9]{30,}/g,
  /github_pat_[A-Za-z0-9_]{30,}/g,
  /AIza[0-9A-Za-z_-]{30,}/g,
  /eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/g,
  /Bearer\s+[A-Za-z0-9._~+/=-]{20,}/gi,
]

const NAMED_SECRET = new RegExp(
  '(OPENAI_API_KEY|ANTHROPIC_API_KEY|CLAUDE_CODE_OAUTH_TOKEN|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|BRIGHTDATA_API_KEY|GITHUB_TOKEN|GH_TOKEN|CRON_SECRET|MARKET_SWEEP_SECRET|GEMINI_API_KEY)\\s*[=:]\\s*[\'"]?[^\\s\'"]{6,}',
  'g',
)

const REDACTED = '[REDACTADO]'

/** Valores de variables de entorno que parecen secretos (para redactarlos aunque no tengan un formato conocido). */
export function collectSecretValues(env: Record<string, string | undefined>): string[] {
  const out: string[] = []
  for (const [name, value] of Object.entries(env)) {
    if (!value || value.length < 8) continue
    if (/(KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL)/i.test(name)) out.push(value)
  }
  return out
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function redactSecrets(text: string, extraValues: string[] = []): string {
  let out = text
  for (const v of extraValues) {
    if (v && v.length >= 8) out = out.replace(new RegExp(escapeRegExp(v), 'g'), REDACTED)
  }
  out = out.replace(NAMED_SECRET, `$1=${REDACTED}`)
  for (const re of SECRET_PATTERNS) out = out.replace(re, REDACTED)
  return out
}

// ──────────────────── Acciones prohibidas ────────────────────

export interface ForbiddenRule {
  id: string
  description: string
  pattern: RegExp
}

/** Referencia del proyecto de producción de Supabase ("VARA MVP"). No es un secreto, pero ningún agente debe nombrarlo en una tarea. */
const PRODUCTION_DB_REF = 'hmvoyigahqfqpoersimr'

export const FORBIDDEN_RULES: ForbiddenRule[] = [
  { id: 'push-protected', description: 'git push a master, main o integracion', pattern: /git\s+push\b[^\n;|&]*\b(master|main|integracion)\b/i },
  { id: 'push-force', description: 'git push forzado', pattern: /git\s+push\b[^\n;|&]*(\s--force\b|\s-f\b|--force-with-lease)/i },
  { id: 'merge-protected', description: 'git merge de master o main', pattern: /git\s+merge\b[^\n;|&]*\b(master|main)\b/i },
  { id: 'checkout-protected', description: 'cambiar a master o main', pattern: /git\s+(checkout|switch)\s+(-\S+\s+)*(master|main)\b/i },
  { id: 'vercel-production', description: 'deploy, promoción o rollback de Vercel', pattern: /vercel\b[^\n;|&]*(--prod\b|\bpromote\b|\brollback\b|\balias\b)/i },
  { id: 'pr-merge', description: 'mergear un Pull Request', pattern: /gh\s+pr\s+merge\b/i },
  { id: 'supabase-write', description: 'aplicar migraciones o cambios con la CLI de Supabase', pattern: /supabase\b[^\n;|&]*\b(db\s+(push|reset)|migration\s+up|link|secrets)\b/i },
  { id: 'destructive-sql', description: 'SQL destructivo (DROP, TRUNCATE, DELETE sin filtro)', pattern: /\b(drop\s+(table|schema|database|column)\b|truncate\s+(table\s+)?\w|delete\s+from\s+\w+\s*(;|$))/i },
  { id: 'production-db', description: 'referencia a la base de producción', pattern: new RegExp(PRODUCTION_DB_REF, 'i') },
  { id: 'skip-permissions', description: 'saltear los permisos de Claude Code', pattern: /--dangerously-skip-permissions/i },
  { id: 'rm-root', description: 'borrado recursivo de raíz o home', pattern: /rm\s+-[a-z]*r[a-z]*\s+(\/|~|\$HOME|\*)(\s|$)/i },
  { id: 'read-env', description: 'leer archivos .env o imprimir el entorno', pattern: /\b(cat|type|more|less|head|tail|printenv)\b[^\n]*(\.env(?!\.example)\b|$)|\bprintenv\b/i },
  { id: 'change-secrets', description: 'cambiar secretos o variables de entorno', pattern: /(gh\s+secret|vercel\s+env\s+(add|rm|pull)|supabase\s+secrets)/i },
]

const NEGATION = /\b(no|nunca|jam[aá]s|never|not|don'?t|do not|sin|prohib\w*|evit\w*|nada de|queda prohibido)\b/i

export interface ForbiddenHit {
  id: string
  description: string
  line: string
}

/**
 * Busca acciones prohibidas en un texto (tarea del Manager, o cualquier instrucción).
 * Las líneas que las nombran para PROHIBIRLAS ("NO hagas git push a master") no cuentan.
 */
export function findForbiddenActions(text: string): ForbiddenHit[] {
  const hits: ForbiddenHit[] = []
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || NEGATION.test(line)) continue
    for (const rule of FORBIDDEN_RULES) {
      if (rule.pattern.test(line)) hits.push({ id: rule.id, description: rule.description, line: line.slice(0, 200) })
    }
  }
  return hits
}

// ─────────────────────── Ramas y rutas ───────────────────────

export const PROTECTED_BRANCHES = ['master', 'main', 'integracion'] as const

const cleanBranch = (name: string) => name.trim().replace(/^refs\/heads\//, '').replace(/^origin\//, '')

export function isProtectedBranch(name: string): boolean {
  return (PROTECTED_BRANCHES as readonly string[]).includes(cleanBranch(name))
}

export function isSafeAgentBranch(name: string): boolean {
  return /^agent\/run-\d{8}-\d{6}-[a-z0-9-]{1,40}$/.test(name)
}

export function assertSafeAgentBranch(name: string): void {
  if (isProtectedBranch(name) || !isSafeAgentBranch(name)) {
    throw new BridgeError('UNSAFE_BRANCH', `La rama "${name}" no es una rama de trabajo permitida (solo agent/run-<fecha>-<hora>-<tema>).`)
  }
}

/** Archivos que un agente no puede cambiar solo: su propia seguridad, las reglas y los secretos. */
export const PROTECTED_PATHS = [
  'tools/vara-agent/',
  '.github/workflows/vara-agent.yml',
  'agent/RELEASE_RULES.md',
  'agent/ORCHESTRATOR_RULES.md',
  'agent/schemas/',
] as const

export function touchedProtectedPaths(files: string[]): string[] {
  const normalized = files.map(f => f.replace(/\\/g, '/'))
  return normalized.filter(
    f => PROTECTED_PATHS.some(p => (p.endsWith('/') ? f.startsWith(p) : f === p)) || /(^|\/)\.env(\.[A-Za-z0-9_-]+)?$/.test(f) && !/\.env\.example$/.test(f),
  )
}

/** Para detectar el mismo bloqueo repetido: ignora números, rutas y mayúsculas. */
export function normalizeBlocker(text: string): string {
  return text
    .toLowerCase()
    .replace(/[0-9]+/g, '#')
    .replace(/[^a-záéíóúñü# ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)
}

/** Objetivos de solo análisis: "no modifiques código", "solo lectura". */
export function isReadOnlyGoal(goal: string): boolean {
  return /\b(no\s+modifiques?|sin\s+modificar|no\s+cambies?|solo\s+(lectura|an[aá]lisis)|read[- ]only|do\s+not\s+modify|don'?t\s+modify)\b/i.test(goal)
}

/** El objetivo habla de producción: al terminar queda en READY_FOR_PRODUCTION (se detiene, no despliega). */
export function mentionsProduction(goal: string): boolean {
  return /\b(producci[oó]n|production|deploy|desplegar|promover|promote)\b/i.test(goal)
}

// ───────────────────── Validaciones del proyecto ─────────────────────

export const VALIDATION_COMMANDS: Record<CheckName, { cmd: string; args: string[] }> = {
  typecheck: { cmd: 'npm', args: ['run', 'typecheck'] },
  lint: { cmd: 'npm', args: ['run', 'lint'] },
  tests: { cmd: 'npm', args: ['run', 'test'] },
  build: { cmd: 'npm', args: ['run', 'build'] },
}

const CHECK_NAMES = Object.keys(VALIDATION_COMMANDS) as CheckName[]

export function skippedValidations(reason: string): Validations {
  const entry: CheckEntry = { status: 'SKIPPED', output: reason, durationMs: 0 }
  return { typecheck: { ...entry }, lint: { ...entry }, tests: { ...entry }, build: { ...entry } }
}

export function tail(text: string, max = 3000): string {
  return text.length <= max ? text : `…${text.slice(text.length - max)}`
}

export async function runValidations(
  run: CommandRunner,
  opts: { cwd?: string; timeoutMs?: number; secrets?: string[]; env?: Record<string, string | undefined> } = {},
): Promise<Validations> {
  const result = {} as Validations
  for (const name of CHECK_NAMES) {
    const { cmd, args } = VALIDATION_COMMANDS[name]
    const started = Date.now()
    const r = await run(cmd, args, { cwd: opts.cwd, timeoutMs: opts.timeoutMs ?? 15 * 60_000, env: opts.env })
    const output = redactSecrets(tail(`${r.stdout}\n${r.stderr}`.trim()), opts.secrets)
    result[name] = {
      status: r.code === 0 && !r.timedOut ? 'PASS' : 'FAIL',
      output: r.timedOut ? `Tiempo agotado.\n${output}` : output,
      durationMs: Date.now() - started,
    }
  }
  return result
}

export function allValidationsPassed(v: Validations): boolean {
  return CHECK_NAMES.every(n => v[n].status === 'PASS')
}

export function anyValidationFailed(v: Validations): boolean {
  return CHECK_NAMES.some(n => v[n].status === 'FAIL')
}

export function validationsSummary(v: Validations): string {
  return CHECK_NAMES.map(n => `${n}: ${v[n].status}`).join(' · ')
}
