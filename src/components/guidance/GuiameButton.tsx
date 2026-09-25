'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Sparkles, BookOpen, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useGuidance } from '@/hooks/useGuidance'
import { useTour } from '@/hooks/useTour'
import { GuidancePanel } from './GuidancePanel'
import { TourOverlay } from './TourOverlay'

const ROUTE_TOURS: Record<string, string> = {
  '/dashboard': 'tour_bienvenida',
  '/operacion': 'tour_operacion',
  '/costos':    'tour_costos',
}

function resolveRouteToTour(pathname: string): string {
  for (const [prefix, tourId] of Object.entries(ROUTE_TOURS)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return tourId
  }
  return 'tour_bienvenida'
}

export function GuiameButton() {
  const [panelOpen, setPanelOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()
  const { allSteps } = useGuidance()
  const { activeTour, stepIndex, isActive, startTour, next, prev, close, isCompleted } = useTour()

  const count = allSteps.length
  const tourId = resolveRouteToTour(pathname)

  function handleStartTour() {
    setMenuOpen(false)
    startTour(tourId)
  }

  return (
    <>
      {isActive && activeTour && (
        <TourOverlay
          step={activeTour.pasos[stepIndex]}
          stepIndex={stepIndex}
          totalSteps={activeTour.pasos.length}
          tourName={activeTour.nombre}
          onNext={next}
          onPrev={prev}
          onClose={close}
        />
      )}

      {menuOpen && !isActive && (
        <div className="fixed bottom-20 right-6 z-50 bg-white rounded-2xl shadow-2xl border border-slate-100 p-3 w-52 space-y-1">
          <div className="flex items-center justify-between px-1 pb-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">VARA Guía</p>
            <button onClick={() => setMenuOpen(false)} className="text-slate-300 hover:text-slate-500">
              <X size={13} />
            </button>
          </div>
          {/* El tour de 5 pasos no cambiaba de pantalla y se veía una sola vez.
              La guía real son las etapas del proceso, siempre disponibles. */}
          <Link
            href="/guia"
            onClick={() => setMenuOpen(false)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left"
          >
            <BookOpen size={14} className="text-brand-500 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-slate-800">Guía del proceso</p>
              <p className="text-[10px] text-slate-400">Qué significa cada paso</p>
            </div>
          </Link>
          <button
            onClick={() => { setMenuOpen(false); setPanelOpen(true) }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left"
          >
            <Sparkles size={14} className="text-brand-500 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-slate-800">Próximos pasos</p>
              {count > 0 && <p className="text-[10px] text-slate-400">{count} pendiente{count > 1 ? 's' : ''}</p>}
            </div>
          </button>
        </div>
      )}

      <button
        onClick={() => setMenuOpen(o => !o)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full bg-brand-600 text-white text-sm font-semibold shadow-lg hover:bg-brand-400 transition-all hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        aria-label="Abrir guía VARA"
      >
        <Sparkles size={15} className="flex-shrink-0" />
        <span>✦ Guiame</span>
        {count > 0 && !isActive && (
          <span className="ml-1 w-5 h-5 rounded-full bg-slate-900/30 text-[10px] font-bold flex items-center justify-center">
            {count}
          </span>
        )}
      </button>

      <GuidancePanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  )
}
