/**
 * Manager (OpenAI Agents SDK): decide el próximo paso y revisa lo que hizo Claude.
 * Devuelve JSON estructurado; la validación estricta la hace el orquestador (validations.ts).
 * Callers: index.ts. El SDK se importa dinámicamente para que los tests no lo necesiten.
 */

import { extractJson } from './validations'
import { BridgeError, type ClaudeResult, type HumanDecision, type Usage, type Validations } from './types'

export interface ManagerInput {
  goal: string
  round: number
  maxRounds: number
  dryRun: boolean
  readOnly: boolean
  gitSummary: string
  lastClaude: ClaudeResult | null
  validations: Validations | null
  history: string
  humanDecisions: HumanDecision[]
  notes: string[]
}

export interface ManagerClient {
  /** Devuelve el JSON crudo de la decisión (sin validar) y el uso de tokens. */
  decide(input: ManagerInput): Promise<{ raw: unknown; usage?: Usage }>
}

export function buildManagerPrompt(i: ManagerInput): string {
  const validations = i.validations
    ? (Object.entries(i.validations) as [string, { status: string; output: string }][])
        .map(([k, v]) => `- ${k}: ${v.status}${v.status === 'FAIL' ? `\n${v.output.slice(-800)}` : ''}`)
        .join('\n')
    : '(todavía no se corrieron validaciones)'
  const claude = i.lastClaude
    ? JSON.stringify({ ...i.lastClaude, summary: i.lastClaude.summary.slice(0, 3000) }, null, 2)
    : '(Claude todavía no trabajó en esta corrida)'
  const humans = i.humanDecisions.length
    ? i.humanDecisions.map(h => `- ${h.command} por ${h.actor}${h.note ? `: ${h.note}` : ''}`).join('\n')
    : '(ninguna)'
  return [
    `OBJETIVO DE PANCHO:\n${i.goal}`,
    `RONDA: ${i.round} de ${i.maxRounds} máximo. dry_run=${i.dryRun}. Objetivo de solo lectura=${i.readOnly}.`,
    `ESTADO GIT:\n${i.gitSummary}`,
    `ÚLTIMO RESULTADO DE CLAUDE:\n${claude}`,
    `VALIDACIONES DEL BRIDGE (typecheck/lint/tests/build):\n${validations}`,
    `HISTORIAL:\n${i.history}`,
    `DECISIONES HUMANAS:\n${humans}`,
    i.notes.length ? `NOTAS DEL BRIDGE:\n${i.notes.map(n => `- ${n}`).join('\n')}` : '',
    'Respondé SOLO con el objeto JSON de decisión.',
  ]
    .filter(Boolean)
    .join('\n\n')
}

export interface OpenAIManagerConfig {
  apiKey: string
  model: string
  /** Reglas del producto y del orquestador (contenido de /agent). */
  instructions: string
  /** JSON Schema de manager-decision.schema.json. */
  schema: Record<string, unknown>
  timeoutMs?: number
}

interface SdkUsage {
  inputTokens?: number
  outputTokens?: number
}

export function createOpenAIManager(cfg: OpenAIManagerConfig): ManagerClient {
  return {
    async decide(input) {
      try {
        const sdk = await import('@openai/agents')
        sdk.setDefaultOpenAIKey(cfg.apiKey)
        sdk.setTracingDisabled(true)
        // El tipo genérico de Agent no admite un esquema JSON arbitrario como outputType; el SDK sí.
        const agent = new sdk.Agent({
          name: 'VARA Manager',
          instructions: cfg.instructions,
          model: cfg.model,
          outputType: { type: 'json_schema', name: 'manager_decision', strict: true, schema: cfg.schema },
        } as never) as unknown as Parameters<typeof sdk.run>[0]
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), cfg.timeoutMs ?? 180_000)
        try {
          const result = await sdk.run(agent, buildManagerPrompt(input), { maxTurns: 3, signal: controller.signal })
          const out = result.finalOutput as unknown
          const raw = typeof out === 'string' ? extractJson(out) : out
          const u = (result as unknown as { state?: { usage?: SdkUsage } }).state?.usage
          return { raw, usage: u ? { inputTokens: u.inputTokens ?? 0, outputTokens: u.outputTokens ?? 0 } : undefined }
        } finally {
          clearTimeout(timer)
        }
      } catch (e) {
        if (e instanceof BridgeError) throw e
        throw new BridgeError('OPENAI_FAILURE', `Falló la llamada a OpenAI: ${e instanceof Error ? e.message : String(e)}`)
      }
    },
  }
}

/** Verifica que el modelo exista para la cuenta antes de gastar tokens. */
export async function preflightModel(apiKey: string, model: string, fetchFn: typeof fetch = fetch): Promise<void> {
  let res: Response
  try {
    res = await fetchFn(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
  } catch (e) {
    throw new BridgeError('OPENAI_FAILURE', `No se pudo contactar a OpenAI: ${e instanceof Error ? e.message : String(e)}`)
  }
  if (res.status === 404) {
    throw new BridgeError('OPENAI_FAILURE', `El modelo "${model}" no existe para esta cuenta. Configurá OPENAI_MODEL con uno disponible.`)
  }
  if (res.status === 401 || res.status === 403) {
    throw new BridgeError('OPENAI_FAILURE', 'OpenAI rechazó la clave (OPENAI_API_KEY inválida o sin permisos).')
  }
  if (!res.ok) throw new BridgeError('OPENAI_FAILURE', `OpenAI respondió ${res.status} al verificar el modelo.`)
}
