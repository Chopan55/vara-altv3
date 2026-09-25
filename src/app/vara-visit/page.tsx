'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Home, User, Shield, Check, ArrowRight, Loader2,
  KeyRound, FileText, MapPin, Clock,
} from 'lucide-react'
import {
  SERVICE_LABELS, SERVICE_DESCRIPTIONS, PRICE_BANDS, TIER_CRITERIA,
  CANCELLATION_POLICY,
  type VisitServiceType, type PartnerPublicProfile,
} from '@/types/varaVisit'
import { listActivePartners } from '@/lib/supabase/visits'
import { PartnerCard } from '@/components/visit/PartnerCard'
import { useVaraState } from '@/hooks/useVaraState'

/**
 * VARA Visit — la capa humana del producto.
 *
 * La promesa no es "te conseguimos a alguien". Es "podés confiar en la persona
 * que VARA está enviando a esa propiedad". Toda la página está ordenada por esa
 * frase: primero qué garantiza VARA, después el precio, y recién al final
 * quién está disponible.
 *
 * Lo que esta pantalla NO hace: mostrar partners que no existen. Si la red está
 * vacía, lo dice. Esa fue la falla P0-1 de la versión anterior, donde tres
 * personas inventadas aparecían con "✓ Verificado" y 4.9 estrellas.
 */

const GUARANTEES = [
  {
    icon: Shield,
    title: 'Identidad verificada, no declarada',
    body: 'DNI, selfie y teléfono verificados por VARA antes de la primera visita. Al partner lo aprobamos nosotros; no alcanza con que suba documentos.',
  },
  {
    icon: KeyRound,
    title: 'La visita no empieza sin tu PIN',
    body: 'Cuando el partner llega, te pide un PIN de 4 números que solo vos tenés. Si no se lo das, la visita no arranca. Queda registrado quién entró y a qué hora.',
  },
  {
    icon: FileText,
    title: 'Un reporte con hechos',
    body: 'Cuántas personas fueron, qué preguntaron textualmente, qué se observó. Sin interpretaciones: los hechos los usa VARA para tu operación.',
  },
]

export default function VaraVisitPage() {
  const vara = useVaraState()
  const isSeller = vara.loaded && vara.journeyType === 'SELL_PROPERTY'

  const [partners, setPartners] = useState<PartnerPublicProfile[] | null>(null)

  useEffect(() => { void listActivePartners().then(setPartners) }, [])

  const suggested: VisitServiceType = isSeller ? 'SHOW_PROPERTY' : 'ACCOMPANY_VISIT'
  const other: VisitServiceType = suggested === 'SHOW_PROPERTY' ? 'ACCOMPANY_VISIT' : 'SHOW_PROPERTY'

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-3xl mx-auto px-4 lg:px-6 py-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-700">
          Servicio adicional
        </p>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1.5">
          VARA Visit
        </h1>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed max-w-xl">
          Cuando hace falta que alguien esté presente, VARA manda a una persona verificada.
          {isSeller
            ? ' Muestra tu propiedad a los interesados y te deja un reporte.'
            : ' Te acompaña a conocer una propiedad y sigue un checklist.'}
        </p>

        {/* Las dos entradas al servicio, la sugerida primero según el journey. */}
        <div className="grid sm:grid-cols-2 gap-3 mt-6">
          {[suggested, other].map((st, i) => (
            <Link
              key={st}
              href={`/vara-visit/solicitar?servicio=${st}`}
              className={
                i === 0
                  ? 'rounded-2xl bg-brand-600 hover:bg-brand-700 p-5 text-white transition-colors'
                  : 'rounded-2xl bg-white border border-slate-200/70 hover:border-slate-300 p-5 transition-colors'
              }
            >
              {st === 'SHOW_PROPERTY'
                ? <Home size={18} className={i === 0 ? 'text-white' : 'text-brand-600'} aria-hidden="true" />
                : <User size={18} className={i === 0 ? 'text-white' : 'text-brand-600'} aria-hidden="true" />}
              <p className={`font-bold mt-2.5 ${i === 0 ? 'text-white' : 'text-slate-900'}`}>
                {SERVICE_LABELS[st]}
              </p>
              <p className={`text-xs mt-1 leading-relaxed ${i === 0 ? 'text-brand-100' : 'text-slate-500'}`}>
                {SERVICE_DESCRIPTIONS[st]}
              </p>
              <span className={`inline-flex items-center gap-1 text-xs font-semibold mt-3 ${i === 0 ? 'text-white' : 'text-brand-700'}`}>
                Pedir una visita <ArrowRight size={13} aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>

        {/* Qué garantiza VARA. Va antes del precio a propósito. */}
        <section className="mt-8">
          <h2 className="text-sm font-bold text-slate-900">
            Qué hace que puedas confiar en quien llega
          </h2>
          <div className="mt-3 space-y-2.5">
            {GUARANTEES.map(g => {
              const Icon = g.icon
              return (
                <div key={g.title} className="flex gap-3 rounded-2xl bg-white border border-slate-200/70 p-4">
                  <div className="w-8 h-8 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                    <Icon size={15} className="text-brand-600" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{g.title}</p>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{g.body}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Precio: bandas reales del motor de precios, no números sueltos. */}
        <section className="mt-8">
          <h2 className="text-sm font-bold text-slate-900">Precio</h2>
          <p className="text-xs text-slate-500 mt-1">
            El partner elige su precio dentro de la banda que define VARA. Lo ves completo
            antes de contratar.
          </p>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {PRICE_BANDS.map(b => (
              <div key={b.durationMinutes} className="rounded-2xl bg-white border border-slate-200/70 p-4 text-center">
                <p className="flex items-center justify-center gap-1 text-xs font-semibold text-slate-500">
                  <Clock size={11} aria-hidden="true" />{b.durationMinutes} min
                </p>
                <p className="text-base font-extrabold text-slate-900 mt-1.5 tabular-nums">
                  {b.currency} {b.minPrice}–{b.maxPrice}
                </p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-2.5">{CANCELLATION_POLICY.text}</p>
          <p className="text-[11px] text-slate-400 mt-1">
            El cobro lo coordina VARA a mano. Todavía no cobramos desde la plataforma.
          </p>
        </section>

        {/* Niveles con criterios publicados. Nada de scores opacos. */}
        <section className="mt-8">
          <h2 className="text-sm font-bold text-slate-900">Niveles de Visit Partner</h2>
          <p className="text-xs text-slate-500 mt-1">
            Cada nivel tiene condiciones verificables. No hay un puntaje secreto.
          </p>
          <div className="mt-3 rounded-2xl bg-white border border-slate-200/70 divide-y divide-slate-100">
            {TIER_CRITERIA.map(t => (
              <div key={t.tier} className="p-4">
                <p className="text-sm font-bold text-slate-900">{t.label}</p>
                <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                  {t.requirements.map(r => (
                    <li key={r} className="flex items-center gap-1 text-[11px] text-slate-600">
                      <Check size={10} className="text-emerald-600" aria-hidden="true" />{r}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* La red real. Vacía es un resultado válido y se dice. */}
        <section className="mt-8">
          <h2 className="text-sm font-bold text-slate-900">Visit Partners disponibles</h2>

          {partners === null && (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center">
              <Loader2 size={15} className="animate-spin" aria-hidden="true" /> Cargando…
            </div>
          )}

          {partners !== null && partners.length === 0 && (
            <div className="mt-3 rounded-2xl bg-white border border-slate-200/70 p-5">
              <p className="text-sm text-slate-700 leading-relaxed">
                Todavía no hay Visit Partners activos. Estamos armando la red y preferimos
                decírtelo antes de que reserves, no después.
              </p>
              <p className="text-xs text-slate-500 mt-2.5">
                Podés pedir una visita igual: te anotamos en la lista de espera de tu zona
                y te avisamos cuando haya cobertura.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <Link href="/vara-visit/solicitar"
                  className="flex-1 rounded-xl bg-brand-600 hover:bg-brand-700 px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors">
                  Pedir cobertura en mi zona
                </Link>
                <Link href="/partner"
                  className="flex-1 rounded-xl bg-white border border-slate-200 hover:border-slate-300 px-4 py-2.5 text-center text-sm font-semibold text-slate-700 transition-colors">
                  Quiero ser Visit Partner
                </Link>
              </div>
            </div>
          )}

          {partners !== null && partners.length > 0 && (
            <div className="mt-3 space-y-2.5">
              {partners.map(p => <PartnerCard key={p.id} partner={p} />)}
              <p className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1">
                <MapPin size={11} aria-hidden="true" />
                La disponibilidad depende de la zona y la fecha. La ves al pedir la visita.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
