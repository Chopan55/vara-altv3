'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  MapPin, Clock, KeyRound, Eye, EyeOff, Star, ShieldAlert,
  FileText, Loader2, Plus, Check, AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  SERVICE_LABELS, VISIT_STATUS_LABELS, ACTIVE_VISIT_STATUSES,
  PARTNER_REVIEW_DIMENSIONS, INCIDENT_CATEGORY_LABELS,
  type VisitBooking, type VisitReport, type PartnerPublicProfile,
  type IncidentCategory, type VisitStatus,
} from '@/types/varaVisit'
import {
  listMyBookings, getBookingPin, getReport, getPartnerById,
  submitPartnerReview, reportIncident,
} from '@/lib/supabase/visits'
import { tryCreateClient } from '@/lib/supabase/client'
import { formatVisitPrice } from '@/lib/varaVisit/pricing'
import { PartnerAvatar, TierBadge, VerificationList } from '@/components/visit/PartnerCard'

/**
 * Mis visitas — el lado del cliente.
 *
 * Responde las cuatro preguntas que tiene alguien que contrató una visita:
 * quién va, en qué estado está, cuál es mi PIN, y qué pasó.
 *
 * El PIN arranca oculto y se revela con un toque. No es paranoia: la pantalla
 * se mira en lugares donde hay otras personas, y el PIN es lo único que impide
 * que una visita arranque sin autorización del cliente.
 */

interface Enriched {
  booking: VisitBooking
  partner: PartnerPublicProfile | null
  report: VisitReport | null
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title}
        className="relative w-full max-w-md bg-white rounded-2xl p-5 max-h-[85vh] overflow-y-auto">
        <h2 className="font-bold text-slate-900 mb-3">{title}</h2>
        {children}
      </div>
    </div>
  )
}

function Stars({
  label, value, onChange, bold,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  bold?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={cn('text-sm', bold ? 'font-bold text-slate-900' : 'text-slate-600')}>
        {label}
      </span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} onClick={() => onChange(n)} aria-label={`${label}: ${n} de 5`} className="p-0.5">
            <Star size={18}
              className={n <= value ? 'text-amber-500 fill-amber-500' : 'text-slate-300'}
              aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  )
}

/** Calificación por dimensiones. No hay promedio oculto: cada una se ve. */
function ReviewDialog({
  bookingId, partnerId, partnerName, onClose, onDone,
}: {
  bookingId: string
  partnerId: string
  partnerName: string
  onClose: () => void
  onDone: () => void
}) {
  const [scores, setScores] = useState<Record<string, number>>({})
  const [overall, setOverall] = useState(0)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)

  const complete = PARTNER_REVIEW_DIMENSIONS.every(d => (scores[d.key] ?? 0) > 0) && overall > 0

  async function send() {
    const supabase = tryCreateClient()
    if (!supabase) return
    setBusy(true)
    const { data } = await supabase.auth.getUser()
    if (data.user) {
      await submitPartnerReview({
        bookingId,
        partnerId,
        reviewerUserId: data.user.id,
        punctuality: scores.punctuality,
        professionalism: scores.professionalism,
        communication: scores.communication,
        knowledge: scores.knowledge,
        reportQuality: scores.reportQuality,
        overallRating: overall,
        comment: comment.trim() || null,
      })
    }
    setBusy(false)
    onDone()
  }

  return (
    <Dialog title={`Calificar a ${partnerName}`} onClose={onClose}>
      <div className="space-y-3">
        {PARTNER_REVIEW_DIMENSIONS.map(d => (
          <Stars key={d.key} label={d.label} value={scores[d.key] ?? 0}
            onChange={v => setScores(s => ({ ...s, [d.key]: v }))} />
        ))}
        <div className="border-t border-slate-100 pt-3">
          <Stars label="Calificación general" value={overall} onChange={setOverall} bold />
        </div>
        <textarea rows={3} value={comment} onChange={e => setComment(e.target.value)}
          aria-label="Comentario"
          placeholder="Comentario (opcional). Es público."
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm resize-none" />
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={onClose}
          className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-600">
          Cancelar
        </button>
        <button onClick={send} disabled={!complete || busy}
          className="flex-1 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-40 py-2.5 text-sm font-semibold text-white transition-colors">
          {busy ? 'Enviando…' : 'Enviar calificación'}
        </button>
      </div>
    </Dialog>
  )
}

function IncidentDialog({
  bookingId, onClose, onDone,
}: {
  bookingId: string
  onClose: () => void
  onDone: () => void
}) {
  const [category, setCategory] = useState<IncidentCategory>('CONDUCT')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  async function send() {
    setBusy(true)
    await reportIncident({
      bookingId, category,
      // El cliente no clasifica gravedad: lo hace Trust & Safety. Pedirle que
      // decida si algo es "crítico" mientras está alterado no sirve a nadie.
      severity: 'LEVEL_2_REVIEW',
      description: description.trim(),
      location: null,
    })
    setBusy(false)
    setSent(true)
  }

  if (sent) {
    return (
      <Dialog title="Reporte registrado" onClose={onDone}>
        <p className="flex items-start gap-2 text-sm text-slate-600">
          <Check size={15} className="text-emerald-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
          Lo estamos revisando. Si hace falta, te contactamos.
        </p>
        <button onClick={onDone}
          className="mt-4 w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white">
          Cerrar
        </button>
      </Dialog>
    )
  }

  return (
    <Dialog title="Reportar un problema" onClose={onClose}>
      <p className="text-sm text-slate-600 leading-relaxed">
        Contanos qué pasó. Si hay riesgo para una persona, llamá al 911 primero.
      </p>
      <label htmlFor="cat-cliente" className="block text-xs font-semibold text-slate-600 mt-3 mb-1.5">
        Qué pasó
      </label>
      <select id="cat-cliente" value={category} onChange={e => setCategory(e.target.value as IncidentCategory)}
        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
        {(Object.keys(INCIDENT_CATEGORY_LABELS) as IncidentCategory[]).map(c => (
          <option key={c} value={c}>{INCIDENT_CATEGORY_LABELS[c]}</option>
        ))}
      </select>
      <textarea rows={4} value={description} onChange={e => setDescription(e.target.value)}
        aria-label="Descripción"
        placeholder="Contá los hechos."
        className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm resize-none" />
      <div className="flex gap-2 mt-4">
        <button onClick={onClose}
          className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-600">
          Cancelar
        </button>
        <button onClick={send} disabled={busy || description.trim().length < 5}
          className="flex-1 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-40 py-2.5 text-sm font-semibold text-white transition-colors">
          {busy ? 'Enviando…' : 'Enviar'}
        </button>
      </div>
    </Dialog>
  )
}

function StatusPill({ status }: { status: VisitStatus }) {
  const tone =
    status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700'
      : status === 'CANCELLED' ? 'bg-slate-100 text-slate-500'
      : status === 'INCIDENT_REVIEW' ? 'bg-red-50 text-red-700'
      : status === 'IN_PROGRESS' || status === 'ARRIVED' ? 'bg-brand-50 text-brand-700'
      : 'bg-amber-50 text-amber-700'
  return (
    <span className={cn('inline-block rounded-lg px-2 py-0.5 text-[10px] font-bold', tone)}>
      {VISIT_STATUS_LABELS[status]}
    </span>
  )
}

function ReportList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="font-semibold text-slate-700 mb-1">{title}</p>
      <ul className="space-y-0.5">
        {items.map((s, i) => (
          <li key={`${s}-${i}`} className="text-slate-600">· {s}</li>
        ))}
      </ul>
    </div>
  )
}

function ReportView({ report }: { report: VisitReport }) {
  return (
    <details className="mt-3 rounded-xl border border-slate-200 p-3">
      <summary className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
        <FileText size={12} aria-hidden="true" /> Reporte de la visita
      </summary>
      <div className="mt-3 space-y-3 text-xs">
        <p className="text-slate-600">
          <strong>{report.attendeesCount}</strong> persona{report.attendeesCount === 1 ? '' : 's'} presente
          {report.attendeesCount === 1 ? '' : 's'}
        </p>
        <ReportList title="Ambientes recorridos" items={report.roomsShown} />
        <ReportList title="Preguntas que hicieron" items={report.questionsAsked} />
        <ReportList title="Observaciones" items={report.observations} />
        {report.issues.length > 0 && (
          <div>
            <p className="font-semibold text-slate-700 mb-1">Problemas detectados</p>
            <ul className="space-y-1">
              {report.issues.map(i => (
                <li key={i.id} className="flex items-start gap-1.5 text-slate-600">
                  <AlertTriangle size={10} className="text-amber-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  {i.description}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  )
}

function VisitCard({
  booking, partner, report, onChanged,
}: Enriched & { onChanged: () => void }) {
  const [pin, setPin] = useState<string | null>(null)
  const [pinVisible, setPinVisible] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [incidentOpen, setIncidentOpen] = useState(false)

  async function revealPin() {
    if (!pin) setPin(await getBookingPin(booking.id))
    setPinVisible(v => !v)
  }

  const canShowPin = ACTIVE_VISIT_STATUSES.includes(booking.status)
  const isDone = booking.status === 'COMPLETED'

  return (
    <article className="bg-white rounded-2xl border border-slate-200/70 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[11px] text-slate-400">{booking.visitCode}</p>
            <h3 className="font-bold text-slate-900 mt-0.5">{SERVICE_LABELS[booking.serviceType]}</h3>
            <p className="flex items-center gap-1 text-xs text-slate-500 mt-1">
              <MapPin size={11} aria-hidden="true" />{booking.locationLabel}
            </p>
            <p className="flex items-center gap-1 text-xs text-slate-500">
              <Clock size={11} aria-hidden="true" />
              {booking.requestedDate} · {booking.requestedTime} · {booking.durationMinutes} min
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <StatusPill status={booking.status} />
            <p className="text-sm font-bold text-slate-900 mt-1.5">
              {formatVisitPrice(booking.price, booking.currency)}
            </p>
          </div>
        </div>

        {/* Quién va. Sin partner asignado lo decimos, no dejamos el hueco. */}
        <div className="mt-3.5 rounded-xl bg-slate-50 p-3">
          {partner ? (
            <div className="flex items-start gap-3">
              <PartnerAvatar partner={partner} size={38} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-slate-900 text-sm">{partner.displayName}</p>
                  <TierBadge tier={partner.tier} />
                </div>
                <div className="mt-1"><VerificationList partner={partner} /></div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-600">
              Todavía no hay un Visit Partner asignado. Te avisamos cuando lo haya.
            </p>
          )}
        </div>

        {/* PIN: oculto por defecto. */}
        {canShowPin && (
          <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <KeyRound size={12} className="text-brand-700" aria-hidden="true" /> Tu PIN de visita
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Dáselo al partner solo si estás conforme con que empiece.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="font-mono text-xl font-bold tracking-[0.2em] text-slate-900">
                  {pinVisible && pin ? pin : '••••'}
                </span>
                <button onClick={revealPin}
                  aria-label={pinVisible ? 'Ocultar PIN' : 'Mostrar PIN'}
                  className="text-slate-500 hover:text-slate-800 p-1">
                  {pinVisible
                    ? <EyeOff size={15} aria-hidden="true" />
                    : <Eye size={15} aria-hidden="true" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {report && <ReportView report={report} />}
      </div>

      <div className="border-t border-slate-100 px-4 py-2.5 flex flex-wrap gap-2">
        {isDone && partner && (
          <button onClick={() => setReviewOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors">
            <Star size={12} aria-hidden="true" /> Calificar al partner
          </button>
        )}
        <button onClick={() => setIncidentOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-slate-200 hover:border-red-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-red-600 transition-colors">
          <ShieldAlert size={12} aria-hidden="true" /> Reportar un problema
        </button>
      </div>

      {reviewOpen && partner && (
        <ReviewDialog
          bookingId={booking.id}
          partnerId={partner.id}
          partnerName={partner.displayName}
          onClose={() => setReviewOpen(false)}
          onDone={() => { setReviewOpen(false); onChanged() }}
        />
      )}
      {incidentOpen && (
        <IncidentDialog
          bookingId={booking.id}
          onClose={() => setIncidentOpen(false)}
          onDone={() => { setIncidentOpen(false); onChanged() }}
        />
      )}
    </article>
  )
}

export default function MisVisitasPage() {
  const [items, setItems] = useState<Enriched[]>([])
  const [loading, setLoading] = useState(true)
  const [signedIn, setSignedIn] = useState<boolean | null>(null)

  const load = useCallback(async () => {
    const supabase = tryCreateClient()
    if (!supabase) { setSignedIn(false); setLoading(false); return }
    const { data } = await supabase.auth.getUser()
    if (!data.user) { setSignedIn(false); setLoading(false); return }
    setSignedIn(true)

    const bookings = await listMyBookings()
    const enriched = await Promise.all(bookings.map(async b => ({
      booking: b,
      partner: b.assignedPartnerId ? await getPartnerById(b.assignedPartnerId) : null,
      report: b.status === 'COMPLETED' ? await getReport(b.id) : null,
    })))
    setItems(enriched)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-slate-400" aria-hidden="true" />
      </div>
    )
  }

  if (signedIn === false) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200/70 p-6 text-center">
          <h1 className="font-bold text-slate-900">Entrá para ver tus visitas</h1>
          <p className="text-sm text-slate-500 mt-2">
            Las visitas quedan a tu nombre, con su código y su PIN.
          </p>
          <Link href="/login"
            className="inline-block mt-5 rounded-xl bg-brand-600 hover:bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors">
            Entrar o crear cuenta
          </Link>
        </div>
      </div>
    )
  }

  const active = items.filter(i => ACTIVE_VISIT_STATUSES.includes(i.booking.status))
  const past = items.filter(i => !ACTIVE_VISIT_STATUSES.includes(i.booking.status))

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 lg:px-6 py-6">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Mis visitas</h1>
        <p className="text-sm text-slate-500 mt-1">
          Quién va, en qué estado está y qué pasó.
        </p>

        {items.length === 0 ? (
          <div className="mt-6 bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
            <p className="font-semibold text-slate-700">Todavía no pediste ninguna visita</p>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              Un Visit Partner verificado puede mostrar tu propiedad o acompañarte a conocer una.
            </p>
            <Link href="/vara-visit/solicitar"
              className="inline-flex items-center gap-1.5 mt-5 rounded-xl bg-brand-600 hover:bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors">
              <Plus size={15} aria-hidden="true" /> Pedir una visita
            </Link>
          </div>
        ) : (
          <>
            <div className="flex justify-end mt-4">
              <Link href="/vara-visit/solicitar"
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition-colors">
                <Plus size={14} aria-hidden="true" /> Pedir otra
              </Link>
            </div>

            {active.length > 0 && (
              <section className="mt-5">
                <h2 className="text-sm font-bold text-slate-700 mb-2.5">Próximas y en curso</h2>
                <div className="space-y-3">
                  {active.map(i => <VisitCard key={i.booking.id} {...i} onChanged={load} />)}
                </div>
              </section>
            )}

            {past.length > 0 && (
              <section className="mt-6">
                <h2 className="text-sm font-bold text-slate-700 mb-2.5">Anteriores</h2>
                <div className="space-y-3">
                  {past.map(i => <VisitCard key={i.booking.id} {...i} onChanged={load} />)}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
