'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { useSellOperation } from '@/hooks/useSellOperation'
import { LEAD_SOURCES, LEAD_STATUSES, addLead, leadCounts, loadLeads, removeLead, setLeadStatus, type Lead, type LeadStatus } from '@/lib/sellerLeads'

const field = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base sm:text-sm text-slate-800'

export default function InteresadosPage() {
  const { op, loaded } = useSellOperation()
  const [leads, setLeads] = useState<Lead[]>([])
  const [name, setName] = useState('')
  const [source, setSource] = useState<string>(LEAD_SOURCES[0])
  const [note, setNote] = useState('')

  useEffect(() => { if (op) setLeads(loadLeads(op.id)) }, [op?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const counts = leadCounts(leads)

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-3xl mx-auto px-4 lg:px-6 py-6">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm mb-4"><ArrowLeft size={14} /> Volver al inicio</Link>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Interesados</h1>
        <p className="text-sm text-slate-500 mt-1">Anotá quién consultó, de dónde vino y en qué etapa está. Solo lo necesario, sin planillas.</p>

        {loaded && !op && (
          <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-6">
            <p className="text-sm text-slate-700">Primero necesitás una venta en VARA.</p>
            <Link href="/empezar?nuevo=1" className="mt-4 inline-block rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Empezar una venta</Link>
          </div>
        )}

        {op && (
          <>
            <p className="mt-5 text-sm text-slate-700">
              <span className="font-semibold">{counts.inquiries}</span> {counts.inquiries === 1 ? 'consulta' : 'consultas'} · <span className="font-semibold">{counts.visits}</span> {counts.visits === 1 ? 'visita' : 'visitas'} · <span className="font-semibold">{counts.offers}</span> {counts.offers === 1 ? 'oferta' : 'ofertas'}
            </p>
            <p className="mt-1 text-xs text-slate-500">Estos números te sirven para cargar el <Link href="/precio-venta" className="underline">seguimiento de tu publicación</Link>.</p>

            <form className="mt-5 grid gap-4 rounded-2xl border border-slate-100 bg-white p-5 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); setLeads(addLead(op.id, { name, source, note })); setName(''); setNote('') }}>
              <label className="text-sm font-medium text-slate-700">Nombre<input className={field} value={name} maxLength={80} onChange={e => setName(e.target.value)} /></label>
              <label className="text-sm font-medium text-slate-700">Cómo llegó
                <select className={field} value={source} onChange={e => setSource(e.target.value)}>{LEAD_SOURCES.map(s => <option key={s}>{s}</option>)}</select>
              </label>
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">Nota (opcional)<input className={field} value={note} maxLength={300} onChange={e => setNote(e.target.value)} placeholder="Qué preguntó, qué le interesa…" /></label>
              <button type="submit" disabled={!name.trim()} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 sm:col-span-2 sm:w-fit">Agregar</button>
            </form>

            {leads.length === 0 ? (
              <p className="mt-6 text-sm text-slate-500">Todavía no anotaste a nadie.</p>
            ) : (
              <ul className="mt-6 space-y-3">
                {leads.map(l => (
                  <li key={l.id} className={`rounded-2xl border border-slate-100 bg-white p-4 ${l.status === 'DISCARDED' ? 'opacity-60' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{l.name} <span className="font-normal text-slate-400">· {l.source}</span></p>
                        {l.note && <p className="mt-1 text-xs text-slate-500">{l.note}</p>}
                      </div>
                      <button type="button" aria-label={`Quitar a ${l.name}`} onClick={() => setLeads(removeLead(op.id, l.id))} className="text-slate-300 hover:text-rose-500"><Trash2 size={14} /></button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {LEAD_STATUSES.map(s => (
                        <button key={s.id} type="button" aria-pressed={l.status === s.id} onClick={() => setLeads(setLeadStatus(op.id, l.id, s.id as LeadStatus))}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${l.status === s.id ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600'}`}>{s.label}</button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-6 text-xs text-slate-400">Lo que anotás queda guardado en este navegador. Usalo con respeto: son datos de personas.</p>
          </>
        )}
      </div>
    </div>
  )
}
