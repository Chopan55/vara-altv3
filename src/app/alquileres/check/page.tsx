import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { FlaskConical } from 'lucide-react'
import { isEnabled } from '@/lib/flags'
import { RentalCheckApp } from '@/components/rentals/RentalCheckApp'

export const metadata: Metadata = {
  title: 'VARA Alquiler Check',
  robots: { index: false, follow: false },
}

/**
 * Laboratorio experimental. Apagado por defecto: sin el flag `rentalsCheck`
 * la ruta responde 404 y nada de este módulo queda expuesto.
 */
export default function RentalCheckPage() {
  if (!isEnabled('rentalsCheck')) notFound()

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="px-4 lg:px-6 pt-8 pb-3">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <FlaskConical size={18} className="text-brand-500" aria-hidden="true" />
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">VARA Alquiler Check</h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide bg-purple-50 text-purple-700">
              Laboratorio experimental
            </span>
          </div>
          <p className="text-sm text-slate-500 leading-relaxed">
            Entender el costo, los riesgos y qué documentar antes de firmar un alquiler.
            Herramienta orientativa: no reemplaza la revisión de un profesional.
          </p>
        </div>
      </header>

      <RentalCheckApp />
    </div>
  )
}
