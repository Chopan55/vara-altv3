import { ogCard, OG_SIZE } from '@/lib/og/card'

export const alt = 'VARA: comprá o vendé tu propiedad sin inmobiliaria y sin pagar comisión inmobiliaria'
export const size = OG_SIZE
export const contentType = 'image/png'

export default function Image() {
  return ogCard({
    eyebrow: 'Comprá y vendé a tu manera',
    title: 'Comprá o vendé tu propiedad sin inmobiliaria y sin pagar comisión inmobiliaria',
    subtitle: 'Pegá el link del aviso: costo total, precio frente a avisos parecidos y qué preguntar antes de avanzar.',
  })
}
