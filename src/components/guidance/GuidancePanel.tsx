'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, CheckCircle2, Circle, ChevronRight, RotateCcw, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGuidance } from '@/hooks/useGuidance'
import type { GuidanceStep } from '@/lib/guidanceEngine'

interface GuidancePanelProps {
  open: boolean
  onClose: () => void
}

/**
 * "Tu camino": qué hiciste, qué falta y qué sigue.
 *
 * Mismo lenguaje visual que el próximo paso (cabecera azul, tarjetas claras) y
 * texto con contraste suficiente: antes era gris sobre casi negro y costaba leerlo.
 */
export function GuidancePanel({ open, onClose }: GuidancePanelProps) {
  const { summary, allSteps, dismiss, resetAll } = useGuidance()
  const router = useRouter()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

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
          className="fixed inset-0 z-50 bg-slate-900/35 backdrop-blur-[2px]"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        role="dialog"
        aria-modal={open}
        aria-hidden={!open}
        aria-label="Tu camino con VARA"
        className={cn(
          'fixed right-0 top-0 bottom-0 z-50 flex w-[380px] max-w-[100vw] flex-col bg-slate-50 shadow-2xl transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <header
          className="relative overflow-hidden px-5 pb-5 pt-5 text-white"
          style={{ background: 'linear-gradient(155deg, #0a45d6 0%, #1357ec 52%, #2a6df5 100%)' }}
        >
          <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full bg-white/20 blur-3xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/40 backdrop-blur">
                <Sparkles size={17} aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-lg font-semibold leading-tight tracking-tight">Tu camino</h2>
                <p className="text-xs text-white/90">
                  {summary.mode === 'BUY' ? 'Comprando tu propiedad' : 'Vendiendo tu propiedad'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="rounded-lg p-1.5 text-white/90 transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="relative mt-5">
            <div className="flex items-end justify-between">
              <span className="text-xs font-medium text-white/90">Tu avance</span>
              <span className="text-2xl font-semibold tabular-nums leading-none">{summary.progressPct}%</span>
            </div>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-white/25"
              role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={summary.progressPct}
            >
              <div
                className="h-full rounded-full bg-white transition-all duration-500"
                style={{ width: `${summary.progressPct}%` }}
              />
            </div>
          </div>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {(summary.completedItems.length > 0 || summary.pendingItems.length > 0) && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Dónde estás</h3>
              <ul className="space-y-2">
                {summary.completedItems.map(item => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-slate-700">
                    <CheckCircle2 size={16} className="flex-shrink-0 text-emerald-500" aria-hidden="true" />
                    {item}
                  </li>
                ))}
                {summary.pendingItems.map(item => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-slate-900">
                    <Circle size={16} className="flex-shrink-0 text-amber-500" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="mb-2.5 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Lo que sigue</h3>
            {allSteps.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center shadow-sm">
                <CheckCircle2 size={30} className="mx-auto mb-2 text-emerald-500" aria-hidden="true" />
                <p className="text-sm font-semibold text-slate-900">Todo está en orden</p>
                <p className="mt-0.5 text-xs text-slate-500">Cuando haya algo para hacer, aparece acá.</p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {allSteps.map(step => (
                  <li key={step.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-sm font-semibold leading-snug text-slate-900">{step.headline}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">{step.subtext}</p>
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handlePrimaryAction(step)}
                        className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                      >
                        {step.actions.find(a => a.primary)?.label ?? 'Ver'}
                        <ChevronRight size={13} aria-hidden="true" />
                      </button>
                      {step.dismissible && (
                        <button
                          type="button"
                          onClick={() => dismiss(step.id)}
                          className="text-xs font-medium text-slate-500 transition-colors hover:text-slate-800"
                        >
                          Ignorar
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <footer className="border-t border-slate-200 bg-white px-5 py-3">
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 transition-colors hover:text-slate-800"
          >
            <RotateCcw size={12} aria-hidden="true" />
            Restablecer guía
          </button>
        </footer>
      </aside>
    </>
  )
}
