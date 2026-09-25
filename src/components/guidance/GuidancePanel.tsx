'use client'
import { useRouter } from 'next/navigation'
import { X, CheckCircle2, Circle, AlertTriangle, ChevronRight, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGuidance } from '@/hooks/useGuidance'
import type { GuidanceStep } from '@/lib/guidanceEngine'

interface GuidancePanelProps {
  open: boolean
  onClose: () => void
}

export function GuidancePanel({ open, onClose }: GuidancePanelProps) {
  const { summary, allSteps, dismiss, resetAll } = useGuidance()
  const router = useRouter()

  function handlePrimaryAction(step: GuidanceStep) {
    const action = step.actions.find(a => a.primary)
    if (!action) return
    if (action.type === 'navigate' && action.payload) {
      router.push(action.payload)
      onClose()
    } else if (action.type === 'open_vara_visit') {
      router.push('/vara-visit')
      onClose()
    } else if (action.type === 'dismiss') {
      dismiss(step.id)
    }
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed right-0 top-0 bottom-0 z-50 w-[340px] max-w-[100vw] bg-slate-900 border-l border-slate-800 flex flex-col transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
        aria-label="Panel de guía VARA"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-white font-semibold text-sm">✦ Guiame</h2>
            <p className="text-slate-500 text-[11px]">
              {summary.mode === 'BUY' ? 'Comprando tu propiedad' : 'Vendiendo tu propiedad'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Cerrar panel"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 border-b border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">Progreso</span>
            <span className="text-xs font-semibold text-brand-400">{summary.progressPct}%</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-500"
              style={{ width: `${summary.progressPct}%` }}
            />
          </div>
          <div className="mt-3 space-y-1">
            {summary.completedItems.map(item => (
              <div key={item} className="flex items-center gap-2 text-xs text-slate-400">
                <CheckCircle2 size={12} className="text-emerald-500 flex-shrink-0" />
                <span>{item}</span>
              </div>
            ))}
            {summary.pendingItems.map(item => (
              <div key={item} className="flex items-center gap-2 text-xs text-slate-500">
                <AlertTriangle size={12} className="text-amber-500/70 flex-shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
          {allSteps.length === 0 ? (
            <div className="text-center py-10 text-slate-600">
              <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500/40" />
              <p className="text-sm">Todo está en orden</p>
            </div>
          ) : (
            allSteps.map(step => (
              <div
                key={step.id}
                className="rounded-xl border border-slate-800 bg-slate-800/40 p-3 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <Circle size={13} className="mt-0.5 flex-shrink-0 text-slate-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-200 leading-snug">
                      {step.headline}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                      {step.subtext}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => handlePrimaryAction(step)}
                        className="flex items-center gap-1 text-[11px] text-brand-400 hover:text-brand-300 font-medium transition-colors"
                      >
                        {step.actions.find(a => a.primary)?.label ?? 'Ver'}
                        <ChevronRight size={11} />
                      </button>
                      {step.dismissible && (
                        <button
                          onClick={() => dismiss(step.id)}
                          className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors"
                        >
                          Ignorar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-800">
          <button
            onClick={resetAll}
            className="flex items-center gap-2 text-[11px] text-slate-600 hover:text-slate-400 transition-colors"
          >
            <RotateCcw size={11} />
            Restablecer guía
          </button>
        </div>
      </aside>
    </>
  )
}
