import Link from 'next/link'
import { ArrowRight, Check, Sparkles } from 'lucide-react'
import { VaraLogo } from '@/components/ui/VaraLogo'
import { PLANS, RATE_NOTE, formatARS, formatMXN } from '@/lib/pricing/plans'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Planes', description: 'Analizar un aviso es gratis. Planes mensuales para seguir tu operación hasta la escritura.' }

export default function PlanesPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200/80">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <VaraLogo size={26} />
          <Link href="/analizar" className="text-sm font-bold text-brand-600 hover:underline">Probar el análisis gratis</Link>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-5 py-14">
        <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-800">Beta privada</span>
        <h1 className="mt-4 text-3xl font-black text-balance md:text-4xl">Planes</h1>
        <p className="mt-3 max-w-2xl text-slate-500">
          Analizar un aviso es gratis y sin cuenta. Para seguir tu compra o venta hasta la escritura, elegís un plan mensual.
          Sin comisión: pagás el plan, no un porcentaje de la propiedad. Durante la beta privada no se cobra.
        </p>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PLANS.map(p => (
            <div key={p.id} className={cn('flex flex-col rounded-2xl border p-6 shadow-sm', p.highlight ? 'border-brand-600 ring-2 ring-brand-600' : 'border-slate-200')}>
              {p.highlight && <span className="mb-2 self-start rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700">Recomendado para comprar o vender</span>}
              <p className="text-lg font-black">{p.name}</p>
              <p className="mt-1 text-sm text-slate-500">{p.tagline}</p>
              <p className="mt-4">
                <span className="text-3xl font-black">{formatARS(p.priceARS)}</span>
                <span className="text-sm text-slate-500"> / mes</span>
              </p>
              <p className="text-sm text-slate-500">México: {formatMXN(p.priceMXN)} / mes</p>
              <ul className="mt-5 space-y-2 text-sm text-slate-600">
                {p.includes.map(i => (
                  <li key={i} className="flex gap-2"><Check size={15} className="mt-0.5 flex-shrink-0 text-brand-600" aria-hidden="true" /> {i}</li>
                ))}
                {p.beta?.map(i => (
                  <li key={i} className="flex gap-2">
                    <Sparkles size={15} className="mt-0.5 flex-shrink-0 text-brand-600" aria-hidden="true" />
                    <span>{i} <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">Beta · por invitación</span></span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs text-slate-500">Precios finales en pesos argentinos. {RATE_NOTE} VARA Visit se contrata aparte, por visita: ves el precio antes de confirmar.</p>
        <Link href="/#contacto" className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-brand-600 hover:underline">
          ¿Dudas sobre qué plan te sirve? Hablá con una persona <ArrowRight size={14} />
        </Link>
      </div>
    </main>
  )
}
