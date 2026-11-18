/**
 * Revisión de superficies leídas de un aviso.
 *
 * Los avisos traen errores de carga (un caso real de MercadoLibre: "108 ha totales" y "1.080.000 m² cubiertos"
 * para una casa en un lote de 1.066 m²). Copiar esos números arruina el precio por m² y los comparables, y
 * callarlos esconde el problema. Acá se APARTAN de los datos que alimentan el análisis y se devuelven como aviso
 * para que la persona los confirme en un toque. Nunca se inventa un valor: la sugerencia solo sale de lo que el
 * propio aviso dice en su descripción.
 */

import type { ScrapedData } from '@/app/api/scrape-property/route'

export interface SurfaceWarning {
  field: 'totalM2' | 'coveredM2'
  /** Lo que declara el aviso, ya en m². */
  observedM2: number
  /** Superficie de lote que menciona la descripción, si la hay (se ofrece como sugerencia, no se aplica sola). */
  suggestedLotM2?: number
  message: string
}

/** Una vivienda (casa, departamento, PH) por encima de esto es casi seguro un error de carga o de unidad. */
export const MAX_HOME_TOTAL_M2 = 20_000
export const MAX_HOME_COVERED_M2 = 5_000

const LAND_HINT = /\b(lotes?|terrenos?|campos?|chacras?|fracci[oó]n|quintas?|hect[aá]reas?)\b/i

const fmt = (n: number) => Math.round(n).toLocaleString('es-AR')

function describe(m2: number): string {
  return m2 >= 10_000 ? `${fmt(m2)} m² (${(m2 / 10_000).toLocaleString('es-AR', { maximumFractionDigits: 2 })} ha)` : `${fmt(m2)} m²`
}

/** Lote que la descripción menciona con claridad: "lote interno de 1066mts", "terreno de 800 m2". */
export function lotFromDescription(description?: string): number | undefined {
  if (!description) return undefined
  const m = description.match(/(?:lote|terreno)[^\d\n]{0,30}([\d][\d.,]*)\s*(?:m²|m2|mts2?|mts|metros)/i)
  if (!m) return undefined
  const n = Number(m[1].replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'))
  return Number.isFinite(n) && n >= 50 && n <= MAX_HOME_TOTAL_M2 ? n : undefined
}

export function reviewSurfaces(input: ScrapedData): { data: ScrapedData; warnings: SurfaceWarning[] } {
  const data: ScrapedData = { ...input }
  const warnings: SurfaceWarning[] = []
  // Si el título habla de un lote o un campo, las superficies grandes son normales.
  const landLike = LAND_HINT.test(data.title ?? '') || /\b(lote|terreno|campo)\b/i.test(data.propertyType ?? '')
  if (landLike) return { data, warnings }

  const suggested = lotFromDescription(data.description)
  const flag = (field: 'totalM2' | 'coveredM2', observed: number, why: string) => {
    warnings.push({
      field,
      observedM2: observed,
      ...(suggested ? { suggestedLotM2: suggested } : {}),
      message: `Revisá la superficie: el aviso declara ${describe(observed)} ${why}.` +
        (suggested ? ` La descripción menciona un lote de ${fmt(suggested)} m².` : '') +
        ' Seguí con el análisis y completá la superficie después.',
    })
    delete data[field]
  }

  if (data.totalM2 !== undefined && data.totalM2 > MAX_HOME_TOTAL_M2) flag('totalM2', data.totalM2, 'como superficie total de una vivienda')
  if (data.coveredM2 !== undefined && data.coveredM2 > MAX_HOME_COVERED_M2) flag('coveredM2', data.coveredM2, 'como superficie cubierta de una vivienda')

  // Cubierta mayor que la total en más de 5 veces no es un edificio de varios pisos: es un error.
  if (data.totalM2 !== undefined && data.coveredM2 !== undefined && data.coveredM2 > data.totalM2 * 5) {
    flag('coveredM2', data.coveredM2, 'cubiertos, mucho más que la superficie total')
  }
  return { data, warnings }
}

/** Total y cubierta suelen fallar juntas con el mismo valor: se muestra un solo aviso por valor. */
export function uniqueWarnings(warnings: SurfaceWarning[] | undefined): SurfaceWarning[] {
  return (warnings ?? []).filter((w, i, all) => all.findIndex(x => x.observedM2 === w.observedM2) === i)
}
