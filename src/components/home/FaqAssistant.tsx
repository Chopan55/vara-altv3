'use client'
import { useState } from 'react'
import Link from 'next/link'
import { FAQS, answer } from '@/lib/faq/faq'

type Msg = { from: 'user' | 'vara'; text: string; contact?: boolean }

export function FaqAssistant() {
  const [msgs, setMsgs] = useState<Msg[]>([
    { from: 'vara', text: 'Hola, soy el asistente de VARA. Preguntame lo que quieras saber o elegí una pregunta.' },
  ])
  const [input, setInput] = useState('')

  const ask = (question: string) => {
    const q = question.trim()
    if (!q) return
    const hit = answer(q)
    setMsgs(m => [
      ...m,
      { from: 'user', text: q },
      hit
        ? { from: 'vara', text: hit.a }
        : { from: 'vara', text: 'Esa no la tengo respondida y prefiero no inventar. Si querés, escribile a una persona del equipo.', contact: true },
    ])
    setInput('')
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="max-h-72 space-y-3 overflow-y-auto pr-1" aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={m.from === 'user' ? 'text-right' : ''}>
            <p className={`inline-block max-w-[90%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${m.from === 'user' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
              {m.text}
            </p>
            {m.contact && (
              <p className="mt-1.5 text-sm"><Link href="/#contacto" className="font-bold text-brand-600 hover:underline">Hablar con una persona</Link></p>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {FAQS.slice(0, 6).map(f => (
          <button key={f.q} type="button" onClick={() => ask(f.q)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-brand-300 hover:text-brand-700">
            {f.q}
          </button>
        ))}
      </div>
      <form onSubmit={e => { e.preventDefault(); ask(input) }} className="mt-4 flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)} maxLength={200} placeholder="Escribí tu pregunta" aria-label="Tu pregunta" className="min-w-0 flex-1 rounded-xl border-2 border-slate-100 px-4 py-2.5 text-sm outline-none focus:border-brand-400" />
        <button type="submit" className="rounded-xl bg-brand-600 px-4 text-sm font-bold text-white hover:bg-brand-700">Preguntar</button>
      </form>
    </div>
  )
}
