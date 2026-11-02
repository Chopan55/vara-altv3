'use client'
import Link from 'next/link'
import { ArrowLeft, Globe, Check } from 'lucide-react'
import { useCountryPreference, SUPPORTED_COUNTRIES } from '@/hooks/useCountryPreference'
import { getJurisdiction } from '@/lib/jurisdiction'
import { cn } from '@/lib/utils'

export default function ConfiguracionPage() {
  const { country, setCountry } = useCountryPreference()

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard" className="text-slate-400 hover:text-slate-700 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-[var(--foreground)] leading-tight">Configuración</h1>
            <p className="text-xs text-slate-400 mt-0.5">Tu mercado y preferencias</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-5 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Globe size={16} className="text-brand-500" />
            <h2 className="text-sm font-bold text-slate-800">País de tu operación</h2>
          </div>
          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
            VARA adapta la terminología, las etapas, los impuestos y los profesionales al
            país que elijas. Podés cambiarlo cuando quieras — el cambio aplica a nuevas
            operaciones.
          </p>

          <div className="grid gap-3">
            {SUPPORTED_COUNTRIES.map(c => {
              const j = getJurisdiction(c.code)
              const isSelected = country === c.code
              return (
                <button
                  key={c.code}
                  onClick={() => setCountry(c.code)}
                  className={cn(
                    'w-full text-left rounded-xl border p-4 transition-all',
                    isSelected
                      ? 'border-brand-300 bg-brand-50'
                      : 'border-slate-200 hover:border-brand-200 hover:bg-slate-50',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl leading-none">{c.flag}</span>
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">{c.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Moneda: {c.currency} · Cierre: {j.closingStageLabel} · Profesional:{' '}
                          {j.professionalLabels.CLOSING_PROFESSIONAL}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0">
                        <Check size={11} className="text-white" />
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Preview de terminología para el país activo */}
          {(() => {
            const j = getJurisdiction(country)
            const rows = [
              { label: 'Profesional de cierre', value: j.professionalLabels.CLOSING_PROFESSIONAL },
              { label: 'Etapa final',            value: j.closingStageLabel },
              { label: 'Impuesto transferencia', value: j.transferTaxLabel },
              { label: 'Seña inicial',           value: j.depositLabel },
            ]
            return (
              <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                  Cómo aparece en tu cuenta ahora
                </p>
                <div className="space-y-1.5">
                  {rows.map(row => (
                    <div key={row.label} className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-500">{row.label}</span>
                      <span className="text-[10px] font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>

        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-600 mb-1">Próximos mercados</p>
          <p className="text-xs text-slate-500 leading-relaxed">
            Chile, Colombia, Perú, Uruguay, Brasil. Cada Jurisdiction Pack incluye la
            terminología, los impuestos, el workflow legal y las plantillas de documentos
            del mercado.
          </p>
        </div>
      </div>
    </div>
  )
}
