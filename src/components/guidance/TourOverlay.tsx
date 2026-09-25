'use client'
import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import type { TourStep } from '@/data/tours'
import { cn } from '@/lib/utils'

interface TooltipPos {
  top: number
  left: number
  arrowSide: 'top' | 'bottom' | 'left' | 'right'
}

interface SpotlightRect { top: number; left: number; width: number; height: number }

function computeTooltipPos(rect: DOMRect, placement: TourStep['placement'], tooltipW = 280, tooltipH = 160): TooltipPos {
  const gap = 12
  switch (placement) {
    case 'right':
      return { top: rect.top + rect.height / 2 - tooltipH / 2, left: rect.right + gap, arrowSide: 'left' }
    case 'left':
      return { top: rect.top + rect.height / 2 - tooltipH / 2, left: rect.left - tooltipW - gap, arrowSide: 'right' }
    case 'bottom':
      return { top: rect.bottom + gap, left: rect.left + rect.width / 2 - tooltipW / 2, arrowSide: 'top' }
    case 'top':
    default:
      return { top: rect.top - tooltipH - gap, left: rect.left + rect.width / 2 - tooltipW / 2, arrowSide: 'bottom' }
  }
}

function clamp(val: number, min: number, max: number) { return Math.max(min, Math.min(max, val)) }

interface Props {
  step: TourStep
  stepIndex: number
  totalSteps: number
  tourName: string
  onNext: () => void
  onPrev: () => void
  onClose: () => void
}

export function TourOverlay({ step, stepIndex, totalSteps, tourName, onNext, onPrev, onClose }: Props) {
  const [pos, setPos] = useState<TooltipPos | null>(null)
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const updatePosition = useCallback(() => {
    const el = document.querySelector(step.selector)
    if (!el) {
      setPos({ top: window.innerHeight / 2 - 80, left: window.innerWidth / 2 - 140, arrowSide: 'top' })
      setSpotlight(null)
      return
    }
    const rect = el.getBoundingClientRect()
    const raw = computeTooltipPos(rect, step.placement)
    const maxLeft = window.innerWidth - 292
    setPos({ ...raw, left: clamp(raw.left, 8, maxLeft) })
    setSpotlight({ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8 })
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [step])

  useEffect(() => {
    updatePosition()
    window.addEventListener('resize', updatePosition)
    return () => window.removeEventListener('resize', updatePosition)
  }, [updatePosition])

  if (!mounted || !pos) return null

  const arrowClasses: Record<string, string> = {
    top:    'top-0 left-1/2 -translate-x-1/2 -translate-y-full border-x-transparent border-t-transparent border-b-white',
    bottom: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-full border-x-transparent border-b-transparent border-t-white',
    left:   'left-0 top-1/2 -translate-y-1/2 -translate-x-full border-y-transparent border-l-transparent border-r-white',
    right:  'right-0 top-1/2 -translate-y-1/2 translate-x-full border-y-transparent border-r-transparent border-l-white',
  }

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[9998]"
        style={{ background: 'rgba(15,23,42,0.65)' }}
        onClick={onClose}
      />

      {spotlight && (
        <div
          className="fixed z-[9999] rounded-xl ring-2 ring-brand-400/80 pointer-events-none transition-all duration-200"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            boxShadow: '0 0 0 9999px rgba(15,23,42,0.65)',
            background: 'transparent',
          }}
        />
      )}

      <div
        className="fixed z-[10000] w-[280px] bg-white rounded-2xl shadow-2xl p-4"
        style={{ top: pos.top, left: pos.left }}
        onClick={e => e.stopPropagation()}
      >
        <div className={cn('absolute w-0 h-0 border-8', arrowClasses[pos.arrowSide])} />

        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0">
              <span className="text-[8px] font-extrabold text-slate-900">V</span>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{tourName}</p>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-500 transition-colors">
            <X size={14} />
          </button>
        </div>

        <p className="font-bold text-slate-900 text-sm mb-1">{step.title}</p>
        <p className="text-xs text-slate-500 leading-relaxed mb-4">{step.body}</p>

        <div className="flex items-center justify-between">
          <p className="text-[10px] text-slate-400">{stepIndex + 1} de {totalSteps}</p>
          <div className="flex gap-1.5">
            {stepIndex > 0 && (
              <button
                onClick={onPrev}
                className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-700 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <ChevronLeft size={12} /> Anterior
              </button>
            )}
            <button
              onClick={onNext}
              className="flex items-center gap-1 text-[11px] font-bold bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              {stepIndex + 1 === totalSteps ? 'Listo' : 'Siguiente'} <ChevronRight size={12} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center gap-1 mt-3">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn('w-1.5 h-1.5 rounded-full transition-colors',
                i === stepIndex ? 'bg-brand-500' : 'bg-slate-200')}
            />
          ))}
        </div>
      </div>
    </>,
    document.body
  )
}
