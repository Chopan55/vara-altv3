'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowLeft, Info, Send, Sparkles } from 'lucide-react'
import { loadSellerPhotos } from '@/lib/sellerPhotos'
import { advisePhotos, measurePhoto, type Advice } from '@/lib/photoAdvice'
import { GENERATED_LABEL, VISUALIZE_MODES, humanError, noticeFor, photoToBase64, type VisualizeMode } from '@/lib/photoVisualize'

interface Rec { title: string; description: string; estimatedCostMin: number; estimatedCostMax: number; timeWeeks: number; impact: string }
interface Result { roomType: string; currentState: string; recommendations: Rec[]; transformedImageUrl: string; editMethod?: 'edit' | 'generated' | 'none'; imageNote?: string }
interface Turn { id: number; modeLabel: string; instruction: string; result: Result }
interface Photo { id: string; preview: string; label: string; isCover: boolean }

const usd = (n: number) => `USD ${Math.round(n).toLocaleString('es-AR')}`
const SUGGESTIONS = ['Agregá una pileta', 'Cambiá el piso por madera clara', 'Sumá plantas y más luz natural', 'Sacá el auto del frente', 'Pintá las paredes de blanco']
const SEV_STYLE: Record<Advice['severity'], string> = { high: 'border-rose-200 bg-rose-50 text-rose-800', medium: 'border-amber-200 bg-amber-50 text-amber-800', info: 'border-slate-200 bg-slate-50 text-slate-700' }

export default function FotosVentaPage() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [measures, setMeasures] = useState<Record<string, { width: number; height: number; brightness: number }>>({})
  const [loaded, setLoaded] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [mode, setMode] = useState<VisualizeMode>('AUTO')
  const [instruction, setInstruction] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [turns, setTurns] = useState<Turn[]>([])

  useEffect(() => {
    loadSellerPhotos()
      .then(ps => {
        const list = ps.map(p => ({ id: p.id, preview: p.url, label: p.label, isCover: p.isCover }))
        setPhotos(list)
        // Medimos brillo y tamaño en segundo plano para poder recomendar.
        list.forEach(p => { measurePhoto(p.preview).then(m => { if (m) setMeasures(prev => ({ ...prev, [p.id]: m })) }) })
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  const advice = useMemo(() => advisePhotos(photos.map(p => ({ id: p.id, label: p.label, isCover: p.isCover, ...measures[p.id] }))), [photos, measures])
  const current = photos.find(p => p.id === selected) ?? null

  const run = async () => {
    if (!current) return
    setLoading(true); setError(null)
    const asked = instruction.trim()
    try {
      const { base64, mimeType } = await photoToBase64(current.preview)
      const res = await fetch('/api/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType, mode, instruction: asked }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(humanError(res.status, data?.error)); return }
      const modeLabel = VISUALIZE_MODES.find(m => m.id === mode)?.label ?? mode
      setTurns(prev => [...prev, { id: Date.now(), modeLabel, instruction: asked, result: data as Result }])
      setInstruction('')
    } catch (e) {
      setError(e instanceof Error ? e.message : humanError(500))
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-3xl mx-auto px-4 lg:px-6 py-6">
        <Link href="/publicar" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm mb-4"><ArrowLeft size={14} /> Volver a Mi propiedad</Link>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Fotos: recomendaciones y potencial</h1>
        <p className="text-sm text-slate-500 mt-1">Mirá qué mejorar en tus fotos antes de publicar y pedí, con tus palabras, cómo te gustaría ver la propiedad. Publicá siempre las fotos originales como base: lo generado es solo una visualización.</p>

        {loaded && photos.length === 0 && (
          <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-6">
            <p className="text-sm text-slate-700">Todavía no subiste fotos. Cargalas en “Mi propiedad”.</p>
            <Link href="/publicar" className="mt-4 inline-block rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Subir fotos</Link>
          </div>
        )}

        {photos.length > 0 && (
          <>
            <section className="mt-6" aria-label="Recomendaciones para tus fotos">
              <h2 className="text-sm font-bold text-slate-900">Recomendaciones para tus fotos</h2>
              {advice.length === 0 ? (
                <p className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">No veo nada para corregir en lo que se puede medir (cantidad, ambientes, luz y tamaño). Igual conviene que alguien más las mire.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {advice.map(a => (
                    <li key={a.id} className={`flex gap-2 rounded-xl border p-3 text-sm ${SEV_STYLE[a.severity]}`}>
                      {a.severity === 'info' ? <Info size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
                      <span>{a.text}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[11px] text-slate-400">Se calculan con datos medibles de tus fotos: cantidad, ambientes etiquetados, luz y tamaño. No evalúan si una foto es linda.</p>
            </section>

            <h2 className="mt-8 text-sm font-bold text-slate-900">1. Elegí una foto</h2>
            <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {photos.map(p => (
                <li key={p.id}>
                  <button type="button" onClick={() => { setSelected(p.id); setTurns([]); setError(null) }} aria-pressed={selected === p.id} className={`block w-full overflow-hidden rounded-xl border-2 ${selected === p.id ? 'border-brand-500' : 'border-transparent'}`}>
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

            <h2 className="mt-6 text-sm font-bold text-slate-900">3. Pedí lo que quieras cambiar o agregar</h2>
            <p className="text-xs text-slate-500">Escribilo como se lo dirías a una persona. Cada pedido parte de tu foto original; no se acumulan.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SUGGESTIONS.map(s => (
                <button key={s} type="button" onClick={() => setInstruction(s)} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600 hover:border-brand-300">{s}</button>
              ))}
            </div>
            <form className="mt-3 flex gap-2" onSubmit={e => { e.preventDefault(); if (current && !loading) void run() }}>
              <input value={instruction} onChange={e => setInstruction(e.target.value)} maxLength={300} placeholder={current ? 'Ej.: agregá una pileta en el fondo' : 'Primero elegí una foto'} disabled={!current || loading} aria-label="Tu pedido" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base sm:text-sm disabled:opacity-50" />
              <button type="submit" disabled={!current || loading} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{loading ? 'Generando…' : <><Sparkles size={14} /> Pedir</>}</button>
            </form>
            <p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Función en prueba: usa inteligencia artificial, puede tardar un minuto y tiene un límite diario. Si todavía no está habilitada para tu cuenta, te lo avisamos.</p>
            {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          </>
        )}

        {turns.length > 0 && (
          <section className="mt-6 space-y-6" aria-live="polite" aria-label="Resultados">
            {turns.map(t => (
              <div key={t.id} className="space-y-3">
                <p className="ml-auto w-fit max-w-[90%] rounded-2xl bg-brand-600 px-4 py-2 text-sm text-white"><span className="font-semibold">{t.modeLabel}</span>{t.instruction ? ` · ${t.instruction}` : ''}</p>
                {t.result.transformedImageUrl ? (
                  <figure className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={t.result.transformedImageUrl} alt="Visualización generada" className="w-full" />
                    <figcaption className="absolute left-3 top-3 rounded-full bg-slate-900/85 px-3 py-1 text-[11px] font-semibold text-white">{GENERATED_LABEL}</figcaption>
                  </figure>
                ) : null}
                <p className="text-xs text-slate-500">{noticeFor(t.result.editMethod, t.result.imageNote)}</p>
                {t.result.recommendations.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Qué cambiaría ({t.result.roomType})</h3>
                    <p className="text-xs text-slate-500">{t.result.currentState}</p>
                    <ul className="mt-2 space-y-2">
                      {t.result.recommendations.map(r => (
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
              </div>
            ))}
            <p className="flex items-center gap-1 text-xs text-slate-400"><Send size={12} /> Podés pedir otro cambio arriba, sobre la misma foto o sobre otra.</p>
          </section>
        )}
      </div>
    </div>
  )
}
