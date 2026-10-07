'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { emptyRentalInput, runRentalCheck } from '@/lib/rentals'
import type { RentalCheckResult as RentalCheckData, RentalCountry, RentalInput } from '@/lib/rentals'
import { RentalCheckForm } from '@/components/rentals/RentalCheckForm'
import type { FieldUpdater } from '@/components/rentals/RentalCheckForm'
import { RentalCheckResult } from '@/components/rentals/RentalCheckResult'

type Outcome = { ok: true; result: RentalCheckData } | { ok: false }

/**
 * Estado de la pantalla: los datos cargados y si ya se pidió la revisión.
 * Toda la lógica legal vive en `runRentalCheck`; acá solo se conecta el
 * formulario con el resultado.
 */
export function RentalCheckApp() {
  const [input, setInput] = useState<RentalInput>(() => emptyRentalInput('AR'))
  const [submitted, setSubmitted] = useState(false)
  // Cambia al limpiar o cambiar de país: reinicia el texto tipeado en los campos numéricos.
  const [resetKey, setResetKey] = useState(0)
  const [scrollTick, setScrollTick] = useState(0)
  const resultRef = useRef<HTMLDivElement>(null)

  const outcome = useMemo<Outcome | null>(() => {
    if (!submitted) return null
    try {
      return { ok: true, result: runRentalCheck(input) }
    } catch (error) {
      console.error('[alquileres] No se pudo calcular la revisión', error)
      return { ok: false }
    }
  }, [submitted, input])

  // Al pedir la revisión se lleva la vista (y el foco) al resultado.
  useEffect(() => {
    const el = resultRef.current
    if (scrollTick === 0 || !el) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
    el.focus({ preventScroll: true })
  }, [scrollTick])

  const handleChange = useCallback<FieldUpdater>((key, value) => {
    setInput(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleCountryChange = useCallback((country: RentalCountry) => {
    setInput(prev => (prev.country === country ? prev : emptyRentalInput(country)))
    setSubmitted(false)
    setResetKey(k => k + 1)
  }, [])

  const handleSubmit = useCallback(() => {
    setSubmitted(true)
    setScrollTick(t => t + 1)
  }, [])

  const handleReset = useCallback(() => {
    setInput(prev => emptyRentalInput(prev.country))
    setSubmitted(false)
    setResetKey(k => k + 1)
  }, [])

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 pb-20 space-y-6">
      <RentalCheckForm
        input={input}
        resetKey={resetKey}
        submitted={submitted}
        onChange={handleChange}
        onCountryChange={handleCountryChange}
        onSubmit={handleSubmit}
        onReset={handleReset}
      />

      {outcome && (
        <div ref={resultRef} tabIndex={-1} className="scroll-mt-20 outline-none">
          {outcome.ok ? (
            <RentalCheckResult result={outcome.result} role={input.role} />
          ) : (
            <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              No se pudo completar la revisión con los datos cargados. Revisar los valores e intentar de nuevo.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
