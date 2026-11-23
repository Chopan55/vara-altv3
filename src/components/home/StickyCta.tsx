'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

/**
 * Barra que acompaña al bajar por la portada: la acción principal siempre a mano.
 * Aparece recién después del hero (ahí ya está el campo para pegar el link).
 */
export function StickyCta() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 900)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const toHero = () => {
    const input = document.getElementById('hero-url')
    if (!input) return
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    input.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' })
    ;(input as HTMLInputElement).focus({ preventScroll: true })
  }

  return (
    <div aria-hidden={!show} inert={!show}
      className={`fixed inset-x-0 bottom-3 z-40 flex justify-center pl-4 pr-20 sm:px-4 transition-all duration-300 print:hidden ${show ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0'}`}>
      <div className="flex w-full max-w-md items-center gap-2 rounded-2xl border border-line bg-white/95 p-2 shadow-lg backdrop-blur">
        <button type="button" onClick={toHero}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">
          Pegá el link del aviso <ArrowRight size={16} aria-hidden="true" />
        </button>
        <Link href="/analizar?ejemplo=1"
          className="inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">
          Ver ejemplo
        </Link>
      </div>
    </div>
  )
}
