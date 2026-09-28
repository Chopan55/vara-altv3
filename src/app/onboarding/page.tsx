'use client'
import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight, Home, TrendingUp, CheckCircle, AlertCircle, Info, Link2, User,
  Loader2, XCircle, ChevronDown, ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { VaraLogo } from '@/components/ui/VaraLogo'
import { resolveProvinceCode, generateChecklist } from '@/lib/regulations'
import { createOperationAnywhere } from '@/lib/userOperations'
import type { OperationType, CountryCode } from '@/types'
import type { ScrapeResult } from '@/app/api/scrape-property/route'

const TOTAL_STEPS = 4

const operationTypes = [
  { id: 'BUY_PROPERTY', icon: Home, title: 'Quiero comprar', desc: 'Estoy buscando una propiedad para comprar' },
  { id: 'SELL_PROPERTY', icon: TrendingUp, title: 'Quiero vender', desc: 'Tengo una propiedad que quiero vender' },
]

const COUNTRIES: { code: CountryCode; label: string; flag: string }[] = [
  { code: 'AR', label: 'Argentina', flag: '🇦🇷' },
  { code: 'MX', label: 'México', flag: '🇲🇽' },
]

const PROVINCES_BY_COUNTRY: Record<string, string[]> = {
  AR: ['Buenos Aires', 'CABA', 'Córdoba', 'Santa Fe', 'Mendoza', 'Otro'],
  MX: ['Ciudad de México', 'Jalisco', 'Nuevo León', 'Estado de México', 'Querétaro', 'Puebla', 'Guanajuato', 'Chihuahua', 'Baja California', 'Yucatán', 'Otro MX'],
}

type ScrapeStatus = 'idle' | 'loading' | 'success' | 'partial' | 'expired' | 'blocked' | 'error'

const fmtPrice = (n?: number, cur?: string) =>
  n ? `${cur ?? 'USD'} ${n.toLocaleString('es-AR')}` : undefined

function saveToStorage(data: {
  name: string
  type: string
  province: string
  propertyUrl: string
}) {
  try {
    localStorage.setItem('vara_user_name', data.name || 'Usuario')
    localStorage.setItem('vara_journey_type', data.type)
    localStorage.setItem('vara_province', data.province)
    localStorage.setItem('vara_property_url', data.propertyUrl)
    localStorage.setItem('vara_onboarding_done', '1')
  } catch {}
}

function ScrapeStatusBadge({ status, portal, missing, errorMessage, data, photoCount, showDetails, onToggleDetails }: {
  status: ScrapeStatus
  portal: string | null
  missing: string[]
  errorMessage?: string
  data: ScrapeResult['data']
  photoCount: number
  showDetails: boolean
  onToggleDetails: () => void
}) {
  if (status === 'loading') {
    return (
      <div className="flex gap-2 items-center mt-2 bg-slate-50 rounded-xl p-3">
        <Loader2 size={13} className="text-brand-500 animate-spin flex-shrink-0" />
        <p className="text-xs text-slate-500">Consultando {portal ?? 'el portal'}…</p>
      </div>
    )
  }
  if (status === 'success' || status === 'partial' || status === 'expired') {
    const ok = status === 'success'
    const tone = ok
      ? { bg: 'bg-green-50', border: 'border-green-100', text: 'text-green-700', icon: 'text-green-500' }
      : { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700', icon: 'text-amber-500' }
    const heading =
      status === 'expired' ? 'Aviso dado de baja — datos rescatados'
      : ok ? `Datos importados de ${portal ?? 'la publicación'}`
      : `Importación parcial de ${portal ?? 'la publicación'}`

    const rows: [string, string | undefined][] = [
      ['Precio', fmtPrice(data.price, data.currency)],
      ['Ubicación', data.address ?? data.neighborhood ?? data.city],
      ['Superficie', data.totalM2 ? `${data.totalM2} m²` : data.coveredM2 ? `${data.coveredM2} m² cub.` : undefined],
      ['Ambientes', data.rooms ? String(data.rooms) : undefined],
      ['Dormitorios', data.bedrooms ? String(data.bedrooms) : undefined],
    ]

    return (
      <div className={cn('mt-2 rounded-xl p-3 space-y-2', tone.bg)}>
        <div className="flex gap-2 items-center">
          {ok ? <CheckCircle size={13} className={cn('flex-shrink-0', tone.icon)} />
              : <AlertCircle size={13} className={cn('flex-shrink-0', tone.icon)} />}
          <p className={cn('text-xs font-medium', tone.text)}>{heading}</p>
          <button onClick={onToggleDetails} className={cn('ml-auto', tone.text)} aria-label="Ver detalle">
            {showDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
        {showDetails && (
          <div className={cn('space-y-1 pt-1 border-t', tone.border)}>
            {data.title && <p className={cn('text-xs font-semibold', tone.text)}>{data.title}</p>}
            {rows.filter(([, v]) => v).map(([k, v]) => (
              <p key={k} className={cn('text-xs', tone.text)}>{k}: <span className="font-semibold">{v}</span></p>
            ))}
            {photoCount > 0 && <p className={cn('text-xs', tone.text)}>{photoCount} foto{photoCount > 1 ? 's' : ''} encontrada{photoCount > 1 ? 's' : ''}</p>}
            {missing.length > 0 && (
              <p className={cn('text-xs opacity-80', tone.text)}>Sin extraer: {missing.join(', ')} — lo completás desde el dashboard.</p>
            )}
          </div>
        )}
      </div>
    )
  }
  if (status === 'blocked') {
    return (
      <div className="flex gap-2 items-start mt-2 bg-slate-100 rounded-xl p-3">
        <AlertCircle size={13} className="text-slate-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-600">{errorMessage ?? 'Este portal bloquea la lectura automática.'}</p>
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div className="flex gap-2 items-start mt-2 bg-red-50 rounded-xl p-3">
        <XCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-red-600">{errorMessage ?? 'No se pudo acceder al portal.'} El link quedó guardado — podés completar los datos desde el dashboard.</p>
      </div>
    )
  }
  return (
    <div className="flex gap-2 items-start mt-2 bg-slate-50 rounded-xl p-2.5">
      <CheckCircle size={13} className="text-slate-400 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-slate-500">
        Link guardado como referencia. <span className="text-slate-400">Hacé clic en &ldquo;Importar&rdquo; para intentar extraer los datos del portal.</span>
      </p>
    </div>
  )
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [country, setCountry] = useState<CountryCode>('AR')
  const [province, setProvince] = useState('')
  const [propertyUrl, setPropertyUrl] = useState('')

  const [scrapeStatus, setScrapeStatus] = useState<ScrapeStatus>('idle')
  const [scrapeData, setScrapeData] = useState<ScrapeResult['data']>({})
  const [scrapePortal, setScrapePortal] = useState<string | null>(null)
  const [scrapeMissing, setScrapeMissing] = useState<string[]>([])
  const [scrapeError, setScrapeError] = useState<string | undefined>()
  const [scrapePhotos, setScrapePhotos] = useState<string[]>([])
  const [pasteText, setPasteText] = useState('')
  const [showDetails, setShowDetails] = useState(false)

  /*
   * generateChecklist() exige un precio, pero en el onboarding la persona
   * todavia no cargo ninguno. Esta pantalla muestra UNICAMENTE porcentajes
   * (`percentMin`/`percentMax`), nunca montos, asi que el precio solo sirve
   * para que el motor calcule los tramos. Si el scraper ya trajo un precio,
   * usamos ese; si no, un valor de referencia explicito.
   *
   * Regla: ningun monto absoluto se muestra hasta que el precio sea del usuario.
   */
  const REFERENCE_PRICE = 185_000

  const checklist = useMemo(() => {
    if (!province || !type) return null
    const code = resolveProvinceCode(province, country)
    const price = typeof scrapeData.price === 'number' && scrapeData.price > 0
      ? scrapeData.price
      : REFERENCE_PRICE
    return generateChecklist(code, type as OperationType, price, country)
  }, [province, type, country, scrapeData.price])

  const isBuy = type === 'BUY_PROPERTY'

  const handleUrlChange = useCallback((value: string) => {
    setPropertyUrl(value)
    setScrapeStatus('idle')
    setScrapeData({})
    setScrapePortal(null)
    setScrapeMissing([])
    setScrapeError(undefined)
    setScrapePhotos([])
    setShowDetails(false)
  }, [])

  const handleScrape = useCallback(async (pastedText?: string) => {
    if (!propertyUrl.trim()) return
    try { new URL(propertyUrl) } catch { return }

    setScrapeStatus('loading')
    setScrapeData({})
    setShowDetails(false)

    try {
      const res = await fetch('/api/scrape-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: propertyUrl, ...(pastedText ? { text: pastedText } : {}) }),
      })
      const result: ScrapeResult = await res.json()
      setScrapePortal(result.portal)
      setScrapeData(result.data ?? {})
      setScrapeMissing(result.missingFields ?? [])
      setScrapeError(result.errorMessage)
      setScrapePhotos(result.photos ?? [])
      setScrapeStatus(result.status)
      if (result.status !== 'error') setShowDetails(true)

      // El borrador alimenta el dashboard; el usuario lo revisa y edita ahí.
      if (result.status !== 'error') {
        try {
          const item = {
            url: propertyUrl, portal: result.portal, data: result.data,
            photos: result.photos?.slice(0, 6) ?? [], importedAt: Date.now(),
          }
          // Lista nueva (deduplicada por URL)
          const raw = localStorage.getItem('vara_imported_properties')
          const list: unknown[] = raw ? JSON.parse(raw) : []
          const filtered = list.filter((x: unknown) => (x as { url: string }).url !== propertyUrl)
          filtered.push(item)
          localStorage.setItem('vara_imported_properties', JSON.stringify(filtered))
          // Clave legacy para compatibilidad con código que aún la lea.
          localStorage.setItem('vara_imported_property', JSON.stringify(item))
        } catch {}
      }
    } catch {
      setScrapeStatus('error')
      setScrapeError('Error de conexión. El link quedó guardado — completá los datos desde el dashboard.')
    }
  }, [propertyUrl])

  async function handleStart() {
    saveToStorage({ name, type, province, propertyUrl })
    try { localStorage.setItem('vara_country', country) } catch {}

    const op = await createOperationAnywhere({
      type: type === 'SELL_PROPERTY' ? 'SELL' : 'BUY',
      province,
      provinceCode: resolveProvinceCode(province, country),
      title: type === 'SELL_PROPERTY' ? 'Mi venta' : 'Mi compra',
      country,
    })
    try { localStorage.setItem('vara_operation_id', op.id) } catch {}

    router.push('/dashboard')
  }

  const progressWidth = `${(step / TOTAL_STEPS) * 100}%`

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="h-1.5 bg-slate-100">
        <div className="h-full bg-brand-500 transition-all duration-500" style={{ width: progressWidth }} />
      </div>

      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full px-6 py-10">
        <div className="flex justify-between items-center mb-8">
          <VaraLogo size={22} />
          <span className="text-xs text-slate-300 font-medium">{step} de {TOTAL_STEPS}</span>
        </div>

        {/* STEP 1: Nombre */}
        {step === 1 && (
          <>
            <div className="mb-8">
              <p className="text-xs font-bold text-brand-500 uppercase tracking-widest mb-2">Paso 1</p>
              <h1 className="text-2xl font-extrabold text-slate-900 mb-1">¿Cómo te llamás?</h1>
              <p className="text-slate-400 text-sm">Para personalizar tu experiencia en VARA.</p>
            </div>

            <div className="relative mb-6">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">
                <User size={18} />
              </div>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && setStep(2)}
                placeholder="Tu nombre"
                autoFocus
                className="w-full pl-11 pr-4 py-4 rounded-2xl border-2 border-slate-100 focus:border-brand-400 outline-none text-slate-800 font-semibold text-base placeholder:font-normal placeholder:text-slate-300 transition-colors"
              />
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold text-base py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors"
            >
              {name.trim() ? `Hola, ${name.trim().split(' ')[0]} 👋` : 'Continuar'} <ArrowRight size={18} />
            </button>

            <p className="mt-4 text-center text-xs text-slate-300">Podés omitir esto si preferís</p>
          </>
        )}

        {/* STEP 2: Intent */}
        {step === 2 && (
          <>
            <div className="mb-8">
              <p className="text-xs font-bold text-brand-500 uppercase tracking-widest mb-2">Paso 2</p>
              <h1 className="text-2xl font-extrabold text-slate-900 mb-1">
                {name.trim() ? `${name.trim().split(' ')[0]}, ¿qué querés hacer?` : '¿Qué querés hacer?'}
              </h1>
              <p className="text-slate-400 text-sm">Configuramos tu operación según tu objetivo.</p>
            </div>

            <div className="space-y-3">
              {operationTypes.map(({ id, icon: Icon, title, desc }) => (
                <button
                  key={id}
                  onClick={() => { setType(id); setStep(3) }}
                  className={cn(
                    'w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all',
                    type === id ? 'border-brand-500 bg-brand-50' : 'border-slate-100 hover:border-slate-200 bg-white'
                  )}
                >
                  <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
                    type === id ? 'bg-brand-100' : 'bg-slate-50')}>
                    <Icon size={20} className={type === id ? 'text-brand-600' : 'text-slate-400'} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{title}</p>
                    <p className="text-sm text-slate-400">{desc}</p>
                  </div>
                  {type === id && <CheckCircle size={18} className="text-brand-500 ml-auto flex-shrink-0" />}
                </button>
              ))}
            </div>

            <button onClick={() => setStep(1)} className="mt-6 text-sm text-slate-400 hover:text-slate-600">← Volver</button>
          </>
        )}

        {/* STEP 3: País + Provincia/Estado */}
        {step === 3 && (
          <>
            <div className="mb-6">
              <p className="text-xs font-bold text-brand-500 uppercase tracking-widest mb-2">Paso 3</p>
              <h1 className="text-2xl font-extrabold text-slate-900 mb-1">¿Dónde es la operación?</h1>
              <p className="text-slate-400 text-sm">La normativa varía por país y región. Esto personaliza tu checklist.</p>
            </div>

            <div className="mb-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">País</p>
              <div className="grid grid-cols-2 gap-3">
                {COUNTRIES.map(c => (
                  <button
                    key={c.code}
                    onClick={() => { setCountry(c.code); setProvince('') }}
                    className={cn(
                      'p-3 rounded-2xl border-2 font-semibold text-sm transition-all flex items-center gap-2',
                      country === c.code ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-100 text-slate-600 hover:border-slate-200'
                    )}
                  >
                    <span>{c.flag}</span> {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                {country === 'MX' ? 'Estado' : 'Provincia'}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {(PROVINCES_BY_COUNTRY[country] ?? PROVINCES_BY_COUNTRY.AR).map(p => (
                  <button
                    key={p}
                    onClick={() => { setProvince(p); setStep(4) }}
                    className={cn(
                      'p-4 rounded-2xl border-2 font-semibold text-sm transition-all text-left',
                      province === p ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-100 text-slate-600 hover:border-slate-200'
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => setStep(2)} className="mt-6 text-sm text-slate-400 hover:text-slate-600">← Volver</button>
          </>
        )}

        {/* STEP 4: URL + GPS listo */}
        {step === 4 && checklist && (
          <>
            <div className="mb-6">
              <p className="text-xs font-bold text-brand-500 uppercase tracking-widest mb-2">Paso 4</p>
              <h1 className="text-2xl font-extrabold text-slate-900 mb-1">Tu GPS está listo</h1>
              <p className="text-slate-400 text-sm">Checklist generado con datos regulatorios reales de {checklist.provinceName}.</p>
            </div>

            <div className="bg-brand-50 rounded-2xl p-4 mb-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Operación</span>
                <span className="font-semibold text-slate-800">{operationTypes.find(o => o.id === type)?.title ?? type}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">País</span>
                <span className="font-semibold text-slate-800">{COUNTRIES.find(c => c.code === country)?.label ?? country}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">{country === 'MX' ? 'Estado' : 'Provincia'}</span>
                <span className="font-semibold text-slate-800">{checklist.provinceName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Etapas</span>
                <span className="font-semibold text-slate-800">{checklist.stages.length} etapas</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Costo estimado comprador</span>
                <span className={cn('font-semibold', checklist.dataConfidence !== 'VERIFIED' ? 'text-amber-600' : 'text-slate-800')}>
                  {checklist.costs.totalBuyer.percentMin.toFixed(1)}–{checklist.costs.totalBuyer.percentMax.toFixed(1)}% del valor
                  {checklist.dataConfidence !== 'VERIFIED' && ' (est.)'}
                </span>
              </div>
            </div>

            {checklist.dataConfidence !== 'VERIFIED' && (
              <div className="flex gap-2 bg-amber-50 rounded-xl p-3 mb-3">
                <AlertCircle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">Datos de {checklist.provinceName} son estimados. Verificar con tu escribano antes de firmar.</p>
              </div>
            )}

            {checklist.warnings.slice(0, 1).map((w, i) => (
              <div key={i} className="flex gap-2 bg-slate-50 rounded-xl p-3 mb-3">
                <Info size={13} className="text-slate-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600">{w}</p>
              </div>
            ))}

            {/* URL de propiedad (solo para BUY) */}
            {isBuy && (
              <div className="mb-5">
                <p className="text-xs font-semibold text-slate-500 mb-2">
                  ¿Tenés una propiedad en mente? <span className="text-slate-300 font-normal">(opcional)</span>
                </p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300">
                      <Link2 size={15} />
                    </div>
                    <input
                      type="url"
                      value={propertyUrl}
                      onChange={e => handleUrlChange(e.target.value)}
                      placeholder="https://www.zonaprop.com.ar/..."
                      className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-slate-100 focus:border-brand-400 outline-none text-slate-700 text-sm placeholder:text-slate-300 transition-colors"
                    />
                  </div>
                  {propertyUrl.trim() && scrapeStatus === 'idle' && (
                    <button
                      onClick={() => handleScrape()}
                      className="px-3 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-colors flex-shrink-0"
                    >
                      Importar
                    </button>
                  )}
                </div>

                {propertyUrl.trim() && (
                  <ScrapeStatusBadge
                    status={scrapeStatus}
                    portal={scrapePortal}
                    missing={scrapeMissing}
                    errorMessage={scrapeError}
                    data={scrapeData}
                    photoCount={scrapePhotos.length}
                    showDetails={showDetails}
                    onToggleDetails={() => setShowDetails(v => !v)}
                  />
                )}

                {/* Portales tras Cloudflare: el usuario pega el texto y la IA lo lee igual */}
                {(scrapeStatus === 'blocked' || scrapeStatus === 'error') && (
                  <div className="mt-2 border border-slate-200 rounded-xl p-3 space-y-2">
                    <p className="text-xs font-semibold text-slate-600">Pegá el texto del aviso</p>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Abrí el aviso en tu navegador, seleccioná todo el texto (Ctrl+A), copiá (Ctrl+C) y pegalo acá.
                      Extraemos precio, superficie, ambientes y ubicación automáticamente.
                    </p>
                    <textarea
                      value={pasteText}
                      onChange={e => setPasteText(e.target.value)}
                      rows={4}
                      placeholder="Pegá acá el contenido de la publicación…"
                      className="w-full border-2 border-slate-100 focus:border-brand-400 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none resize-none placeholder:text-slate-300"
                    />
                    <button
                      onClick={() => handleScrape(pasteText)}
                      disabled={pasteText.trim().length < 150}
                      className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-bold py-2.5 rounded-xl transition-colors"
                    >
                      {pasteText.trim().length < 150
                        ? `Pegá el aviso (${pasteText.trim().length}/150 caracteres)`
                        : 'Leer datos del texto'}
                    </button>
                  </div>
                )}

                {!propertyUrl.trim() && (
                  <p className="text-xs text-slate-300 mt-1.5">Zonaprop, MercadoLibre, Argenprop — intentamos importar los datos básicos</p>
                )}
              </div>
            )}

            <button
              onClick={handleStart}
              disabled={scrapeStatus === 'loading'}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold text-base py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors"
            >
              {scrapeStatus === 'loading' ? (
                <><Loader2 size={18} className="animate-spin" /> Importando…</>
              ) : (
                <>Empezar mi operación <ArrowRight size={18} /></>
              )}
            </button>

            <button onClick={() => setStep(3)} className="mt-4 text-sm text-slate-400 hover:text-slate-600 text-center w-full">← Volver</button>
          </>
        )}
      </div>
    </div>
  )
}
