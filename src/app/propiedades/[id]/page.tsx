'use client'
import { use, useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, MapPin, Bed, Bath, Square, Upload, Sparkles, ChevronRight, TrendingUp, AlertCircle, Clock, DollarSign, Zap, TrendingDown, Minus } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { formatPrice, cn } from '@/lib/utils'
import { useVaraState } from '@/hooks/useVaraState'
import { loadUserPropertyById, type UserProperty } from '@/lib/userProperties'
import { analyzePricePosition, priceRef } from '@/lib/market/priceReference'

const categoryIcon: Record<string, string> = { PINTURA: '🎨', ILUMINACION: '💡', PISOS: '🪵', COCINA: '🍳', BAÑO: '🚿', MOBILIARIO: '🛋️', JARDÍN: '🌿', EXTERIOR: '🏠' }

interface Recommendation {
  title: string; description: string; estimatedCostMin: number; estimatedCostMax: number
  timeWeeks: number; impact: 'HIGH' | 'MEDIUM' | 'LOW'; category: string
}

interface TransformResult {
  roomType: string; currentState: string; potentialScore: number
  recommendations: Recommendation[]; transformedImageUrl: string
  editMethod?: 'edit' | 'generated' | 'none'; imageNote?: string
}

type TransformMode = 'AUTO' | 'PINTURA_EXTERIOR' | 'INTERIOR' | 'COCINA' | 'BANO' | 'JARDIN' | 'VACIAR'

const MODES: { id: TransformMode; label: string; icon: string }[] = [
  { id: 'AUTO', label: 'Automático', icon: '✨' },
  { id: 'PINTURA_EXTERIOR', label: 'Pintar fachada', icon: '🎨' },
  { id: 'INTERIOR', label: 'Renovar interior', icon: '🛋️' },
  { id: 'COCINA', label: 'Cocina', icon: '🍳' },
  { id: 'BANO', label: 'Baño', icon: '🚿' },
  { id: 'JARDIN', label: 'Jardín', icon: '🌿' },
  { id: 'VACIAR', label: 'Vaciar ambiente', icon: '📦' },
]

const INSTRUCTION_EXAMPLES = [
  'Pintar el frente gris grafito con aberturas negras',
  'Cocina con muebles blancos y mesada de granito',
  'Living en tonos neutros con piso de madera clara',
]

function ImpactBadge({ impact }: { impact: string }) {
  const cfg = { HIGH: 'bg-red-50 text-red-700 border-red-200', MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200', LOW: 'bg-slate-50 text-slate-600 border-slate-200' }
  const label = { HIGH: 'Alto impacto', MEDIUM: 'Impacto medio', LOW: 'Bajo' }
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg[impact as keyof typeof cfg]}`}>{label[impact as keyof typeof label]}</span>
}

export default function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const vara = useVaraState()
  const isSeller = vara.loaded && vara.journeyType === 'SELL_PROPERTY'
  const [property, setProperty] = useState<UserProperty | null>(null)
  const [propertyLoaded, setPropertyLoaded] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [mimeType, setMimeType] = useState('image/jpeg')
  const [mode, setMode] = useState<TransformMode>('AUTO')
  const [instruction, setInstruction] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TransformResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      setUploadedImage(e.target?.result as string)
      setMimeType(file.type || 'image/jpeg')
      setResult(null)
      setError(null)
    }
    reader.readAsDataURL(file)
  }

  const analyzeImage = async () => {
    if (!uploadedImage) return
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await fetch('/api/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: uploadedImage.split(',')[1],
          mimeType,
          instruction,
          mode,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error procesando la imagen')
    } finally { setLoading(false) }
  }

  const resetTransform = () => {
    setResult(null); setUploadedImage(null); setError(null); setInstruction(''); setMode('AUTO')
  }

  useEffect(() => {
    let alive = true
    loadUserPropertyById(id)
      .then(p => { if (alive) setProperty(p) })
      .finally(() => { if (alive) setPropertyLoaded(true) })
    return () => { alive = false }
  }, [id])

  const totalMin = result?.recommendations.reduce((s, r) => s + r.estimatedCostMin, 0) ?? 0
  const totalMax = result?.recommendations.reduce((s, r) => s + r.estimatedCostMax, 0) ?? 0

  if (propertyLoaded && !property) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-8 text-center max-w-sm">
          <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <MapPin size={24} className="text-slate-300" />
          </div>
          <p className="font-bold text-slate-900 mb-1">Esta propiedad no existe</p>
          <p className="text-sm text-slate-400 mb-5">
            No encontramos una propiedad tuya con este identificador. Importá un aviso o cargala a mano.
          </p>
          <Link href="/propiedades"
            className="inline-block bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors">
            Ir a mis propiedades
          </Link>
        </div>
      </div>
    )
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-slate-400 animate-spin" />
      </div>
    )
  }

  const escritura = Math.round(property.price * 0.035)

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="px-4 lg:px-6 pt-8 pb-3">
        <div className="max-w-4xl mx-auto">
                      <Link href={isSeller ? '/publicar' : '/propiedades'} className="flex items-center gap-1.5 text-slate-400 text-sm">
              <ArrowLeft size={14} /> {isSeller ? 'Publicar' : 'Mis propiedades'}
            </Link>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-slate-900 text-lg leading-tight">{property.title}</h1>
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-1"><MapPin size={10} />{property.address}, {property.neighborhood}, {property.city}</p>
            </div>
            {property.score && (
              <div className="flex flex-col items-center gap-1">
                <div className={cn('w-16 h-16 rounded-full border-4 flex flex-col items-center justify-center',
                  property.score >= 80 ? 'border-emerald-200' : property.score >= 60 ? 'border-amber-200' : 'border-red-200')}>
                  <span className={cn('font-black text-xl leading-none', property.score >= 80 ? 'text-emerald-600' : property.score >= 60 ? 'text-amber-600' : 'text-red-600')}>{property.score}</span>
                  <span className="text-[9px] text-slate-400 mt-0.5">Score</span>
                </div>
                <span className="text-[9px] text-slate-400 text-center leading-tight max-w-[72px]">precio/m² · antigüedad · amenities</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 pt-4 space-y-4">
        {/* Stats */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-extrabold text-slate-900 text-2xl">{formatPrice(property.price, property.currency)}</p>
              <p className="text-xs text-slate-400">USD {Math.round(property.price / property.surface).toLocaleString('es-AR')}/m²</p>
            </div>
            <Badge variant="brand" size="sm">{property.operationType === 'sale' ? 'Venta' : 'Alquiler'}</Badge>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            {[{ icon: Bed, val: property.bedrooms, label: 'dorm.' }, { icon: Bath, val: property.bathrooms, label: 'baños' }, { icon: Square, val: property.surface, label: 'm²' }].map(({ icon: Icon, val, label }) => (
              <div key={label} className="text-center bg-slate-50 rounded-xl py-3">
                <Icon size={16} className="mx-auto text-slate-400 mb-1" />
                <p className="font-bold text-slate-900 text-sm">{val}</p>
                <p className="text-[10px] text-slate-400">{label}</p>
              </div>
            ))}
          </div>
          {property.features.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-3 border-t border-slate-50">
              {property.features.map(f => <span key={f} className="text-[11px] bg-slate-50 text-slate-500 px-2 py-0.5 rounded-full border border-slate-100">{f}</span>)}
            </div>
          )}
        </div>

        {/* True acquisition cost */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-brand-500" />
            <h2 className="font-bold text-slate-900 text-sm">Costo real de adquisición</h2>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs"><span className="text-slate-500">Precio de lista</span><span className="font-semibold text-slate-700">{formatPrice(property.price, property.currency)}</span></div>
            <div className="flex justify-between text-xs"><span className="text-slate-500">Gastos escritura (~3.5%)</span><span className="font-semibold text-slate-700">USD {escritura.toLocaleString('es-AR')}</span></div>
            <div className="flex justify-between text-xs"><span className="text-slate-500">Renovación estimada</span><span className="font-semibold text-slate-700">{result ? `USD ${totalMin.toLocaleString()} – ${totalMax.toLocaleString()}` : <span className="text-slate-300 italic">Analizá un ambiente abajo ↓</span>}</span></div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-900">Inversión total</span>
              <span className="text-sm font-extrabold text-slate-900">USD {(property.price + escritura + (result ? totalMin : 0)).toLocaleString('es-AR')}+</span>
            </div>
          </div>
        </div>

        {/* Property Intelligence — precio vs mercado */}
        {(() => {
          const pricePerM2 = property.surface > 0 ? Math.round(property.price / property.surface) : 0
          const province = property.province ?? ''
          const { position, ref, delta } = analyzePricePosition(pricePerM2, province)
          const marketRef = priceRef(province)

          const cfg = {
            BELOW: {
              bg: 'bg-emerald-50 border-emerald-100',
              icon: TrendingDown,
              iconColor: 'text-emerald-600',
              label: 'Por debajo del mercado',
              labelColor: 'text-emerald-700',
              detail: `USD ${pricePerM2.toLocaleString('es-AR')}/m² es ${Math.abs(delta ?? 0)}% menos que la media de ${ref.label}. Es una oportunidad.`,
              negotiation: 'Precio ya competitivo — margen de negociación limitado (~2–5%).',
            },
            AT: {
              bg: 'bg-slate-50 border-slate-200',
              icon: Minus,
              iconColor: 'text-slate-500',
              label: 'En línea con el mercado',
              labelColor: 'text-slate-700',
              detail: `USD ${pricePerM2.toLocaleString('es-AR')}/m² está dentro del rango de referencia para ${ref.label}.`,
              negotiation: 'Precio razonable — podés intentar negociar 3–8% sin romper el trato.',
            },
            ABOVE: {
              bg: 'bg-rose-50 border-rose-100',
              icon: TrendingUp,
              iconColor: 'text-rose-600',
              label: 'Por encima del mercado',
              labelColor: 'text-rose-700',
              detail: `USD ${pricePerM2.toLocaleString('es-AR')}/m² es ${Math.abs(delta ?? 0)}% más que la media de ${ref.label}. Negociá.`,
              negotiation: 'Margen de negociación estimado: 8–15% sobre precio de lista.',
            },
            UNKNOWN: {
              bg: 'bg-slate-50 border-slate-200',
              icon: Minus,
              iconColor: 'text-slate-400',
              label: 'Sin datos suficientes',
              labelColor: 'text-slate-500',
              detail: 'Cargá el precio y la superficie para ver el análisis de mercado.',
              negotiation: '',
            },
          }[position]

          const Icon = cfg.icon

          return (
            <div className={cn('bg-white rounded-2xl p-4 shadow-sm border', cfg.bg)}>
              <div className="flex items-start gap-3 mb-3">
                <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0', cfg.bg)}>
                  <Icon size={15} className={cfg.iconColor} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={cn('text-sm font-bold', cfg.labelColor)}>{cfg.label}</p>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">[ESTIMADO]</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{cfg.detail}</p>
                </div>
              </div>

              {position !== 'UNKNOWN' && (
                <>
                  {/* Barra visual de posición */}
                  <div className="mb-3">
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>USD {marketRef.min.toLocaleString('es-AR')}/m²</span>
                      <span className="font-semibold text-slate-600">Referencia {ref.label}</span>
                      <span>USD {marketRef.max.toLocaleString('es-AR')}/m²</span>
                    </div>
                    <div className="relative h-2 bg-slate-100 rounded-full overflow-visible">
                      <div className="absolute inset-y-0 left-[10%] right-[10%] bg-emerald-100 rounded-full" />
                      {pricePerM2 > 0 && (() => {
                        const pct = Math.min(100, Math.max(0,
                          ((pricePerM2 - marketRef.min * 0.7) / (marketRef.max * 1.4 - marketRef.min * 0.7)) * 100
                        ))
                        return (
                          <div
                            className={cn('absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow',
                              position === 'BELOW' ? 'bg-emerald-500' : position === 'ABOVE' ? 'bg-rose-500' : 'bg-slate-500'
                            )}
                            style={{ left: `calc(${pct}% - 6px)` }}
                          />
                        )
                      })()}
                    </div>
                    <p className="text-center text-xs font-bold text-slate-700 mt-1.5">
                      Tu propiedad: USD {pricePerM2.toLocaleString('es-AR')}/m²
                    </p>
                  </div>

                  {/* Negociación */}
                  {cfg.negotiation && (
                    <div className="bg-white/70 rounded-xl px-3 py-2.5 flex items-start gap-2">
                      <Zap size={11} className="text-brand-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-slate-600 leading-relaxed">
                        <span className="font-semibold">Negociación: </span>{cfg.negotiation}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })()}

        {/* Visualizá el potencial */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-slate-50">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={16} className="text-amber-500" />
              <h2 className="font-bold text-slate-900 text-sm">Visualizá el potencial</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">IA disponible</span>
            </div>
            <p className="text-xs text-slate-400">
              {isSeller
                ? 'Subí una foto de un ambiente y VARA te dice qué reformas aumentan el valor de venta y cuánto costarían.'
                : 'Subí una foto de un ambiente y VARA analiza qué reformas aplicar, cuánto costarían y cómo quedaría.'}
            </p>
          </div>

          {!uploadedImage && !loading && !result && (
            <div
              role="button"
              tabIndex={0}
              aria-label="Subir foto del ambiente — clickeá o arrastrá una imagen"
              className="m-4 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-amber-300 hover:bg-amber-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 transition-all"
              onClick={() => fileRef.current?.click()}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click() } }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}>
              <Upload size={28} className="mx-auto text-slate-300 mb-3" />
              <p className="font-semibold text-slate-600 text-sm mb-1">Subí una foto del ambiente</p>
              <p className="text-xs text-slate-400">Living, cocina, dormitorio, baño — arrastrá o clickeá</p>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" aria-hidden="true" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            </div>
          )}

          {/* Controles: qué cambiar */}
          {uploadedImage && !loading && !result && (
            <div className="p-4 space-y-4">
              <div className="flex gap-3">
                <div className="w-24 h-24 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={uploadedImage} alt="Foto subida" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700">Foto cargada</p>
                  <p className="text-xs text-slate-400 mt-0.5">Elegí qué querés cambiar. VARA edita esta misma foto, no genera otra propiedad.</p>
                  <button onClick={() => fileRef.current?.click()} className="text-xs text-amber-600 font-semibold mt-1.5 hover:underline">
                    Cambiar foto
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Tipo de cambio</p>
                <div className="flex flex-wrap gap-1.5">
                  {MODES.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setMode(m.id)}
                      className={cn(
                        'text-xs font-semibold px-2.5 py-1.5 rounded-full border transition-all',
                        mode === m.id
                          ? 'bg-brand-600 text-white border-brand-600'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-amber-300'
                      )}
                    >
                      {m.icon} {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="t-instruction" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                  Indicaciones <span className="font-normal normal-case tracking-normal text-slate-300">(opcional)</span>
                </label>
                <textarea
                  id="t-instruction"
                  value={instruction}
                  onChange={e => setInstruction(e.target.value)}
                  rows={2}
                  maxLength={400}
                  placeholder="Ej: pintar el frente gris grafito, cambiar el piso a madera clara..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-400 resize-none placeholder:text-slate-300"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {INSTRUCTION_EXAMPLES.map(ex => (
                    <button
                      key={ex}
                      onClick={() => setInstruction(ex)}
                      className="text-[10px] text-slate-500 bg-slate-50 hover:bg-amber-50 hover:text-amber-700 border border-slate-100 px-2 py-1 rounded-lg transition-colors"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={analyzeImage}
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <Sparkles size={16} /> Generar transformación
              </button>
              <p className="text-[10px] text-slate-300 text-center">Tarda entre 20 y 60 segundos</p>
            </div>
          )}

          {loading && (
            <div className="m-4 bg-slate-900 rounded-xl p-6 text-center" role="status" aria-live="polite" aria-label="Procesando imagen con inteligencia artificial">
              <div className="w-10 h-10 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin mx-auto mb-4" aria-hidden="true" />
              <p className="text-white font-semibold text-sm mb-1">Transformando tu foto...</p>
              <p className="text-slate-400 text-xs">Analizamos el ambiente y editamos tu imagen · puede tardar hasta 1 minuto</p>
            </div>
          )}

          {error && (
            <div className="m-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-700 text-sm">Error</p>
                <p className="text-red-500 text-xs mt-0.5">{error}</p>
                <button onClick={() => setError(null)} className="text-xs text-red-600 font-semibold mt-2 underline">Intentar de nuevo</button>
              </div>
            </div>
          )}

          {result && (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Actual</p>
                  <div className="aspect-square rounded-xl overflow-hidden bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={uploadedImage!} alt="Actual" className="w-full h-full object-cover" />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-1.5">Con reformas ✦</p>
                  <div className="aspect-square rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center">
                    {result.transformedImageUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={result.transformedImageUrl} alt="Renovado" className="w-full h-full object-cover" />
                    ) : (
                      <p className="text-[10px] text-slate-400 px-3 text-center">Imagen no disponible</p>
                    )}
                  </div>
                </div>
              </div>

              {result.editMethod === 'generated' && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <AlertCircle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-700">
                    {result.imageNote ?? 'Esta imagen es una referencia de estilo generada por IA, no tu propiedad editada.'}
                  </p>
                </div>
              )}
              {result.editMethod === 'none' && result.imageNote && (
                <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <AlertCircle size={13} className="text-slate-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-slate-600">{result.imageNote}</p>
                </div>
              )}

              <div className="bg-slate-50 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900 text-sm capitalize">{result.roomType}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{result.currentState}</p>
                </div>
                <div className="text-center">
                  <p className={cn('font-black text-2xl', result.potentialScore >= 7 ? 'text-emerald-600' : result.potentialScore >= 5 ? 'text-amber-600' : 'text-red-600')}>{result.potentialScore}</p>
                  <p className="text-[10px] text-slate-400">potencial /10</p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign size={16} className="text-amber-600" />
                  <span className="text-sm font-bold text-amber-900">Inversión en reformas</span>
                </div>
                <span className="font-extrabold text-amber-900 text-sm">USD {totalMin.toLocaleString()} – {totalMax.toLocaleString()}</span>
              </div>

              <div className="space-y-2">
                {result.recommendations.map((rec, i) => (
                  <div key={i} className="bg-white border border-slate-100 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{categoryIcon[rec.category] ?? '🔧'}</span>
                        <span className="font-semibold text-slate-900 text-sm">{rec.title}</span>
                      </div>
                      <ImpactBadge impact={rec.impact} />
                    </div>
                    <p className="text-xs text-slate-500 mb-2">{rec.description}</p>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><DollarSign size={10} />USD {rec.estimatedCostMin.toLocaleString()}–{rec.estimatedCostMax.toLocaleString()}</span>
                      <span className="flex items-center gap-1"><Clock size={10} />{rec.timeWeeks} sem.</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setResult(null)}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-3 rounded-xl transition-colors"
                >
                  Probar otro cambio
                </button>
                <button
                  onClick={resetTransform}
                  className="flex-1 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 text-xs font-semibold py-3 rounded-xl transition-colors"
                >
                  Otro ambiente
                </button>
              </div>
            </div>
          )}
        </div>

        {/* CTA — bifurcado por journey */}
        {isSeller ? (
          <div className="bg-slate-900 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={16} className="text-amber-400" />
              <span className="font-bold text-white text-sm">¿Listo para publicar?</span>
            </div>
            <p className="text-slate-400 text-xs mb-4">
              {result
                ? `Inversión estimada en reformas: USD ${totalMin.toLocaleString()} – ${totalMax.toLocaleString()}. Publicá ahora y mencionalas en el aviso.`
                : 'Analizá un ambiente con IA para saber qué reformas aumentan el valor antes de publicar.'}
            </p>
            <Link href="/publicar" className="flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-sm px-5 py-3 rounded-xl transition-colors">
              {result ? 'Publicar con estas mejoras' : 'Ir a publicar mi propiedad'} <ChevronRight size={14} />
            </Link>
          </div>
        ) : (
          <div className="bg-slate-900 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2"><Zap size={16} className="text-amber-400" /><span className="font-bold text-white text-sm">¿Te interesa esta propiedad?</span></div>
            <p className="text-slate-400 text-xs mb-4">VARA te acompaña en cada paso — documentación, riesgos, costos y profesionales.</p>
            <Link href="/onboarding" className="flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-sm px-5 py-3 rounded-xl transition-colors">
              Iniciar operación de compra <ChevronRight size={14} />
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
