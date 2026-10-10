'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { CRITERIA, EMPTY_PROFILE, IMPORTANCE, loadProfile, saveProfile, summarize, type BuyerProfile, type Importance } from '@/lib/buyerProfile'

const field = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800'
const digits = (v: string) => v.replace(/[^\d]/g, '')

export default function MiBusquedaPage() {
  const [p, setP] = useState<BuyerProfile>(EMPTY_PROFILE)
  const [saved, setSaved] = useState(false)
  useEffect(() => { setP(loadProfile()) }, [])

  const set = <K extends keyof BuyerProfile>(k: K, v: BuyerProfile[K]) => { setP(prev => ({ ...prev, [k]: v })); setSaved(false) }
  const setImp = (id: string, v: Importance) => set('importance', { ...p.importance, [id]: p.importance[id] === v ? undefined : v })
  const summary = summarize(p)

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-3xl mx-auto px-4 lg:px-6 py-6">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm mb-4"><ArrowLeft size={14} /> Volver al inicio</Link>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Mi búsqueda</h1>
        <p className="text-sm text-slate-500 mt-1">Contanos qué buscás y qué pesa más para vos. No existe la mejor propiedad: existe la mejor para vos. Completá solo lo que sepas.</p>

        <section className="mt-6 grid gap-4 rounded-2xl border border-slate-100 bg-white p-5 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">Tipo de propiedad<input className={field} value={p.type} onChange={e => set('type', e.target.value)} placeholder="Casa, departamento…" /></label>
          <label className="text-sm font-medium text-slate-700">Zona o barrios<input className={field} value={p.zone} onChange={e => set('zone', e.target.value)} placeholder="Pilar, Palermo…" /></label>
          <label className="text-sm font-medium text-slate-700">Presupuesto máximo
            <span className="mt-1 flex gap-2">
              <select className="rounded-xl border border-slate-200 bg-white px-2 text-sm" value={p.currency} onChange={e => set('currency', e.target.value as BuyerProfile['currency'])}><option>USD</option><option>ARS</option><option>MXN</option></select>
              <input className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" inputMode="numeric" value={p.budget} onChange={e => set('budget', digits(e.target.value))} />
            </span>
          </label>
          <label className="text-sm font-medium text-slate-700">Cómo pensás pagar
            <select className={field} value={p.financing} onChange={e => set('financing', e.target.value as BuyerProfile['financing'])}>
              <option value="UNKNOWN">Todavía no sé</option><option value="NONE">Con fondos propios</option><option value="MORTGAGE">Con crédito hipotecario</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">Dormitorios (mínimo)<input className={field} inputMode="numeric" value={p.bedrooms} onChange={e => set('bedrooms', digits(e.target.value))} /></label>
          <label className="text-sm font-medium text-slate-700">Superficie mínima (m²)<input className={field} inputMode="numeric" value={p.surface} onChange={e => set('surface', digits(e.target.value))} /></label>
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-bold text-slate-900">¿Qué tan importante es cada cosa?</h2>
          <ul className="mt-3 space-y-3">
            {CRITERIA.map(c => (
              <li key={c.id} className="rounded-2xl border border-slate-100 bg-white p-4">
                <p className="text-sm font-semibold text-slate-800">{c.label}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {IMPORTANCE.map(i => (
                    <button key={i.id} type="button" onClick={() => setImp(c.id, i.id)} aria-pressed={p.importance[c.id] === i.id}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${p.importance[c.id] === i.id ? (i.id === 'DEALBREAKER' ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-brand-500 bg-brand-50 text-brand-700') : 'border-slate-200 text-slate-600'}`}>{i.label}</button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {summary.length > 0 && (
          <p className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700"><span className="font-semibold">Tu búsqueda:</span> {summary.join(' · ')}.</p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => { saveProfile(p); setSaved(true) }} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Guardar</button>
          <Link href="/comparar" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Ir a comparar</Link>
          {saved && <span role="status" className="text-sm text-emerald-700">Guardado en este dispositivo.</span>}
        </div>
        <p className="mt-4 text-xs text-slate-400">Por ahora tu perfil queda guardado en este navegador y no busca propiedades por su cuenta.</p>
      </div>
    </div>
  )
}
