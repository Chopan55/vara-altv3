'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  MapPin, Clock, KeyRound, Check, AlertTriangle, Loader2,
  LifeBuoy, ShieldAlert, LogOut, Phone, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  SERVICE_LABELS, VISIT_STATUS_LABELS, EMERGENCY_NUMBERS,
  INCIDENT_CATEGORY_LABELS, checklistFor,
  type VisitBooking, type VisitSession, type GeoPoint,
  type IncidentCategory, type IncidentSeverity,
} from '@/types/varaVisit'
import {
  verifyPin, canCheckIn, canStartVisit, canCheckOut, requestGeoPoint,
  durationMinutes, checklistProgress,
  PIN_ERROR_MESSAGES, CHECK_IN_BLOCK_MESSAGES, START_BLOCK_MESSAGES,
} from '@/lib/varaVisit/session'
import {
  getBookingByCode, getSession, ensureSession, getMyPartner,
  checkIn as persistCheckIn, recordPinResult, startVisit as persistStart,
  saveChecklist, checkOut as persistCheckOut, reportIncident, getBookingPin,
} from '@/lib/supabase/visits'

/**
 * Visit Mode — la pantalla que usa el Visit Partner parado en la puerta.
 *
 * Diseñada para celular con una mano, de noche, con apuro. De ahí las
 * decisiones que la hacen ver "simple de más":
 *
 * - Una sola acción principal visible por vez. En el lugar no se elige entre
 *   seis botones: se hace lo que sigue.
 * - Botones grandes y contraste alto. Fondo oscuro: se lee mejor con sol
 *   directo que una pantalla blanca, y no encandila de noche.
 * - "Necesito ayuda" siempre accesible, nunca escondido en un menú.
 * - Nada se pierde si falla la red: el estado se relee de la base al volver.
 *
 * La regla que no se negocia: sin PIN confirmado, la visita no arranca.
 */

type Phase = 'loading' | 'not_found' | 'pre_checkin' | 'pin' | 'in_progress' | 'done'

function formatElapsed(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full sm:max-w-md bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-white/10 p-5 max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-white">{title}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-slate-400 hover:text-white p-1">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function InfoBlock({ title, body, confidential }: { title: string; body: string; confidential?: boolean }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{title}</p>
      <p className="text-sm text-slate-200 mt-1 leading-relaxed">{body}</p>
      {confidential && (
        <p className="text-[11px] text-amber-400 mt-2">
          Confidencial. No lo compartas con nadie.
        </p>
      )}
    </div>
  )
}

/**
 * Ayuda.
 *
 * VARA NO llama a servicios de emergencia por su cuenta: mostramos los números
 * para que la persona decida. Una llamada automática al 911 disparada por una
 * señal de la app produce falsos positivos con consecuencias reales.
 */
function HelpSheet({ onClose, visitCode }: { onClose: () => void; visitCode: string }) {
  return (
    <Sheet title="Necesito ayuda" onClose={onClose}>
      <p className="text-sm text-slate-300 leading-relaxed">
        Si hay riesgo para una persona, ponete a salvo primero y llamá vos.
        VARA no llama a emergencias por vos.
      </p>
      <div className="mt-4 space-y-2">
        {EMERGENCY_NUMBERS.map(e => (
          <a key={e.number} href={`tel:${e.number}`}
            className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3.5 text-sm font-semibold text-white hover:bg-white/15 transition-colors">
            <span>{e.label}</span>
            <span className="flex items-center gap-1.5 text-brand-300">
              <Phone size={14} aria-hidden="true" />{e.number}
            </span>
          </a>
        ))}
      </div>
      <div className="mt-4 rounded-xl bg-white/5 p-4">
        <p className="text-xs text-slate-400">Para soporte de VARA, mencioná este código:</p>
        <p className="font-mono font-bold text-white mt-1">{visitCode}</p>
      </div>
    </Sheet>
  )
}

function IncidentSheet({
  busy, onClose, onSubmit,
}: {
  busy: boolean
  onClose: () => void
  onSubmit: (c: IncidentCategory, s: IncidentSeverity, d: string) => void
}) {
  const [category, setCategory] = useState<IncidentCategory>('SAFETY')
  const [severity, setSeverity] = useState<IncidentSeverity>('LEVEL_2_REVIEW')
  const [description, setDescription] = useState('')

  return (
    <Sheet title="Reportar un problema" onClose={onClose}>
      <p className="text-sm text-slate-300 leading-relaxed">
        Reportar no es una falta tuya: es información que protege a todos.
        Registramos la hora y, si está disponible, la ubicación.
      </p>

      <label htmlFor="cat" className="block text-xs font-semibold text-slate-400 mt-4 mb-1.5">Qué pasó</label>
      <select id="cat" value={category} onChange={e => setCategory(e.target.value as IncidentCategory)}
        className="w-full rounded-xl bg-slate-900 border border-white/20 px-3 py-3 text-sm text-white">
        {(Object.keys(INCIDENT_CATEGORY_LABELS) as IncidentCategory[]).map(c => (
          <option key={c} value={c}>{INCIDENT_CATEGORY_LABELS[c]}</option>
        ))}
      </select>

      <span className="block text-xs font-semibold text-slate-400 mt-4 mb-1.5">Gravedad</span>
      <div className="grid grid-cols-3 gap-2">
        {([
          ['LEVEL_1_MINOR', 'Menor'],
          ['LEVEL_2_REVIEW', 'A revisar'],
          ['LEVEL_3_CRITICAL', 'Crítico'],
        ] as [IncidentSeverity, string][]).map(([v, label]) => (
          <button key={v} onClick={() => setSeverity(v)}
            className={cn(
              'rounded-xl py-3 text-xs font-semibold transition-colors',
              severity === v ? 'bg-red-500 text-white' : 'bg-white/10 text-slate-300 hover:bg-white/15',
            )}>
            {label}
          </button>
        ))}
      </div>

      <label htmlFor="desc" className="block text-xs font-semibold text-slate-400 mt-4 mb-1.5">
        Contá qué pasó, con hechos
      </label>
      <textarea id="desc" rows={4} value={description} onChange={e => setDescription(e.target.value)}
        placeholder="Ej: Llegaron 5 personas y estaban informadas 2."
        className="w-full rounded-xl bg-slate-900 border border-white/20 px-3 py-3 text-sm text-white resize-none" />

      <button onClick={() => onSubmit(category, severity, description.trim())}
        disabled={busy || description.trim().length < 5}
        className="mt-4 w-full rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-40 py-4 text-sm font-bold text-white transition-colors">
        {busy ? 'Enviando…' : 'Enviar reporte'}
      </button>
    </Sheet>
  )
}

export default function VisitModePage() {
  const params = useParams()
  const code = typeof params.code === 'string' ? params.code : ''

  const [booking, setBooking] = useState<VisitBooking | null>(null)
  const [session, setSession] = useState<VisitSession | null>(null)
  const [partnerId, setPartnerId] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  // PIN
  const [pinInput, setPinInput] = useState('')
  const [expectedPin, setExpectedPin] = useState<string | null>(null)
  const [pinError, setPinError] = useState<string | null>(null)

  // Cronómetro
  const [elapsed, setElapsed] = useState(0)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Ayuda / incidente
  const [helpOpen, setHelpOpen] = useState(false)
  const [incidentOpen, setIncidentOpen] = useState(false)

  const reload = useCallback(async () => {
    const b = await getBookingByCode(code)
    if (!b) { setPhase('not_found'); return }
    setBooking(b)

    const me = await getMyPartner()
    setPartnerId(me?.id ?? null)

    // El PIN lo lee el cliente por RLS; el partner recibe null y lo pide en voz alta.
    setExpectedPin(await getBookingPin(b.id))

    const s = me ? await ensureSession(b.id, me.id) : await getSession(b.id)
    setSession(s)

    if (!s || s.status === 'NOT_STARTED') setPhase('pre_checkin')
    else if (s.status === 'CHECKED_IN') setPhase('pin')
    else if (s.status === 'IN_PROGRESS') setPhase('in_progress')
    else setPhase('done')
  }, [code])

  useEffect(() => { void reload() }, [reload])

  // Cronómetro desde el check-in real, no desde que se abrió la pantalla.
  useEffect(() => {
    if (phase !== 'in_progress' || !session?.checkInAt) return
    const from = new Date(session.checkInAt).getTime()
    const tick = () => setElapsed(Math.floor((Date.now() - from) / 1000))
    tick()
    tickRef.current = setInterval(tick, 1000)
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [phase, session?.checkInAt])

  async function doCheckIn() {
    if (!booking || !partnerId || !session) return
    const block = canCheckIn(session)
    if (block) { setNotice(CHECK_IN_BLOCK_MESSAGES[block]); return }

    setBusy(true); setNotice(null)
    // La ubicación nunca bloquea: si no la da, el check-in sigue igual.
    const loc: GeoPoint | null = await requestGeoPoint()
    const ok = await persistCheckIn(booking.id, partnerId, loc)
    setBusy(false)
    if (!ok) { setNotice('No pudimos registrar la llegada. Probá de nuevo.'); return }
    await reload()
  }

  async function doVerifyPin() {
    if (!booking || !partnerId || !session) return
    const result = verifyPin(expectedPin, pinInput, session.pinAttempts)

    if (!result.ok) {
      setPinError(PIN_ERROR_MESSAGES[result.reason])
      // Solo persistimos si consumió intento: un tipeo no queda registrado.
      if (result.reason === 'WRONG_PIN') {
        await recordPinResult(booking.id, partnerId, false, session.pinAttempts + 1)
        await reload()
      }
      setPinInput('')
      return
    }

    setBusy(true); setPinError(null)
    await recordPinResult(booking.id, partnerId, true, session.pinAttempts)
    const fresh = await getSession(booking.id)
    if (fresh) {
      const startBlock = canStartVisit(fresh)
      if (startBlock) { setNotice(START_BLOCK_MESSAGES[startBlock]); setBusy(false); return }
      await persistStart(booking.id)
    }
    setBusy(false)
    await reload()
  }

  async function toggleChecklist(id: string) {
    if (!booking || !session) return
    const next = { ...session.checklistState, [id]: !session.checklistState[id] }
    setSession({ ...session, checklistState: next })
    await saveChecklist(booking.id, next)
  }

  async function doCheckOut() {
    if (!booking || !partnerId || !session) return
    const block = canCheckOut(session, booking.serviceType)
    if (block) {
      setNotice(
        block.reason === 'NOT_IN_PROGRESS'
          ? 'La visita no está en curso.'
          : `Falta completar: ${block.missing.map(m => m.label).join(', ')}`,
      )
      return
    }
    setBusy(true); setNotice(null)
    const loc = await requestGeoPoint()
    const mins = session.checkInAt ? durationMinutes(session.checkInAt, new Date().toISOString()) : 0
    const ok = await persistCheckOut(booking.id, partnerId, loc, mins)
    setBusy(false)
    if (!ok) { setNotice('No pudimos cerrar la visita. Probá de nuevo.'); return }
    await reload()
  }

  async function submitIncident(category: IncidentCategory, severity: IncidentSeverity, description: string) {
    if (!booking) return
    setBusy(true)
    const loc = await requestGeoPoint()
    await reportIncident({ bookingId: booking.id, category, severity, description, location: loc })
    setBusy(false)
    setIncidentOpen(false)
    setNotice('Incidente registrado. Soporte de VARA lo va a revisar.')
    await reload()
  }

  // ───────────────────────── Estados de carga ─────────────────────────

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-slate-500" aria-hidden="true" />
      </div>
    )
  }

  if (phase === 'not_found' || !booking) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
        <div className="text-center max-w-xs">
          <AlertTriangle size={32} className="text-amber-400 mx-auto mb-3" aria-hidden="true" />
          <h1 className="font-bold text-lg">No encontramos esta visita</h1>
          <p className="text-sm text-slate-400 mt-2">
            Verificá el código. Si el problema sigue, contactá a soporte de VARA.
          </p>
          <Link href="/partner" className="inline-block mt-5 text-sm font-semibold text-brand-400 underline">
            Volver a mis visitas
          </Link>
        </div>
      </div>
    )
  }

  const items = checklistFor(booking.serviceType)
  const progress = session
    ? checklistProgress(session, booking.serviceType)
    : { done: 0, total: 0, percent: 0 }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-28">
      <header className="px-5 pt-6 pb-4">
        <p className="font-mono text-[11px] text-slate-500">{booking.visitCode}</p>
        <h1 className="text-xl font-extrabold mt-1">{SERVICE_LABELS[booking.serviceType]}</h1>
        <p className="flex items-center gap-1.5 text-sm text-slate-400 mt-1">
          <MapPin size={13} aria-hidden="true" />{booking.locationLabel}
        </p>
        <p className="flex items-center gap-1.5 text-sm text-slate-400">
          <Clock size={13} aria-hidden="true" />
          {booking.requestedDate} · {booking.requestedTime} · {booking.durationMinutes} min
        </p>
        <span className="inline-block mt-3 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold">
          {VISIT_STATUS_LABELS[booking.status]}
        </span>
      </header>

      {notice && (
        <div className="mx-5 mb-4 rounded-xl bg-amber-500/15 border border-amber-500/30 px-3 py-2.5 flex items-start gap-2">
          <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs text-amber-100 flex-1">{notice}</p>
          <button onClick={() => setNotice(null)} aria-label="Cerrar aviso">
            <X size={14} className="text-amber-400" aria-hidden="true" />
          </button>
        </div>
      )}

      <main className="px-5 space-y-4">
        {/* ─────────── Antes de entrar ─────────── */}
        {phase === 'pre_checkin' && (
          <>
            {booking.instructions && (
              <InfoBlock title="Indicaciones del cliente" body={booking.instructions} />
            )}
            {booking.accessInstructions && (
              <InfoBlock title="Cómo entrar" body={booking.accessInstructions} confidential />
            )}
            {booking.guestsExpected !== null && (
              <InfoBlock
                title="Personas esperadas"
                body={`${booking.guestsExpected}. Si llegan más, registralo antes de abrir.`}
              />
            )}

            <button onClick={doCheckIn} disabled={busy}
              className="w-full rounded-2xl bg-brand-500 hover:bg-brand-400 disabled:opacity-50 py-5 text-base font-bold text-white transition-colors flex items-center justify-center gap-2">
              {busy
                ? <><Loader2 size={18} className="animate-spin" aria-hidden="true" /> Registrando…</>
                : <><MapPin size={18} aria-hidden="true" /> Llegué a la propiedad</>}
            </button>
            <p className="text-[11px] text-slate-500 text-center">
              Registramos la hora y, si el celular la da, la ubicación. Si no la da, igual podés seguir.
            </p>
          </>
        )}

        {/* ─────────── PIN ─────────── */}
        {phase === 'pin' && session && (
          <>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-5 text-center">
              <KeyRound size={22} className="text-brand-400 mx-auto mb-2" aria-hidden="true" />
              <h2 className="font-bold">Pedile el PIN al cliente</h2>
              <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                Son 4 números. Sin este paso la visita no puede empezar.
              </p>

              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={4}
                value={pinInput}
                onChange={e => { setPinInput(e.target.value.replace(/\D/g, '')); setPinError(null) }}
                aria-label="PIN de la visita"
                className="mt-4 w-40 mx-auto block rounded-xl bg-slate-900 border border-white/20 px-4 py-3 text-center text-2xl font-bold tracking-[0.4em] text-white"
              />

              {pinError && <p className="text-xs text-red-400 mt-2">{pinError}</p>}

              <p className="text-[11px] text-slate-500 mt-2">
                Intentos usados: {session.pinAttempts} de 3
              </p>

              <button onClick={doVerifyPin} disabled={busy || pinInput.length !== 4}
                className="mt-4 w-full rounded-xl bg-brand-500 hover:bg-brand-400 disabled:opacity-40 py-4 text-sm font-bold text-white transition-colors">
                {busy ? 'Verificando…' : 'Confirmar identidad'}
              </button>
            </div>

            <p className="text-[11px] text-slate-500 text-center">
              Si el cliente no puede darte el PIN, no inicies la visita. Contactá a soporte.
            </p>
          </>
        )}

        {/* ─────────── Visita en curso ─────────── */}
        {phase === 'in_progress' && session && (
          <>
            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-400">
                Identidad confirmada · Visita en curso
              </p>
              <p className="text-4xl font-extrabold tabular-nums mt-2">{formatElapsed(elapsed)}</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Programada: {booking.durationMinutes} minutos
              </p>
            </div>

            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-sm">Checklist</h2>
                <span className="text-[11px] text-slate-400">
                  {progress.done} de {progress.total}
                </span>
              </div>
              <div className="space-y-2">
                {items.map(i => {
                  const done = !!session.checklistState[i.id]
                  return (
                    <button key={i.id} onClick={() => toggleChecklist(i.id)}
                      className="w-full flex items-center gap-3 rounded-xl bg-white/5 px-3 py-3.5 text-left transition-colors hover:bg-white/10">
                      <span className={cn(
                        'w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 border',
                        done ? 'bg-emerald-500 border-emerald-500' : 'border-white/30',
                      )}>
                        {done && <Check size={14} className="text-white" aria-hidden="true" />}
                      </span>
                      <span className={cn('text-sm flex-1', done ? 'text-slate-400 line-through' : 'text-white')}>
                        {i.label}
                      </span>
                      {i.required && !done && (
                        <span className="text-[10px] text-amber-400 font-semibold">Obligatorio</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <button onClick={doCheckOut} disabled={busy}
              className="w-full rounded-2xl bg-white text-slate-900 hover:bg-slate-100 disabled:opacity-50 py-5 text-base font-bold transition-colors flex items-center justify-center gap-2">
              {busy
                ? <><Loader2 size={18} className="animate-spin" aria-hidden="true" /> Cerrando…</>
                : <><LogOut size={18} aria-hidden="true" /> Finalizar visita</>}
            </button>
            <p className="text-[11px] text-slate-500 text-center">
              No cierres la app sin finalizar: esto es lo que registra tu salida.
            </p>
          </>
        )}

        {/* ─────────── Cerrada ─────────── */}
        {phase === 'done' && session && (
          <>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-5 text-center">
              <Check size={26} className="text-emerald-400 mx-auto mb-2" aria-hidden="true" />
              <h2 className="font-bold">Visita finalizada</h2>
              <p className="text-sm text-slate-400 mt-1">
                Duración registrada: {session.durationMinutes ?? 0} minutos
              </p>
            </div>
            <Link href={`/visit/${code}/reporte`}
              className="block w-full rounded-2xl bg-brand-500 hover:bg-brand-400 py-5 text-center text-base font-bold text-white transition-colors">
              Cargar el reporte
            </Link>
            <p className="text-[11px] text-slate-500 text-center">
              El reporte es parte del servicio. Sin él la visita queda incompleta.
            </p>
          </>
        )}
      </main>

      {/* Ayuda: siempre visible, nunca dentro de un menú. */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur border-t border-white/10 px-5 py-3 flex gap-2">
        <button onClick={() => setHelpOpen(true)}
          className="flex-1 rounded-xl bg-white/10 hover:bg-white/15 py-3.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
          <LifeBuoy size={16} aria-hidden="true" /> Necesito ayuda
        </button>
        <button onClick={() => setIncidentOpen(true)}
          className="flex-1 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 py-3.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
          <ShieldAlert size={16} aria-hidden="true" /> Reportar problema
        </button>
      </div>

      {helpOpen && <HelpSheet onClose={() => setHelpOpen(false)} visitCode={booking.visitCode} />}
      {incidentOpen && (
        <IncidentSheet busy={busy} onClose={() => setIncidentOpen(false)} onSubmit={submitIncident} />
      )}
    </div>
  )
}
