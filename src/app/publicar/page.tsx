'use client'
import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOperations } from '@/hooks/useOperations'
import { ApiError, apiErrorMessage, safeJson, userFacingError } from '@/lib/api/client'
import { DRAFT_KEY, EMPTY_FORM, buildAdText, type Portal, type PublishForm, type Tab } from '@/components/publicar/model'
import { usePublishPhotos } from '@/components/publicar/usePublishPhotos'
import { DatosStep } from '@/components/publicar/DatosStep'
import { PreviewStep } from '@/components/publicar/PreviewStep'
import { PublishStep } from '@/components/publicar/PublishStep'

export default function PublicarPage() {
  const { operations, activeTransactionData } = useOperations()
  const sellOp = operations.find(o => o.type === 'SELL') ?? null

  const [activeTab, setActiveTab] = useState<Tab>('datos')
  const [published, setPublished] = useState<string[]>([])
  const photosState = usePublishPhotos()
  const { photos } = photosState

  const [form, setForm] = useState<PublishForm>(EMPTY_FORM)
  const [copyLoading, setCopyLoading] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)
  const [highlights, setHighlights] = useState<string[]>([])
  const [copiedPortal, setCopiedPortal] = useState<string | null>(null)

  // Recupera el borrador guardado; si no hay, pre-fill con datos reales de la operación.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY)
      if (saved) { setForm({ ...EMPTY_FORM, ...JSON.parse(saved) }); return }
    } catch {}
    // Pre-fill desde la operación de venta activa si hay datos de propiedad
    const prop = activeTransactionData?.property
    if (prop || sellOp) {
      const partial: Partial<PublishForm> = {}
      if (prop?.price) partial.price = String(prop.price)
      if (prop?.surface) partial.surface = String(prop.surface)
      if (activeTransactionData?.city) partial.city = activeTransactionData.city
      if (activeTransactionData?.province) partial.neighborhood = activeTransactionData.province
      if (sellOp?.title) partial.title = sellOp.title
      if (Object.keys(partial).length > 0) setForm(prev => ({ ...prev, ...partial }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellOp?.id])

  useEffect(() => {
    if (form === EMPTY_FORM) return
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(form)) } catch {}
  }, [form])

  const set = (k: keyof PublishForm, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const generateCopy = async () => {
    setCopyLoading(true); setCopyError(null)
    try {
      const res = await fetch('/api/listing-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, notes: form.description }),
      })
      const data = await safeJson<{ title?: string; description?: string; highlights?: string[]; error?: string }>(res)
      if (!res.ok) throw new ApiError(apiErrorMessage(res.status, data.error), res.status)
      setForm(prev => ({
        ...prev,
        title: data.title || prev.title,
        description: data.description || prev.description,
      }))
      setHighlights(Array.isArray(data.highlights) ? data.highlights : [])
    } catch (e) {
      setCopyError(userFacingError(e, 'No pudimos generar el texto. No se perdió nada: probá de nuevo.'))
    } finally {
      setCopyLoading(false)
    }
  }

  const toggleFeature = (f: string) =>
    setForm(prev => ({
      ...prev,
      features: prev.features.includes(f)
        ? prev.features.filter(x => x !== f)
        : [...prev.features, f],
    }))

  /**
   * Abre el portal en pestaña nueva y copia el texto del aviso al portapapeles.
   * No promete ningún "coordinador" que no existe: la publicación la hace el usuario.
   */
  const handlePublish = useCallback(async (portal: Portal) => {
    setPublished(prev => prev.includes(portal.id) ? prev : [...prev, portal.id])

    try {
      await navigator.clipboard.writeText(buildAdText(form))
      setCopiedPortal(portal.id)
      setTimeout(() => setCopiedPortal(p => p === portal.id ? null : p), 4000)
    } catch { /* el usuario puede copiar el texto manualmente */ }

    window.open(portal.url, '_blank', 'noopener,noreferrer')
  }, [form])

  const formComplete = Boolean(form.title && form.price && form.address && form.description)
  const coverPhoto = photos.find(p => p.isCover) ?? photos[0] ?? null

  // Publicar es una secuencia, no tres secciones sueltas: primero cargás,
  // después revisás, recién entonces se publica. Los pasos numerados lo dicen.
  const steps: { id: Tab; label: string }[] = [
    { id: 'datos', label: 'Preparación' },
    { id: 'preview', label: 'Revisión' },
    { id: 'publicar', label: 'Publicación' },
  ]
  const currentStep = steps.findIndex(s => s.id === activeTab)

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-3xl mx-auto px-4 lg:px-6 py-6">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm mb-4 transition-colors">
          <ArrowLeft size={14} /> Volver al inicio
        </Link>

        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Preparar publicación</h1>
        <p className="text-sm text-slate-500 mt-1">
          Completá cada paso para publicar tu propiedad y llegar a más compradores.
        </p>

        {/* Pasos numerados */}
        <ol className="flex items-center gap-2 sm:gap-3 my-6">
          {steps.map((s, i) => {
            const done = i < currentStep
            const current = i === currentStep
            return (
              <li key={s.id} className="flex items-center gap-2 sm:gap-3 min-w-0">
                <button
                  onClick={() => setActiveTab(s.id)}
                  aria-current={current ? 'step' : undefined}
                  className="flex items-center gap-2 min-w-0 group"
                >
                  <span className={cn(
                    'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors',
                    current ? 'bg-brand-600 text-white'
                      : done ? 'bg-brand-100 text-brand-700'
                      : 'bg-slate-200 text-slate-500'
                  )}>
                    {done ? <Check size={13} aria-hidden="true" /> : i + 1}
                  </span>
                  <span className={cn(
                    'text-sm truncate transition-colors',
                    current ? 'font-semibold text-slate-900' : 'text-slate-500 group-hover:text-slate-700'
                  )}>
                    {s.label}
                  </span>
                </button>
                {i < steps.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={cn('hidden sm:block h-px w-10 lg:w-20', done ? 'bg-brand-300' : 'bg-slate-200')}
                  />
                )}
              </li>
            )
          })}
        </ol>

      <div className="space-y-4">

        {activeTab === 'datos' && (
          <DatosStep
            form={form} set={set} toggleFeature={toggleFeature} generateCopy={generateCopy}
            copyLoading={copyLoading} copyError={copyError} highlights={highlights}
            formComplete={formComplete} setActiveTab={setActiveTab} photosState={photosState}
          />
        )}

        {activeTab === 'preview' && (
          <PreviewStep form={form} photos={photos} coverPhoto={coverPhoto} setActiveTab={setActiveTab} />
        )}

        {activeTab === 'publicar' && (
          <PublishStep form={form} published={published} copiedPortal={copiedPortal} handlePublish={handlePublish} />
        )}

      </div>
    </div>
    </div>
  )
}
