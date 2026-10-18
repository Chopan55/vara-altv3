'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle2, Circle } from 'lucide-react'
import { useSellOperation } from '@/hooks/useSellOperation'
import { readHave, sellDocumentsFromTxn, sellReadiness, toggleHave } from '@/lib/sellPrep'

export default function PrepararVentaPage() {
  const { op, loaded, getTransactionData } = useSellOperation()
  const [have, setHave] = useState<string[]>([])
  useEffect(() => { if (op) setHave(readHave(op.id)) }, [op?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const txn = op ? getTransactionData(op.id) : null
  const docs = txn ? sellDocumentsFromTxn(txn, have) : []
  const r = sellReadiness(docs)
  const byCategory = docs.reduce<Record<string, typeof docs>>((acc, d) => { (acc[d.category] ??= []).push(d); return acc }, {})

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-3xl mx-auto px-4 lg:px-6 py-6">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm mb-4"><ArrowLeft size={14} /> Volver al inicio</Link>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Preparar la venta</h1>
        <p className="text-sm text-slate-500 mt-1">Juntar los papeles antes de publicar evita frenar una oferta cuando ya apareció el comprador.</p>

        {loaded && !op && (
          <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-6">
            <p className="text-sm text-slate-700">Todavía no tenés una venta en VARA. Creala y te armo la lista de papeles según tu provincia.</p>
            <Link href="/empezar?nuevo=1" className="mt-4 inline-block rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Empezar una venta</Link>
          </div>
        )}

        {op && (
          <>
            <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-5">
              <div className="flex items-baseline justify-between"><span className="text-sm font-semibold text-slate-800">{op.province}</span><span className="text-sm text-slate-500">{r.have} de {r.total} papeles</span></div>
              <div className="mt-3 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand-600" style={{ width: `${r.percent}%` }} /></div>
              <p className="mt-3 text-xs text-slate-500">La lista sale de los pasos de una venta en tu provincia. Confirmá con tu escribano qué te piden en tu caso: puede variar.</p>
            </div>

            {Object.entries(byCategory).map(([cat, items]) => (
              <section key={cat} className="mt-5">
                <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">{cat.toLowerCase()}</h2>
                <ul className="space-y-2">
                  {items.map(d => (
                    <li key={d.name}>
                      <button type="button" onClick={() => setHave(toggleHave(op.id, d.name))} className="flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 text-left hover:border-brand-300">
                        {d.have ? <CheckCircle2 size={18} className="text-emerald-600 shrink-0" /> : <Circle size={18} className="text-slate-300 shrink-0" />}
                        <span className={`text-sm ${d.have ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{d.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/publicar" className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Seguir con la publicación</Link>
              <Link href={`/operacion/${op.id}`} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Ver mi operación</Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
