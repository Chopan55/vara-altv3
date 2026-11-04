export interface PhotoItem {
  id: string
  preview: string
  label: string
  isCover: boolean
}

export const ROOM_LABELS = [
  'Frente', 'Living', 'Comedor', 'Cocina', 'Dormitorio principal',
  'Dormitorio 2', 'Dormitorio 3', 'Baño', 'Jardín', 'Pileta',
  'Quincho', 'Garage / Cochera', 'Entrada', 'Otro',
  // Internas: nunca se muestran en la ficha, el video ni el aviso.
  'Plano', 'Documento (privado)',
]

export const FOTO_TIPS = [
  { icon: '☀️', tip: 'Sacá las fotos con luz natural, de día y con ventanas abiertas.' },
  { icon: '📐', tip: 'Tomá desde las esquinas para mostrar todo el ambiente.' },
  { icon: '🧹', tip: 'Despejá objetos personales antes de fotografiar.' },
  { icon: '🌟', tip: 'La portada es clave — elegí la foto de mayor impacto visual.' },
]


export type Tab = 'datos' | 'preview' | 'publicar'

export const PORTALS = [
  {
    id: 'zonaprop',
    name: 'Zonaprop',
    logo: '🏠',
    reach: '4M+ visitantes/mes',
    url: 'https://www.zonaprop.com.ar',
    free: true,
  },
  {
    id: 'argenprop',
    name: 'Argenprop',
    logo: '🔑',
    reach: '2M+ visitantes/mes',
    url: 'https://www.argenprop.com',
    free: true,
  },
  {
    id: 'mercadolibre',
    name: 'MercadoLibre',
    logo: '🛒',
    reach: '5M+ visitantes/mes',
    url: 'https://inmuebles.mercadolibre.com.ar',
    free: false,
  },
]

export const DRAFT_KEY = 'vara_publish_draft'

export interface PublishForm {
  title: string; type: string; price: string; currency: string
  surface: string; coveredSurface: string; rooms: string; bedrooms: string; bathrooms: string
  address: string; neighborhood: string; city: string; description: string
  features: string[]
}

export const EMPTY_FORM: PublishForm = {
  title: '', type: 'Casa', price: '', currency: 'USD',
  surface: '', coveredSurface: '', rooms: '', bedrooms: '', bathrooms: '',
  address: '', neighborhood: '', city: '', description: '',
  features: [],
}

export const PROPERTY_TYPES = ['Casa', 'Departamento', 'PH', 'Terreno', 'Local comercial']
export const FEATURES = ['Pileta', 'Quincho', 'Jardín', 'Cochera', 'Seguridad 24hs', 'Parrilla', 'Luminoso', 'Balcón']

export type Portal = typeof PORTALS[number]

/** Texto listo para pegar en un portal: solo los datos que cargó el usuario. */
export function buildAdText(form: PublishForm): string {
  return [
    form.title,
    `Precio: ${form.currency} ${Number(form.price || 0).toLocaleString('es-AR')}`,
    form.address
      ? `Ubicación: ${[form.address, form.neighborhood, form.city].filter(Boolean).join(', ')}`
      : form.city ? `Ciudad: ${form.city}` : null,
    form.surface ? `Superficie: ${form.surface} m²` : null,
    form.coveredSurface ? `Superficie cubierta: ${form.coveredSurface} m²` : null,
    form.rooms ? `Ambientes: ${form.rooms}` : null,
    form.bedrooms ? `Dormitorios: ${form.bedrooms}` : null,
    form.bathrooms ? `Baños: ${form.bathrooms}` : null,
    form.description ? `\n${form.description}` : null,
    form.features.length > 0 ? `\nCaracterísticas: ${form.features.join(', ')}` : null,
  ].filter((l): l is string => Boolean(l)).join('\n')
}
