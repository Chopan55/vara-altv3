'use client'
import { AlertCircle, Eye, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FEATURES, PROPERTY_TYPES, type PublishForm, type Tab } from './model'
import { PhotosSection } from './PhotosSection'
import type { usePublishPhotos } from './usePublishPhotos'

export function DatosStep({
  form, set, toggleFeature, generateCopy, copyLoading, copyError, highlights, formComplete, setActiveTab, photosState,
}: {
  form: PublishForm
  set: (k: keyof PublishForm, v: string) => void
  toggleFeature: (f: string) => void
  generateCopy: () => void
  copyLoading: boolean
  copyError: string | null
  highlights: string[]
  formComplete: boolean
  setActiveTab: (t: Tab) => void
  photosState: ReturnType<typeof usePublishPhotos>
}) {
  return (
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
      <PhotosSection p={photosState} />

      <button
        onClick={() => setActiveTab('preview')}
        disabled={!formComplete}
        className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-900 font-bold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2"
      >
        <Eye size={16} /> Ver preview del aviso
      </button>
    </>
  )
}
