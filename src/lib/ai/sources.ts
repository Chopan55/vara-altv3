/**
 * «En qué se basa esta respuesta». Cada respuesta del asistente declara de dónde sale lo que dice:
 * los datos registrados de la operación, la calculadora de costos, las guías de VARA o, si no hay
 * nada de eso, conocimiento general sin verificar. Es la respuesta de diseño a la queja más repetida
 * de los usuarios de IA inmobiliaria: que inventa y no dice de dónde lo saca.
 */
import type { CostSource } from './costFacts'

export type SourceKind = 'operation' | 'calculator' | 'knowledge' | 'general'

export interface ReplySource {
  kind: SourceKind
  label: string
  detail?: string
  href?: string
}

const CONFIDENCE: Record<string, string> = { VERIFIED: 'verificados', PARTIAL: 'parciales', ESTIMATED: 'estimados' }

export function buildSources(input: {
  operation: { stage: string | null; documentCount: number | null } | null
  cost: CostSource | null
  knowledgeTitles: string[]
}): ReplySource[] {
  const sources: ReplySource[] = []

  if (input.operation) {
    const parts: string[] = []
    if (input.operation.stage) parts.push(`etapa ${input.operation.stage}`)
    if (input.operation.documentCount !== null) {
      parts.push(`${input.operation.documentCount} documento${input.operation.documentCount === 1 ? '' : 's'} pendiente${input.operation.documentCount === 1 ? '' : 's'} o en revisión`)
    } else {
      parts.push('documentos sin verificar')
    }
    sources.push({ kind: 'operation', label: 'Tu operación en VARA', detail: parts.join(' · ') })
  }

  if (input.cost) {
    const confidence = CONFIDENCE[input.cost.confidence] ?? input.cost.confidence.toLowerCase()
    sources.push({
      kind: 'calculator',
      label: 'Calculadora de costos de VARA',
      detail: `${input.cost.jurisdiction} · datos ${confidence} · actualizados ${input.cost.updatedAt}`,
      href: '/dinero?tab=costos',
    })
  }

  const titles = [...new Set(input.knowledgeTitles)].slice(0, 3)
  if (titles.length > 0) sources.push({ kind: 'knowledge', label: 'Guías de VARA', detail: titles.join(' · '), href: '/guia' })

  if (sources.length === 0) {
    sources.push({
      kind: 'general',
      label: 'Conocimiento general',
      detail: 'No sale de tus datos en VARA. Confirmalo con un profesional antes de decidir.',
    })
  }
  return sources
}
