/**
 * VARA Property Pack: ficha ordenada de la propiedad para mandar a interesados en
 * vez de contestar lo mismo por WhatsApp. Se arma solo con lo que el vendedor ya
 * cargó en "Mi propiedad" y con los papeles que marcó como disponibles; lo que no
 * cargó no aparece, no se completa con datos inventados.
 */
export interface PackSource {
  title?: string; type?: string; price?: string; currency?: string
  surface?: string; coveredSurface?: string; rooms?: string; bedrooms?: string; bathrooms?: string
  address?: string; neighborhood?: string; city?: string; description?: string
  features?: string[]
}

export interface PackFact { label: string; value: string }
export interface Pack {
  title: string
  priceLine: string | null
  location: string | null
  facts: PackFact[]
  features: string[]
  description: string | null
  documents: string[]
  isEmpty: boolean
}

const clean = (v?: string) => (v ?? '').trim()

export function buildPack(src: PackSource, availableDocs: string[]): Pack {
  const price = clean(src.price)
  const location = [clean(src.address), clean(src.neighborhood), clean(src.city)].filter(Boolean).join(', ')
  const facts: PackFact[] = []
  const add = (label: string, v: string | undefined, unit = '') => { const x = clean(v); if (x) facts.push({ label, value: `${x}${unit}` }) }
  add('Tipo', src.type)
  add('Superficie total', src.surface, ' m²')
  add('Superficie cubierta', src.coveredSurface, ' m²')
  add('Ambientes', src.rooms)
  add('Dormitorios', src.bedrooms)
  add('Baños', src.bathrooms)
  const features = (src.features ?? []).filter(Boolean)
  const description = clean(src.description) || null

  return {
    title: clean(src.title) || 'Propiedad en venta',
    priceLine: price ? `${clean(src.currency) || 'USD'} ${Number(price.replace(/\D/g, '')).toLocaleString('es-AR')}` : null,
    location: location || null,
    facts,
    features,
    description,
    documents: availableDocs,
    isEmpty: !price && !location && facts.length === 0 && !description && features.length === 0,
  }
}
