'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Home, User, Shield, Check, ArrowRight, Loader2,
  KeyRound, FileText, MapPin, Clock, ChevronDown,
} from 'lucide-react'
import {
  SERVICE_LABELS, SERVICE_DESCRIPTIONS, PRICE_BANDS, TIER_CRITERIA,
  CANCELLATION_POLICY,
  type VisitServiceType, type PartnerPublicProfile,
} from '@/types/varaVisit'
import { listActivePartners, requestCoverage, hasSession } from '@/lib/supabase/visits'
import { loadKnownLocation } from '@/lib/knownLocation'
import { accountUrl } from '@/lib/auth/entryJourney'
import { PartnerCard } from '@/components/visit/PartnerCard'
import { useVaraState } from '@/hooks/useVaraState'
import { useOperations } from '@/hooks/useOperations'
import { cn } from '@/lib/utils'

/**
 * VARA Visit — la capa humana del producto.
 *
 * La promesa no es "te conseguimos a alguien". Es "podés confiar en la persona
 * que VARA está enviando a esa propiedad". Orden de la página: qué podés pedir,
 * si hoy hay cobertura, cómo funciona, qué garantiza VARA y el precio. El
 * detalle (protocolo, reporte, niveles) queda plegado.
 *
 * Lo que esta pantalla NO hace: mostrar partners que no existen. Si la red está
 * vacía, lo dice arriba de todo, antes de que alguien empiece a pedir una visita.
 */

const HOW: Record<VisitServiceType, string[]> = {
  SHOW_PROPERTY: [
    'Completás zona, fecha y quién puede entrar.',
    'VARA asigna un Visit Partner verificado en tu zona y ves el precio final.',
    'El partner llega y te pide el PIN. Sin PIN, la visita no empieza.',
    'Muestra la propiedad con el checklist y las reglas que fijaste.',
    'Recibís un reporte: quién fue, qué preguntaron y qué se observó.',
  ],
  ACCOMPANY_VISIT: [
    'Cargás la propiedad que vas a ver y el punto de encuentro.',
    'Marcás qué querés que revise: humedad, ruido, luz, documentación visible…',
    'VARA asigna un Visit Partner verificado y ves el precio final.',
    'La visita empieza con tu PIN y el partner sigue el checklist.',
    'Recibís el reporte y los próximos pasos sugeridos.',
  ],
}
const PROTOCOL = [
  { when: 'Antes', items: ['Identidad del partner verificada por VARA', 'La dirección exacta se comparte solo con el partner asignado', 'Ves el precio final antes de confirmar'] },
  { when: 'Durante', items: ['La visita empieza solo con tu PIN', 'Si llega alguien no informado, el partner no abre y te avisa', 'El partner puede frenar la visita si hay una situación insegura', 'VARA registra inicio y cierre'] },
  { when: 'Después', items: ['Reporte que separa hechos de opiniones', 'Soporte si algo salió mal', 'El partner no negocia ni cobra por fuera de VARA'] },
]
const SAMPLE_REPORT = [
  ['Servicio', 'Acompañar una visita'],
  ['Fecha y hora', 'Sábado 11:00 · 45 min'],
  ['Inicio / cierre', '11:02 / 11:46 (con PIN)'],
  ['Checklist', 'Humedad: manchas visibles en el baño · Ruido: calle con tránsito medio · Luz: buena a la mañana'],
  ['Preguntas al corredor', 'Expensas del último mes · Antigüedad del edificio'],
  ['Alertas', 'Ninguna'],
  ['Resumen objetivo', 'Se visitaron 3 ambientes. Se tomaron 8 fotos permitidas.'],
  ['Próximos pasos', 'Pedir expensas por escrito y consultar la causa de la humedad.'],
]

const GUARANTEES = [
  {
    icon: Shield,
    title: 'Identidad verificada, no declarada',
    body: 'DNI, selfie y teléfono verificados por VARA antes de la primera visita. Al partner lo aprobamos nosotros; no alcanza con que suba documentos.',
  },
  {
    icon: KeyRound,
    title: 'La visita no empieza sin tu PIN',
    body: 'El partner te pide un PIN de 4 números que solo vos tenés. Si no se lo das, la visita no arranca. Queda registrado quién entró y a qué hora.',
  },
  {
    icon: FileText,
    title: 'Un reporte con hechos',
    body: 'Cuántas personas fueron, qué preguntaron textualmente, qué se observó. Sin interpretaciones.',
  },
]

function Fold({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-2xl bg-white border border-slate-200/70">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 text-sm font-bold text-slate-900">
        {title}
        <ChevronDown size={15} className="text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="border-t border-slate-100 px-4 pb-4 pt-3">{children}</div>
    </details>
  )
}

/** Lista de espera en un paso: zona y listo. No hace falta armar una visita entera para pedir cobertura. */
function CoverageWaitlist({ serviceType }: { serviceType: VisitServiceType }) {
  const [zone, setZone] = useState('')
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')

  useEffect(() => {
    void hasSession().then(setSignedIn)
    void loadKnownLocation().then(k => { if (k.label) setZone(prev => prev || k.label) })
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!zone.trim()) return
    setState('sending')
    setState((await requestCoverage(zone.trim(), serviceType)) ? 'done' : 'error')
  }

  if (state === 'done') {
    return (
      <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
        <Check size={14} aria-hidden="true" /> Te anotamos en {zone.trim()}. Te avisamos cuando haya cobertura.
      </p>
    )
  }

  if (signedIn === false) {
    return (
      <Link href={accountUrl('/vara-visit', 'login')}
        className="mt-3 block rounded-xl bg-brand-600 hover:bg-brand-700 px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors">
        Entrá para anotarte en la lista de espera
      </Link>
    )
  }

  return (
    <form onSubmit={submit} className="mt-3">
      <label htmlFor="wl-zone" className="sr-only">Tu zona</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input id="wl-zone" value={zone} onChange={e => setZone(e.target.value)} placeholder="Tu zona, ej: Pilar"
            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm" />
        </div>
        <button type="submit" disabled={!zone.trim() || state === 'sending'}
          className="rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 px-4 py-2.5 text-sm font-semibold text-white transition-colors">
          {state === 'sending' ? <Loader2 size={15} className="animate-spin" aria-label="Enviando" /> : 'Avisame'}
        </button>
      </div>
      {state === 'error' && <p className="mt-1.5 text-xs text-rose-600">No pudimos anotarte. Probá de nuevo en un momento.</p>}
    </form>
  )
}

export default function VaraVisitPage() {
  const vara = useVaraState()
  const { journey } = useOperations()
  const isSeller = vara.loaded && journey === 'SELL'

  const [partners, setPartners] = useState<PartnerPublicProfile[] | null>(null)
  useEffect(() => { void listActivePartners().then(setPartners) }, [])

  const suggested: VisitServiceType = isSeller ? 'SHOW_PROPERTY' : 'ACCOMPANY_VISIT'
  const other: VisitServiceType = suggested === 'SHOW_PROPERTY' ? 'ACCOMPANY_VISIT' : 'SHOW_PROPERTY'
  const [howFor, setHowFor] = useState<VisitServiceType | null>(null)
  const howService = howFor ?? suggested
  const emptyNetwork = partners !== null && partners.length === 0

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-3xl mx-auto px-4 lg:px-6 py-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-700">
          VARA Visit
        </p>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1.5">
          Una persona verificada por VARA, en la visita
        </h1>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed max-w-xl">
          {isSeller
            ? 'Muestra tu propiedad a los interesados cuando vos no podés estar, y te deja un reporte.'
            : 'Te acompaña a conocer una propiedad, revisa lo que le pidas y te deja un reporte.'}
        </p>

        {/* Estado real de la red, antes de que alguien empiece a pedir. */}
        <div role="status" className={cn(
          'mt-5 rounded-2xl border p-4',
          emptyNetwork ? 'border-amber-200 bg-amber-50' : 'border-slate-200/70 bg-white',
        )}>
          {partners === null && (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Revisando cobertura…
            </p>
          )}
          {emptyNetwork && (
            <>
              <p className="text-sm font-bold text-amber-900">Piloto: todavía no hay Visit Partners activos</p>
              <p className="text-xs text-amber-900/80 mt-1 leading-relaxed">
                Estamos armando la red por zonas. Te lo decimos antes de que reserves, no después.
                Dejanos tu zona y te avisamos cuando haya cobertura. No se cobra nada hasta entonces.
              </p>
              <CoverageWaitlist serviceType={suggested} />
            </>
          )}
          {partners !== null && partners.length > 0 && (
            <p className="flex items-center gap-2 text-sm text-slate-700">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-500" />
              <strong className="font-bold">{partners.length}</strong>
              {partners.length === 1 ? ' Visit Partner activo' : ' Visit Partners activos'} · cobertura piloto por zonas
            </p>
          )}
        </div>

        {/* Las dos entradas al servicio, la sugerida primero según el journey. */}
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          {[suggested, other].map((st, i) => (
            <Link
              key={st}
              href={`/vara-visit/solicitar?servicio=${st}`}
              className={
                i === 0 && !emptyNetwork
                  ? 'rounded-2xl bg-brand-600 hover:bg-brand-700 p-5 text-white transition-colors'
                  : 'rounded-2xl bg-white border border-slate-200/70 hover:border-slate-300 p-5 transition-colors'
              }
            >
              {(() => {
                const primary = i === 0 && !emptyNetwork
                const Icon = st === 'SHOW_PROPERTY' ? Home : User
                return (
                  <>
                    <Icon size={18} className={primary ? 'text-white' : 'text-brand-600'} aria-hidden="true" />
                    <p className={`font-bold mt-2.5 ${primary ? 'text-white' : 'text-slate-900'}`}>{SERVICE_LABELS[st]}</p>
                    <p className={`text-xs mt-1 leading-relaxed ${primary ? 'text-brand-100' : 'text-slate-500'}`}>
                      {SERVICE_DESCRIPTIONS[st]}
                    </p>
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold mt-3 ${primary ? 'text-white' : 'text-brand-700'}`}>
                      {emptyNetwork ? 'Ver cómo sería' : 'Pedir una visita'} <ArrowRight size={13} aria-hidden="true" />
                    </span>
                  </>
                )
              })()}
            </Link>
          ))}
        </div>

        {/* Cómo funciona: un camino a la vez, el del journey primero. */}
        <section className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900">Cómo funciona</h2>
            <div role="tablist" className="flex rounded-full bg-slate-100 p-0.5">
              {([suggested, other] as VisitServiceType[]).map(st => (
                <button key={st} role="tab" type="button" aria-selected={howService === st} onClick={() => setHowFor(st)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                    howService === st ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500',
                  )}>
                  {st === 'SHOW_PROPERTY' ? 'Vendo' : 'Compro'}
                </button>
              ))}
            </div>
          </div>
          <ol className="mt-3 rounded-2xl bg-white border border-slate-200/70 p-4 space-y-2.5">
            {HOW[howService].map((t, i) => (
              <li key={t} className="flex gap-2.5 text-sm text-slate-600 leading-relaxed">
                <span className="w-5 h-5 mt-0.5 rounded-full bg-brand-50 text-brand-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
        </section>

        {/* Qué garantiza VARA. Va antes del precio a propósito. */}
        <section className="mt-8">
          <h2 className="text-sm font-bold text-slate-900">Por qué podés confiar en quien llega</h2>
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
            El partner elige su precio dentro de la banda que define VARA. Lo ves completo antes de confirmar.
          </p>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {PRICE_BANDS.map(b => (
              <div key={b.durationMinutes} className="rounded-2xl bg-white border border-slate-200/70 p-3 text-center">
                <p className="flex items-center justify-center gap-1 text-xs font-semibold text-slate-500">
                  <Clock size={11} aria-hidden="true" />{b.durationMinutes} min
                </p>
                <p className="text-sm sm:text-base font-extrabold text-slate-900 mt-1.5 tabular-nums">
                  {b.currency} {b.minPrice}–{b.maxPrice}
                </p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-2.5">
            Incluye al partner verificado, el registro de inicio y cierre, y el reporte. No reemplaza a un
            escribano, arquitecto o inspector. En el piloto el pago se coordina con VARA: nunca pagues por fuera.
          </p>
          <p className="text-[11px] text-slate-500 mt-1">{CANCELLATION_POLICY.text}</p>
        </section>

        {/* El detalle, plegado: está para quien lo busca, no para todos. */}
        <section className="mt-8 space-y-2.5">
          <Fold title="Protocolo: antes, durante y después">
            <div className="grid sm:grid-cols-3 gap-4">
              {PROTOCOL.map(p => (
                <div key={p.when}>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{p.when}</p>
                  <ul className="mt-1.5 space-y-1.5">
                    {p.items.map(i => (
                      <li key={i} className="flex gap-1.5 text-xs text-slate-600 leading-relaxed">
                        <Check size={11} className="text-emerald-600 mt-0.5 flex-shrink-0" aria-hidden="true" />{i}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-3">
              El partner no negocia por vos y no recibe llaves salvo un protocolo especial acordado.
            </p>
          </Fold>

          <Fold title="Ejemplo de reporte">
            <p className="text-[11px] text-slate-500">Ejemplo ilustrativo; no corresponde a una visita real.</p>
            <dl className="mt-2 divide-y divide-slate-100">
              {SAMPLE_REPORT.map(([k, v]) => (
                <div key={k} className="grid grid-cols-3 gap-2 py-2">
                  <dt className="text-[11px] font-semibold text-slate-500">{k}</dt>
                  <dd className="col-span-2 text-xs text-slate-700">{v}</dd>
                </div>
              ))}
            </dl>
          </Fold>

          <Fold title="Niveles de Visit Partner">
            <p className="text-xs text-slate-500">Cada nivel tiene condiciones verificables. No hay un puntaje secreto.</p>
            <div className="mt-2 divide-y divide-slate-100">
              {TIER_CRITERIA.map(t => (
                <div key={t.tier} className="py-2.5">
                  <p className="text-sm font-bold text-slate-900">{t.label}</p>
                  <ul className="mt-1 space-y-0.5">
                    {t.requirements.map(r => (
                      <li key={r} className="flex items-start gap-1.5 text-xs text-slate-600">
                        <Check size={11} className="text-emerald-600 mt-0.5 flex-shrink-0" aria-hidden="true" />{r}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Fold>
        </section>

        {/* La red real, solo si existe. */}
        {partners !== null && partners.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-bold text-slate-900">Visit Partners activos</h2>
            <div className="mt-3 space-y-2.5">
              {partners.map(p => <PartnerCard key={p.id} partner={p} />)}
              <p className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1">
                <MapPin size={11} aria-hidden="true" />
                La disponibilidad depende de la zona y la fecha. La ves al pedir la visita.
              </p>
            </div>
          </section>
        )}

        <Link href="/partner"
          className="mt-8 flex items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3.5 hover:border-slate-400 transition-colors">
          <span>
            <span className="block text-sm font-bold text-slate-900">¿Querés ser Visit Partner?</span>
            <span className="block text-xs text-slate-500">Generá ingresos haciendo visitas en tu zona.</span>
          </span>
          <ArrowRight size={15} className="text-slate-400 flex-shrink-0" aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}
