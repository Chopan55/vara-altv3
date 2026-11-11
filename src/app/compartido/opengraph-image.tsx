import { ogCard, OG_SIZE } from '@/lib/og/card'

export const alt = 'Te compartieron el análisis de una propiedad en VARA'
export const size = OG_SIZE
export const contentType = 'image/png'

export default function Image() {
  return ogCard({
    eyebrow: 'Te compartieron un análisis',
    title: 'Mirá lo que VARA encontró sobre esta propiedad',
    subtitle: 'Precio frente a avisos parecidos, costo total con gastos y qué preguntarle al vendedor.',
  })
}
