import { cn } from '@/lib/utils'

/**
 * Tarjeta: solo cuando es un objeto, una acción, un resumen o un estado interactivo.
 * Si es texto corrido, va sin caja.
 */
export function Card({ children, className, as: Tag = 'div' }: { children: React.ReactNode; className?: string; as?: 'div' | 'article' | 'li' }) {
  return (
    <Tag className={cn('rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-[var(--shadow-card)]', className)}>
      {children}
    </Tag>
  )
}
