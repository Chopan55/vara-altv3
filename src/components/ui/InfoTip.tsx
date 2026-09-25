'use client'
import { useState, useRef, useEffect, useId } from 'react'
import { HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Explicación breve junto a un término que no se entiende solo.
 *
 * En celular no hay hover, así que funciona por tap y se cierra tocando afuera.
 * No reemplaza a la Guía: acá va una oración; lo largo vive en /guia.
 */
export function InfoTip({
  children,
  label = 'Qué significa',
  align = 'left',
  className,
}: {
  children: React.ReactNode
  /** Se lee en lector de pantalla y como title del botón. */
  label?: string
  align?: 'left' | 'right'
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <span ref={ref} className={cn('relative inline-flex items-center', className)}>
      <button
        type="button"
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o) }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        className="text-slate-300 hover:text-slate-500 transition-colors p-0.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        <HelpCircle size={12} aria-hidden="true" />
      </button>

      {open && (
        <span
          id={id}
          role="tooltip"
          className={cn(
            'absolute bottom-full mb-1.5 z-50 w-56 rounded-xl bg-slate-900 px-3 py-2 shadow-xl',
            'text-[11px] font-normal leading-relaxed text-slate-100 normal-case tracking-normal',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {children}
        </span>
      )}
    </span>
  )
}
