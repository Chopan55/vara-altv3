'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  MapPin, Clock, Loader2, Check, X, ArrowRight, ShieldCheck,
  AlertTriangle, Star, TrendingUp, FileText, Lock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  SERVICE_LABELS, VISIT_STATUS_LABELS, ACTIVE_VISIT_STATUSES,
  ONBOARDING_STEPS, ONBOARDING_STEP_LABELS, VERIFICATION_STATUS_LABELS,
  PARTNER_STATUS_LABELS, tierLabel,
  type VisitBooking, type PartnerPublicProfile,
  type PartnerVerification, type PartnerTraining, type VerificationStatus,
} from '@/types/varaVisit'
import {
  getMyPartner, listPartnerBookings, acceptAssignment, rejectAssignment,
  getMyVerification, getMyTraining, getReport,
} from '@/lib/supabase/visits'
import { formatVisitPrice } from '@/lib/varaVisit/pricing'
import { TierBadge } from '@/components/visit/PartnerCard'

/**
 * Portal del Visit Partner.
 *
 * Una pantalla, tres preguntas: qué tengo hoy, qué me falta para poder
 * trabajar, y cómo vengo.
 *
 * Decisión central: si el partner NO está activo, lo primero y más grande de
 * la pantalla es qué le falta. Un portal que muestra "0 visitas" sin explicar
 * por qué no llegan es una pantalla que genera bronca.
 */

type Tab = 'visitas' | 'perfil'

function BookingRow({ booking, children }: { booking: VisitBooking; children?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] text-slate-400">{booking.visitCode}</p>
          <p className="font-semibold text-slate-900 text-sm mt-0.5">
            {SERVICE_LABELS[booking.serviceType]}
          </p>
          <p className="flex items-center gap-1 text-xs text-slate-500 mt-1">
            <MapPin size={10} aria-hidden="true" />{booking.locationLabel}
          </p>
          <p className="flex items-center gap-1 text-xs text-slate-500">
            <Clock size={10} aria-hidden="true" />
            {booking.requestedDate} · {booking.requestedTime} · {booking.durationMinutes} min
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <span className="inline-block rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
            {VISIT_STATUS_LABELS[booking.status]}
          </span>
          <p className="text-sm font-bold text-slate-900 mt-1.5">
            {formatVisitPrice(booking.price, booking.currency)}
          </p>
        </div>
      </div>
      {booking.instructions && (
        <p className="mt-2.5 text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
          {booking.instructions}
        </p>
      )}
      {children && <div className="mt-3">{children}</div>}
    </div>
  )
}

function Metric({
  icon: Icon, label, value, sub,
}: {
  icon: React.ElementType
  label: string
  value: string
  sub: string
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <Icon size={13} className="text-slate-400 mb-1" aria-hidden="true" />
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-base font-bold text-slate-900 mt-0.5">{value}</p>
      <p className="text-[10px] text-slate-400">{sub}</p>
    </div>
  )
}

function MetricsPanel({ partner }: { partner: PartnerPublicProfile }) {
  const m = partner.metrics
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 p-4">
      <h2 className="text-sm font-bold text-slate-900 mb-3">Cómo venís</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Metric icon={Star} label="Calificación"
          value={m.averageRating === null ? '—' : m.averageRating.toFixed(2)}
          sub={`${m.reviewCount} reseñas`} />
        <Metric icon={Check} label="Completadas" value={String(m.completedVisits)}
          sub={`de ${m.totalVisits}`} />
        <Metric icon={Clock} label="Puntualidad"
          value={m.punctualityRate === null ? '—' : `${Math.round(m.punctualityRate * 100)}%`}
          sub="check-in a horario" />
        <Metric icon={TrendingUp} label="Nivel" value={tierLabel(partner.tier)}
          sub="según criterios" />
      </div>
      {m.incidentCount > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-red-700">
          <AlertTriangle size={12} aria-hidden="true" />
          {m.incidentCount} incidente{m.incidentCount > 1 ? 's' : ''} registrado{m.incidentCount > 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}

function VerificationPanel({
  verification, training,
}: {
  verification: PartnerVerification | null
  training: PartnerTraining | null
}) {
  const rows: { label: string; status: VerificationStatus }[] = [
    { label: 'Identidad', status: verification?.identityStatus ?? 'NOT_STARTED' },
    { label: 'Documento', status: verification?.documentVerificationStatus ?? 'NOT_STARTED' },
    { label: 'Domicilio', status: verification?.addressVerificationStatus ?? 'NOT_STARTED' },
    { label: 'Referencias', status: verification?.referenceCheckStatus ?? 'NOT_STARTED' },
    { label: 'Entrevista', status: verification?.interviewStatus ?? 'NOT_STARTED' },
    {
      label: 'Capacitación',
      status: training?.certificationStatus === 'CERTIFIED' ? 'VERIFIED' : 'NOT_STARTED',
    },
  ]

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 p-4">
      <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-1">
        <ShieldCheck size={14} className="text-brand-600" aria-hidden="true" /> Verificaciones
      </h2>
      <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
        Estos estados los define VARA, no vos. Es lo que hace que un cliente pueda
        confiar en el badge.
      </p>
      <ul className="divide-y divide-slate-100">
        {rows.map(r => (
          <li key={r.label} className="flex items-center justify-between py-2.5">
            <span className="text-sm text-slate-700">{r.label}</span>
            <span className={cn(
              'rounded-lg px-2 py-0.5 text-[10px] font-bold',
              r.status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-700'
                : r.status === 'REJECTED' ? 'bg-red-50 text-red-700'
                : r.status === 'IN_REVIEW' || r.status === 'SUBMITTED'
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-slate-100 text-slate-500',
            )}>
              {VERIFICATION_STATUS_LABELS[r.status]}
            </span>
          </li>
        ))}
      </ul>

      {/* Antecedentes: solo estado, nunca contenido. Ver nota legal en varaVisit.ts. */}
      <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
        De los antecedentes guardamos únicamente si el proceso está aprobado o no.
        Nunca el certificado ni su contenido.
      </p>
    </div>
  )
}

function BlockedBanner({
  partner, verification, training,
}: {
  partner: PartnerPublicProfile
  verification: PartnerVerification | null
  training: PartnerTraining | null
}) {
  const missing: string[] = []
  if (!partner.verifiedIdentity) missing.push('Verificar tu identidad')
  if (training?.certificationStatus !== 'CERTIFIED') missing.push('Aprobar la capacitación')
  if (verification?.referenceCheckStatus !== 'VERIFIED') missing.push('Que confirmemos tus referencias')
  if (verification?.interviewStatus !== 'VERIFIED') missing.push('Hacer la entrevista')

  const suspended = partner.status === 'SUSPENDED'

  return (
    <div className={cn(
      'mt-4 rounded-2xl border p-4',
      suspended ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50',
    )}>
      <p className={cn(
        'flex items-center gap-2 text-sm font-bold',
        suspended ? 'text-red-900' : 'text-amber-900',
      )}>
        {suspended
          ? <><Lock size={14} aria-hidden="true" /> Tu cuenta está suspendida</>
          : <><AlertTriangle size={14} aria-hidden="true" /> Todavía no podés recibir visitas</>}
      </p>

      {suspended ? (
        <p className="text-xs text-red-800 mt-1.5 leading-relaxed">
          Hay una revisión de seguridad abierta. Soporte de VARA te va a contactar.
          Mientras tanto no se te asignan visitas.
        </p>
      ) : (
        <>
          <p className="text-xs text-amber-800 mt-1.5">Falta:</p>
          <ul className="mt-1.5 space-y-1">
            {missing.map(m => (
              <li key={m} className="flex items-center gap-1.5 text-xs text-amber-900">
                <span className="w-1 h-1 rounded-full bg-amber-600" aria-hidden="true" />{m}
              </li>
            ))}
          </ul>
          <Link href="/partner/onboarding"
            className="inline-flex items-center gap-1.5 mt-3 rounded-lg bg-amber-900 hover:bg-amber-800 px-3 py-2 text-xs font-semibold text-white transition-colors">
            Continuar el alta <ArrowRight size={12} aria-hidden="true" />
          </Link>
        </>
      )}
    </div>
  )
}

export default function PartnerPortalPage() {
  const [partner, setPartner] = useState<PartnerPublicProfile | null>(null)
  const [bookings, setBookings] = useState<VisitBooking[]>([])
  const [reported, setReported] = useState<Set<string>>(new Set())
  const [verification, setVerification] = useState<PartnerVerification | null>(null)
  const [training, setTraining] = useState<PartnerTraining | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('visitas')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const me = await getMyPartner()
    setPartner(me)
    if (me) {
      const list = await listPartnerBookings(me.id)
      setBookings(list)
      setVerification(await getMyVerification(me.id))
      setTraining(await getMyTraining(me.id))

      // Saber qué visitas ya tienen reporte: es lo que el partner adeuda.
      const done = list.filter(b => b.status === 'COMPLETED')
      const withReport = await Promise.all(
        done.map(async b => ((await getReport(b.id)) ? b.id : null)),
      )
      setReported(new Set(withReport.filter((x): x is string => x !== null)))
    }
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function accept(b: VisitBooking) {
    if (!partner) return
    setBusyId(b.id)
    await acceptAssignment(b.id, partner.id)
    await load()
    setBusyId(null)
  }

  async function reject(b: VisitBooking) {
    if (!partner) return
    const reason = window.prompt('¿Por qué no podés tomarla? (opcional)') ?? undefined
    setBusyId(b.id)
    await rejectAssignment(b.id, partner.id, reason)
    await load()
    setBusyId(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-slate-400" aria-hidden="true" />
      </div>
    )
  }

  // Sin perfil de partner: invitación a sumarse, con el proceso a la vista.
  if (!partner) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-2xl mx-auto px-4 lg:px-6 py-8">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Ser Visit Partner de VARA
          </h1>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            Mostrás propiedades o acompañás visitas, con un checklist y un reporte.
            No sos agente inmobiliario y no participás de la negociación.
          </p>

          <div className="mt-6 bg-white rounded-2xl border border-slate-200/70 p-5">
            <h2 className="font-bold text-slate-900 text-sm">
              El proceso tiene 7 pasos, y ninguno se saltea
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Subir documentos no alcanza para quedar habilitado. Entrás a la casa de
              alguien: el estándar es alto a propósito.
            </p>
            <ol className="mt-4 space-y-2">
              {ONBOARDING_STEPS.map((s, i) => (
                <li key={s} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-sm text-slate-700">{ONBOARDING_STEP_LABELS[s]}</span>
                </li>
              ))}
            </ol>
            <Link href="/partner/onboarding"
              className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 px-4 py-3 text-sm font-semibold text-white transition-colors">
              Empezar el alta <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const active = bookings.filter(b => ACTIVE_VISIT_STATUSES.includes(b.status))
  const pendingAccept = active.filter(b => b.status === 'ASSIGNED')
  const confirmed = active.filter(b => b.status !== 'ASSIGNED')
  const pendingReports = bookings.filter(b => b.status === 'COMPLETED' && !reported.has(b.id))
  const history = bookings.filter(b => !ACTIVE_VISIT_STATUSES.includes(b.status))

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 lg:px-6 py-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {partner.displayName}
          </h1>
          <div className="flex items-center gap-2 mt-1.5">
            <TierBadge tier={partner.tier} />
            <span className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-bold',
              partner.status === 'ACTIVE'
                ? 'bg-emerald-50 text-emerald-700'
                : partner.status === 'SUSPENDED'
                  ? 'bg-red-50 text-red-700'
                  : 'bg-amber-50 text-amber-700',
            )}>
              {PARTNER_STATUS_LABELS[partner.status]}
            </span>
          </div>
        </div>

        {/* Lo primero: por qué no recibís visitas, si es el caso. */}
        {partner.status !== 'ACTIVE' && (
          <BlockedBanner partner={partner} verification={verification} training={training} />
        )}

        {pendingReports.length > 0 && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-amber-900">
              <FileText size={14} aria-hidden="true" />
              Tenés {pendingReports.length} reporte{pendingReports.length > 1 ? 's' : ''} pendiente{pendingReports.length > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-amber-800 mt-1">
              Una visita sin reporte queda incompleta y afecta tu completion rate.
            </p>
            <div className="mt-2.5 space-y-1.5">
              {pendingReports.map(b => (
                <Link key={b.id} href={`/visit/${b.visitCode}/reporte`}
                  className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:text-slate-900">
                  <span>{b.locationLabel} · {b.requestedDate}</span>
                  <ArrowRight size={12} aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-1 border-b border-slate-200 mt-5">
          {(['visitas', 'perfil'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn(
                'px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors',
                tab === t ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500',
              )}>
              {t === 'visitas' ? 'Mis visitas' : 'Perfil y verificación'}
            </button>
          ))}
        </div>

        {tab === 'visitas' && (
          <div className="mt-5 space-y-5">
            {pendingAccept.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-slate-700 mb-2.5">Solicitudes nuevas</h2>
                <div className="space-y-2.5">
                  {pendingAccept.map(b => (
                    <BookingRow key={b.id} booking={b}>
                      <div className="flex gap-2">
                        <button onClick={() => accept(b)} disabled={busyId === b.id}
                          className="flex-1 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 px-3 py-2 text-xs font-semibold text-white transition-colors flex items-center justify-center gap-1.5">
                          <Check size={13} aria-hidden="true" /> Aceptar
                        </button>
                        <button onClick={() => reject(b)} disabled={busyId === b.id}
                          className="rounded-lg bg-white border border-slate-200 hover:border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors flex items-center gap-1.5">
                          <X size={13} aria-hidden="true" /> No puedo
                        </button>
                      </div>
                    </BookingRow>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="text-sm font-bold text-slate-700 mb-2.5">Confirmadas</h2>
              {confirmed.length === 0 ? (
                <p className="text-sm text-slate-500 bg-white rounded-2xl border border-slate-200/70 p-5">
                  No tenés visitas confirmadas.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {confirmed.map(b => (
                    <BookingRow key={b.id} booking={b}>
                      <Link href={`/visit/${b.visitCode}`}
                        className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 px-3 py-2.5 text-xs font-bold text-white transition-colors">
                        Abrir Visit Mode <ArrowRight size={13} aria-hidden="true" />
                      </Link>
                    </BookingRow>
                  ))}
                </div>
              )}
            </section>

            {history.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-slate-700 mb-2.5">Historial</h2>
                <div className="space-y-2.5">
                  {history.map(b => <BookingRow key={b.id} booking={b} />)}
                </div>
              </section>
            )}
          </div>
        )}

        {tab === 'perfil' && (
          <div className="mt-5 space-y-4">
            <MetricsPanel partner={partner} />
            <VerificationPanel verification={verification} training={training} />
          </div>
        )}
      </div>
    </div>
  )
}
