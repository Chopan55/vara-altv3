/**
 * Ejemplo de la portada: un aviso REAL y público, no datos inventados.
 * Se guardan solo los datos del aviso (no su descripción) y la fecha en que se copiaron.
 * Cuando el aviso se vence, se reemplaza por otro real y se actualiza `copiedAt`.
 */
export const EXAMPLE_LISTING = {
  url: 'https://www.zonaprop.com.ar/propiedades/clasificado/veclcain-casa-en-venta-en-tortugas-country-club-60571500.html',
  portal: 'Zonaprop',
  copiedAt: '2026-11-22',
  text: [
    'Casa en Venta en Tortugas Country Club, Manuel Alberti, Pilar, GBA Norte',
    'Venta. Casa. USD 1.400.000',
    'Superficie cubierta 470 m². Superficie total 1.602 m².',
    '7 ambientes. 4 dormitorios. 4 baños. Antigüedad 6 años.',
  ].join('\n'),
} as const

export function formatCopiedAt(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
