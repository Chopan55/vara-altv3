'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft, ArrowRight, Check, Home, User, Calendar, Clock,
  Shield, AlertCircle, Loader2, KeyRound, Sparkles, MapPin,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  SERVICE_LABELS, SERVICE_DESCRIPTIONS, PRICE_BANDS,
  type VisitServiceType, type VisitBooking, type PartnerPublicProfile,
} from '@/types/varaVisit'
import { findMatches, type MatchCriteria, type MatchResult } from '@/lib/varaVisit/matching'
import { quote, formatVisitPrice } from '@/lib/varaVisit/pricing'
import {
  listActivePartners, createBooking, requestCoverage, hasSession,
} from '@/lib/supabase/visits'
import { loadUserProperties, type UserProperty } from '@/lib/userProperties'
import { PartnerCard } from '@/components/visit/PartnerCard'
import { useVaraState } from '@/hooks/useVaraState'
import { journeyToStored } from '@/lib/journey'

const VALID_SERVICES: VisitServiceType[] = ['SHOW_PROPERTY', 'ACCOMPANY_VISIT']
const CHECK_OPTIONS = [
  'Humedad', 'Estado general', 'Ruido', 'Luz natural', 'Entorno',
  'Documentación visible', 'Amenities', 'Gastos', 'Señales de riesgo',
]

const inputCls = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm'
const labelCls = 'text-xs font-semibold text-slate-600 block mb-1.5'

function Opt() { return <span className="font-normal text-slate-400">(opcional)</span> }
function Req() { return <span className="text-rose-500" aria-label="obligatorio"> *</span> }

/**
 * Reserva de una visita.
 *
 * Cuatro pasos, no siete: "no pidas 15 decisiones si alcanza con 3".
 * Servicio, cuándo y dónde, quién, confirmar.
 *
 * Lo que NO hace, y es deliberado:
 *
 * - No muestra un partner si no hay ninguno. Cuando la zona está vacía muestra
 *   que está vacía y ofrece una salida real (lista de espera). Esa fue la falla
 *   P0-1 de la versión anterior: elegías entre tres personas que no existían.
 *
 * - No cobra. El precio se calcula, se muestra desglosado y se registra; el
 *   cobro se coordina a mano en el piloto. Ver VARA_VISIT_AUDIT.md §4.
 */

type Step = 'servicio' | 'cuando' | 'quien' | 'confirmar'

const STEPS: { id: Step; label: string }[] = [
  { id: 'servicio', label: 'Servicio' },
  { id: 'cuando', label: 'Cuándo' },
  { id: 'quien', label: 'Quién' },
  { id: 'confirmar', label: 'Confirmar' },
]

function StepBar({ current }: { current: Step }) {
  const idx = STEPS.findIndex(s => s.id === current)
  return (
    <ol className="flex items-center gap-2 sm:gap-3 my-5">
      {STEPS.map((s, i) => (
        <li key={s.id} className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span className={cn(
            'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold',
            i === idx ? 'bg-brand-600 text-white'
              : i < idx ? 'bg-brand-100 text-brand-700'
              : 'bg-slate-200 text-slate-500',
          )}>
            {i < idx ? <Check size={13} aria-hidden="true" /> : i + 1}
          </span>
          <span className={cn(
            'text-sm truncate',
            i === idx ? 'font-semibold text-slate-900' : 'text-slate-500',
          )}>
            {s.label}
          </span>
          {i < STEPS.length - 1 && (
            <span aria-hidden="true" className={cn(
              'hidden sm:block h-px w-8 lg:w-16',
              i < idx ? 'bg-brand-300' : 'bg-slate-200',
            )} />
          )}
        </li>
      ))}
    </ol>
  )
}

function Row({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="p-4 flex items-center gap-3">
      <Icon size={16} className="text-slate-400 flex-shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[11px] text-slate-400">{label}</p>
        <p className="text-sm font-semibold text-slate-900 truncate">{value}</p>
      </div>
    </div>
  )
}

function SolicitarInner() {
  const router = useRouter()
  const params = useSearchParams()

  const vara = useVaraState()
  // Si ya llegás con el servicio elegido (?servicio=…), arrancamos en el paso 2.
  const presetService = VALID_SERVICES.find(v => v === params.get('servicio')) ?? null
  const [step, setStep] = useState<Step>(presetService ? 'cuando' : 'servicio')
  const [serviceType, setServiceType] = useState<VisitServiceType | null>(presetService)
  const [touched, setTouched] = useState(false)

  // Cuándo y dónde
  const [properties, setProperties] = useState<UserProperty[]>([])
  const [propertyId, setPropertyId] = useState<string | null>(null)
  const [locationLabel, setLocationLabel] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('10:00')
  const [duration, setDuration] = useState(30)
  const [instructions, setInstructions] = useState('')
  const [accessInstructions, setAccessInstructions] = useState('')
  const [guests, setGuests] = useState('')
  // Campos propios de cada servicio. Se guardan dentro de las indicaciones (texto libre).
  const [listingLink, setListingLink] = useState('')
  const [visitName, setVisitName] = useState('')
  const [meetingPoint, setMeetingPoint] = useState('')
  const [coordinator, setCoordinator] = useState('')
  const [checks, setChecks] = useState<string[]>([])
  const [reportType, setReportType] = useState<'BASICO' | 'DETALLADO'>('BASICO')
  const [attending, setAttending] = useState<'SI' | 'NO'>('NO')
  const [arrivesEarly, setArrivesEarly] = useState(false)
  const [emergency, setEmergency] = useState('')
  const [authorized, setAuthorized] = useState('')
  const [ownerPresent, setOwnerPresent] = useState<'SI' | 'NO'>('NO')
  const [doorman, setDoorman] = useState('')
  const [photosAllowed, setPhotosAllowed] = useState<'SI' | 'NO'>('NO')

  // Quién
  const [partners, setPartners] = useState<PartnerPublicProfile[]>([])
  const [loadingPartners, setLoadingPartners] = useState(false)
  const [mode, setMode] = useState<'VARA_MATCH' | 'CLIENT_CHOICE'>('VARA_MATCH')
  const [chosenId, setChosenId] = useState<string | null>(null)

  // Resultado
  const [submitting, setSubmitting] = useState(false)
  const [booking, setBooking] = useState<VisitBooking | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [waitlisted, setWaitlisted] = useState(false)

  useEffect(() => { void hasSession().then(setSignedIn) }, [])

  // El servicio fija el contexto: mostrar mi propiedad = vendedor; acompañarme = comprador.
  useEffect(() => {
    if (!serviceType) return
    vara.setJourneyType(journeyToStored(serviceType === 'SHOW_PROPERTY' ? 'SELL' : 'BUY'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceType])

  useEffect(() => {
    void loadUserProperties().then(list => {
      setProperties(list)
      // Si tiene una sola propiedad, la elegimos: es la respuesta obvia.
      if (list.length === 1) {
        setPropertyId(list[0].id)
        setLocationLabel(list[0].city || list[0].neighborhood || '')
      }
    })
  }, [])

  // Buscamos partners recién en el paso 3: antes no hay zona ni fecha que usar.
  useEffect(() => {
    if (step !== 'quien' || !serviceType) return
    setLoadingPartners(true)
    void listActivePartners(serviceType)
      .then(setPartners)
      .finally(() => setLoadingPartners(false))
  }, [step, serviceType])

  const criteria: MatchCriteria | null = useMemo(() => {
    if (!serviceType || !locationLabel || !date) return null
    return { serviceType, zoneLabel: locationLabel, date, time }
  }, [serviceType, locationLabel, date, time])

  const outcome = useMemo(
    () => (criteria ? findMatches(partners, criteria) : null),
    [partners, criteria],
  )

  const selectedMatch: MatchResult | null = useMemo(() => {
    if (!outcome) return null
    if (mode === 'VARA_MATCH') return outcome.matches[0] ?? null
    return outcome.matches.find(m => m.partner.id === chosenId) ?? null
  }, [outcome, mode, chosenId])

  const priceBreakdown = useMemo(() => {
    if (!selectedMatch || !date) return null
    return quote({
      partnerRate: selectedMatch.partner.ratePerVisit,
      currency: selectedMatch.partner.currency,
      durationMinutes: duration,
      date, time,
    })
  }, [selectedMatch, date, time, duration])

  const missing: string[] = []
  if (step === 'servicio' && !serviceType) missing.push('el servicio')
  if (step === 'cuando') {
    if (!locationLabel.trim()) missing.push('la zona')
    if (!date) missing.push('la fecha')
    if (!time) missing.push('la hora')
    if (serviceType === 'ACCOMPANY_VISIT' && !meetingPoint.trim()) missing.push('el punto de encuentro')
    if (serviceType === 'SHOW_PROPERTY' && !emergency.trim()) missing.push('un contacto de emergencia')
  }
  if (step === 'quien' && !selectedMatch) missing.push('un Visit Partner disponible')
  const canContinue = missing.length === 0

  /** Arma el texto que ve el partner con todo lo que completó la persona. */
  function buildInstructions(): string | undefined {
    const L: string[] = []
    if (serviceType === 'ACCOMPANY_VISIT') {
      if (visitName.trim()) L.push(`Visita: ${visitName.trim()}`)
      if (listingLink.trim()) L.push(`Aviso: ${listingLink.trim()}`)
      if (meetingPoint.trim()) L.push(`Punto de encuentro: ${meetingPoint.trim()}`)
      if (coordinator.trim()) L.push(`Coordina la visita: ${coordinator.trim()}`)
      if (checks.length) L.push(`Revisar: ${checks.join(', ')}`)
      L.push(`Reporte: ${reportType === 'BASICO' ? 'básico' : 'detallado'}`)
      L.push(`Estaré presente: ${attending === 'SI' ? 'sí' : 'no'}${arrivesEarly ? ' · pido llegar antes' : ''}`)
    } else {
      if (authorized.trim()) L.push(`Personas autorizadas: ${authorized.trim()}`)
      L.push(`Propietario presente: ${ownerPresent === 'SI' ? 'sí' : 'no'}`)
      if (doorman.trim()) L.push(`Portero/seguridad: ${doorman.trim()}`)
      L.push(`Fotos/video permitidos: ${photosAllowed === 'SI' ? 'sí' : 'no'}`)
      if (coordinator.trim()) L.push(`Coordina: ${coordinator.trim()}`)
    }
    if (instructions.trim()) L.push(`Notas: ${instructions.trim()}`)
    return L.length ? L.join('\n') : undefined
  }

  function buildAccess(): string | undefined {
    const L: string[] = []
    if (accessInstructions.trim()) L.push(accessInstructions.trim())
    if (emergency.trim()) L.push(`Contacto de emergencia: ${emergency.trim()}`)
    return L.length ? L.join('\n') : undefined
  }

  function next() {
    if (!canContinue) { setTouched(true); return }
    setTouched(false)
    if (step === 'servicio') setStep('cuando')
    else if (step === 'cuando') setStep('quien')
    else if (step === 'quien') setStep('confirmar')
  }

  function back() {
    if (step === 'cuando') setStep('servicio')
    else if (step === 'quien') setStep('cuando')
    else if (step === 'confirmar') setStep('quien')
  }

  async function submit() {
    if (!serviceType || !selectedMatch || !priceBreakdown) return
    setSubmitting(true); setError(null)
    try {
      const created = await createBooking({
        serviceType,
        propertyId,
        date, time,
        durationMinutes: duration,
        locationLabel: locationLabel.trim(),
        instructions: buildInstructions(),
        accessInstructions: buildAccess(),
        guestsExpected: serviceType === 'SHOW_PROPERTY' && guests ? Number(guests) : undefined,
        price: priceBreakdown.total,
        currency: priceBreakdown.currency,
        assignmentMode: mode,
        chosenPartnerId: selectedMatch.partner.id,
      })
      if (!created) {
        setError('No pudimos registrar la visita. Revisá que hayas iniciado sesión.')
        return
      }
      setBooking(created)
    } catch {
      setError('Algo salió mal al registrar la visita.')
    } finally {
      setSubmitting(false)
    }
  }

  async function joinWaitlist() {
    if (!locationLabel.trim()) return
    const ok = await requestCoverage(locationLabel.trim(), serviceType ?? undefined)
    setWaitlisted(ok)
    if (!ok) setError('Para anotarte en la lista de espera necesitás una cuenta.')
  }

  // ─────────────── Confirmación: la visita ya existe ───────────────
  if (booking) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200/70 p-6">
          <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={28} className="text-emerald-600" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 text-center">Visita registrada</h1>
          <p className="text-sm text-slate-500 text-center mt-1">
            {booking.locationLabel} · {booking.requestedDate} a las {booking.requestedTime}
          </p>

          <div className="mt-5 rounded-xl bg-slate-50 p-4 text-center">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Código de visita
            </p>
            <p className="font-mono font-bold text-slate-900 mt-1">{booking.visitCode}</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Es el número que decís si necesitás contactarnos por esta visita.
            </p>
          </div>

          {/* El PIN es el centro de la seguridad: va destacado, no escondido. */}
          <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <KeyRound size={14} className="text-brand-700" aria-hidden="true" />
              <p className="text-xs font-bold text-slate-800">Tu PIN de visita</p>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">
              Cuando el Visit Partner llegue, te va a pedir un PIN de 4 números.
              Dáselo solo si estás conforme con que empiece la visita.
              <strong className="block mt-1">Lo vas a ver en el detalle de la visita.</strong>
            </p>
          </div>

          <div className="mt-5 space-y-2">
            <Link href="/mis-visitas"
              className="block rounded-xl bg-brand-600 hover:bg-brand-700 px-4 py-3 text-center text-sm font-semibold text-white transition-colors">
              Ver mis visitas
            </Link>
            <button onClick={() => router.push('/vara-visit')}
              className="block w-full rounded-xl bg-white border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-700 hover:border-slate-300 transition-colors">
              Volver a VARA Visit
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 lg:px-6 py-6">
        <Link href="/vara-visit"
          className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm mb-4 transition-colors">
          <ArrowLeft size={14} aria-hidden="true" /> Volver a VARA Visit
        </Link>

        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Pedir una visita</h1>
        <p className="text-sm text-slate-500 mt-1">
          Una persona verificada por VARA, con reporte al terminar.
        </p>

        <StepBar current={step} />

        {signedIn === false && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 mb-4">
            <AlertCircle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-xs text-amber-900">
              Para pedir una visita necesitás una cuenta: la visita queda a tu nombre y el
              PIN es tuyo.{' '}
              <Link href="/login" className="font-bold underline">Entrar o crear cuenta</Link>
            </p>
          </div>
        )}

        {serviceType && step !== 'servicio' && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 mb-4">
            <p className="text-sm text-slate-800">
              Servicio elegido: <strong>{SERVICE_LABELS[serviceType]}</strong>
            </p>
            <button onClick={() => { setStep('servicio'); setTouched(false) }}
              className="text-xs font-bold text-brand-700 underline">Cambiar</button>
          </div>
        )}

        {serviceType === 'ACCOMPANY_VISIT' && step !== 'servicio' && (
          <p className="text-xs text-slate-500 mb-4 -mt-2">
            Estás preparando una visita a una propiedad que querés comprar o alquilar.
          </p>
        )}

        {/* ─────────── Paso 1: servicio ─────────── */}
        {step === 'servicio' && (
          <div className="space-y-3">
            {(Object.keys(SERVICE_LABELS) as VisitServiceType[]).map(st => (
              <button
                key={st}
                onClick={() => setServiceType(st)}
                className={cn(
                  'w-full text-left bg-white rounded-2xl border p-4 transition-all',
                  serviceType === st
                    ? 'border-brand-400 ring-2 ring-brand-100'
                    : 'border-slate-200/70 hover:border-slate-300',
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                    {st === 'SHOW_PROPERTY'
                      ? <Home size={16} className="text-brand-600" aria-hidden="true" />
                      : <User size={16} className="text-brand-600" aria-hidden="true" />}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{SERVICE_LABELS[st]}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{SERVICE_DESCRIPTIONS[st]}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ─────────── Paso 2: cuándo y dónde ─────────── */}
        {step === 'cuando' && (
          <div className="space-y-4">
            {properties.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200/70 p-4">
                <label htmlFor="prop" className="text-xs font-semibold text-slate-600 block mb-2">
                  Propiedad
                </label>
                <select
                  id="prop"
                  value={propertyId ?? ''}
                  onChange={e => {
                    const id = e.target.value || null
                    setPropertyId(id)
                    const p = properties.find(x => x.id === id)
                    if (p) setLocationLabel(p.city || p.neighborhood || '')
                  }}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                >
                  <option value="">Sin asociar a una propiedad</option>
                  {properties.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200/70 p-4 space-y-3">
              <div>
                <label htmlFor="zona" className="text-xs font-semibold text-slate-600 block mb-1.5">
                  Zona de la visita
                </label>
                <div className="relative">
                  <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    id="zona"
                    value={locationLabel}
                    onChange={e => setLocationLabel(e.target.value)}
                    placeholder="Ej: Pilar"
                    className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2.5 text-sm"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Con esto buscamos quién trabaja cerca. La dirección exacta se la damos
                  solo al partner asignado.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="fecha" className="text-xs font-semibold text-slate-600 block mb-1.5">
                    Fecha
                  </label>
                  <input id="fecha" type="date" value={date} min={new Date().toISOString().slice(0, 10)}
                    onChange={e => setDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                </div>
                <div>
                  <label htmlFor="hora" className="text-xs font-semibold text-slate-600 block mb-1.5">
                    Hora
                  </label>
                  <input id="hora" type="time" value={time}
                    onChange={e => setTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-600 block mb-1.5">Duración</span>
                <div className="flex gap-2">
                  {PRICE_BANDS.map(b => (
                    <button key={b.durationMinutes} onClick={() => setDuration(b.durationMinutes)}
                      className={cn(
                        'flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors',
                        duration === b.durationMinutes
                          ? 'border-brand-400 bg-brand-50 text-brand-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300',
                      )}>
                      {b.durationMinutes} min
                      <span className="block text-[10px] font-normal text-slate-400">
                        {b.currency} {b.minPrice}–{b.maxPrice}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {serviceType === 'ACCOMPANY_VISIT' ? (
              <div className="bg-white rounded-2xl border border-slate-200/70 p-4 space-y-3">
                <p className="text-sm font-bold text-slate-900">La propiedad que vas a visitar</p>
                <div>
                  <label htmlFor="link" className={labelCls}>Link del aviso o dirección aproximada <Opt /></label>
                  <input id="link" value={listingLink} onChange={e => setListingLink(e.target.value)}
                    placeholder="https://… o calle y altura aproximada" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="vname" className={labelCls}>Nombre o referencia <Opt /></label>
                  <input id="vname" value={visitName} onChange={e => setVisitName(e.target.value)}
                    placeholder="Ej: Depto 3 amb. Belgrano" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="punto" className={labelCls}>Punto de encuentro<Req /></label>
                  <input id="punto" value={meetingPoint} onChange={e => setMeetingPoint(e.target.value)}
                    placeholder="Ej: puerta del edificio, esquina…"
                    aria-invalid={touched && !meetingPoint.trim()} className={inputCls} />
                </div>
                <div>
                  <label htmlFor="coord" className={labelCls}>Quién coordina la visita y cómo contactarlo <Opt /></label>
                  <input id="coord" value={coordinator} onChange={e => setCoordinator(e.target.value)}
                    placeholder="Ej: Inmobiliaria Pérez, 11 5555 5555" className={inputCls} />
                </div>
                <div>
                  <span className={labelCls}>Qué querés que revise</span>
                  <div className="flex flex-wrap gap-2">
                    {CHECK_OPTIONS.map(c => {
                      const on = checks.includes(c)
                      return (
                        <button key={c} type="button" aria-pressed={on}
                          onClick={() => setChecks(on ? checks.filter(x => x !== c) : [...checks, c])}
                          className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                            on ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-slate-300')}>
                          {c}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <span className={labelCls}>Tipo de reporte</span>
                  <div className="grid grid-cols-2 gap-2">
                    {(['BASICO', 'DETALLADO'] as const).map(t => (
                      <button key={t} type="button" aria-pressed={reportType === t} onClick={() => setReportType(t)}
                        className={cn('rounded-xl border px-3 py-2.5 text-sm font-semibold',
                          reportType === t ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600')}>
                        {t === 'BASICO' ? 'Básico' : 'Detallado'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className={labelCls}>¿Vas a estar presente?</span>
                    <div className="flex gap-2">
                      {(['SI', 'NO'] as const).map(v => (
                        <button key={v} type="button" aria-pressed={attending === v} onClick={() => setAttending(v)}
                          className={cn('flex-1 rounded-xl border px-3 py-2 text-sm font-semibold',
                            attending === v ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600')}>
                          {v === 'SI' ? 'Sí' : 'No'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="flex items-end gap-2 text-xs text-slate-600 pb-2">
                    <input type="checkbox" checked={arrivesEarly} onChange={e => setArrivesEarly(e.target.checked)} />
                    Que llegue antes
                  </label>
                </div>
                <div>
                  <label htmlFor="emerg" className={labelCls}>Contacto de emergencia <Opt /></label>
                  <input id="emerg" value={emergency} onChange={e => setEmergency(e.target.value)}
                    placeholder="Nombre y teléfono" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="instr" className={labelCls}>Notas <Opt /></label>
                  <textarea id="instr" rows={2} value={instructions} maxLength={300}
                    onChange={e => setInstructions(e.target.value)}
                    placeholder="Algo más que el partner deba saber…"
                    className={cn(inputCls, 'resize-none')} />
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200/70 p-4 space-y-3">
                <p className="text-sm font-bold text-slate-900">Acceso y reglas de la visita</p>
                <div>
                  <label htmlFor="auth" className={labelCls}>Personas autorizadas a entrar <Opt /></label>
                  <input id="auth" value={authorized} onChange={e => setAuthorized(e.target.value)}
                    placeholder="Nombres de quienes vienen" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="guests" className={labelCls}>Cuántas personas esperás <Opt /></label>
                  <input id="guests" type="number" min={0} max={20} value={guests}
                    onChange={e => setGuests(e.target.value)} className={inputCls} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className={labelCls}>¿Está el propietario?</span>
                    <div className="flex gap-2">
                      {(['SI', 'NO'] as const).map(v => (
                        <button key={v} type="button" aria-pressed={ownerPresent === v} onClick={() => setOwnerPresent(v)}
                          className={cn('flex-1 rounded-xl border px-3 py-2 text-sm font-semibold',
                            ownerPresent === v ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600')}>
                          {v === 'SI' ? 'Sí' : 'No'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className={labelCls}>¿Fotos y video?</span>
                    <div className="flex gap-2">
                      {(['SI', 'NO'] as const).map(v => (
                        <button key={v} type="button" aria-pressed={photosAllowed === v} onClick={() => setPhotosAllowed(v)}
                          className={cn('flex-1 rounded-xl border px-3 py-2 text-sm font-semibold',
                            photosAllowed === v ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600')}>
                          {v === 'SI' ? 'Permitidos' : 'No'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <label htmlFor="door" className={labelCls}>Portero o seguridad <Opt /></label>
                  <input id="door" value={doorman} onChange={e => setDoorman(e.target.value)}
                    placeholder="Ej: avisar en recepción" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="coord" className={labelCls}>Quién coordina y cómo contactarlo <Opt /></label>
                  <input id="coord" value={coordinator} onChange={e => setCoordinator(e.target.value)}
                    placeholder="Nombre y teléfono" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="acceso" className={labelCls}>Cómo se entra: llaves, alarma, mascotas <Opt /></label>
                  <textarea id="acceso" rows={2} value={accessInstructions} maxLength={300}
                    onChange={e => setAccessInstructions(e.target.value)}
                    placeholder="Código de portería, alarma, mascotas…"
                    className={cn(inputCls, 'resize-none')} />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Lo ve únicamente el partner asignado, después de confirmar la visita.
                  </p>
                </div>
                <div>
                  <label htmlFor="emerg" className={labelCls}>Contacto de emergencia<Req /></label>
                  <input id="emerg" value={emergency} onChange={e => setEmergency(e.target.value)}
                    placeholder="Nombre y teléfono"
                    aria-invalid={touched && !emergency.trim()} className={inputCls} />
                </div>
                <div>
                  <label htmlFor="instr" className={labelCls}>Qué destacar <Opt /></label>
                  <textarea id="instr" rows={2} value={instructions} maxLength={300}
                    onChange={e => setInstructions(e.target.value)}
                    placeholder="Qué mostrar primero…"
                    className={cn(inputCls, 'resize-none')} />
                </div>
                <ul className="rounded-xl bg-slate-50 p-3 text-[11px] text-slate-600 space-y-1">
                  <li>• Si llega alguien que no informaste, el partner no abre y te avisa.</li>
                  <li>• La visita empieza solo cuando se ingresa el PIN.</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ─────────── Paso 3: quién ─────────── */}
        {step === 'quien' && (
          <div className="space-y-4">
            {loadingPartners && (
              <div className="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center">
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                Buscando partners en {locationLabel}…
              </div>
            )}

            {!loadingPartners && outcome && outcome.matches.length === 0 && (
              // Zona sin cobertura. No hay perfil que mostrar, así que no se muestra ninguno.
              <div className="bg-white rounded-2xl border border-slate-200/70 p-5">
                <h2 className="font-bold text-slate-900">
                  Todavía no tenemos un Visit Partner disponible en {locationLabel}
                </h2>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                  La cobertura es piloto y se activa por zonas. Preferimos decírtelo ahora y
                  no después de que reserves y nadie aparezca.
                </p>
                <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
                  <li>• Tu zona queda registrada y la priorizamos según cuántos pedidos tenga.</li>
                  <li>• Si la visita es urgente, la coordinamos manualmente con el equipo de VARA.</li>
                  <li>• No cobramos nada hasta que haya un Visit Partner asignado.</li>
                </ul>
                {waitlisted ? (
                  <p className="mt-4 flex items-center gap-2 text-sm text-emerald-700">
                    <Check size={14} aria-hidden="true" />
                    Te anotamos. Te avisamos cuando haya cobertura en esta zona.
                  </p>
                ) : (
                  <button onClick={joinWaitlist}
                    className="mt-4 w-full rounded-xl bg-brand-600 hover:bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors">
                    Avisame cuando haya cobertura acá
                  </button>
                )}
                <div className="mt-2 grid sm:grid-cols-2 gap-2">
                  <Link href="/#contacto"
                    className="rounded-xl bg-white border border-slate-200 hover:border-slate-300 px-4 py-2.5 text-center text-sm font-semibold text-slate-700 transition-colors">
                    Quiero que VARA me contacte
                  </Link>
                  <Link href="/partner"
                    className="rounded-xl bg-white border border-slate-200 hover:border-slate-300 px-4 py-2.5 text-center text-sm font-semibold text-slate-700 transition-colors">
                    Postularme como Visit Partner
                  </Link>
                </div>
              </div>
            )}

            {!loadingPartners && outcome && outcome.matches.length > 0 && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => { setMode('VARA_MATCH'); setChosenId(null) }}
                    className={cn(
                      'rounded-2xl border p-3 text-left transition-colors',
                      mode === 'VARA_MATCH'
                        ? 'border-brand-400 bg-brand-50'
                        : 'border-slate-200 bg-white hover:border-slate-300',
                    )}>
                    <Sparkles size={14} className="text-brand-600 mb-1" aria-hidden="true" />
                    <p className="text-sm font-bold text-slate-900">Que elija VARA</p>
                    <p className="text-[11px] text-slate-500">Te asignamos al mejor disponible</p>
                  </button>
                  <button onClick={() => setMode('CLIENT_CHOICE')}
                    className={cn(
                      'rounded-2xl border p-3 text-left transition-colors',
                      mode === 'CLIENT_CHOICE'
                        ? 'border-brand-400 bg-brand-50'
                        : 'border-slate-200 bg-white hover:border-slate-300',
                    )}>
                    <User size={14} className="text-brand-600 mb-1" aria-hidden="true" />
                    <p className="text-sm font-bold text-slate-900">Elijo yo</p>
                    <p className="text-[11px] text-slate-500">
                      {outcome.matches.length} disponible{outcome.matches.length > 1 ? 's' : ''}
                    </p>
                  </button>
                </div>

                <div className="space-y-2">
                  {(mode === 'VARA_MATCH' ? outcome.matches.slice(0, 1) : outcome.matches).map(m => (
                    <PartnerCard
                      key={m.partner.id}
                      partner={m.partner}
                      reasons={m.reasons}
                      zoneLabel={locationLabel}
                      selected={mode === 'VARA_MATCH' || chosenId === m.partner.id}
                      onSelect={mode === 'CLIENT_CHOICE' ? setChosenId : undefined}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ─────────── Paso 4: confirmar ─────────── */}
        {step === 'confirmar' && serviceType && selectedMatch && priceBreakdown && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/70 divide-y divide-slate-100">
              <Row icon={Home} label="Servicio" value={SERVICE_LABELS[serviceType]} />
              <Row icon={MapPin} label="Zona" value={locationLabel} />
              <Row icon={Calendar} label="Fecha" value={date} />
              <Row icon={Clock} label="Hora y duración" value={`${time} · ${duration} minutos`} />
              <Row icon={User} label="Visit Partner" value={selectedMatch.partner.displayName} />
            </div>

            {/* Desglose completo antes de contratar, no después. */}
            <div className="bg-white rounded-2xl border border-slate-200/70 p-4">
              <h2 className="text-sm font-bold text-slate-900 mb-3">Precio</h2>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-600">Visita de {duration} minutos</dt>
                  <dd className="font-medium text-slate-900 tabular-nums">
                    {formatVisitPrice(priceBreakdown.base, priceBreakdown.currency)}
                  </dd>
                </div>
                {priceBreakdown.lines.map(l => (
                  <div key={l.label} className="flex justify-between">
                    <dt className="text-slate-600">
                      {l.label}
                      <span className="block text-[11px] text-slate-400">{l.description}</span>
                    </dt>
                    <dd className="font-medium text-slate-900 tabular-nums">
                      + {formatVisitPrice(l.amount, priceBreakdown.currency)}
                    </dd>
                  </div>
                ))}
                <div className="flex justify-between border-t border-slate-100 pt-2 mt-2">
                  <dt className="font-bold text-slate-900">Total</dt>
                  <dd className="font-bold text-slate-900 tabular-nums">
                    {formatVisitPrice(priceBreakdown.total, priceBreakdown.currency)}
                  </dd>
                </div>
              </dl>
              <p className="text-[11px] text-slate-500 mt-3">{priceBreakdown.cancellationPolicy}</p>
              <p className="text-[11px] text-slate-400 mt-1">
                El pago se coordina con VARA una vez confirmada la visita. Todavía no cobramos
                desde la plataforma.
              </p>
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2.5">
              <Shield size={14} className="text-brand-700 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-xs text-slate-700">
                Al confirmar generamos un código de visita y un PIN. El partner no puede
                iniciar la visita sin que vos le des ese PIN.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
                <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* ─────────── Navegación ─────────── */}
        <div className="flex gap-2 mt-6">
          {step !== 'servicio' && (
            <button onClick={back}
              className="rounded-xl bg-white border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300 transition-colors">
              Atrás
            </button>
          )}
          {step === 'confirmar' ? (
            <button onClick={submit} disabled={submitting || !canContinue}
              className="flex-1 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 px-4 py-3 text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2">
              {submitting
                ? <><Loader2 size={15} className="animate-spin" aria-hidden="true" /> Registrando…</>
                : <>Confirmar visita <ArrowRight size={15} aria-hidden="true" /></>}
            </button>
          ) : (
            <button onClick={next} aria-disabled={!canContinue}
              className={cn('flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-2',
                canContinue ? 'bg-brand-600 hover:bg-brand-700 text-white' : 'bg-slate-200 text-slate-500')}>
              Continuar <ArrowRight size={15} aria-hidden="true" />
            </button>
          )}
        </div>
        {!canContinue && step !== 'confirmar' && (
          <p role="status" className={cn('mt-2 text-xs', touched ? 'text-rose-600 font-semibold' : 'text-slate-500')}>
            Para seguir completá {missing.join(', ')}.
          </p>
        )}
      </div>
    </div>
  )
}

export default function SolicitarPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <SolicitarInner />
    </Suspense>
  )
}
