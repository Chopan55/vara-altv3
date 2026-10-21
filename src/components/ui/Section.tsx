import { cn } from '@/lib/utils'

type Tone = 'base' | 'alt' | 'brand'

const TONE: Record<Tone, string> = {
  base: 'bg-surface text-ink',
  alt: 'bg-surface-alt text-ink',
  brand: 'bg-brand-900 text-white',
}

interface Props {
  id?: string
  tone?: Tone
  /** 'lg' = respiración de marketing (96–120 px); 'md' = bloques más chicos. */
  space?: 'md' | 'lg'
  width?: 'narrow' | 'normal' | 'wide'
  className?: string
  children: React.ReactNode
}

const WIDTH = { narrow: 'max-w-3xl', normal: 'max-w-6xl', wide: 'max-w-7xl' }

/** Franja de página: alterna fondos para dar ritmo y fija el ancho y el espacio vertical. */
export function Section({ id, tone = 'base', space = 'lg', width = 'normal', className, children }: Props) {
  return (
    <section id={id} className={cn(TONE[tone], space === 'lg' ? 'py-20 md:py-28' : 'py-12 md:py-16')}>
      <div className={cn('mx-auto px-5 md:px-8', WIDTH[width], className)}>{children}</div>
    </section>
  )
}
