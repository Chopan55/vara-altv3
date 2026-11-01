/**
 * Explicación del análisis con IA, con verificación.
 *
 * El modelo redacta; el motor ya decidió. Cada respuesta pasa por
 * `findUngroundedNumbers`: si nombra un número que el análisis no tiene, se
 * descarta y se muestra lo que VARA sí sabe. El LLM nunca es fuente de
 * números.
 */

import {
  ANALYST_SYSTEM_PROMPT, briefToPrompt, fallbackReply, findUngroundedNumbers, clean, type AnalysisBrief,
} from './brief'

export interface ChatMessage { role: 'user' | 'assistant'; content: string }

/** Cliente de modelo inyectable: en tests es un doble, en producción OpenAI. */
export interface ModelClient {
  complete(args: { system: string; messages: ChatMessage[] }): Promise<string>
}

export const EXPLAIN_LIMITS = { maxMessages: 8, maxChars: 600, maxQuestionChars: 600 } as const

export function sanitizeMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return []
  return raw
    .slice(-EXPLAIN_LIMITS.maxMessages)
    .map((m): ChatMessage | null => {
      const o = (m ?? {}) as Record<string, unknown>
      const content = clean(o.content, EXPLAIN_LIMITS.maxChars)
      return (o.role === 'user' || o.role === 'assistant') && content ? { role: o.role, content } : null
    })
    .filter((m): m is ChatMessage => m !== null)
}

export interface ExplainResult {
  reply: string
  /** false cuando se descartó la respuesta del modelo por nombrar números inventados. */
  grounded: boolean
  ungrounded: number[]
}

export async function explainAnalysis(
  client: ModelClient,
  brief: AnalysisBrief,
  messages: ChatMessage[],
): Promise<ExplainResult> {
  const system = `${ANALYST_SYSTEM_PROMPT}\n\n${briefToPrompt(brief)}`
  const raw = (await client.complete({ system, messages })).trim()
  if (!raw) return { reply: fallbackReply(brief), grounded: false, ungrounded: [] }

  const ungrounded = findUngroundedNumbers(raw, brief)
  if (ungrounded.length > 0) return { reply: fallbackReply(brief), grounded: false, ungrounded }
  return { reply: raw, grounded: true, ungrounded: [] }
}

/** Adaptador de OpenAI: modelo chico, poco creativo, respuestas cortas. */
export function openAiModelClient(openai: {
  chat: { completions: { create: (a: unknown) => Promise<{ choices: { message?: { content?: string | null } }[] }> } }
}): ModelClient {
  return {
    async complete({ system, messages }) {
      const res = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 450,
        messages: [{ role: 'system', content: system }, ...messages],
      })
      return res.choices[0]?.message?.content ?? ''
    },
  }
}
