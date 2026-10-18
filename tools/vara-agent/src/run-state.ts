/**
 * Registro de cada corrida (observabilidad): run_id, objetivo, rondas, decisiones, validaciones,
 * commits, estado final, aprobaciones y costo estimado. Callers: index.ts, approvals.ts.
 * Se guarda como .agent-runs/<run_id>/run.json (ignorado por git) y se sube como artefacto del workflow.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { timestamp } from './git-state'
import type { ResumeState, RoundRecord, RunConfig, RunRecord, Usage } from './types'
import { redactSecrets, validationsSummary } from './validations'

export function newRunId(now: Date): string {
  return `run-${timestamp(now)}`
}

export function createRunRecord(runId: string, config: RunConfig, now: Date): RunRecord {
  return {
    run_id: runId,
    goal: config.goal,
    started_at: now.toISOString(),
    ended_at: null,
    branch: config.resume?.branch ?? null,
    dry_run: config.dryRun,
    max_rounds: config.maxRounds,
    rounds: [],
    commits: [],
    final_status: null,
    human_approvals: config.resume?.humanDecisions ? [...config.resume.humanDecisions] : [],
    pr_url: null,
    issue_url: null,
    human_question: null,
    error: null,
    usage: {
      openai: { inputTokens: 0, outputTokens: 0 },
      claude: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
      estimated_cost_usd: null,
    },
  }
}

export function addUsage(rec: RunRecord, who: 'openai' | 'claude', u?: Usage): void {
  if (!u) return
  const t = rec.usage[who]
  t.inputTokens += u.inputTokens
  t.outputTokens += u.outputTokens
  if (u.costUsd !== undefined) t.costUsd = (t.costUsd ?? 0) + u.costUsd
}

export interface Prices {
  /** USD por millón de tokens de entrada / salida del Manager. Si no se configuran, el costo de OpenAI no se estima. */
  openaiInputPerM?: number
  openaiOutputPerM?: number
}

export function pricesFromEnv(env: Record<string, string | undefined>): Prices {
  const num = (v?: string) => (v && Number.isFinite(Number(v)) ? Number(v) : undefined)
  return { openaiInputPerM: num(env.OPENAI_PRICE_INPUT_PER_M), openaiOutputPerM: num(env.OPENAI_PRICE_OUTPUT_PER_M) }
}

/** Claude informa su costo real; OpenAI se estima solo si hay precios. Devuelve null si no hay nada que sumar. */
export function estimateCost(rec: RunRecord, prices: Prices = {}): number | null {
  let total = 0
  let known = false
  if (rec.usage.claude.costUsd !== undefined && rec.usage.claude.costUsd > 0) {
    total += rec.usage.claude.costUsd
    known = true
  }
  if (prices.openaiInputPerM !== undefined && prices.openaiOutputPerM !== undefined) {
    total +=
      (rec.usage.openai.inputTokens / 1e6) * prices.openaiInputPerM + (rec.usage.openai.outputTokens / 1e6) * prices.openaiOutputPerM
    known = true
  }
  return known ? Math.round(total * 10_000) / 10_000 : null
}

export function saveRun(rec: RunRecord, baseDir: string, secrets: string[] = [], logLines: string[] = []): string {
  const dir = path.join(baseDir, '.agent-runs', rec.run_id)
  mkdirSync(dir, { recursive: true })
  const file = path.join(dir, 'run.json')
  writeFileSync(file, redactSecrets(JSON.stringify(rec, null, 2), secrets), 'utf8')
  if (logLines.length) writeFileSync(path.join(dir, 'run.log'), redactSecrets(logLines.join('\n'), secrets), 'utf8')
  return file
}

/** Resumen compacto para dárselo al Manager al reanudar o para armar la pregunta a Pancho. */
export function historySummary(rec: RunRecord): string {
  if (rec.rounds.length === 0) return 'Todavía no hubo rondas.'
  return rec.rounds
    .map((r: RoundRecord) => {
      const parts = [`Ronda ${r.round}: GPT decidió ${r.manager.decision.decision} — ${r.manager.decision.summary}`]
      if (r.claude) parts.push(`Claude (${r.claude.result.status}): ${r.claude.result.summary}`)
      if (r.validations) parts.push(`Validaciones: ${validationsSummary(r.validations)}`)
      if (r.changedFiles.length) parts.push(`Archivos: ${r.changedFiles.slice(0, 15).join(', ')}`)
      if (r.notes.length) parts.push(`Notas: ${r.notes.join(' | ')}`)
      return parts.join('\n  ')
    })
    .join('\n')
}

export function toResumeState(rec: RunRecord, roundsUsed: number): ResumeState {
  return {
    runId: rec.run_id,
    branch: rec.branch ?? '',
    roundsUsed,
    historySummary: historySummary(rec),
    humanDecisions: rec.human_approvals,
  }
}

export function encodeState(state: ResumeState): string {
  return Buffer.from(JSON.stringify(state), 'utf8').toString('base64')
}

export function decodeState(encoded: string): ResumeState | null {
  try {
    const s = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as ResumeState
    if (typeof s.runId !== 'string' || typeof s.branch !== 'string' || typeof s.roundsUsed !== 'number') return null
    return { ...s, humanDecisions: Array.isArray(s.humanDecisions) ? s.humanDecisions : [] }
  } catch {
    return null
  }
}

export function renderPrBody(rec: RunRecord, extra: { risks?: string[] } = {}): string {
  const list = (items: string[]) => (items.length ? items.map(i => `- ${i}`).join('\n') : '- (ninguno)')
  const gpt = rec.rounds.map(r => `${r.round}. **${r.manager.decision.decision}** — ${r.manager.decision.summary}`)
  const claude = rec.rounds.filter(r => r.claude).map(r => `${r.round}. (${r.claude!.result.status}) ${r.claude!.result.summary}`)
  const last = [...rec.rounds].reverse().find(r => r.validations)
  const tests = last?.validations
    ? (Object.entries(last.validations) as [string, { status: string }][]).map(([k, v]) => `- ${k}: ${v.status}`).join('\n')
    : '- No se corrieron validaciones (corrida sin cambios o dry-run).'
  const risks = [...rec.rounds.flatMap(r => r.manager.decision.risks), ...rec.rounds.flatMap(r => r.claude?.result.risks ?? []), ...(extra.risks ?? [])]
  const humans = rec.human_approvals.map(h => `${h.command} por @${h.actor} (${h.at})${h.note ? `: ${h.note}` : ''}`)
  return [
    `## Goal\n${rec.goal}`,
    `## Iterations\n${rec.rounds.length} de máximo ${rec.max_rounds}. Run: \`${rec.run_id}\`${rec.dry_run ? ' (dry-run)' : ''}.`,
    `## GPT decisions\n${list(gpt)}`,
    `## Claude changes\n${list(claude)}`,
    `## Tests\n${tests}`,
    `## Risks\n${list([...new Set(risks)])}`,
    `## Human decisions\n${list(humans)}`,
    `## Final state\n${rec.final_status ?? 'EN CURSO'}. Este PR va a \`integracion\`; no se mergea solo.`,
  ].join('\n\n')
}
