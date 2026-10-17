import Link from 'next/link'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'md' | 'lg'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-soft',
  secondary: 'bg-white text-ink border border-line hover:border-brand-300 hover:text-brand-700',
  ghost: 'text-brand-700 hover:bg-brand-50',
}
const SIZE: Record<Size, string> = {
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3.5 text-base',
}

interface Props {
  href: string
  variant?: Variant
  size?: Size
  className?: string
  children: React.ReactNode
}

/** Botón-enlace de la marca. Un solo primario por vista; el resto, secondary o ghost. */
export function ButtonLink({ href, variant = 'primary', size = 'md', className, children }: Props) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2',
        VARIANT[variant], SIZE[size], className,
      )}
    >
      {children}
    </Link>
  )
}
