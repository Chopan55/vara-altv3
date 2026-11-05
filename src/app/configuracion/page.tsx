'use client'
import Link from 'next/link'
import { ArrowLeft, Globe, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCountryPreference, SUPPORTED_COUNTRIES, OPERABLE_COUNTRIES } from '@/hooks/useCountryPreference'
import { useOperations } from '@/hooks/useOperations'
import { useVaraState } from '@/hooks/useVaraState'
import { getJurisdiction } from '@/lib/jurisdiction'
import { journeyToStored } from '@/lib/journey'
import { cn } from '@/lib/utils'
import { EmailAlertsCard } from '@/components/settings/EmailAlertsCard'

export default function ConfiguracionPage() {
  const { country, setCountry } = useCountryPreference()
  const router = useRouter()
  const vara = useVaraState()
  const { operations, activeOperation } = useOperations()
  const opsHere = operations.filter(o => (o.country ?? 'AR') === country)
  const canOperate = OPERABLE_COUNTRIES.includes(country)

  // Pasar a una operación es cambiar de país: cada operación guarda el suyo.
  const openOperation = (id: string, type: 'BUY' | 'SELL') => {
    vara.setJourneyType(journeyToStored(type))
    vara.setOperationId(id)
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard" aria-label="Volver" className="-m-2 p-2 text-slate-400 hover:text-slate-700 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-[var(--foreground)] leading-tight">Configuración</h1>
            <p className="text-xs text-slate-400 mt-0.5">Tu mercado, tus operaciones y tus alertas</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-5 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Globe size={16} className="text-brand-500" />
            <h2 className="text-sm font-bold text-slate-800">País</h2>
          </div>
          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
            Cada operación tiene su país y VARA adapta a él las etapas, los documentos, los impuestos
            y los profesionales. Podés tener operaciones en Argentina y en México a la vez: para
            pasar de un país a otro, abrí una operación de ese país. El país que elijas acá es el que
            aparece primero al crear una operación nueva.
          </p>
          {activeOperation && (
            <p className="mb-4 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Ahora estás en <strong>{activeOperation.title}</strong> ·{' '}
              {getJurisdiction(activeOperation.country ?? 'AR').countryName}
            </p>
          )}

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
                        <p className="flex items-center gap-2 font-semibold text-slate-900 text-sm">
                          {c.name}
                          {j.readiness === 'validation' && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">En validación</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Moneda: {c.currency} · Cierre: {j.closingStageLabel} · Profesional:{' '}
                          {j.professionalLabels.CLOSING_PROFESSIONAL}
                        </p>
                        {j.readinessNote && (
                          <p className="text-[11px] text-amber-700 mt-1">{j.readinessNote}</p>
                        )}
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
                {!j.hasCostEngine && (
                  <p className="mt-3 text-[11px] leading-relaxed text-amber-800">
                    Para {j.countryName} VARA todavía no calcula costos ni impuestos: no mostramos
                    números hasta validarlos con un profesional local. Las operaciones nuevas se
                    siguen creando con Argentina o México.
                  </p>
                )}
              </div>
            )
          })()}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-5 mb-4">
          <h2 className="text-sm font-bold text-slate-800 mb-1">
            Tus operaciones en {getJurisdiction(country).countryName}
          </h2>
          {opsHere.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {opsHere.map(o => (
                <li key={o.id}>
                  <button type="button" onClick={() => openOperation(o.id, o.type)}
                    className={cn('flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm',
                      o.id === activeOperation?.id ? 'border-brand-300 bg-brand-50' : 'border-slate-200 hover:border-brand-200')}>
                    <span className="min-w-0 truncate font-semibold text-slate-800">{o.title}</span>
                    <span className="ml-2 flex-shrink-0 text-xs text-slate-500">
                      {o.type === 'SELL' ? 'Venta' : 'Compra'} · {o.id === activeOperation?.id ? 'Activa' : 'Abrir'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-slate-500">Todavía no tenés operaciones en este país.</p>
          )}
          {canOperate ? (
            <Link href={`/onboarding?country=${country}`}
              className="mt-3 inline-block rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white">
              Nueva operación en {getJurisdiction(country).countryName}
            </Link>
          ) : (
            <p className="mt-3 text-xs text-amber-700">
              Todavía no se pueden crear operaciones en {getJurisdiction(country).countryName}.
            </p>
          )}
        </div>

        <EmailAlertsCard />

        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-600 mb-1">Próximos mercados</p>
          <p className="text-xs text-slate-500 leading-relaxed">
            Perú, Uruguay y Brasil. Un país pasa de &quot;En validación&quot; a activo cuando
            un profesional local valida sus costos, impuestos y documentos.
          </p>
        </div>
      </div>
    </div>
  )
}
