import { cn } from '@/lib/utils'

interface Props {
  src: string
  alt: string
  /** Los datos de las capturas son de ejemplo: se dice siempre. */
  caption?: string
  priority?: boolean
  className?: string
}

/** Captura real de VARA enmarcada, con profundidad sutil. El producto es el protagonista. */
export function ProductFrame({ src, alt, caption = 'Datos de ejemplo', priority, className }: Props) {
  return (
    <figure className={cn('relative', className)}>
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-[var(--shadow-product)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} loading={priority ? 'eager' : 'lazy'} className="block w-full h-auto" />
      </div>
      {caption && <figcaption className="mt-3 text-xs text-ink-soft">{caption}</figcaption>}
    </figure>
  )
}
