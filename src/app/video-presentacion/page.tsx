'use client'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Clapperboard, Download } from 'lucide-react'
import { loadSellerPhotos, type SellerPhoto } from '@/lib/sellerPhotos'
import { MAX_PHOTOS } from '@/lib/video/timeline'
import { buildSlideshow, canRecordVideo } from '@/lib/video/slideshow'
import { UNLABELED, tourOrder } from '@/lib/photoAdvice'
import { MUSIC_RIGHTS_NOTE, MUSIC_STYLES, audioFileProblem, buildEvents, decodeAudioFile, playEvents, type MusicStyleId } from '@/lib/video/music'

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
  const [music, setMusic] = useState<'none' | MusicStyleId | 'file'>('none')
  const [fileAudio, setFileAudio] = useState<{ name: string; buffer: AudioBuffer } | null>(null)
  const [volume, setVolume] = useState(50)
  const [musicError, setMusicError] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState<MusicStyleId | null>(null)
  const previewCtx = useRef<AudioContext | null>(null)

  const stopPreview = () => { previewCtx.current?.close().catch(() => {}); previewCtx.current = null; setPreviewing(null) }
  useEffect(() => () => { previewCtx.current?.close().catch(() => {}) }, [])

  /** Escuchar 10 segundos del estilo antes de elegirlo. */
  const preview = (id: MusicStyleId) => {
    if (previewing === id) { stopPreview(); return }
    stopPreview()
    const style = MUSIC_STYLES.find(m => m.id === id)
    if (!style) return
    try {
      const ctx = new window.AudioContext()
      const master = ctx.createGain()
      master.gain.value = volume / 100
      master.connect(ctx.destination)
      playEvents(ctx, master, buildEvents(style, 10), ctx.currentTime + 0.05)
      previewCtx.current = ctx
      setPreviewing(id)
      setTimeout(() => { if (previewCtx.current === ctx) stopPreview() }, 10500)
    } catch { setMusicError('Tu navegador no puede reproducir la muestra.') }
  }

  const onFile = async (file?: File) => {
    if (!file) return
    const problem = audioFileProblem(file)
    if (problem) { setMusicError(problem); return }
    setMusicError(null)
    try {
      const buffer = await decodeAudioFile(file)
      setFileAudio({ name: file.name, buffer })
      setMusic('file')
    } catch { setMusicError('No pudimos leer ese audio. Probá con otro MP3.') }
  }

  useEffect(() => {
    setSupported(canRecordVideo())
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}') as { title?: string; neighborhood?: string; city?: string }
      setTitle(d.title ?? '')
      setSubtitle([d.neighborhood, d.city].filter(Boolean).join(', '))
    } catch {}
    loadSellerPhotos({ onlyPublishable: true }).then(setPhotos).catch(() => {}).finally(() => setLoaded(true))
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
      stopPreview()
      const chosen = music === 'none' ? null : music === 'file' ? (fileAudio ? { kind: 'file' as const, buffer: fileAudio.buffer } : null) : { kind: 'style' as const, id: music }
      const blob = await buildSlideshow({ items, title, subtitle, secondsPerPhoto: secs, music: chosen, musicVolume: volume / 100, onProgress: setProgress })
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

            <section aria-label="Música de fondo" className="mt-5 rounded-2xl border border-slate-100 bg-white p-5">
              <h2 className="text-sm font-bold text-slate-900">Música de fondo</h2>
              <p className="mt-1 text-xs text-slate-500">Cuatro estilos de VARA pensados para recorridos, sin derechos de autor y sin costo. O subí tu propio MP3.</p>
              <div className="mt-3 space-y-2" role="radiogroup" aria-label="Elegir música">
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm text-slate-700"><input type="radio" name="music" checked={music === 'none'} onChange={() => { setMusic('none'); stopPreview() }} /> Sin música</label>
                {MUSIC_STYLES.map(m => (
                  <div key={m.id} className={`flex items-center justify-between gap-2 rounded-xl border p-3 ${music === m.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>
                    <label className="flex flex-1 items-start gap-2 text-sm text-slate-800"><input type="radio" name="music" className="mt-1" checked={music === m.id} onChange={() => setMusic(m.id)} /><span><span className="font-semibold">{m.label}</span><span className="block text-xs text-slate-500">{m.description}</span></span></label>
                    <button type="button" onClick={() => preview(m.id)} className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">{previewing === m.id ? 'Detener' : 'Escuchar'}</button>
                  </div>
                ))}
                <div className={`rounded-xl border p-3 ${music === 'file' ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>
                  <label className="flex items-center gap-2 text-sm text-slate-800"><input type="radio" name="music" checked={music === 'file'} disabled={!fileAudio} onChange={() => setMusic('file')} /><span className="font-semibold">Mi propio MP3</span>{fileAudio && <span className="truncate text-xs text-slate-500">{fileAudio.name}</span>}</label>
                  <input type="file" accept="audio/mpeg,.mp3" onChange={e => { void onFile(e.target.files?.[0]); e.target.value = '' }} aria-label="Subir un MP3" className="mt-2 block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white" />
                  <p className="mt-1 text-[11px] text-slate-500">Hasta 15 MB. El archivo se queda en tu navegador: no se sube a ningún servidor.</p>
                </div>
              </div>
              {music !== 'none' && (
                <label className="mt-3 block text-xs font-semibold text-slate-600">Volumen: {volume}%
                  <input type="range" min={10} max={100} step={5} value={volume} onChange={e => setVolume(Number(e.target.value))} className="mt-1 w-full" />
                </label>
              )}
              {music === 'file' && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-[11px] text-amber-800">{MUSIC_RIGHTS_NOTE}</p>}
              {musicError && <p role="alert" className="mt-2 text-xs text-rose-700">{musicError}</p>}
            </section>

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
