'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Home, Bed, Bath, Square,
  Camera, ExternalLink, CheckCircle2, Sparkles,
  MapPin, Eye, Edit3, Send, X, Star, AlertCircle,
  ImagePlus, ChevronDown, Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOperations } from '@/hooks/useOperations'
import { toggleSellerTask } from '@/lib/supabase/sellerTasks'
import { loadPhotos, savePhoto, deletePhoto, updatePhotoMeta, setCoverPhoto } from '@/lib/photoStore'
import {
  hasPhotoSession, uploadPhoto, listPhotos, deletePhotoRemote,
  updatePhotoRemote, setCoverRemote,
} from '@/lib/supabase/photos'

interface PhotoItem {
  id: string
  preview: string
  label: string
  isCover: boolean
}

const ROOM_LABELS = [
  'Frente', 'Living', 'Comedor', 'Cocina', 'Dormitorio principal',
  'Dormitorio 2', 'Dormitorio 3', 'Baño', 'Jardín', 'Pileta',
  'Quincho', 'Garage / Cochera', 'Entrada', 'Otro',
]

const FOTO_TIPS = [
  { icon: '☀️', tip: 'Sacá las fotos con luz natural, de día y con ventanas abiertas.' },
  { icon: '📐', tip: 'Tomá desde las esquinas para mostrar todo el ambiente.' },
  { icon: '🧹', tip: 'Despejá objetos personales antes de fotografiar.' },
  { icon: '🌟', tip: 'La portada es clave — elegí la foto de mayor impacto visual.' },
]

type Tab = 'datos' | 'preview' | 'publicar'

const PORTALS = [
  {
    id: 'zonaprop',
    name: 'Zonaprop',
    logo: '🏠',
    reach: '4M+ visitantes/mes',
    url: 'https://www.zonaprop.com.ar',
    free: true,
  },
  {
    id: 'argenprop',
    name: 'Argenprop',
    logo: '🔑',
    reach: '2M+ visitantes/mes',
    url: 'https://www.argenprop.com',
    free: true,
  },
  {
    id: 'mercadolibre',
    name: 'MercadoLibre',
    logo: '🛒',
    reach: '5M+ visitantes/mes',
    url: 'https://inmuebles.mercadolibre.com.ar',
    free: false,
  },
]

const DRAFT_KEY = 'vara_publish_draft'

interface PublishForm {
  title: string; type: string; price: string; currency: string
  surface: string; coveredSurface: string; rooms: string; bedrooms: string; bathrooms: string
  address: string; neighborhood: string; city: string; description: string
  features: string[]
}

const EMPTY_FORM: PublishForm = {
  title: '', type: 'Casa', price: '', currency: 'USD',
  surface: '', coveredSurface: '', rooms: '', bedrooms: '', bathrooms: '',
  address: '', neighborhood: '', city: '', description: '',
  features: [],
}

const PROPERTY_TYPES = ['Casa', 'Departamento', 'PH', 'Terreno', 'Local comercial']
const FEATURES = ['Pileta', 'Quincho', 'Jardín', 'Cochera', 'Seguridad 24hs', 'Parrilla', 'Luminoso', 'Balcón']

export default function PublicarPage() {
  const { operations, activeTransactionData } = useOperations()
  const sellOp = operations.find(o => o.type === 'SELL') ?? null

  const [activeTab, setActiveTab] = useState<Tab>('datos')
  const [published, setPublished] = useState<string[]>([])
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Las fotos viven en IndexedDB: sobreviven la recarga y no chocan con el límite de localStorage.
  useEffect(() => {
    let alive = true
    ;(async () => {
      // Con sesión las fotos viven en Storage y te siguen entre dispositivos.
      if (await hasPhotoSession()) {
        const remote = await listPhotos()
        if (!alive) return
        setPhotos(remote.map(p => ({ id: p.id, preview: p.url, label: p.label, isCover: p.isCover })))
        setInCloud(true)
        return
      }
      const stored = await loadPhotos()
      if (!alive) return
      setPhotos(stored.map(p => ({ id: p.id, preview: p.preview, label: p.label, isCover: p.isCover })))
    })().catch(() => {})
    return () => { alive = false }
  }, [])

  const addFiles = useCallback((files: FileList | null) => {
    if (!files) return
    const accepted = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, 20 - photos.length)
    if (!accepted.length) return

    const needsCover = photos.length === 0

    void (async () => {
      if (await hasPhotoSession()) {
        setUploading(true)
        for (let i = 0; i < accepted.length; i++) {
          const up = await uploadPhoto(accepted[i], 'Sin etiquetar', needsCover && i === 0)
          if (up) {
            setPhotos(prev => [...prev, { id: up.id, preview: up.url, label: up.label, isCover: up.isCover }])
          }
        }
        setUploading(false)
        setInCloud(true)
        return
      }
      const newPhotos: PhotoItem[] = accepted.map((f, i) => {
        const id = `ph-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const isCover = needsCover && i === 0
        void savePhoto({ id, blob: f, label: 'Sin etiquetar', isCover, createdAt: Date.now() + i })
        return { id, preview: URL.createObjectURL(f), label: 'Sin etiquetar', isCover }
      })
      setPhotos(prev => [...prev, ...newPhotos])
    })()
  }, [photos.length])

  const removePhoto = (id: string) => {
    void (async () => {
      if (await hasPhotoSession()) {
        const remote = (await listPhotos()).find(p => p.id === id)
        if (remote) await deletePhotoRemote(id, remote.storagePath)
      } else { void deletePhoto(id) }
    })()
    setPhotos(prev => {
      const next = prev.filter(p => p.id !== id)
      if (next.length > 0 && !next.some(p => p.isCover)) {
        next[0] = { ...next[0], isCover: true }
        void setCoverPhoto(next[0].id)
      }
      return next
    })
  }

  const setCover = (id: string) => {
    void (async () => {
      if (await hasPhotoSession()) await setCoverRemote(id)
      else void setCoverPhoto(id)
    })()
    setPhotos(prev => prev.map(p => ({ ...p, isCover: p.id === id })))
  }

  const setLabel = (id: string, label: string) => {
    void (async () => {
      if (await hasPhotoSession()) await updatePhotoRemote(id, { label })
      else void updatePhotoMeta(id, { label })
    })()
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, label } : p))
  }

  const [form, setForm] = useState<PublishForm>(EMPTY_FORM)
  const [copyLoading, setCopyLoading] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)
  const [highlights, setHighlights] = useState<string[]>([])
  const [inCloud, setInCloud] = useState(false)
  const [uploading, setUploading] = useState(false)

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
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No pudimos generar el texto.')
      setForm(prev => ({
        ...prev,
        title: data.title || prev.title,
        description: data.description || prev.description,
      }))
      setHighlights(Array.isArray(data.highlights) ? data.highlights : [])
    } catch (e) {
      setCopyError(e instanceof Error ? e.message : 'No pudimos generar el texto.')
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
   * Guarda el borrador de solicitud de publicación localmente (H16).
   * NO marca la tarea como DONE — eso requiere confirmación real (URL de publicación).
   * El texto del botón dice exactamente qué hace.
   */
  const handlePublish = (portalId: string) => {
    setPublished(prev => prev.includes(portalId) ? prev : [...prev, portalId])
    try {
      const existing = JSON.parse(localStorage.getItem('vara_publish_requests') || '[]')
      existing.push({ portalId, title: form.title, price: form.price, city: form.city, timestamp: Date.now(), status: 'DRAFT' })
      localStorage.setItem('vara_publish_requests', JSON.stringify(existing))
    } catch {}
    // NO marcar tarea como DONE automáticamente: la publicación real requiere evidencia (URL).
  }

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

        {/* ── TAB: DATOS ── */}
        {activeTab === 'datos' && (
          <>
            <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-5 space-y-4">
              <h2 className="font-semibold text-slate-800 text-sm">Información básica</h2>

              <div>
                <label htmlFor="f-title" className="text-xs font-semibold text-slate-500 mb-1.5 block">Título del aviso</label>
                <input
                  id="f-title"
                  value={form.title}
                  onChange={e => set('title', e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-400 focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-1 transition-colors"
                  placeholder="Ej: Casa 3 amb. con jardín en Pilar"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="f-type" className="text-xs font-semibold text-slate-500 mb-1.5 block">Tipo</label>
                  <select
                    id="f-type"
                    value={form.type}
                    onChange={e => set('type', e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-400 focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-1 bg-white"
                  >
                    {PROPERTY_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="f-price" className="text-xs font-semibold text-slate-500 mb-1.5 block">Precio (USD)</label>
                  <input
                    id="f-price"
                    type="number"
                    value={form.price}
                    onChange={e => set('price', e.target.value)}
                    placeholder="185000"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-400 focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-1 transition-colors placeholder:text-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="f-surface" className="text-xs font-semibold text-slate-500 mb-1.5 block">Sup. total m²</label>
                  <input id="f-surface" value={form.surface} onChange={e => set('surface', e.target.value)} placeholder="420"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-400 focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-1 placeholder:text-slate-300" />
                </div>
                <div>
                  <label htmlFor="f-covered" className="text-xs font-semibold text-slate-500 mb-1.5 block">Sup. cub. m²</label>
                  <input id="f-covered" value={form.coveredSurface} onChange={e => set('coveredSurface', e.target.value)} placeholder="180"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-400 focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-1 placeholder:text-slate-300" />
                </div>
                <div>
                  <label htmlFor="f-rooms" className="text-xs font-semibold text-slate-500 mb-1.5 block">Ambientes</label>
                  <input id="f-rooms" value={form.rooms} onChange={e => set('rooms', e.target.value)} placeholder="3"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-400 focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-1 placeholder:text-slate-300" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="f-bedrooms" className="text-xs font-semibold text-slate-500 mb-1.5 block">Dormitorios</label>
                  <input id="f-bedrooms" value={form.bedrooms} onChange={e => set('bedrooms', e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-400 focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-1" />
                </div>
                <div>
                  <label htmlFor="f-bathrooms" className="text-xs font-semibold text-slate-500 mb-1.5 block">Baños</label>
                  <input id="f-bathrooms" value={form.bathrooms} onChange={e => set('bathrooms', e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-400 focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-1" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-5 space-y-4">
              <h2 className="font-semibold text-slate-800 text-sm">Ubicación</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="f-address" className="text-xs font-semibold text-slate-500 mb-1.5 block">Dirección</label>
                  <input id="f-address" value={form.address} onChange={e => set('address', e.target.value)} placeholder="Av. Los Robles 432"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-400 focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-1 placeholder:text-slate-300" />
                </div>
                <div>
                  <label htmlFor="f-neighborhood" className="text-xs font-semibold text-slate-500 mb-1.5 block">Barrio</label>
                  <input id="f-neighborhood" value={form.neighborhood} onChange={e => set('neighborhood', e.target.value)} placeholder="La Lonja"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-400 focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-1 placeholder:text-slate-300" />
                </div>
              </div>
              <div>
                <label htmlFor="f-city" className="text-xs font-semibold text-slate-500 mb-1.5 block">Ciudad</label>
                <input id="f-city" value={form.city} onChange={e => set('city', e.target.value)} placeholder="Pilar"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-400 focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-1 placeholder:text-slate-300" />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-800 text-sm">Descripción</h2>
                <button
                  onClick={generateCopy}
                  disabled={copyLoading}
                  className="text-xs font-semibold text-amber-600 hover:underline disabled:opacity-50 flex items-center gap-1"
                >
                  <Sparkles size={11} />
                  {copyLoading ? 'Redactando…' : form.description ? 'Reescribir con IA' : 'Redactar con IA'}
                </button>
              </div>

              <p className="text-xs text-slate-400 -mt-1">
                Cargá los datos de arriba y la IA redacta el aviso. Solo usa los datos que ingresaste — no inventa características.
              </p>

              <label htmlFor="f-description" className="sr-only">Descripción de la propiedad</label>
              <textarea
                id="f-description"
                value={form.description}
                onChange={e => set('description', e.target.value)}
                rows={6}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-400 focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-1 resize-none leading-relaxed"
                placeholder="Describí la propiedad, o tocá 'Redactar con IA' para generar un borrador…"
                aria-describedby="f-description-count"
              />
              <div className="flex items-center justify-between">
                <p id="f-description-count" className="text-xs text-slate-300" aria-live="polite">{form.description.length} caracteres</p>
                {form.description && <p className="text-[10px] text-slate-300">Revisá y editá antes de publicar</p>}
              </div>

              {copyError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3">
                  <AlertCircle size={12} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-red-600">{copyError}</p>
                </div>
              )}

              {highlights.length > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-1.5">Puntos destacados sugeridos</p>
                  <ul className="space-y-1">
                    {highlights.map((h, i) => (
                      <li key={i} className="text-[11px] text-amber-800 flex gap-1.5">
                        <span className="text-amber-500">•</span>{h}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-5">
              <h2 className="font-semibold text-slate-800 text-sm mb-3">Características</h2>
              <div className="flex flex-wrap gap-2">
                {FEATURES.map(f => (
                  <button
                    key={f}
                    onClick={() => toggleFeature(f)}
                    className={cn(
                      'text-xs font-semibold px-3 py-1.5 rounded-full border transition-all',
                      form.features.includes(f)
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Fotos */}
            <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-slate-800 text-sm">Fotos y video</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {uploading ? 'Subiendo fotos…' : photos.length === 0
                      ? 'Mín. 12 recomendadas · Las fotos definen el interés del comprador'
                      : `${photos.length} foto${photos.length > 1 ? 's' : ''} cargada${photos.length > 1 ? 's' : ''} · ${photos.length < 12 ? `faltan ${12 - photos.length} para el mínimo recomendado` : '✓ Buen cantidad'}`}
                  </p>
                </div>
                <Link href="/propiedades"
                  title="Subí una foto y VARA la edita: pintura, interior, vaciar ambiente"
                  className="text-xs font-semibold text-amber-600 hover:underline flex items-center gap-1 flex-shrink-0">
                  <Sparkles size={11} /> Transformar fotos
                </Link>
              </div>

              {/* Tips */}
              <div className="grid grid-cols-2 gap-2">
                {FOTO_TIPS.map((t, i) => (
                  <div key={i} className="flex items-start gap-2 bg-slate-50 rounded-xl p-2.5">
                    <span className="text-sm flex-shrink-0">{t.icon}</span>
                    <p className="text-[10px] text-slate-500 leading-snug">{t.tip}</p>
                  </div>
                ))}
              </div>

              {/* Drop zone */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => addFiles(e.target.files)}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
                className={cn(
                  'border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all',
                  dragOver ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:border-amber-300 hover:bg-slate-50'
                )}
              >
                <ImagePlus size={28} className={cn('mx-auto mb-2', dragOver ? 'text-amber-500' : 'text-slate-300')} />
                <p className="text-sm font-semibold text-slate-500">
                  {dragOver ? 'Soltá para agregar' : 'Arrastrá fotos aquí o hacé clic para seleccionar'}
                </p>
                <p className="text-xs text-slate-300 mt-1">JPG, PNG, WEBP · Hasta 20 fotos</p>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  {inCloud
                    ? 'Guardadas en tu cuenta — las vas a ver desde cualquier dispositivo'
                    : 'Guardadas solo en este navegador. Entrá con tu cuenta para que te sigan.'}
                </p>
              </div>

              {/* Grid de fotos */}
              {photos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                    Tus fotos — tocá la estrella para elegir portada, etiquetá cada ambiente
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {photos.map(photo => (
                      <div key={photo.id} className={cn(
                        'relative rounded-xl overflow-hidden border-2 transition-all',
                        photo.isCover ? 'border-amber-400 ring-2 ring-amber-200' : 'border-slate-100'
                      )}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.preview} alt={photo.label} className="w-full h-28 object-cover" />

                        {/* Portada badge */}
                        {photo.isCover && (
                          <div className="absolute top-1.5 left-1.5 bg-brand-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            <Star size={8} fill="currentColor" /> Portada
                          </div>
                        )}

                        {/* Acciones */}
                        <div className="absolute top-1.5 right-1.5 flex gap-1">
                          {!photo.isCover && (
                            <button
                              onClick={() => setCover(photo.id)}
                              title="Usar como portada"
                              className="w-6 h-6 bg-white/90 rounded-full flex items-center justify-center hover:bg-amber-100 transition-colors"
                            >
                              <Star size={10} className="text-slate-400" />
                            </button>
                          )}
                          <button
                            onClick={() => removePhoto(photo.id)}
                            title="Eliminar"
                            className="w-6 h-6 bg-white/90 rounded-full flex items-center justify-center hover:bg-red-100 transition-colors"
                          >
                            <X size={10} className="text-slate-400" />
                          </button>
                        </div>

                        {/* Label selector */}
                        <div className="relative p-1.5 bg-white border-t border-slate-100">
                          <select
                            value={photo.label}
                            onChange={e => setLabel(photo.id, e.target.value)}
                            className="w-full text-[10px] text-slate-600 bg-transparent border-none focus:outline-none appearance-none pr-4 truncate"
                          >
                            <option value="Sin etiquetar">Sin etiquetar</option>
                            {ROOM_LABELS.map(l => <option key={l} value={l}>{l}</option>)}
                          </select>
                          <ChevronDown size={9} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                      </div>
                    ))}

                    {/* Agregar más */}
                    {photos.length < 20 && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="h-full min-h-[8rem] rounded-xl border-2 border-dashed border-slate-200 hover:border-amber-300 flex flex-col items-center justify-center gap-1.5 transition-colors"
                      >
                        <Camera size={20} className="text-slate-300" />
                        <span className="text-[10px] text-slate-400">Agregar más</span>
                      </button>
                    )}
                  </div>

                  {/* Sin etiquetar warning */}
                  {photos.some(p => p.label === 'Sin etiquetar') && (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                      <AlertCircle size={12} className="text-amber-500 mt-0.5 flex-shrink-0" />
                      <p className="text-[10px] text-amber-700">
                        {photos.filter(p => p.label === 'Sin etiquetar').length} foto{photos.filter(p => p.label === 'Sin etiquetar').length > 1 ? 's' : ''} sin etiquetar. Etiquetar mejora el SEO en los portales.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Video CTA */}
              <div className="flex items-start gap-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
                <div className="w-8 h-8 rounded-xl bg-slate-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-base">🎥</span>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-slate-700">Video recorrida</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Las propiedades con video reciben hasta 3× más consultas. Disponible próximamente vía VARA Visit.</p>
                </div>
                <Link href="/vara-visit" className="text-[10px] font-bold text-amber-600 hover:underline whitespace-nowrap">
                  Solicitar
                </Link>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('preview')}
              disabled={!formComplete}
              className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-900 font-bold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2"
            >
              <Eye size={16} /> Ver preview del aviso
            </button>
          </>
        )}

        {/* ── TAB: PREVIEW ── */}
        {activeTab === 'preview' && (
          <>
            <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card overflow-hidden">
              {/* Foto de portada real */}
              {coverPhoto ? (
                <div className="relative h-48 bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={coverPhoto.preview} alt={coverPhoto.label} className="w-full h-full object-cover" />
                  {photos.length > 1 && (
                    <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-semibold px-2 py-1 rounded-full">
                      +{photos.length - 1} foto{photos.length - 1 > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              ) : (
                <div className="h-48 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                  <div className="text-center">
                    <Home size={32} className="text-slate-300 mx-auto mb-1" />
                    <p className="text-xs text-slate-400">Sin fotos cargadas</p>
                    <button onClick={() => setActiveTab('datos')} className="text-xs text-amber-600 font-semibold mt-1 hover:underline">
                      Agregar fotos
                    </button>
                  </div>
                </div>
              )}

              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h2 className="font-bold text-slate-900 text-lg leading-tight">{form.title || 'Sin título'}</h2>
                  <p className="text-xl font-extrabold text-slate-900 whitespace-nowrap">
                    USD {Number(form.price).toLocaleString('es-AR')}
                  </p>
                </div>

                <p className="text-sm text-slate-400 flex items-center gap-1 mb-3">
                  <MapPin size={11} /> {form.address}, {form.neighborhood}, {form.city}
                </p>

                <div className="flex items-center gap-4 mb-4 pb-4 border-b border-slate-100">
                  {form.rooms && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <Home size={13} className="text-slate-400" />
                      <span>{form.rooms} amb.</span>
                    </div>
                  )}
                  {form.bedrooms && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <Bed size={13} className="text-slate-400" />
                      <span>{form.bedrooms} dorm.</span>
                    </div>
                  )}
                  {form.bathrooms && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <Bath size={13} className="text-slate-400" />
                      <span>{form.bathrooms} baños</span>
                    </div>
                  )}
                  {form.coveredSurface && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <Square size={13} className="text-slate-400" />
                      <span>{form.coveredSurface} m² cub.</span>
                    </div>
                  )}
                </div>

                <p className="text-sm text-slate-600 leading-relaxed mb-4">{form.description}</p>

                {form.features.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {form.features.map(f => (
                      <span key={f} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{f}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setActiveTab('datos')}
                className="flex-1 flex items-center justify-center gap-2 bg-white rounded-2xl border border-slate-200/70 shadow-card py-3.5 text-sm font-semibold text-slate-600 hover:shadow-elevated transition-shadow">
                <Edit3 size={14} /> Editar
              </button>
              <button onClick={() => setActiveTab('publicar')}
                className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 rounded-2xl py-3.5 text-sm font-bold text-slate-900 transition-colors">
                <Send size={14} /> Publicar ahora
              </button>
            </div>
          </>
        )}

        {/* ── TAB: PUBLICAR ── */}
        {activeTab === 'publicar' && (
          <>
            <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4">
              <p className="text-xs font-semibold text-slate-500 mb-1">Tu aviso</p>
              <p className="font-bold text-slate-900">{form.title}</p>
              <p className="text-sm text-slate-400">USD {Number(form.price).toLocaleString('es-AR')} · {form.city}</p>
            </div>

            <div className="space-y-3">
              {PORTALS.map(portal => {
                const isPublished = published.includes(portal.id)
                return (
                  <div key={portal.id} className={cn(
                    'bg-white rounded-2xl border border-slate-200/70 shadow-card p-5',
                    isPublished && 'border border-green-200'
                  )}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-xl">
                          {portal.logo}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{portal.name}</p>
                          <p className="text-xs text-slate-400">{portal.reach}</p>
                        </div>
                      </div>
                      {!portal.free && (
                        <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                          Pago
                        </span>
                      )}
                      {portal.free && (
                        <span className="text-[10px] font-bold bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                          Gratis
                        </span>
                      )}
                    </div>

                    {isPublished ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-amber-600">
                          <CheckCircle2 size={14} />
                          <span className="text-xs font-semibold">Solicitud registrada</span>
                        </div>
                        <p className="text-xs text-slate-400">Modo piloto — un coordinador VARA procesará tu publicación en {portal.name} y te contactará para confirmar.</p>
                      </div>
                    ) : (
                      <button
                        onClick={() => handlePublish(portal.id)}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                      >
                        <ExternalLink size={12} /> Solicitar publicación en {portal.name}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            {published.length > 0 && (
              <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 size={14} className="text-amber-600" />
                  <p className="text-sm font-bold text-amber-800">
                    {published.length === 1 ? 'Solicitud en 1 portal registrada' : `Solicitudes en ${published.length} portales registradas`}
                  </p>
                </div>
                <p className="text-xs text-amber-700 leading-relaxed">
                  Borrador guardado localmente. La publicación en portales requiere coordinación manual — un coordinador VARA procesará tu solicitud y te contactará para confirmar. La tarea de publicación en tu operación se completa cuando tengás la URL del aviso publicado.
                </p>
                <Link href="/asistente" className="mt-2 flex items-center gap-1 text-xs font-semibold text-green-700 hover:underline">
                  Estrategia de negociación con VARA →
                </Link>
              </div>
            )}
          </>
        )}

      </div>
    </div>
    </div>
  )
}
