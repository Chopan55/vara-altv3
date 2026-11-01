'use client'
import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft, CheckCircle2, AlertCircle, CircleDashed } from 'lucide-react'
import type { ScrapeResult } from '@/app/api/scrape-property/route'
import { reviewListing, type ReviewStatus } from '@/lib/listingReview'

const ICON: Record<ReviewStatus, React.ReactNode> = {
  ok: <CheckCircle2 size={18} className="shrink-0 text-emerald-600" aria-label="Bien" />,
  weak: <AlertCircle size={18} className="shrink-0 text-amber-500" aria-label="A reforzar" />,
  missing: <CircleDashed size={18} className="shrink-0 text-slate-300" aria-label="Falta" />,
}

export default function RevisarPublicacionPage() {
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsPaste, setNeedsPaste] = useState(false)
  const [result, setResult] = useState<ScrapeResult | null>(null)

  const run = async () => {
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await fetch('/api/scrape-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), text: text.trim() || undefined }),
      })
      const data = (await res.json().catch(() => ({}))) as ScrapeResult & { error?: string }
      if (!res.ok) { setError(data.error ?? 'No pudimos leer el aviso. Probá de nuevo.'); return }
      if (data.status === 'blocked' || data.status === 'error' || (data.status === 'expired' && !data.data?.price)) {
        setNeedsPaste(true)
        setError(data.errorMessage ?? 'El portal no nos dejó leer el aviso. Pegá el texto del aviso acá abajo y lo revisamos igual.')
        return
      }
      setResult(data)
    } catch {
      setError('No pudimos leer el aviso. Probá de nuevo en un rato.')
    } finally { setLoading(false) }
  }

  const review = result ? reviewListing({ data: result.data, photoCount: result.photos.length }) : null
  const canRun = !loading && (url.trim().length > 8 || text.trim().length > 40)

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-3xl mx-auto px-4 lg:px-6 py-6">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm mb-4"><ArrowLeft size={14} /> Volver al inicio</Link>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Revisar mi publicación</h1>
        <p className="text-sm text-slate-500 mt-1">Pegá el link de tu aviso y te mostramos qué tiene, qué le falta y qué conviene reforzar para recibir más consultas.</p>

        <section className="mt-6 rounded-2xl border border-slate-100 bg-white p-5">
          <label className="text-sm font-medium text-slate-700">Link del aviso
            <input value={url} onChange={e => setUrl(e.target.value)} inputMode="url" placeholder="https://www.zonaprop.com.ar/…" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-sm" />
          </label>
          {needsPaste && (
            <label className="mt-4 block text-sm font-medium text-slate-700">Texto del aviso
              <textarea value={text} onChange={e => setText(e.target.value)} rows={6} placeholder="Copiá y pegá el contenido del aviso (título, precio, descripción…)" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-sm" />
            </label>
          )}
          <button type="button" onClick={run} disabled={!canRun} className="mt-4 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{loading ? 'Leyendo el aviso…' : 'Revisar'}</button>
          {error && <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{error}</p>}
        </section>

        {review && result && (
          <section className="mt-6" aria-live="polite">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-bold text-slate-900">{result.data.title || 'Tu aviso'}</h2>
              <span className="text-sm text-slate-500">Completitud: <span className="font-bold text-slate-900">{review.score}%</span></span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand-600" style={{ width: `${review.score}%` }} /></div>
            <ul className="mt-4 space-y-2">
              {review.items.map(i => (
                <li key={i.id} className="flex gap-3 rounded-xl border border-slate-100 bg-white p-3">
                  {ICON[i.status]}
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{i.label}</p>
                    <p className="text-xs text-slate-500">{i.tip}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-400">Leemos solo lo que el aviso muestra. Si el portal oculta algo, puede figurar como faltante. Es una guía, no una tasación.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/precio-venta" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Revisar el precio</Link>
              <Link href="/publicar" className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Mejorar en Mi propiedad</Link>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
