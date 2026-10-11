'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Clapperboard, Download } from 'lucide-react'
import { loadSellerPhotos, type SellerPhoto } from '@/lib/sellerPhotos'
import { MAX_PHOTOS } from '@/lib/video/timeline'
import { buildSlideshow, canRecordVideo } from '@/lib/video/slideshow'
import { UNLABELED, tourOrder } from '@/lib/photoAdvice'

const DRAFT_KEY = 'vara_publish_draft'

export default function VideoPresentacionPage() {
  const [photos, setPhotos] = useState<SellerPhoto[]>([])
  const [loaded, setLoaded] = useState(false)
  const [asTour, setAsTour] = useState(true)
  const [secs, setSecs] = useState(3)
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
    loadSellerPhotos().then(setPhotos).catch(() => {}).finally(() => setLoaded(true))
  }, [])

  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl) }, [videoUrl])

  // Orden del recorrido: de la calle hacia adentro. Sin él, queda el orden en que se subieron (portada primero).
  const ordered = useMemo(() => (asTour ? tourOrder(photos) : photos).slice(0, MAX_PHOTOS), [photos, asTour])
  const unlabeled = photos.filter(p => !p.label || p.label === UNLABELED).length

  const generate = async () => {
    setError(null)
    if (videoUrl) { URL.revokeObjectURL(videoUrl); setVideoUrl(null) }
    setProgress(0)
    try {
      const items = ordered.map(p => ({ url: p.url, label: p.label && p.label !== UNLABELED ? p.label : undefined }))
      const blob = await buildSlideshow({ items, title, subtitle, secondsPerPhoto: secs, onProgress: setProgress })
      setVideoUrl(URL.createObjectURL(blob))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos armar el video.')
    } finally {
      setProgress(null)
    }
  }

  const seconds = ordered.length * secs

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-3xl mx-auto px-4 lg:px-6 py-6">
        <Link href="/publicar" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm mb-4"><ArrowLeft size={14} /> Volver a Mi propiedad</Link>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Recorrido en video</h1>
        <p className="text-sm text-slate-500 mt-1">Un recorrido por tu propiedad armado con tus fotos: la cámara se mueve en cada una y se muestra el nombre de cada ambiente.</p>
        <p className="mt-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Se arma en tu navegador con tus fotos, sin inteligencia artificial y sin costo. Tus fotos no salen de tu dispositivo. Es un recorrido de imágenes con movimiento de cámara, no una filmación de la propiedad.</p>

        {loaded && photos.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-6">
            <p className="text-sm text-slate-700">Todavía no subiste fotos. Cargalas en “Mi propiedad” y volvé.</p>
            <Link href="/publicar" className="mt-4 inline-block rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Subir fotos</Link>
          </div>
        ) : photos.length > 0 && (
          <>
            <section className="mt-6 grid gap-4 rounded-2xl border border-slate-100 bg-white p-5 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">Título<input value={title} maxLength={60} onChange={e => setTitle(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-sm" /></label>
              <label className="text-sm font-medium text-slate-700">Ubicación<input value={subtitle} maxLength={80} onChange={e => setSubtitle(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-sm" /></label>
              <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2"><input type="checkbox" checked={asTour} onChange={e => setAsTour(e.target.checked)} /> Ordenar como un recorrido (frente, living, cocina, dormitorios, baño, exterior)</label>
              <label className="text-sm font-medium text-slate-700">Segundos por ambiente
                <select value={secs} onChange={e => setSecs(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base sm:text-sm">
                  <option value={3}>3 (ágil)</option><option value={4}>4</option><option value={5}>5 (tranquilo)</option>
                </select>
              </label>
              <p className="self-end text-xs text-slate-500">{ordered.length} {ordered.length === 1 ? 'foto' : 'fotos'} · {seconds} segundos.</p>
            </section>

            <ol className="mt-4 flex flex-wrap gap-2 text-xs" aria-label="Orden del recorrido">
              {ordered.map((p, i) => (
                <li key={p.id} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">{i + 1}. {p.label && p.label !== UNLABELED ? p.label : 'Sin nombre'}</li>
              ))}
            </ol>
            {unlabeled > 0 && (
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">{unlabeled} {unlabeled === 1 ? 'foto no tiene' : 'fotos no tienen'} nombre de ambiente, así que {unlabeled === 1 ? 'queda' : 'quedan'} al final y sin cartel. Etiquetalas en <Link href="/publicar" className="underline">Mi propiedad</Link> (Living, Cocina…) para un recorrido en orden.</p>
            )}

            {!supported && <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Tu navegador no puede armar videos. Probá con Chrome o Edge en una computadora.</p>}
            {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button type="button" onClick={generate} disabled={!supported || progress !== null} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"><Clapperboard size={14} /> {progress !== null ? `Armando… ${Math.round(progress * 100)}%` : videoUrl ? 'Armar de nuevo' : 'Armar recorrido'}</button>
              {videoUrl && <a href={videoUrl} download="recorrido-vara.webm" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"><Download size={14} /> Descargar</a>}
            </div>
            {progress !== null && <p className="mt-2 text-xs text-slate-500">Dejá esta pestaña abierta mientras se arma (dura lo mismo que el video).</p>}
            {videoUrl && <video src={videoUrl} controls className="mt-5 w-full rounded-2xl bg-black" />}
            <p className="mt-6 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">¿Querés clips con movimiento real generados por IA a partir de tus fotos? Probá el <Link href="/recorrido-ia" className="font-semibold underline">Recorrido con IA</Link> (en prueba, con costo por clip y solo para cuentas habilitadas).</p>
            <p className="mt-3 text-xs text-slate-400">¿Querés un recorrido filmado en la propiedad por una persona? Se pide por <Link href="/vara-visit" className="underline">VARA Visit</Link>.</p>
          </>
        )}
      </div>
    </div>
  )
}
