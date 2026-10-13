'use client'
import { useState } from 'react'
import { EMPTY_MANUAL, buildManualData, canSubmitManual, missingManual, type ManualForm } from '@/lib/manualProperty'

const input = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base sm:text-sm text-slate-800'

/** Formulario corto para sumar una propiedad sin link. Todo es opcional salvo un dato mínimo. */
export function ManualPropertyForm({ onSubmit }: { onSubmit: (form: ManualForm) => void }) {
  const [f, setF] = useState<ManualForm>(EMPTY_MANUAL)
  const set = <K extends keyof ManualForm>(k: K, v: ManualForm[K]) => setF(prev => ({ ...prev, [k]: v }))
  const data = buildManualData(f)
  const missing = missingManual(data)

  return (
    <form className="space-y-3 p-5" onSubmit={e => { e.preventDefault(); if (canSubmitManual(data)) onSubmit(f) }}>
      <p className="text-xs text-slate-500">Cargá lo que sepas. Después podés completar el resto: VARA te dice qué falta para comparar bien.</p>
      <label className="block text-xs font-semibold text-slate-600">Título (opcional)<input className={input} value={f.title} maxLength={80} onChange={e => set('title', e.target.value)} placeholder="Casa en Estancias del Pilar" /></label>
      <div className="grid grid-cols-3 gap-2">
        <label className="col-span-2 block text-xs font-semibold text-slate-600">Precio<input className={input} inputMode="numeric" value={f.price} onChange={e => set('price', e.target.value.replace(/\D/g, ''))} /></label>
        <label className="block text-xs font-semibold text-slate-600">Moneda
          <select className={input} value={f.currency} onChange={e => set('currency', e.target.value as ManualForm['currency'])}><option>USD</option><option>ARS</option></select>
        </label>
      </div>
      <label className="block text-xs font-semibold text-slate-600">Dirección<input className={input} value={f.address} onChange={e => set('address', e.target.value)} /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs font-semibold text-slate-600">Barrio<input className={input} value={f.neighborhood} onChange={e => set('neighborhood', e.target.value)} /></label>
        <label className="block text-xs font-semibold text-slate-600">Ciudad<input className={input} value={f.city} onChange={e => set('city', e.target.value)} /></label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs font-semibold text-slate-600">Superficie (m²)<input className={input} inputMode="numeric" value={f.totalM2} onChange={e => set('totalM2', e.target.value.replace(/\D/g, ''))} /></label>
        <label className="block text-xs font-semibold text-slate-600">Ambientes<input className={input} inputMode="numeric" value={f.rooms} onChange={e => set('rooms', e.target.value.replace(/\D/g, ''))} /></label>
        <label className="block text-xs font-semibold text-slate-600">Dormitorios<input className={input} inputMode="numeric" value={f.bedrooms} onChange={e => set('bedrooms', e.target.value.replace(/\D/g, ''))} /></label>
        <label className="block text-xs font-semibold text-slate-600">Baños<input className={input} inputMode="numeric" value={f.bathrooms} onChange={e => set('bathrooms', e.target.value.replace(/\D/g, ''))} /></label>
      </div>
      {canSubmitManual(data) && missing.length > 0 && <p className="text-[11px] text-amber-700">Todavía falta: {missing.join(', ')}. Podés sumarla igual y completarlo después.</p>}
      <button type="submit" disabled={!canSubmitManual(data)} className="w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white disabled:opacity-40">Sumar propiedad</button>
    </form>
  )
}
