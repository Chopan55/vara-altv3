import { ogCard, OG_SIZE } from '@/lib/og/card'

export const alt = 'VARA: cuánto te sale de verdad una propiedad'
export const size = OG_SIZE
export const contentType = 'image/png'

export default function Image() {
  return ogCard({
    eyebrow: 'Comprá y vendé a tu manera',
    title: '¿Cuánto te sale de verdad esa propiedad?',
    subtitle: 'Pegá el link del aviso: costo total, precio frente a avisos parecidos y qué preguntar antes de avanzar.',
  })
}
