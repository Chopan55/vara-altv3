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
import { useOperations } from '@/hooks/useOperations'

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

const HOW_OWNER = [
  'Elegís "Mostrar mi propiedad" y completás zona, fecha y quién puede entrar.',
  'VARA busca un Visit Partner verificado en tu zona.',
  'Confirmás el precio final y la visita queda agendada.',
  'El día de la visita, el partner llega y te pide el PIN. Sin PIN no empieza.',
  'Muestra la propiedad siguiendo el checklist y las reglas que fijaste.',
  'Recibís un reporte con hechos: quién fue, qué preguntaron y qué se observó.',
]
const HOW_BUYER = [
  'Elegís "Acompañarme a una visita" y cargás la propiedad que vas a ver.',
  'Marcás qué querés que revise: humedad, ruido, luz, documentación visible…',
  'VARA asigna un Visit Partner verificado y confirmás el precio final.',
  'Se encuentran en el punto acordado y la visita empieza con tu PIN.',
  'El partner sigue el checklist y registra lo que ve, con fotos si están permitidas.',
  'Recibís el reporte y los próximos pasos sugeridos.',
]
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
  const { journey } = useOperations()
  const isSeller = vara.loaded && journey === 'SELL'

  const [partners, setPartners] = useState<PartnerPublicProfile[] | null>(null)

  useEffect(() => { void listActivePartners().then(setPartners) }, [])

  const suggested: VisitServiceType = isSeller ? 'SHOW_PROPERTY' : 'ACCOMPANY_VISIT'
  const other: VisitServiceType = suggested === 'SHOW_PROPERTY' ? 'ACCOMPANY_VISIT' : 'SHOW_PROPERTY'

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-3xl mx-auto px-4 lg:px-6 py-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-700">
          Visitas seguras
        </p>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1.5">
          Visitas inmobiliarias con una persona verificada por VARA
        </h1>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed max-w-xl">
          Cobertura piloto: disponible por zonas, con coordinación manual inicial.
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

        {/* Cómo funciona, en pasos simples, para cada camino. */}
        <section className="mt-8">
          <h2 className="text-sm font-bold text-slate-900">Cómo funciona</h2>
          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            {[['Si querés mostrar tu propiedad', HOW_OWNER], ['Si querés que te acompañen', HOW_BUYER]].map(([title, steps]) => (
              <div key={title as string} className="rounded-2xl bg-white border border-slate-200/70 p-4">
                <p className="text-sm font-bold text-slate-900">{title as string}</p>
                <ol className="mt-2.5 space-y-2">
                  {(steps as string[]).map((t, i) => (
                    <li key={t} className="flex gap-2.5 text-xs text-slate-600 leading-relaxed">
                      <span className="w-5 h-5 rounded-full bg-brand-50 text-brand-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                      {t}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>

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

        {/* Protocolo VARA Visit: lo que pasa antes, durante y después. */}
        <section className="mt-8">
          <h2 className="text-sm font-bold text-slate-900">Protocolo VARA Visit</h2>
          <div className="grid sm:grid-cols-3 gap-3 mt-3">
            {PROTOCOL.map(p => (
              <div key={p.when} className="rounded-2xl bg-white border border-slate-200/70 p-4">
                <p className="text-sm font-bold text-slate-900">{p.when}</p>
                <ul className="mt-2 space-y-1.5">
                  {p.items.map(i => (
                    <li key={i} className="flex gap-1.5 text-xs text-slate-600 leading-relaxed">
                      <Check size={11} className="text-emerald-600 mt-0.5 flex-shrink-0" aria-hidden="true" />{i}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-2.5">
            El partner no reemplaza a un escribano, arquitecto o inspector, no negocia por vos y no recibe llaves salvo un protocolo especial acordado.
          </p>
        </section>

        {/* Ejemplo de reporte: ilustrativo, no es de una visita real. */}
        <section className="mt-8">
          <details className="rounded-2xl bg-white border border-slate-200/70 p-4">
            <summary className="cursor-pointer text-sm font-bold text-slate-900">Ver ejemplo de reporte</summary>
            <p className="text-[11px] text-slate-500 mt-2">Ejemplo ilustrativo; no corresponde a una visita real.</p>
            <dl className="mt-3 divide-y divide-slate-100">
              {SAMPLE_REPORT.map(([k, v]) => (
                <div key={k} className="grid grid-cols-3 gap-2 py-2">
                  <dt className="text-[11px] font-semibold text-slate-500">{k}</dt>
                  <dd className="col-span-2 text-xs text-slate-700">{v}</dd>
                </div>
              ))}
            </dl>
          </details>
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
          <p className="text-[11px] text-slate-500 mt-1">
            Durante la etapa piloto, VARA coordina el pago de forma manual. Siempre ves el
            precio final antes de confirmar. Nunca pagues por fuera sin confirmación de VARA.
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            El precio incluye al Visit Partner verificado, el registro de inicio y cierre, y el
            reporte. No incluye informes de un escribano, arquitecto o inspector.
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
