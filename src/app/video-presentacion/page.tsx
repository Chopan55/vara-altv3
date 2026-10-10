'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft, Clapperboard, Download } from 'lucide-react'
import { loadPhotos } from '@/lib/photoStore'
import { MAX_PHOTOS, SECONDS_PER_PHOTO } from '@/lib/video/timeline'
import { buildSlideshow, canRecordVideo } from '@/lib/video/slideshow'

const DRAFT_KEY = 'vara_publish_draft'

export default function VideoPresentacionPage() {
  const [photos, setPhotos] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [progress, setProgress] = useState<number | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    setSupported(canRecordVideo())
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}') as { title?: string; neighborhood?: string; city?: string }
      setTitle(d.title ?? '')
      setSubtitle([d.neighborhood, d.city].filter(Boolean).join(', '))
    } catch {}
    loadPhotos()
      .then(ps => setPhotos(ps.sort((a, b) => Number(b.isCover) - Number(a.isCover)).slice(0, MAX_PHOTOS).map(p => p.preview)))
      .catch(() => {})
  }, [])

  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl) }, [videoUrl])

  const generate = async () => {
    setError(null)
    if (videoUrl) { URL.revokeObjectURL(videoUrl); setVideoUrl(null) }
    setProgress(0)
    try {
      const blob = await buildSlideshow({ urls: photos, title, subtitle, onProgress: setProgress })
      setVideoUrl(URL.createObjectURL(blob))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos armar el video.')
    } finally {
      setProgress(null)
    }
  }

  const seconds = photos.length * SECONDS_PER_PHOTO

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-3xl mx-auto px-4 lg:px-6 py-6">
        <Link href="/publicar" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm mb-4"><ArrowLeft size={14} /> Volver a Mi propiedad</Link>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Video de presentación</h1>
        <p className="text-sm text-slate-500 mt-1">Un video corto armado con tus fotos, con transiciones suaves y el título de tu propiedad.</p>
        <p className="mt-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Se arma en tu navegador con tus fotos, sin inteligencia artificial y sin costo. Tus fotos no salen de tu dispositivo. Es un recorrido de imágenes, no una filmación de la propiedad.</p>

        {photos.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-6">
            <p className="text-sm text-slate-700">Todavía no subiste fotos. Cargalas en “Mi propiedad” y volvé.</p>
            <Link href="/publicar" className="mt-4 inline-block rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Subir fotos</Link>
          </div>
        ) : (
          <>
            <section className="mt-6 grid gap-4 rounded-2xl border border-slate-100 bg-white p-5 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">Título<input value={title} maxLength={60} onChange={e => setTitle(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></label>
              <label className="text-sm font-medium text-slate-700">Ubicación<input value={subtitle} maxLength={80} onChange={e => setSubtitle(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></label>
              <p className="text-xs text-slate-500 sm:col-span-2">{photos.length} {photos.length === 1 ? 'foto' : 'fotos'} · {seconds} segundos. La foto de portada va primero.</p>
            </section>

            {!supported && <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Tu navegador no puede armar videos. Probá con Chrome o Edge en una computadora.</p>}
            {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button type="button" onClick={generate} disabled={!supported || progress !== null} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"><Clapperboard size={14} /> {progress !== null ? `Armando… ${Math.round(progress * 100)}%` : videoUrl ? 'Armar de nuevo' : 'Armar video'}</button>
              {videoUrl && <a href={videoUrl} download="presentacion-vara.webm" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"><Download size={14} /> Descargar</a>}
            </div>
            {progress !== null && <p className="mt-2 text-xs text-slate-500">Dejá esta pestaña abierta mientras se arma (dura lo mismo que el video).</p>}
            {videoUrl && <video src={videoUrl} controls className="mt-5 w-full rounded-2xl bg-black" />}
          </>
        )}
      </div>
    </div>
  )
}
