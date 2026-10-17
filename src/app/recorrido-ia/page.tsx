'use client'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Play, Sparkles } from 'lucide-react'
import { loadSellerPhotos, type SellerPhoto } from '@/lib/sellerPhotos'
import { UNLABELED, tourOrder } from '@/lib/photoAdvice'
import { photoToBase64 } from '@/lib/photoVisualize'
import { CLIP_LABEL, CLIP_SECONDS, MAX_CLIPS_PER_TOUR, estimateCostUsd } from '@/lib/tourClip'

type ClipState = 'waiting' | 'creating' | 'generating' | 'ready' | 'failed'
interface Clip { photoId: string; label: string; state: ClipState; url?: string; message?: string }

const POLL_MS = 8000
const MAX_WAIT_MS = 8 * 60 * 1000
const money = (n: number) => `USD ${n.toFixed(2).replace('.', ',')}`
const STATE_TEXT: Record<ClipState, string> = { waiting: 'En espera', creating: 'Enviando…', generating: 'Generando (puede tardar unos minutos)…', ready: 'Listo', failed: 'No se pudo' }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export default function RecorridoIAPage() {
  const [photos, setPhotos] = useState<SellerPhoto[]>([])
  const [loaded, setLoaded] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [accepted, setAccepted] = useState(false)
  const [running, setRunning] = useState(false)
  const [clips, setClips] = useState<Clip[]>([])
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState<number | null>(null)
  const urls = useRef<string[]>([])

  useEffect(() => {
    loadSellerPhotos({ onlyPublishable: true }).then(ps => {
      const ordered = tourOrder(ps)
      setPhotos(ordered)
      // Por defecto, hasta 3 fotos con ambiente nombrado: alcanza para probar y cuesta poco.
      setPicked(ordered.filter(p => p.label && p.label !== UNLABELED).slice(0, 3).map(p => p.id))
    }).catch(() => {}).finally(() => setLoaded(true))
    return () => { urls.current.forEach(u => URL.revokeObjectURL(u)) }
  }, [])

  const cost = useMemo(() => estimateCostUsd(picked.length), [picked])
  const toggle = (id: string) => setPicked(cur => cur.includes(id) ? cur.filter(x => x !== id) : cur.length >= MAX_CLIPS_PER_TOUR ? cur : [...cur, id])
  const patch = (i: number, p: Partial<Clip>) => setClips(cur => cur.map((c, k) => (k === i ? { ...c, ...p } : c)))

  const generate = async () => {
    const chosen = photos.filter(p => picked.includes(p.id))
    if (chosen.length === 0 || !accepted || running) return
    setError(null); setPlaying(null); setRunning(true)
    urls.current.forEach(u => URL.revokeObjectURL(u)); urls.current = []
    setClips(chosen.map(p => ({ photoId: p.id, label: p.label && p.label !== UNLABELED ? p.label : 'Ambiente', state: 'waiting' })))

    for (let i = 0; i < chosen.length; i++) {
      const p = chosen[i]
      patch(i, { state: 'creating' })
      try {
        const { base64, mimeType } = await photoToBase64(p.url)
        const created = await fetch('/api/tour-clip', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mimeType, room: p.label }),
        })
        const cj = await created.json().catch(() => ({}))
        if (!created.ok) { patch(i, { state: 'failed', message: cj?.error ?? 'No pudimos generar el clip.' }); setError(cj?.error ?? 'No pudimos generar el clip.'); break }

        patch(i, { state: 'generating' })
        const started = Date.now()
        let done = false
        while (Date.now() - started < MAX_WAIT_MS) {
          await sleep(POLL_MS)
          const st = await fetch(`/api/tour-clip?op=${encodeURIComponent(cj.operation)}`)
          const sj = await st.json().catch(() => ({}))
          if (!st.ok) { patch(i, { state: 'failed', message: sj?.error ?? 'No pudimos consultar el clip.' }); done = true; break }
          if (sj.state === 'failed') { patch(i, { state: 'failed', message: sj.message }); done = true; break }
          if (sj.state === 'ready') {
            const vid = await fetch(`/api/tour-clip?op=${encodeURIComponent(cj.operation)}&download=1`)
            if (!vid.ok) { patch(i, { state: 'failed', message: 'No pudimos bajar el clip.' }); done = true; break }
            const url = URL.createObjectURL(await vid.blob())
            urls.current.push(url)
            patch(i, { state: 'ready', url })
            done = true
            break
          }
        }
        if (!done) patch(i, { state: 'failed', message: 'Tardó demasiado. Probá de nuevo más tarde.' })
      } catch (e) {
        patch(i, { state: 'failed', message: e instanceof Error ? e.message : 'Algo falló.' })
      }
    }
    setRunning(false)
  }

  const readyClips = clips.map((c, i) => ({ c, i })).filter(x => x.c.state === 'ready')
  const playNext = (fromIndex: number) => {
    const next = readyClips.find(x => x.i > fromIndex)
    setPlaying(next ? next.i : null)
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-3xl mx-auto px-4 lg:px-6 py-6">
        <Link href="/video-presentacion" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm mb-4"><ArrowLeft size={14} /> Volver al recorrido en video</Link>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Recorrido con IA (en prueba)</h1>
        <p className="text-sm text-slate-500 mt-1">La IA convierte cada foto en un clip corto con la cámara avanzando dentro del ambiente. Después los podés ver uno detrás del otro como un recorrido.</p>
        <p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">{CLIP_LABEL}. La IA puede deformar o inventar detalles: revisá cada clip antes de mostrarlo y no lo presentes como el estado real. Los clips pueden traer sonido generado.</p>

        {loaded && photos.length === 0 && (
          <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-6">
            <p className="text-sm text-slate-700">Todavía no subiste fotos. Cargalas en “Mi propiedad”.</p>
            <Link href="/publicar" className="mt-4 inline-block rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Subir fotos</Link>
          </div>
        )}

        {photos.length > 0 && (
          <>
            <h2 className="mt-6 text-sm font-bold text-slate-900">1. Elegí las fotos (hasta {MAX_CLIPS_PER_TOUR})</h2>
            <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {photos.map(p => {
                const on = picked.includes(p.id)
                return (
                  <li key={p.id}>
                    <button type="button" onClick={() => toggle(p.id)} aria-pressed={on} disabled={running} className={`relative block w-full overflow-hidden rounded-xl border-2 ${on ? 'border-brand-500' : 'border-transparent'}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt={p.label} className="h-24 w-full object-cover" />
                      <span className="absolute bottom-1 left-1 rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold text-white">{p.label && p.label !== UNLABELED ? p.label : 'Sin nombre'}</span>
                    </button>
                  </li>
                )
              })}
            </ul>

            <section className="mt-5 rounded-2xl border border-slate-100 bg-white p-4">
              <p className="text-sm text-slate-800"><span className="font-semibold">{picked.length}</span> {picked.length === 1 ? 'clip' : 'clips'} de {CLIP_SECONDS} segundos · costo estimado <span className="font-semibold">{money(cost)}</span></p>
              <p className="mt-1 text-[11px] text-slate-500">Cálculo con la tarifa publicada por Google para su modelo más económico (Veo 3.1 Lite). El cobro lo hace Google a la cuenta donde está la clave, solo por los clips que salen bien. Verificá la tarifa vigente en su página de precios.</p>
              <label className="mt-3 flex items-start gap-2 text-xs text-slate-700"><input type="checkbox" className="mt-0.5" checked={accepted} onChange={e => setAccepted(e.target.checked)} disabled={running} /> Entiendo que cada clip generado se cobra y que hay un límite de 10 clips por día.</label>
              <button type="button" onClick={generate} disabled={picked.length === 0 || !accepted || running} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"><Sparkles size={14} /> {running ? 'Generando…' : 'Generar recorrido'}</button>
              {running && <p className="mt-2 text-xs text-slate-500">Dejá esta pestaña abierta. Cada clip puede tardar entre unos segundos y varios minutos.</p>}
            </section>
            {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          </>
        )}

        {clips.length > 0 && (
          <section className="mt-6 space-y-4" aria-live="polite" aria-label="Clips">
            {readyClips.length > 1 && playing === null && (
              <button type="button" onClick={() => setPlaying(readyClips[0].i)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"><Play size={14} /> Ver el recorrido completo</button>
            )}
            {playing !== null && clips[playing]?.url && (
              <div>
                <p className="mb-1 text-xs font-semibold text-slate-600">Recorrido · {clips[playing].label}</p>
                <video key={clips[playing].url} src={clips[playing].url} autoPlay controls playsInline onEnded={() => playNext(playing)} className="w-full rounded-2xl bg-black" />
                <p className="mt-1 text-[11px] text-slate-400">{CLIP_LABEL}</p>
              </div>
            )}
            <ul className="space-y-3">
              {clips.map((c, i) => (
                <li key={`${c.photoId}-${i}`} className="rounded-2xl border border-slate-100 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">{i + 1}. {c.label}</p>
                    <span className={`text-xs ${c.state === 'failed' ? 'text-rose-600' : c.state === 'ready' ? 'text-emerald-600' : 'text-slate-500'}`}>{STATE_TEXT[c.state]}</span>
                  </div>
                  {c.state === 'failed' && c.message && <p className="mt-1 text-xs text-rose-700">{c.message}</p>}
                  {c.url && (
                    <>
                      <video src={c.url} controls playsInline className="mt-2 w-full rounded-xl bg-black" />
                      <div className="mt-1 flex items-center justify-between">
                        <p className="text-[11px] text-slate-400">{CLIP_LABEL}</p>
                        <a href={c.url} download={`clip-${i + 1}-${c.label}.mp4`} className="text-xs font-semibold text-brand-700 underline">Descargar</a>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
