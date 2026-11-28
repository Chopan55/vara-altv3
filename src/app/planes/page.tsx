'use client'

import Link from 'next/link'
import { ArrowRight, Check, Sparkles } from 'lucide-react'
import { VaraLogo } from '@/components/ui/VaraLogo'
import { EXTRA_CREDITS, PLANS, RATE_NOTE, formatARS, formatMXN } from '@/lib/pricing/plans'
import { cn } from '@/lib/utils'
import { trackFunnel } from '@/lib/funnel/track'
import { useEffect, useState } from 'react'

export default function PlanesPage() {
  const [country, setCountry] = useState<'AR' | 'MX'>('AR')

  useEffect(() => { trackFunnel('plan_viewed', { country }) }, [country])

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200/80">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <VaraLogo size={26} />
          <Link href="/analizar" className="text-sm font-bold text-brand-600 hover:underline">Probar el análisis gratis</Link>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-5 py-14">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">Beta privada: esta pantalla muestra cómo serían los planes. Todavía no se cobra nada.</div>
        <h1 className="mt-4 text-3xl font-black text-balance md:text-4xl">Planes</h1>
        <p className="mt-3 max-w-2xl text-slate-500">
          Analizar un aviso es gratis y sin cuenta. Esta es una referencia para seguir tu compra o venta; no hay checkout ni pasarela conectada.
        </p>
        <div className="mt-6 flex items-center gap-3 text-sm">
          <label htmlFor="country" className="font-bold">País</label>
          <select id="country" value={country} onChange={e => setCountry(e.target.value as 'AR' | 'MX')} className="rounded-lg border border-slate-300 px-3 py-2">
            <option value="AR">Argentina (ARS)</option>
            <option value="MX">México (MXN)</option>
          </select>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PLANS.map(p => (
            <div key={p.id} className={cn('flex flex-col rounded-2xl border p-6 shadow-sm', p.highlight ? 'border-brand-600 ring-2 ring-brand-600' : 'border-slate-200')}>
              {p.highlight && <span className="mb-2 self-start rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700">Recomendado para comprar o vender</span>}
              <p className="text-lg font-black">{p.name}</p>
              <p className="mt-1 text-sm text-slate-500">{p.tagline}</p>
              <p className="mt-4">
                <span className="text-3xl font-black">{country === 'AR' ? formatARS(p.priceARS) : formatMXN(p.priceMXN)}</span>
                <span className="text-sm text-slate-500"> / mes</span>
              </p>
              <p className="text-sm text-slate-500">{country === 'AR' ? `México: ${formatMXN(p.priceMXN)} / mes` : `Referencia AR: ${formatARS(p.priceARS)} / mes`}</p>
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">{p.aiCredits} créditos de IA por mes</p>
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
              <button type="button" onClick={() => trackFunnel('plan_selected_simulation', { plan: p.id, country })} className="mt-6 rounded-lg border border-brand-600 px-4 py-2 text-sm font-bold text-brand-700 hover:bg-brand-50">Me interesa (simulación)</button>
            </div>
          ))}
        </div>
        <div className="mt-6 space-y-2 text-xs text-slate-500">
          <p>{country === 'MX' ? RATE_NOTE : 'Precios de referencia en pesos argentinos.'} Paquete extra: {EXTRA_CREDITS.credits} créditos por {formatARS(EXTRA_CREDITS.priceARS)} (aprox. {formatMXN(EXTRA_CREDITS.priceMXN)}).</p>
          <p>{country === 'MX' ? 'Los créditos son acciones de IA: una consulta, leer un documento o imaginar un ambiente. No es uso ilimitado y no incluye VARA Visit, que se contrata aparte.' : 'Los créditos son acciones de IA —una consulta, leer un documento o imaginar un ambiente—. No es uso ilimitado y no incluye VARA Visit, que se contrata aparte.'}</p>
          <p>{country === 'MX' ? 'Los precios y resultados son una simulación sin garantías; confirma los datos importantes con tu notario.' : 'Los precios y resultados son una simulación sin garantías; confirmá los datos importantes con tu escribano.'}</p>
        </div>
        <Link href="/#contacto" className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-brand-600 hover:underline">
          ¿Dudas sobre qué plan te sirve? Hablá con una persona <ArrowRight size={14} />
        </Link>
      </div>
    </main>
  )
}
