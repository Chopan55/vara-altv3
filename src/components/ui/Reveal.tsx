'use client'
import { useEffect, useRef, useState } from 'react'

/**
 * Aparece suave al entrar en pantalla. Sin JavaScript, o con «reducir movimiento»,
 * el contenido se ve igual desde el principio: nada queda escondido.
 */
export function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'idle' | 'hidden' | 'shown'>('idle')
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const r = el.getBoundingClientRect()
    if (r.top < window.innerHeight) return // ya está a la vista: no se anima
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setState('shown'); io.disconnect() }
    }, { threshold: 0.15 })
    setState('hidden')
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} style={{ transitionDelay: `${delay}ms` }}
      className={`${state === 'hidden' ? 'translate-y-4 opacity-0' : 'translate-y-0 opacity-100'} transition duration-700 ease-out ${className}`}>
      {children}
    </div>
  )
}
