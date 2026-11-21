/**
 * De dónde sale cada renglón de costos, en palabras para el comprador.
 *
 * El `basis` de un renglón puede ser el aviso, el enlace a una norma (PDF de
 * una ley impositiva), el sitio de un organismo de referencia (colegio,
 * registro) o una estimación propia. Mostrarlo distinto evita que un enlace
 * institucional parezca respaldo directo del importe.
 */

export type CostSourceKind = 'AVISO' | 'NORMA' | 'ORGANISMO' | 'ESTIMACION'

export interface CostSource {
  kind: CostSourceKind
  /** Texto corto para mostrar. */
  label: string
  /** Enlace verificable, solo si el basis es una URL http(s). */
  url?: string
}

function asUrl(v: string): URL | null {
  try {
    const u = new URL(v.trim())
    return u.protocol === 'https:' || u.protocol === 'http:' ? u : null
  } catch {
    return null
  }
}

export function describeCostSource(basis: string | null | undefined): CostSource {
  const b = (basis ?? '').trim()
  if (!b) return { kind: 'ESTIMACION', label: 'Estimación de VARA' }
  if (/^aviso$/i.test(b)) return { kind: 'AVISO', label: 'Dato del aviso' }
  const u = asUrl(b)
  if (u) {
    const host = u.hostname.replace(/^www\./, '')
    if (/\.pdf$/i.test(u.pathname)) return { kind: 'NORMA', label: `Norma oficial (${host})`, url: u.toString() }
    return { kind: 'ORGANISMO', label: `Organismo de referencia (${host})`, url: u.toString() }
  }
  if (/estimad/i.test(b)) return { kind: 'ESTIMACION', label: 'Estimación de VARA' }
  return { kind: 'ORGANISMO', label: b }
}

/** "2026-09-13" → "13/09/2026". Devuelve null si no es una fecha válida. */
export function formatAsOf(iso: string | null | undefined): string | null {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return null
  return `${m[3]}/${m[2]}/${m[1]}`
}
