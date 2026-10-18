'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, BookOpen, ListChecks } from 'lucide-react'
import { useGuidance } from '@/hooks/useGuidance'
import { useTour } from '@/hooks/useTour'
import { GuidancePanel } from './GuidancePanel'
import { TourOverlay } from './TourOverlay'

/**
 * Guíame vive en dos piezas a propósito:
 *
 *  - `GuiameTrigger`: el botón. Va en la barra superior, donde no choca con el
 *    botón flotante del chat (antes los dos estaban pegados en el mismo rincón).
 *  - `GuiameButton`: el menú, el panel y el tour. Se montan en la raíz de la
 *    pantalla y no dentro de la barra, porque la barra tiene desenfoque de fondo
 *    y eso rompe el `position: fixed` de todo lo que lleve adentro.
 *
 * El estado de "menú abierto" lo maneja quien las monta.
 */

export function GuiameTrigger({ expanded, onClick }: { expanded: boolean; onClick: () => void }) {
  const { allSteps } = useGuidance()
  const count = allSteps.length

  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="menu"
      aria-expanded={expanded}
      className="relative inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-white shadow-sm transition-[filter,transform] hover:brightness-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1357ec]"
      style={{ background: 'linear-gradient(155deg, #0a45d6 0%, #1357ec 55%, #2a6df5 100%)' }}
    >
      <Sparkles size={15} aria-hidden="true" />
      <span className="hidden sm:inline">{count > 0 ? `${count} ${count === 1 ? 'paso pendiente' : 'pasos pendientes'}` : 'Qué hago ahora'}</span>
      {count > 0 && (
        <span
          className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/25 px-1 text-[11px] font-bold sm:hidden"
          aria-label={`${count} ${count === 1 ? 'paso pendiente' : 'pasos pendientes'}`}
        >
          {count}
        </span>
      )}
    </button>
  )
}

interface GuiameHostProps {
  menuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
}

export function GuiameButton({ menuOpen, onMenuOpenChange }: GuiameHostProps) {
  const [panelOpen, setPanelOpen] = useState(false)
  const { allSteps } = useGuidance()
  const { activeTour, stepIndex, isActive, next, prev, close } = useTour()
  const count = allSteps.length

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onMenuOpenChange(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen, onMenuOpenChange])

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
        <>
          <div className="fixed inset-0 z-40" onClick={() => onMenuOpenChange(false)} aria-hidden="true" />
          <div
            role="menu"
            aria-label="Guíame"
            className="fixed right-4 top-16 z-50 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl lg:right-6"
          >
            {/* El tour de 5 pasos no cambiaba de pantalla y se veía una sola vez.
                La guía real son las etapas del proceso, siempre disponibles. */}
            <Link
              role="menuitem"
              href="/guia"
              onClick={() => onMenuOpenChange(false)}
              className="flex items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
            >
              <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <BookOpen size={15} aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900">Guía del proceso</span>
                <span className="block text-xs text-slate-500">Qué significa cada paso</span>
              </span>
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => { onMenuOpenChange(false); setPanelOpen(true) }}
              className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
            >
              <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <ListChecks size={15} aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900">Tu camino</span>
                <span className="block text-xs text-slate-500">
                  {count > 0 ? `${count} paso${count > 1 ? 's' : ''} pendiente${count > 1 ? 's' : ''}` : 'Todo en orden'}
                </span>
              </span>
            </button>
          </div>
        </>
      )}

      <GuidancePanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  )
}
