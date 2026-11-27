/** Cómo se presenta un resultado con citas. Pura: se prueba sin pantalla. */
import type { CitedFinding, CitedSummary, FindingKind } from './citations'

/** Etiquetas fijas por tipo: VARA no escribe afirmaciones propias sobre el documento, solo muestra sus frases. */
export const KIND_LABELS: Record<FindingKind, string> = {
  holder: 'Titular o parte',
  domain_condition: 'Condición del dominio',
  registry_id: 'Matrícula o partida',
  mortgage: 'Hipoteca',
  embargo: 'Embargo',
  inhibition: 'Inhibición',
  usufruct: 'Usufructo, uso o habitación',
  easement: 'Servidumbre o restricción',
  surface: 'Superficie o medidas',
  civil_status: 'Estado civil o asentimiento',
  debt: 'Deuda mencionada',
  other: 'Otro dato del documento',
}

export type GroupTone = 'rose' | 'amber' | 'slate'
export interface FindingGroup { title: string; tone: GroupTone; findings: CitedFinding[] }

const GROUPS: Array<{ title: string; tone: GroupTone; kinds: FindingKind[] }> = [
  { title: 'El documento menciona cargas', tone: 'rose', kinds: ['mortgage', 'embargo', 'inhibition'] },
  { title: 'El documento menciona restricciones', tone: 'amber', kinds: ['usufruct', 'easement'] },
  { title: 'Deudas mencionadas', tone: 'amber', kinds: ['debt'] },
  { title: 'Titulares y partes', tone: 'slate', kinds: ['holder', 'civil_status'] },
  { title: 'Datos del inmueble', tone: 'slate', kinds: ['domain_condition', 'registry_id', 'surface'] },
  { title: 'Otros datos', tone: 'slate', kinds: ['other'] },
]

export function groupFindings(summary: CitedSummary): FindingGroup[] {
  return GROUPS
    .map(g => ({ title: g.title, tone: g.tone, findings: summary.findings.filter(f => g.kinds.includes(f.kind)) }))
    .filter(g => g.findings.length > 0)
}

/** Avisos que acompañan al resultado. Nunca se afirma que el documento esté «limpio» ni «en regla». */
export function summaryNotices(summary: CitedSummary): string[] {
  const out: string[] = []
  if (summary.coverage === 'unreadable') {
    out.push('No pude leer texto de este PDF (parece un escaneo o una foto). Eso no quiere decir que esté todo en orden: revisalo con tu escribano.')
    return out
  }
  if (summary.coverage === 'partial') {
    out.push(`Leí las primeras ${summary.pagesRead} de ${summary.pageCount} páginas. Lo que está después no se analizó.`)
  }
  if (summary.findings.length === 0) {
    out.push('No encontré datos para mostrar en las páginas que pude leer. Eso no prueba que no existan cargas ni restricciones: confirmalo con tu escribano.')
  }
  if (summary.discarded > 0) {
    out.push(`Descarté ${summary.discarded} ${summary.discarded === 1 ? 'dato' : 'datos'} que no pude comprobar en el texto del documento.`)
  }
  return out
}

export const CITED_DISCLAIMER =
  'Son frases del propio documento, con la página de donde salen: que figuren no prueba que sean ciertas ni que estén vigentes. Es una ayuda para entender el papel: no reemplaza a tu escribano ni da garantía.'
