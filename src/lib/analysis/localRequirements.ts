/**
 * Requisitos municipales que ya están cargados en el catálogo regulatorio,
 * puestos a disposición del comprador según el partido o municipio.
 *
 * Regla: no se infiere el partido por el nombre comercial de un barrio. Solo
 * se toma si la ciudad o el barrio del aviso coincide exactamente con un
 * municipio cargado; si no, el comprador lo elige.
 */

import { getRegulation } from '@/lib/regulations'
import type { KeyMunicipality } from '@/data/regulations/types'

export interface LocalRequirements {
  provinceName: string
  municipalities: KeyMunicipality[]
  /** Municipio detectado con certeza en el aviso, si lo hay. */
  detected: KeyMunicipality | null
  /** Requisito general que aplica en cualquier municipio de la jurisdicción. */
  general: string
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

export function localRequirements(
  regionCode: string | null | undefined,
  country: string | null | undefined,
  places: (string | null | undefined)[],
): LocalRequirements | null {
  // Sin jurisdicción conocida no se muestran municipios: podrían ser de otra provincia.
  if (!regionCode) return null
  const isMX = (country ?? '').toUpperCase() === 'MX'
  const reg = getRegulation(regionCode, isMX ? 'MX' : 'AR')
  if (reg.code !== regionCode) return null
  const municipalities = reg.keyMunicipalities ?? []
  if (municipalities.length === 0) return null
  const wanted = new Set(places.filter((p): p is string => !!p && !!p.trim()).map(norm))
  const detected = municipalities.find(m => wanted.has(norm(m.name))) ?? null
  return {
    provinceName: reg.displayName,
    municipalities,
    detected,
    general: isMX
      ? 'Constancias de no adeudo de predial y agua del municipio o alcaldía'
      : 'Libre deuda de tasas municipales del partido donde está la propiedad',
  }
}
