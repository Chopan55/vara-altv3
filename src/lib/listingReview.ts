import { analyzePricePosition } from '@/lib/market/priceReference'

/**
 * Revisión de un aviso ya publicado: qué datos tiene, cuáles faltan y qué
 * conviene reforzar. Solo mira lo que el aviso muestra; no inventa nada.
 */
export interface ReviewInput {
  data: {
    title?: string; price?: number; currency?: string; totalM2?: number; coveredM2?: number
    rooms?: number; bedrooms?: number; bathrooms?: number; expenses?: number
    description?: string; features?: string[]; province?: string
  }
  photoCount: number
}

export type ReviewStatus = 'ok' | 'weak' | 'missing'
export interface ReviewItem { id: string; label: string; status: ReviewStatus; tip: string }

export function reviewListing({ data, photoCount }: ReviewInput): { items: ReviewItem[]; score: number } {
  const items: ReviewItem[] = []
  const add = (id: string, label: string, status: ReviewStatus, tip: string) => items.push({ id, label, status, tip })

  const title = (data.title ?? '').trim()
  add('title', 'Título', title.length >= 25 ? 'ok' : title ? 'weak' : 'missing',
    title.length >= 25 ? 'Tiene un título descriptivo.' : 'Un buen título nombra el tipo, la zona y lo que más suma (ej.: “Casa de 4 dormitorios con jardín en Pilar”).')

  add('price', 'Precio', data.price ? 'ok' : 'missing', data.price ? 'El precio está visible.' : 'Sin precio, muchos interesados no consultan.')

  add('surface', 'Superficie', data.totalM2 || data.coveredM2 ? 'ok' : 'missing',
    data.totalM2 || data.coveredM2 ? 'Informa los metros.' : 'Indicá metros totales y cubiertos: es lo primero que se compara.')

  add('layout', 'Ambientes, dormitorios y baños', data.rooms && data.bedrooms !== undefined && data.bathrooms !== undefined ? 'ok' : data.rooms || data.bedrooms || data.bathrooms ? 'weak' : 'missing',
    'Completá ambientes, dormitorios y baños para que filtren por ellos.')

  add('expenses', 'Expensas', data.expenses !== undefined ? 'ok' : 'missing',
    data.expenses !== undefined ? 'Informa expensas.' : 'Si hay expensas, mostralas: evita consultas y desconfianza. Si no hay, aclaralo.')

  const words = (data.description ?? '').trim().split(/\s+/).filter(Boolean).length
  add('description', 'Descripción', words >= 60 ? 'ok' : words > 0 ? 'weak' : 'missing',
    words >= 60 ? 'La descripción tiene desarrollo.' : 'Es corta. Contá el estado, la luz, el entorno y por qué conviene.')

  add('photos', 'Fotos', photoCount >= 8 ? 'ok' : photoCount >= 4 ? 'weak' : 'missing',
    photoCount >= 8 ? `Tiene ${photoCount} fotos.` : photoCount > 0 ? `Tiene ${photoCount}. Con 8 o más, y con luz natural, se consulta más.` : 'No pudimos ver fotos. Un aviso sin fotos casi no recibe consultas.')

  add('features', 'Características y amenities', (data.features?.length ?? 0) >= 3 ? 'ok' : (data.features?.length ?? 0) > 0 ? 'weak' : 'missing',
    'Listá lo que suma: cochera, jardín, pileta, seguridad, orientación.')

  // Posición de precio: solo si hay precio en USD y superficie, contra la referencia histórica.
  if (data.price && data.totalM2 && (data.currency ?? 'USD').toUpperCase().startsWith('U') && data.province) {
    const pos = analyzePricePosition(data.price / data.totalM2, data.province)
    const tip = pos.position === 'ABOVE' ? 'Está por encima de la referencia histórica de la zona. Puede ser válido, pero esperá menos consultas.'
      : pos.position === 'BELOW' ? 'Está por debajo de la referencia histórica de la zona. Revisá si dejás plata sobre la mesa.'
      : pos.position === 'AT' ? 'Está dentro de la referencia histórica de la zona.' : 'No se pudo comparar.'
    add('priceFit', 'Precio frente a la zona', pos.position === 'AT' ? 'ok' : pos.position === 'UNKNOWN' ? 'missing' : 'weak', `${tip} (Referencia orientativa, no comparables reales.)`)
  }

  const score = Math.round((items.filter(i => i.status === 'ok').length / items.length) * 100)
  return { items, score }
}
