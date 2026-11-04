'use client'
import { Bath, Bed, Edit3, Home, MapPin, Send, Square } from 'lucide-react'
import type { PhotoItem, PublishForm, Tab } from './model'

export function PreviewStep({ form, photos, coverPhoto, setActiveTab }: {
  form: PublishForm
  photos: PhotoItem[]
  coverPhoto: PhotoItem | null
  setActiveTab: (t: Tab) => void
}) {
  return (
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
  )
}
