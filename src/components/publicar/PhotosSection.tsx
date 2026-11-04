'use client'
import Link from 'next/link'
import { AlertCircle, Camera, ChevronDown, ImagePlus, Sparkles, Star, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOTO_TIPS, ROOM_LABELS } from './model'
import type { usePublishPhotos } from './usePublishPhotos'

export function PhotosSection({ p }: { p: ReturnType<typeof usePublishPhotos> }) {
  const { photos, dragOver, setDragOver, fileInputRef, inCloud, sessionChecked, uploading, addFiles, removePhoto, setCover, setLabel } = p
  return (
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
          {!sessionChecked
            ? 'Revisando tu cuenta…'
            : inCloud
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
          <p className="text-xs font-bold text-slate-700">Recorrido en video</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Armalo vos con tus fotos, con movimiento de cámara y el nombre de cada ambiente. Sin costo. Si querés un recorrido filmado en la propiedad, se pide por VARA Visit.</p>
          <Link href="/vara-visit" className="mt-1 inline-block text-[10px] font-semibold text-slate-500 hover:underline">
            Pedir recorrido filmado
          </Link>
        </div>
        <Link href="/video-presentacion" className="text-[10px] font-bold text-amber-600 hover:underline whitespace-nowrap">
          Armar recorrido
        </Link>
      </div>
    </div>
  )
}
