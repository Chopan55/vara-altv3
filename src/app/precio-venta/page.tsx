'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { loadOperations, type StoredOperation } from '@/lib/userOperations'
import { planPricing, readListing } from '@/lib/sellPricing'

const KEY = 'vara_sellprice_'
const usd = (n: number) => `USD ${n.toLocaleString('es-AR')}`
const digits = (v: string) => v.replace(/[^\d]/g, '')
const field = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base sm:text-sm text-slate-800'

interface Saved { surface: string; desired: string; days: string; inquiries: string; visits: string; offers: string }
const EMPTY: Saved = { surface: '', desired: '', days: '', inquiries: '', visits: '', offers: '' }

export default function PrecioVentaPage() {
  const [op, setOp] = useState<StoredOperation | null>(null)
  const [f, setF] = useState<Saved>(EMPTY)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    loadOperations().then(ops => {
      const sell = ops.find(o => o.type === 'SELL') ?? null
      setOp(sell)
      if (sell) { try { setF({ ...EMPTY, ...(JSON.parse(localStorage.getItem(KEY + sell.id) ?? '{}') as Partial<Saved>) }) } catch {} }
      setLoaded(true)
    })
  }, [])

  const set = (k: keyof Saved, v: string) => {
    const next = { ...f, [k]: digits(v) }
    setF(next)
    if (op) { try { localStorage.setItem(KEY + op.id, JSON.stringify(next)) } catch {} }
  }

  const plan = op ? planPricing(Number(f.surface), op.province, Number(f.desired) || undefined) : null
  const monitoring = f.days ? readListing({ daysListed: Number(f.days), inquiries: Number(f.inquiries) || 0, visits: Number(f.visits) || 0, offers: Number(f.offers) || 0 }) : null
  const toneCls = { wait: 'bg-slate-50 text-slate-700', ok: 'bg-emerald-50 text-emerald-800', review: 'bg-amber-50 text-amber-800' }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-3xl mx-auto px-4 lg:px-6 py-6">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm mb-4"><ArrowLeft size={14} /> Volver al inicio</Link>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Precio de venta</h1>
        <p className="text-sm text-slate-500 mt-1">Un punto de partida para decidir el precio de publicación y cuándo revisarlo.</p>

        {loaded && !op && (
          <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-6">
            <p className="text-sm text-slate-700">Primero necesitás una venta en VARA para saber en qué provincia estás.</p>
            <Link href="/empezar?nuevo=1" className="mt-4 inline-block rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Empezar una venta</Link>
          </div>
        )}

        {op && (
          <>
            <section className="mt-6 grid gap-4 rounded-2xl border border-slate-100 bg-white p-5 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">Superficie cubierta (m²)<input className={field} inputMode="numeric" value={f.surface} onChange={e => set('surface', e.target.value)} /></label>
              <label className="text-sm font-medium text-slate-700">Precio que te gustaría (USD, opcional)<input className={field} inputMode="numeric" value={f.desired} onChange={e => set('desired', e.target.value)} /></label>
            </section>

            {plan && (
              <section className="mt-5 rounded-2xl border border-slate-100 bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Precio de publicación sugerido</p>
                <p className="mt-1 text-3xl font-extrabold text-slate-900">{usd(plan.start)}</p>
                <p className="mt-3 text-sm text-slate-700"><span className="font-semibold">Rango de referencia:</span> {usd(plan.range.min)} – {usd(plan.range.max)}</p>
                <p className="mt-1 text-xs text-slate-500">Basado en USD {plan.reference.min}–{plan.reference.max} por m² para {plan.reference.label} (referencia histórica de portales). No son propiedades comparables reales ni precios de cierre: el precio al que se firma suele ser distinto del publicado.</p>
                {plan.desired && (
                  <p className={`mt-3 rounded-xl p-3 text-sm ${plan.desired.position === 'IN' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                    {plan.desired.position === 'IN' && `Tu precio (${usd(plan.desired.price)}) está dentro del rango.`}
                    {plan.desired.position === 'ABOVE' && `Tu precio (${usd(plan.desired.price)}) está por encima del rango. Podés probarlo, pero esperá menos consultas y definí de antemano cuándo lo revisás.`}
                    {plan.desired.position === 'BELOW' && `Tu precio (${usd(plan.desired.price)}) está por debajo del rango. Revisá si dejás plata sobre la mesa.`}
                  </p>
                )}
                <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                  <p className="font-semibold">Estrategia sugerida</p>
                  <p className="mt-1">Publicá a {usd(plan.start)} y dale 3 semanas. Si hay poco interés, revisá la presentación y, si hace falta, bajá a {usd(plan.fallback)} (5% menos).</p>
                </div>
              </section>
            )}

            <section className="mt-6">
              <h2 className="text-sm font-bold text-slate-900">Seguimiento de tu publicación</h2>
              <p className="mt-1 text-xs text-slate-500">Cargá los números a mano: por ahora VARA no se conecta a los portales para leerlos.</p>
              <div className="mt-3 grid gap-4 rounded-2xl border border-slate-100 bg-white p-5 sm:grid-cols-4">
                <label className="text-sm font-medium text-slate-700">Días publicada<input className={field} inputMode="numeric" value={f.days} onChange={e => set('days', e.target.value)} /></label>
                <label className="text-sm font-medium text-slate-700">Consultas<input className={field} inputMode="numeric" value={f.inquiries} onChange={e => set('inquiries', e.target.value)} /></label>
                <label className="text-sm font-medium text-slate-700">Visitas<input className={field} inputMode="numeric" value={f.visits} onChange={e => set('visits', e.target.value)} /></label>
                <label className="text-sm font-medium text-slate-700">Ofertas<input className={field} inputMode="numeric" value={f.offers} onChange={e => set('offers', e.target.value)} /></label>
              </div>
              {monitoring && <p role="status" className={`mt-3 rounded-xl p-3 text-sm ${toneCls[monitoring.tone]}`}>{monitoring.text}</p>}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
