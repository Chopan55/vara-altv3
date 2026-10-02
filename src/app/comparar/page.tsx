'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, BarChart2, Bed, Bath, TrendingDown, TrendingUp, Minus, Sparkles } from 'lucide-react'
import { formatPrice, cn } from '@/lib/utils'
import { loadUserProperties, type UserProperty } from '@/lib/userProperties'
import { analyzePricePosition } from '@/lib/market/priceReference'

const MAX_COMPARE = 3

function PosIcon({ position }: { position: string }) {
  if (position === 'BELOW') return <TrendingDown size={11} className="text-emerald-600" />
  if (position === 'ABOVE') return <TrendingUp size={11} className="text-rose-600" />
  return <Minus size={11} className="text-slate-400" />
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? 'text-emerald-600 border-emerald-200' : score >= 60 ? 'text-amber-600 border-amber-200' : 'text-red-600 border-red-200'
  return (
    <div className={cn('w-10 h-10 rounded-full border-2 flex items-center justify-center mx-auto', color)}>
      <span className={cn('font-black text-sm leading-none', color.split(' ')[0])}>{score}</span>
    </div>
  )
}

const PROP_TYPE_LABEL: Record<string, string> = {
  HOUSE: 'Casa', APARTMENT: 'Depto.', PH: 'PH', LAND: 'Terreno',
  GARAGE: 'Cochera', LOCAL: 'Local', OFFICE: 'Oficina', FIELD: 'Campo', OTHER: 'Otro',
}

export default function CompararPage() {
  const [properties, setProperties] = useState<UserProperty[]>([])
  const [loaded, setLoaded] = useState(false)
  const [selected, setSelected] = useState<string[]>([])

  useEffect(() => {
    loadUserProperties().then(ps => {
      setProperties(ps)
      setLoaded(true)
    })
  }, [])

  const toggle = (id: string) => {
    setSelected(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length < MAX_COMPARE
        ? [...prev, id]
        : prev
    )
  }

  const compared = selected.map(id => properties.find(p => p.id === id)).filter(Boolean) as UserProperty[]

  if (!loaded) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-slate-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-4xl mx-auto px-4 py-6">

        <div className="flex items-center gap-3 mb-6">
          <Link href="/propiedades" className="text-slate-400 hover:text-slate-700 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-[var(--foreground)] leading-tight">Comparar propiedades</h1>
            <p className="text-xs text-slate-400 mt-0.5">Elegí hasta {MAX_COMPARE} para ver en paralelo</p>
          </div>
        </div>

        {properties.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-8 text-center">
            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <BarChart2 size={20} className="text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-800 mb-1">Sin propiedades guardadas</p>
            <p className="text-xs text-slate-400 max-w-xs mx-auto mb-4">
              Importá propiedades desde un aviso de Zonaprop o Argenprop para compararlas.
            </p>
            <Link href="/propiedades" className="inline-block text-xs font-bold bg-brand-600 text-white px-4 py-2 rounded-xl hover:bg-brand-700 transition-colors">
              Ir a mis propiedades →
            </Link>
          </div>
        )}

        {properties.length > 0 && (
          <div className="mb-6 space-y-2">
            {properties.map(p => {
              const isSelected = selected.includes(p.id)
              const disabled = !isSelected && selected.length >= MAX_COMPARE
              return (
                <button
                  key={p.id}
                  onClick={() => !disabled && toggle(p.id)}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-2xl border text-left transition-all w-full',
                    isSelected
                      ? 'bg-brand-50 border-brand-300'
                      : disabled
                      ? 'bg-white border-slate-200/70 opacity-40 cursor-not-allowed'
                      : 'bg-white border-slate-200/70 shadow-card hover:border-brand-300 hover:bg-brand-50/30'
                  )}
                >
                  <div className={cn(
                    'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0',
                    isSelected ? 'bg-brand-600 border-brand-600' : 'border-slate-300'
                  )}>
                    {isSelected && <span className="text-white text-[9px] font-black">✓</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{p.title}</p>
                    <p className="text-xs text-slate-400 truncate">{p.neighborhood}, {p.city}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-slate-900">{formatPrice(p.price, p.currency)}</p>
                    <p className="text-[10px] text-slate-400">{p.surface} m²</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {compared.length === 1 && (
          <p className="text-center text-sm text-slate-400 py-4">Seleccioná al menos una más para comparar</p>
        )}

        {compared.length >= 2 && (
          <div className="space-y-4">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Comparativa</h2>

            <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card overflow-hidden">
              <div className="grid border-b border-slate-100" style={{ gridTemplateColumns: `130px repeat(${compared.length}, 1fr)` }}>
                <div className="p-3" />
                {compared.map(p => (
                  <div key={p.id} className="p-3 text-center border-l border-slate-100">
                    <p className="text-[10px] font-bold text-brand-600 uppercase tracking-wider mb-0.5">{PROP_TYPE_LABEL[p.type] ?? p.type}</p>
                    <p className="text-xs font-semibold text-slate-700 leading-tight line-clamp-2">{p.title}</p>
                  </div>
                ))}
              </div>

              {([
                {
                  label: 'Precio',
                  render: (p: UserProperty) => (
                    <span className="font-extrabold text-slate-900 text-sm">{formatPrice(p.price, p.currency)}</span>
                  ),
                  bestId: compared.reduce((b, p) => p.price < b.price ? p : b, compared[0]).id,
                },
                {
                  label: 'USD/m²',
                  render: (p: UserProperty) => {
                    const usdm2 = p.surface > 0 ? Math.round(p.price / p.surface) : 0
                    const { position } = analyzePricePosition(usdm2, p.province ?? '')
                    return (
                      <span className="inline-flex items-center gap-1">
                        <span className="font-bold text-slate-800 text-sm">{usdm2.toLocaleString('es-AR')}</span>
                        <PosIcon position={position} />
                      </span>
                    )
                  },
                  bestId: [...compared].sort((a, b) => {
                    const am2 = a.surface > 0 ? a.price / a.surface : Infinity
                    const bm2 = b.surface > 0 ? b.price / b.surface : Infinity
                    return am2 - bm2
                  })[0].id,
                },
                {
                  label: 'Superficie',
                  render: (p: UserProperty) => <span className="font-bold text-slate-800 text-sm">{p.surface} m²</span>,
                  bestId: compared.reduce((b, p) => p.surface > b.surface ? p : b, compared[0]).id,
                },
                {
                  label: 'Dormitorios',
                  render: (p: UserProperty) => (
                    <span className="inline-flex items-center gap-1 font-bold text-slate-800 text-sm">
                      <Bed size={12} className="text-slate-400" /> {p.bedrooms}
                    </span>
                  ),
                  bestId: compared.reduce((b, p) => p.bedrooms > b.bedrooms ? p : b, compared[0]).id,
                },
                {
                  label: 'Baños',
                  render: (p: UserProperty) => (
                    <span className="inline-flex items-center gap-1 font-bold text-slate-800 text-sm">
                      <Bath size={12} className="text-slate-400" /> {p.bathrooms}
                    </span>
                  ),
                  bestId: compared.reduce((b, p) => p.bathrooms > b.bathrooms ? p : b, compared[0]).id,
                },
                ...(compared.some(p => p.score) ? [{
                  label: 'Score VARA',
                  render: (p: UserProperty) => p.score ? <ScoreRing score={p.score} /> : <span className="text-xs text-slate-300">—</span>,
                  bestId: compared.reduce((b, p) => (p.score ?? 0) > (b.score ?? 0) ? p : b, compared[0]).id,
                }] : []),
              ] as { label: string; render: (p: UserProperty) => React.ReactNode; bestId: string }[]).map(row => (
                <div key={row.label} className="grid border-b border-slate-100 last:border-0" style={{ gridTemplateColumns: `130px repeat(${compared.length}, 1fr)` }}>
                  <div className="p-3 flex items-center">
                    <span className="text-xs text-slate-500 font-medium">{row.label}</span>
                  </div>
                  {compared.map(p => (
                    <div key={p.id} className={cn(
                      'p-3 border-l border-slate-100 flex items-center justify-center gap-1',
                      p.id === row.bestId ? 'bg-emerald-50/60' : ''
                    )}>
                      {row.render(p)}
                      {p.id === row.bestId && <span className="text-emerald-500 text-[9px] font-black flex-shrink-0">✦</span>}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {compared.some(p => p.features.length > 0) && (
              <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card overflow-hidden">
                <div className="grid" style={{ gridTemplateColumns: `130px repeat(${compared.length}, 1fr)` }}>
                  <div className="p-3 flex items-center">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Amenities</span>
                  </div>
                  {compared.map(p => (
                    <div key={p.id} className="p-3 border-l border-slate-100">
                      <div className="flex flex-wrap gap-1 justify-center">
                        {p.features.slice(0, 5).map(f => (
                          <span key={f} className="text-[9px] bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded-full border border-slate-100">{f}</span>
                        ))}
                        {p.features.length > 5 && <span className="text-[9px] text-slate-400">+{p.features.length - 5}</span>}
                        {p.features.length === 0 && <span className="text-[10px] text-slate-300">—</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(() => {
              const byPriceM2 = [...compared].sort((a, b) => {
                const am2 = a.surface > 0 ? a.price / a.surface : Infinity
                const bm2 = b.surface > 0 ? b.price / b.surface : Infinity
                return am2 - bm2
              })
              const cheapest = byPriceM2[0]
              const scored = compared.filter(p => p.score)
              const bestScore = scored.length > 0 ? scored.reduce((b, p) => (p.score ?? 0) > (b.score ?? 0) ? p : b, scored[0]) : null
              const sameProp = bestScore && cheapest.id === bestScore.id

              return (
                <div className="bg-slate-900 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={14} className="text-amber-400" />
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">Análisis VARA</span>
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">[ESTIMADO]</span>
                  </div>
                  {sameProp ? (
                    <p className="text-sm text-slate-100 leading-relaxed">
                      <span className="font-bold text-white">{cheapest.title}</span> tiene el mejor precio/m² y el score
                      más alto — es la opción más equilibrada de las {compared.length}.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="text-sm text-slate-100 leading-relaxed">
                        Mejor precio/m²: <span className="font-bold text-white">{cheapest.title}</span>
                        {' '}(USD {cheapest.surface > 0 ? Math.round(cheapest.price / cheapest.surface).toLocaleString('es-AR') : '—'}/m²).
                      </p>
                      {bestScore && (
                        <p className="text-sm text-slate-100 leading-relaxed">
                          Mayor score: <span className="font-bold text-white">{bestScore.title}</span> ({bestScore.score}/100).
                        </p>
                      )}
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
                    Análisis basado en precio/m² vs. referencia de mercado estimada. No reemplaza tasación profesional.
                  </p>
                </div>
              )
            })()}

            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${compared.length}, 1fr)` }}>
              {compared.map(p => (
                <Link
                  key={p.id}
                  href={`/propiedades/${p.id}`}
                  className="flex items-center justify-center gap-1.5 text-xs font-semibold text-brand-600 bg-brand-50 border border-brand-200 rounded-xl py-2.5 hover:bg-brand-100 transition-colors"
                >
                  <Sparkles size={11} /> Ver potencial
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
