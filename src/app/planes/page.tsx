import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { VaraLogo } from '@/components/ui/VaraLogo'
import { PLANS } from '@/lib/pricing/plans'

export const metadata = { title: 'VARA — Planes', description: 'Pagá por lo que necesitás.' }

export default function PlanesPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200/80">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <Link href="/" aria-label="Volver al inicio"><VaraLogo size={26} /></Link>
          <Link href="/onboarding" className="text-sm font-bold text-brand-600 hover:underline">Empezar gratis</Link>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-5 py-14">
        <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-800">Borrador</span>
        <h1 className="mt-4 text-3xl font-black text-balance md:text-4xl">Pagá por lo que necesitás</h1>
        <p className="mt-3 max-w-2xl text-slate-500">
          Entender es gratis. Pagás cuando necesitás ayuda para avanzar. Todavía estamos definiendo precios y límites; esto es lo que vamos a ofrecer.
        </p>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PLANS.map(p => (
            <div key={p.id} className="flex flex-col rounded-2xl border border-slate-200 p-6 shadow-sm">
              <p className="text-lg font-black">{p.name}</p>
              <p className="mt-1 text-sm text-slate-500">{p.tagline}</p>
              <p className="mt-4 text-2xl font-black text-brand-600">{p.priceNote}</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                {p.includes.map(i => (
                  <li key={i} className="flex gap-2"><Check size={15} className="mt-0.5 flex-shrink-0 text-brand-600" aria-hidden="true" /> {i}</li>
                ))}
              </ul>
              <div className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-500">
                <p className="mb-1 font-bold uppercase tracking-wider text-slate-400">Límites</p>
                {p.limits.map(l => (
                  <p key={l.label} className="flex justify-between gap-2"><span>{l.label}</span><span className="font-semibold">{l.value}</span></p>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Link href="/#contacto" className="mt-10 inline-flex items-center gap-2 text-sm font-bold text-brand-600 hover:underline">
          ¿Dudas? Hablá con una persona <ArrowRight size={14} />
        </Link>
      </div>
    </main>
  )
}
