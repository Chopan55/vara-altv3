/**
 * Resumen de un documento leído por IA. La respuesta del modelo es entrada no
 * confiable: se reconstruye campo por campo antes de guardarla o mostrarla.
 */

export interface DocSummary {
  holders: string[]
  encumbrances: string[]
  restrictions: string[]
  alerts: string[]
  excerpt: string
  /**
   * Si se pudo leer texto del documento. Un PDF escaneado sin texto devuelve todo
   * vacío, y "sin cargas" ahí no es una buena noticia: es que no se leyó nada.
   */
  readable: boolean
}

const MAX_ITEMS = 20
const MAX_LEN = 400

function strings(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((x): x is string => typeof x === 'string')
    .map(x => x.trim().slice(0, MAX_LEN))
    .filter(Boolean)
    .slice(0, MAX_ITEMS)
}

export function sanitizeDocSummary(raw: unknown): DocSummary | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const summary = {
    holders: strings(o.holders),
    encumbrances: strings(o.encumbrances),
    restrictions: strings(o.restrictions),
    alerts: strings(o.alerts),
    excerpt: typeof o.excerpt === 'string' ? o.excerpt.trim().slice(0, 1500) : '',
  }
  // Legible si el modelo lo dice explícitamente o si hay contenido extraído.
  const extracted = summary.holders.length > 0 || summary.excerpt.length >= 40
  const readable = o.readable === false ? false : extracted
  return { ...summary, readable }
}

export function isPdfPath(path: string | null | undefined): boolean {
  return !!path && /\.pdf$/i.test(path)
}

export type SummaryTone = 'unreadable' | 'issues' | 'alerts' | 'clear'

/** Las cargas (hipoteca, embargo) pesan más que una alerta para revisar. */
export function summaryTone(s: DocSummary): SummaryTone {
  if (!s.readable) return 'unreadable'
  if (s.encumbrances.length > 0 || s.restrictions.length > 0) return 'issues'
  if (s.alerts.length > 0) return 'alerts'
  return 'clear'
}
