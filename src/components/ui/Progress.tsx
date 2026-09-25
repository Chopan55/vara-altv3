import { cn } from '@/lib/utils'

interface ProgressProps {
  value: number
  size?: 'sm' | 'md'
  showLabel?: boolean
  className?: string
}

export function Progress({ value, size = 'md', showLabel, className }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className={cn('flex-1 bg-slate-100 rounded-full overflow-hidden', size === 'sm' ? 'h-1.5' : 'h-2')}>
        <div
          className="h-full bg-brand-600 rounded-full transition-all duration-500"
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && <span className="text-xs font-semibold text-slate-500 w-8 text-right">{clamped}%</span>}
    </div>
  )
}
