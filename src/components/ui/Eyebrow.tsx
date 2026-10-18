import { cn } from '@/lib/utils'

/** Etiqueta corta sobre un titular. Una por sección, en minúscula y sin tracking: ancla, no grita. */
export function Eyebrow({ children, tone = 'brand', className }: { children: React.ReactNode; tone?: 'brand' | 'accent' | 'light'; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
        tone === 'brand' && 'bg-brand-50 text-brand-700',
        tone === 'accent' && 'bg-accent-soft text-teal-800',
        tone === 'light' && 'bg-white/10 text-white',
        className,
      )}
    >
      {children}
    </span>
  )
}
