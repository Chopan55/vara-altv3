'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { loadPhotos } from '@/lib/photoStore'
import { GENERATED_LABEL, VISUALIZE_MODES, humanError, noticeFor, photoToBase64, type VisualizeMode } from '@/lib/photoVisualize'

interface Rec { title: string; description: string; estimatedCostMin: number; estimatedCostMax: number; timeWeeks: number; impact: string }
interface Result { roomType: string; currentState: string; recommendations: Rec[]; transformedImageUrl: string; editMethod?: 'edit' | 'generated' | 'none'; imageNote?: string }

const usd = (n: number) => `USD ${Math.round(n).toLocaleString('es-AR')}`

export default function FotosVentaPage() {
  const [photos, setPhotos] = useState<{ id: string; preview: string; label: string }[]>([])
  const [loaded, setLoaded] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [mode, setMode] = useState<VisualizeMode>('AUTO')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  useEffect(() => {
    loadPhotos().then(ps => setPhotos(ps.map(p => ({ id: p.id, preview: p.preview, label: p.label })))).catch(() => {}).finally(() => setLoaded(true))
  }, [])

  const current = photos.find(p => p.id === selected) ?? null

  const run = async () => {
    if (!current) return
    setLoading(true); setError(null); setResult(null)
    try {
      const { base64, mimeType } = await photoToBase64(current.preview)
      const res = await fetch('/api/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType, mode, instruction: '' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(humanError(res.status, data?.error)); return }
      setResult(data as Result)
    } catch (e) {
      setError(e instanceof Error ? e.message : humanError(500))
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-3xl mx-auto px-4 lg:px-6 py-6">
        <Link href="/publicar" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm mb-4"><ArrowLeft size={14} /> Volver a Mi propiedad</Link>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Fotos: ver el potencial</h1>
        <p className="text-sm text-slate-500 mt-1">¿Querés mejorar estas fotos antes de publicar? Elegí una y mirá cómo podría verse. Publicá siempre las fotos originales como base: lo generado es solo una visualización.</p>
        <p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Función en prueba. Usa inteligencia artificial y tiene un límite diario. Si todavía no está habilitada para tu cuenta, te lo vamos a avisar.</p>

        {loaded && photos.length === 0 && (
          <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-6">
            <p className="text-sm text-slate-700">Todavía no subiste fotos. Cargalas en “Mi propiedad”.</p>
            <Link href="/publicar" className="mt-4 inline-block rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Subir fotos</Link>
          </div>
        )}

        {photos.length > 0 && (
          <>
            <h2 className="mt-6 text-sm font-bold text-slate-900">1. Elegí una foto</h2>
            <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {photos.map(p => (
                <li key={p.id}>
                  <button type="button" onClick={() => { setSelected(p.id); setResult(null); setError(null) }} aria-pressed={selected === p.id} className={`block w-full overflow-hidden rounded-xl border-2 ${selected === p.id ? 'border-brand-500' : 'border-transparent'}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.preview} alt={p.label} className="h-24 w-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>

            <h2 className="mt-6 text-sm font-bold text-slate-900">2. ¿Qué querés ver?</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {VISUALIZE_MODES.map(m => (
                <button key={m.id} type="button" title={m.hint} aria-pressed={mode === m.id} onClick={() => setMode(m.id)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${mode === m.id ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600'}`}>{m.label}</button>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button type="button" onClick={run} disabled={!current || loading} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"><Sparkles size={14} /> {loading ? 'Generando… puede tardar un minuto' : 'Visualizar potencial'}</button>
              {!current && <span className="text-xs text-slate-400">Elegí una foto primero.</span>}
            </div>
            {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          </>
        )}

        {result && (
          <section className="mt-6" aria-live="polite">
            {result.transformedImageUrl ? (
              <figure className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={result.transformedImageUrl} alt="Visualización generada" className="w-full" />
                <figcaption className="absolute left-3 top-3 rounded-full bg-slate-900/85 px-3 py-1 text-[11px] font-semibold text-white">{GENERATED_LABEL}</figcaption>
              </figure>
            ) : null}
            <p className="mt-3 text-xs text-slate-500">{noticeFor(result.editMethod, result.imageNote)}</p>

            {result.recommendations.length > 0 && (
              <div className="mt-5">
                <h2 className="text-sm font-bold text-slate-900">Qué cambiaría ({result.roomType})</h2>
                <p className="text-xs text-slate-500">{result.currentState}</p>
                <ul className="mt-3 space-y-2">
                  {result.recommendations.map(r => (
                    <li key={r.title} className="rounded-xl border border-slate-100 bg-white p-3">
                      <p className="text-sm font-semibold text-slate-800">{r.title}</p>
                      <p className="mt-1 text-xs text-slate-600">{r.description}</p>
                      <p className="mt-1 text-[11px] text-slate-400">Costo estimado {usd(r.estimatedCostMin)} – {usd(r.estimatedCostMax)} · {r.timeWeeks} {r.timeWeeks === 1 ? 'semana' : 'semanas'}</p>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-slate-400">Los costos son estimaciones generadas por IA, no presupuestos. Pedí cotizaciones reales antes de decidir.</p>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
