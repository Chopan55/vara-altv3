'use client'
import { useRouter } from 'next/navigation'
import { X, AlertTriangle, Info, HelpCircle, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGuidance } from '@/hooks/useGuidance'
import type { GuidanceStep, GuidanceStepType } from '@/lib/guidanceEngine'

const ICONS: Record<GuidanceStepType, React.ElementType> = {
  warning: AlertTriangle,
  question: HelpCircle,
  action: Zap,
  info: Info,
  resume: Zap,
}

const COLORS: Record<GuidanceStepType, string> = {
  warning: 'border-red-200 bg-red-50 text-red-900',
  question: 'border-brand-200 bg-brand-50 text-slate-800',
  action: 'border-amber-200 bg-amber-50 text-amber-900',
  info: 'border-slate-200 bg-white text-slate-700',
  resume: 'border-amber-200 bg-amber-50 text-amber-900',
}

export function GuidanceBanner({ className }: { className?: string }) {
  const { nextStep, dismiss } = useGuidance()
  const router = useRouter()

  if (!nextStep) return null

  const Icon = ICONS[nextStep.type]
  const colorClass = COLORS[nextStep.type]

  function handleAction(step: GuidanceStep, actionIndex: number) {
    const action = step.actions[actionIndex]
    if (!action) return
    if (action.type === 'navigate' && action.payload) {
      router.push(action.payload)
    } else if (action.type === 'dismiss') {
      dismiss(step.id)
    } else if (action.type === 'open_vara_visit') {
      router.push('/vara-visit')
    }
  }

  const primaryAction = nextStep.actions.find(a => a.primary)
  const secondaryAction = nextStep.actions.find(a => !a.primary && a.type !== 'dismiss')
  const dismissAction = nextStep.actions.find(a => a.type === 'dismiss')

  return (
    <div className={cn(
      'rounded-xl border px-4 py-3 flex items-start gap-3',
      colorClass,
      className
    )}>
      <Icon size={16} className="mt-0.5 flex-shrink-0" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-snug">{nextStep.headline}</p>
        <p className="text-xs mt-0.5 leading-relaxed opacity-80">{nextStep.subtext}</p>

        {nextStep.actions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2.5">
            {primaryAction && (
              <button
                onClick={() => handleAction(nextStep, nextStep.actions.indexOf(primaryAction))}
                className="px-3 py-1 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-400 transition-colors"
              >
                {primaryAction.label}
              </button>
            )}
            {secondaryAction && (
              <button
                onClick={() => handleAction(nextStep, nextStep.actions.indexOf(secondaryAction))}
                className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-medium hover:border-slate-300 transition-colors"
              >
                {secondaryAction.label}
              </button>
            )}
            {dismissAction && (
              <button
                onClick={() => dismiss(nextStep.id)}
                className="px-3 py-1 rounded-lg text-xs text-slate-500 hover:text-slate-700 transition-colors"
              >
                {dismissAction.label}
              </button>
            )}
          </div>
        )}
      </div>

      {nextStep.dismissible && (
        <button
          onClick={() => dismiss(nextStep.id)}
          className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors p-0.5"
          aria-label="Cerrar sugerencia"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
