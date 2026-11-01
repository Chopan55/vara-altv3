/**
 * Ficha técnica de los portales. MercadoLibre (y otros) publican los datos estructurados como pares
 * `{"id":"Dormitorios","text":"6"}` dentro de la página. Es la fuente más confiable: sale del aviso
 * mismo y no de adivinar claves sueltas en el HTML.
 */
export interface PortalSpecs {
  totalM2?: number
  coveredM2?: number
  rooms?: number
  bedrooms?: number
  bathrooms?: number
  garageSpots?: number
  ageYears?: number
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/** "1.279 m²" → 1279 · "460 m²" → 460 · "6" → 6 · "15 años" → 15. */
export function specNumber(raw: string): number | undefined {
  const m = raw.replace(/\s+/g, ' ').match(/\d[\d.,]*/)
  if (!m) return undefined
  let t = m[0].replace(/[.,]+$/, '')
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '')
  else t = t.replace(',', '.')
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

export function fromPortalSpecs(html: string): PortalSpecs {
  const specs = new Map<string, string>()
  for (const m of html.matchAll(/\{"id":"([^"]{2,40})","text":"([^"]{1,60})"\}/g)) {
    const key = norm(m[1])
    if (!specs.has(key)) specs.set(key, m[2])
  }
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const v = specs.get(k)
      if (v !== undefined) return specNumber(v)
    }
    return undefined
  }

  const out: PortalSpecs = {}
  const set = <K extends keyof PortalSpecs>(k: K, v: number | undefined) => { if (v !== undefined) out[k] = v as PortalSpecs[K] }
  set('totalM2', get('superficie total', 'superficie del terreno'))
  set('coveredM2', get('superficie cubierta'))
  set('rooms', get('ambientes'))
  set('bedrooms', get('dormitorios'))
  set('bathrooms', get('banos'))
  set('garageSpots', get('cocheras'))
  set('ageYears', get('antiguedad'))
  return out
}
