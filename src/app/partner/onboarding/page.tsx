'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, ArrowRight, Check, Loader2, Plus, X, ShieldCheck,
  Lock, AlertTriangle, BookOpen, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ONBOARDING_STEPS, ONBOARDING_STEP_LABELS, REFERENCE_QUESTIONS,
  MIN_REFERENCES_REQUIRED, QUIZ_PASSING_SCORE, MAX_QUIZ_ATTEMPTS,
  PRICE_BANDS, bandFor,
  type PartnerOnboardingStep, type PartnerPublicProfile,
  type PartnerReference, type PartnerTraining, type PartnerVerification,
  type VisitServiceType,
} from '@/types/varaVisit'
import { TRAINING_MODULES, QUIZ_QUESTIONS, gradeQuiz } from '@/data/visitTraining'
import {
  getMyPartner, createMyPartner, updateMyPartner, saveMyContact,
  listMyReferences, addReference, deleteReference,
  getMyTraining, markModuleCompleted, saveQuizResult,
  getMyVerification, hasSession,
} from '@/lib/supabase/visits'
import { isRateWithinBand } from '@/lib/varaVisit/pricing'

/**
 * Alta de Visit Partner — 7 pasos.
 *
 * Tres cosas que el partner tiene que entender desde el principio, y que la
 * pantalla dice explícitamente:
 *
 * 1. Subir documentos no lo habilita. La habilitación la da VARA.
 * 2. Los pasos 3, 5 y 7 (identidad, entrevista, visitas supervisadas) los
 *    resuelve una persona de VARA. Acá se envía y se espera. Fingir que son
 *    automáticos generaría la expectativa de quedar activo en cinco minutos.
 * 3. Lo que se carga en "zona de trabajo" es aproximado a propósito: el
 *    domicilio exacto se guarda aparte y nunca se muestra a un cliente.
 */

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 p-5">
      <h2 className="font-bold text-slate-900">{title}</h2>
      {hint && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{hint}</p>}
      <div className="mt-4">{children}</div>
    </div>
  )
}

function Field({
  id, label, hint, ...rest
}: {
  id: string
  label: string
  hint?: string
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="text-xs font-semibold text-slate-600 block mb-1.5">{label}</label>
      <input id={id} {...rest}
        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
      {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  )
}

/** Aviso de paso manual. Se repite porque es la expectativa más importante. */
function ManualNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
      <AlertTriangle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
      <p className="text-xs text-amber-900 leading-relaxed">{children}</p>
    </div>
  )
}

function PersonalStep({
  partner, onSaved,
}: {
  partner: PartnerPublicProfile | null
  onSaved: () => void
}) {
  const [name, setName] = useState(partner?.displayName ?? '')
  const [profession, setProfession] = useState(partner?.profession ?? '')
  const [years, setYears] = useState(partner?.experienceYears?.toString() ?? '')
  const [bio, setBio] = useState(partner?.bio ?? '')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!name.trim()) return
    setBusy(true)
    const draft = {
      displayName: name.trim(),
      profession: profession.trim() || undefined,
      experienceYears: years ? Number(years) : undefined,
      bio: bio.trim() || undefined,
    }
    let id: string | null = partner?.id ?? null
    if (partner) await updateMyPartner(partner.id, draft)
    else id = await createMyPartner(draft)
    if (id) await saveMyContact(id, { phone: phone.trim(), email: email.trim() })
    setBusy(false)
    onSaved()
  }

  return (
    <div className="space-y-4">
      <Card title="Tus datos" hint="El nombre y la profesión se muestran en tu perfil público.">
        <div className="space-y-3">
          <Field id="name" label="Nombre y apellido" value={name}
            onChange={e => setName(e.target.value)} placeholder="Como querés que te vean" />
          <Field id="prof" label="Profesión u ocupación" value={profession}
            onChange={e => setProfession(e.target.value)} placeholder="Ej: Corredor inmobiliario" />
          <Field id="years" label="Años de experiencia" type="number" min={0} max={60}
            value={years} onChange={e => setYears(e.target.value)} />
          <div>
            <label htmlFor="bio" className="text-xs font-semibold text-slate-600 block mb-1.5">
              Presentación breve
            </label>
            <textarea id="bio" rows={3} maxLength={280} value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Qué zona conocés, cómo trabajás."
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm resize-none" />
          </div>
        </div>
      </Card>

      <Card
        title="Cómo te contactamos"
        hint="Esto NO se muestra en tu perfil público. Lo usa VARA para coordinar."
      >
        <div className="space-y-3">
          <Field id="phone" label="Teléfono" value={phone} inputMode="tel"
            onChange={e => setPhone(e.target.value)} placeholder="+54 9 ..." />
          <Field id="email" label="Email" type="email" value={email}
            onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
          <Lock size={13} className="text-slate-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Tu teléfono queda en una tabla aparte del perfil público. Un cliente que mira
            el marketplace no puede verlo.
          </p>
        </div>
      </Card>

      <button onClick={save} disabled={busy || !name.trim()}
        className="w-full rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-40 py-3 text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2">
        {busy
          ? <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          : <>Guardar y continuar <ArrowRight size={15} aria-hidden="true" /></>}
      </button>
    </div>
  )
}

function ZoneStep({ partner, onSaved }: { partner: PartnerPublicProfile; onSaved: () => void }) {
  const [homeZone, setHomeZone] = useState(partner.homeZoneLabel)
  const [zones, setZones] = useState<string[]>(partner.coverageZones)
  const [zoneDraft, setZoneDraft] = useState('')
  const [radius, setRadius] = useState(String(partner.maxTravelRadiusKm))
  const [services, setServices] = useState<VisitServiceType[]>(partner.serviceTypes)
  const [duration, setDuration] = useState(30)
  const [rate, setRate] = useState(String(partner.ratePerVisit || bandFor(30).defaultPrice))
  const [busy, setBusy] = useState(false)

  const band = bandFor(duration)
  const rateOk = isRateWithinBand(Number(rate), duration)

  async function save() {
    setBusy(true)
    await updateMyPartner(partner.id, {
      homeZoneLabel: homeZone.trim(),
      coverageZones: zones,
      maxTravelRadiusKm: Number(radius) || 10,
      serviceTypes: services,
      ratePerVisit: Number(rate),
    })
    setBusy(false)
    onSaved()
  }

  function toggleService(s: VisitServiceType) {
    setServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  function addZone() {
    const z = zoneDraft.trim()
    if (!z) return
    setZones([...zones, z])
    setZoneDraft('')
  }

  return (
    <div className="space-y-4">
      <Card
        title="Dónde trabajás"
        hint="Priorizamos el matching local: un partner que conoce la zona hace mejor el trabajo."
      >
        <div className="space-y-3">
          <Field id="home" label="Zona donde trabajás habitualmente" value={homeZone}
            onChange={e => setHomeZone(e.target.value)} placeholder="Ej: Pilar, Buenos Aires"
            hint="Aproximada. Nunca publicamos tu domicilio: al cliente le decimos que trabajás habitualmente en esta zona." />

          <div>
            <span className="text-xs font-semibold text-slate-600 block mb-1.5">
              Otros barrios que cubrís
            </span>
            {zones.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {zones.map(z => (
                  <span key={z} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-700">
                    {z}
                    <button onClick={() => setZones(zones.filter(x => x !== z))} aria-label={`Quitar ${z}`}>
                      <X size={11} aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input value={zoneDraft} onChange={e => setZoneDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addZone() } }}
                aria-label="Agregar barrio"
                placeholder="Ej: Del Viso"
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
              <button onClick={addZone} aria-label="Agregar barrio"
                className="rounded-xl bg-slate-900 px-3.5 text-white">
                <Plus size={15} aria-hidden="true" />
              </button>
            </div>
          </div>

          <Field id="radius" label="Radio máximo (km)" type="number" min={1} max={100}
            value={radius} onChange={e => setRadius(e.target.value)} />
        </div>
      </Card>

      <Card title="Qué servicios ofrecés">
        <div className="space-y-2">
          {([
            ['SHOW_PROPERTY', 'Mostrar propiedades', 'Recibís interesados en una propiedad del cliente.'],
            ['ACCOMPANY_VISIT', 'Acompañar visitas', 'Vas con un comprador a conocer una propiedad.'],
          ] as [VisitServiceType, string, string][]).map(([v, label, desc]) => (
            <button key={v} onClick={() => toggleService(v)}
              className={cn(
                'w-full text-left rounded-xl border p-3 transition-colors',
                services.includes(v) ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:border-slate-300',
              )}>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'w-4 h-4 rounded flex items-center justify-center flex-shrink-0',
                  services.includes(v) ? 'bg-brand-600' : 'border border-slate-300',
                )}>
                  {services.includes(v) && <Check size={11} className="text-white" aria-hidden="true" />}
                </span>
                <span className="text-sm font-semibold text-slate-900">{label}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 ml-6">{desc}</p>
            </button>
          ))}
        </div>
      </Card>

      <Card
        title="Tu precio"
        hint="VARA define una banda por duración. Podés elegir dentro de ese rango."
      >
        <div className="flex gap-2 mb-3">
          {PRICE_BANDS.map(b => (
            <button key={b.durationMinutes}
              onClick={() => { setDuration(b.durationMinutes); setRate(String(b.defaultPrice)) }}
              className={cn(
                'flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors',
                duration === b.durationMinutes
                  ? 'border-brand-400 bg-brand-50 text-brand-700'
                  : 'border-slate-200 text-slate-600',
              )}>
              {b.durationMinutes} min
            </button>
          ))}
        </div>
        <Field id="rate" label={`Tu precio (${band.currency} ${band.minPrice}–${band.maxPrice})`}
          type="number" min={band.minPrice} max={band.maxPrice}
          value={rate} onChange={e => setRate(e.target.value)} />
        {!rateOk && (
          <p className="text-[11px] text-red-600 mt-1">
            Tiene que estar entre {band.currency} {band.minPrice} y {band.maxPrice}.
          </p>
        )}
      </Card>

      <button onClick={save} disabled={busy || !homeZone.trim() || services.length === 0 || !rateOk}
        className="w-full rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-40 py-3 text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2">
        {busy
          ? <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          : <>Guardar y continuar <ArrowRight size={15} aria-hidden="true" /></>}
      </button>
    </div>
  )
}

function IdentityStep({
  verification, onNext,
}: {
  verification: PartnerVerification | null
  onNext: () => void
}) {
  const verified = verification?.identityStatus === 'VERIFIED'
  return (
    <div className="space-y-4">
      <Card
        title="Verificación de identidad"
        hint="Es el paso que sostiene todo lo demás. Sin identidad verificada no se te asigna ninguna visita."
      >
        <ManualNotice>
          <strong>Este paso lo hace una persona de VARA.</strong> En el piloto coordinamos
          la validación de DNI y selfie por un canal seguro — todavía no hay carga de
          documentos en la plataforma, y preferimos no fingir que la hay.
        </ManualNotice>

        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold text-slate-600">Qué vamos a verificar:</p>
          <ul className="space-y-1.5">
            {['DNI frente y dorso', 'Selfie con el documento', 'Teléfono', 'Email'].map(x => (
              <li key={x} className="flex items-center gap-2 text-sm text-slate-700">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" aria-hidden="true" />{x}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
          <Lock size={13} className="text-slate-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Al cliente nunca le mostramos tu DNI. Ve únicamente
            &ldquo;✓ Identidad verificada&rdquo;.
          </p>
        </div>

        {verified && (
          <p className="mt-4 flex items-center gap-2 text-sm text-emerald-700 font-medium">
            <ShieldCheck size={15} aria-hidden="true" /> Tu identidad ya está verificada.
          </p>
        )}
      </Card>

      <button onClick={onNext}
        className="w-full rounded-xl bg-brand-600 hover:bg-brand-700 py-3 text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2">
        Continuar <ArrowRight size={15} aria-hidden="true" />
      </button>
    </div>
  )
}

function ReferencesStep({
  partnerId, references, onChanged, onNext,
}: {
  partnerId: string
  references: PartnerReference[]
  onChanged: () => void
  onNext: () => void
}) {
  const [name, setName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [contact, setContact] = useState('')
  const [busy, setBusy] = useState(false)

  async function add() {
    if (!name.trim() || !relationship.trim()) return
    setBusy(true)
    await addReference(partnerId, {
      name: name.trim(),
      relationship: relationship.trim(),
      contactEmail: contact.includes('@') ? contact.trim() : undefined,
      contactPhone: contact.includes('@') ? undefined : contact.trim(),
    })
    setName(''); setRelationship(''); setContact('')
    setBusy(false)
    onChanged()
  }

  const enough = references.length >= MIN_REFERENCES_REQUIRED

  return (
    <div className="space-y-4">
      <Card
        title={`Referencias (mínimo ${MIN_REFERENCES_REQUIRED})`}
        hint="Personas que puedan responder por vos. Las contactamos nosotros."
      >
        <ManualNotice>
          <strong>El contacto lo hace VARA.</strong> Todavía no enviamos mails automáticos:
          una persona del equipo llama o escribe y carga la respuesta.
        </ManualNotice>

        {references.length > 0 && (
          <ul className="mt-4 space-y-2">
            {references.map(r => (
              <li key={r.id} className="flex items-start gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{r.name}</p>
                  <p className="text-[11px] text-slate-500">{r.relationship}</p>
                </div>
                <span className={cn(
                  'rounded-lg px-2 py-0.5 text-[10px] font-bold flex-shrink-0',
                  r.status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-700'
                    : r.status === 'FAILED' ? 'bg-red-50 text-red-700'
                    : 'bg-slate-200 text-slate-600',
                )}>
                  {r.status === 'VERIFIED' ? 'Verificada'
                    : r.status === 'REQUESTED' ? 'Contactada'
                    : r.status === 'RESPONDED' ? 'Respondió'
                    : r.status === 'FAILED' ? 'No pudimos validarla'
                    : 'Pendiente'}
                </span>
                <button onClick={async () => { await deleteReference(r.id); onChanged() }}
                  aria-label={`Quitar ${r.name}`}
                  className="text-slate-400 hover:text-red-500 flex-shrink-0">
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 space-y-2.5 border-t border-slate-100 pt-4">
          <Field id="rname" label="Nombre" value={name} onChange={e => setName(e.target.value)} />
          <Field id="rrel" label="Relación" value={relationship}
            onChange={e => setRelationship(e.target.value)}
            placeholder="Ej: Ex jefe, colega, cliente" />
          <Field id="rcon" label="Email o teléfono" value={contact}
            onChange={e => setContact(e.target.value)} />
          <button onClick={add} disabled={busy || !name.trim() || !relationship.trim()}
            className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 py-2.5 text-sm font-semibold text-white transition-colors">
            Agregar referencia
          </button>
        </div>
      </Card>

      <Card title="Qué les vamos a preguntar" hint="Para que sepas qué esperar.">
        <ul className="space-y-1.5">
          {REFERENCE_QUESTIONS.map(q => (
            <li key={q.key} className="flex items-start gap-2 text-sm text-slate-700">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0 mt-1.5" aria-hidden="true" />
              {q.question}
            </li>
          ))}
        </ul>
      </Card>

      <button onClick={onNext} disabled={!enough}
        className="w-full rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-40 py-3 text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2">
        {enough
          ? <>Continuar <ArrowRight size={15} aria-hidden="true" /></>
          : `Cargá al menos ${MIN_REFERENCES_REQUIRED} referencias`}
      </button>
    </div>
  )
}

function InterviewStep({
  verification, onNext,
}: {
  verification: PartnerVerification | null
  onNext: () => void
}) {
  const status = verification?.interviewStatus ?? 'NOT_STARTED'
  return (
    <div className="space-y-4">
      <Card title="Entrevista" hint="Una conversación de 20 minutos con alguien de VARA.">
        <ManualNotice>
          <strong>La coordinamos nosotros.</strong> Cuando tengas las referencias cargadas
          y la identidad verificada, te escribimos para agendarla.
        </ManualNotice>
        <p className="text-sm text-slate-600 mt-4 leading-relaxed">
          No es un examen. Queremos entender cómo resolverías situaciones concretas:
          alguien que llega con más gente de la informada, un acceso que no funciona,
          una pregunta sobre el precio.
        </p>
        <p className="mt-4 text-xs font-semibold text-slate-600">
          Estado: <span className="text-slate-900">
            {status === 'VERIFIED' ? 'Aprobada'
              : status === 'IN_REVIEW' ? 'Agendada'
              : status === 'REJECTED' ? 'No aprobada'
              : 'Pendiente'}
          </span>
        </p>
      </Card>

      <button onClick={onNext}
        className="w-full rounded-xl bg-brand-600 hover:bg-brand-700 py-3 text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2">
        Continuar a la capacitación <ArrowRight size={15} aria-hidden="true" />
      </button>
    </div>
  )
}

function Quiz({
  partnerId, attemptsLeft, onDone,
}: {
  partnerId: string
  attemptsLeft: number
  onDone: () => void
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [result, setResult] = useState<ReturnType<typeof gradeQuiz> | null>(null)
  const [busy, setBusy] = useState(false)

  const complete = QUIZ_QUESTIONS.every(q => answers[q.id] !== undefined)

  async function submit() {
    setBusy(true)
    const r = gradeQuiz(answers)
    const passed = r.score >= QUIZ_PASSING_SCORE
    await saveQuizResult(partnerId, Number(r.score.toFixed(3)), passed)
    setResult(r)
    setBusy(false)
  }

  if (result) {
    const passed = result.score >= QUIZ_PASSING_SCORE
    return (
      <Card title={passed ? 'Aprobaste' : 'No alcanzó'}>
        <p className="text-3xl font-extrabold text-slate-900">
          {Math.round(result.score * 100)}%
        </p>
        <p className="text-sm text-slate-500 mt-1">
          {result.correct} de {result.total} correctas · se necesita {Math.round(QUIZ_PASSING_SCORE * 100)}%
        </p>

        {/* Las explicaciones se muestran siempre: el examen también enseña. */}
        {result.wrong.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-bold text-slate-600 mb-2">Lo que conviene repasar:</p>
            <ul className="space-y-2.5">
              {result.wrong.map(q => (
                <li key={q.id} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-sm font-medium text-slate-800">{q.question}</p>
                  <p className="text-xs text-emerald-700 mt-1.5">
                    Correcta: {q.options[q.correctIndex]}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">{q.explanation}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button onClick={onDone}
          className="mt-5 w-full rounded-xl bg-brand-600 hover:bg-brand-700 py-3 text-sm font-semibold text-white transition-colors">
          Volver
        </button>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <Card title="Examen de certificación"
        hint={`${QUIZ_QUESTIONS.length} preguntas. Te quedan ${attemptsLeft} intentos.`}>
        <div className="space-y-5">
          {QUIZ_QUESTIONS.map((q, i) => (
            <fieldset key={q.id}>
              <legend className="text-sm font-semibold text-slate-800 mb-2">
                {i + 1}. {q.question}
              </legend>
              <div className="space-y-1.5">
                {q.options.map((o, oi) => (
                  <label key={oi} className={cn(
                    'flex items-start gap-2.5 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors',
                    answers[q.id] === oi ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:border-slate-300',
                  )}>
                    <input type="radio" name={q.id} checked={answers[q.id] === oi}
                      onChange={() => setAnswers(a => ({ ...a, [q.id]: oi }))}
                      className="mt-0.5" />
                    <span className="text-sm text-slate-700">{o}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </Card>

      <button onClick={submit} disabled={!complete || busy}
        className="w-full rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-40 py-3 text-sm font-semibold text-white transition-colors">
        {busy ? 'Corrigiendo…' : complete ? 'Entregar examen' : 'Respondé todas las preguntas'}
      </button>
    </div>
  )
}

function TrainingStep({
  partnerId, training, onChanged, onNext,
}: {
  partnerId: string
  training: PartnerTraining | null
  onChanged: () => void
  onNext: () => void
}) {
  const [openModule, setOpenModule] = useState<string | null>(null)
  const [quizOpen, setQuizOpen] = useState(false)
  const done = new Set(training?.modulesCompleted ?? [])
  const allDone = TRAINING_MODULES.every(m => done.has(m.id))
  const certified = training?.certificationStatus === 'CERTIFIED'
  const attemptsLeft = MAX_QUIZ_ATTEMPTS - (training?.quizAttempts ?? 0)

  if (quizOpen) {
    return <Quiz partnerId={partnerId} attemptsLeft={attemptsLeft}
      onDone={async () => { onChanged(); setQuizOpen(false) }} />
  }

  return (
    <div className="space-y-4">
      <Card
        title="VARA Visit Certification"
        hint={`${TRAINING_MODULES.length} módulos y un examen de ${QUIZ_QUESTIONS.length} preguntas. Se aprueba con ${Math.round(QUIZ_PASSING_SCORE * 100)}%.`}
      >
        {certified && (
          <p className="mb-4 flex items-center gap-2 text-sm text-emerald-700 font-medium">
            <ShieldCheck size={15} aria-hidden="true" /> Certificación aprobada
          </p>
        )}

        <ul className="space-y-1.5">
          {TRAINING_MODULES.map(m => (
            <li key={m.id}>
              <button onClick={() => setOpenModule(openModule === m.id ? null : m.id)}
                className="w-full flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-left hover:bg-slate-100 transition-colors">
                <span className={cn(
                  'w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-[10px] font-bold',
                  done.has(m.id) ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500',
                )}>
                  {done.has(m.id) ? <Check size={11} aria-hidden="true" /> : m.order}
                </span>
                <span className="text-sm text-slate-800 flex-1">{m.title}</span>
                <BookOpen size={13} className="text-slate-400 flex-shrink-0" aria-hidden="true" />
              </button>

              {openModule === m.id && (
                <div className="mt-1.5 rounded-xl border border-slate-200 p-3.5">
                  <p className="text-xs text-slate-500">{m.summary}</p>
                  <ul className="mt-2.5 space-y-1.5">
                    {m.keyPoints.map(p => (
                      <li key={p} className="flex items-start gap-2 text-sm text-slate-700 leading-relaxed">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0 mt-1.5" aria-hidden="true" />
                        {p}
                      </li>
                    ))}
                  </ul>
                  <button onClick={async () => { await markModuleCompleted(partnerId, m.id); onChanged() }}
                    className="mt-3 w-full rounded-lg bg-slate-900 hover:bg-slate-800 py-2 text-xs font-semibold text-white transition-colors">
                    {done.has(m.id) ? 'Leído' : 'Marcar como leído'}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {!certified && (
        <button onClick={() => setQuizOpen(true)} disabled={!allDone || attemptsLeft <= 0}
          className="w-full rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-40 py-3 text-sm font-semibold text-white transition-colors">
          {!allDone ? 'Leé todos los módulos para rendir'
            : attemptsLeft <= 0 ? 'Sin intentos disponibles — contactá a VARA'
            : `Rendir el examen (${attemptsLeft} intento${attemptsLeft > 1 ? 's' : ''})`}
        </button>
      )}

      {certified && (
        <button onClick={onNext}
          className="w-full rounded-xl bg-brand-600 hover:bg-brand-700 py-3 text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2">
          Continuar <ArrowRight size={15} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

function SupervisedStep({ verification }: { verification: PartnerVerification | null }) {
  const completed = verification?.supervisedVisitsCompleted ?? 0
  const required = 3
  return (
    <div className="space-y-4">
      <Card
        title="Visitas supervisadas"
        hint="Las primeras visitas las hacés acompañado por alguien de VARA."
      >
        <p className="text-sm text-slate-600 leading-relaxed">
          Nadie queda habilitado solo por haber subido documentos y aprobado un examen.
          Las primeras tres visitas se hacen acompañadas, y recién después se te asignan
          visitas propias.
        </p>

        <div className="mt-4 rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-semibold text-slate-600">Progreso</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">
            {completed} <span className="text-base font-medium text-slate-400">de {required}</span>
          </p>
          <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-brand-500 rounded-full transition-all"
              style={{ width: `${Math.min((completed / required) * 100, 100)}%` }} />
          </div>
        </div>

        <div className="mt-4">
          <ManualNotice>
            <strong>Las coordina VARA.</strong> Te contactamos cuando tengas el resto del
            alta aprobado.
          </ManualNotice>
        </div>
      </Card>

      <Link href="/partner"
        className="block w-full rounded-xl bg-brand-600 hover:bg-brand-700 py-3 text-center text-sm font-semibold text-white transition-colors">
        Volver al portal
      </Link>
    </div>
  )
}

export default function PartnerOnboardingPage() {
  const [loading, setLoading] = useState(true)
  const [signedIn, setSignedIn] = useState(false)
  const [partner, setPartner] = useState<PartnerPublicProfile | null>(null)
  const [references, setReferences] = useState<PartnerReference[]>([])
  const [training, setTraining] = useState<PartnerTraining | null>(null)
  const [verification, setVerification] = useState<PartnerVerification | null>(null)
  const [step, setStep] = useState<PartnerOnboardingStep>('PERSONAL_DATA')

  const load = useCallback(async () => {
    const ok = await hasSession()
    setSignedIn(ok)
    if (ok) {
      const me = await getMyPartner()
      setPartner(me)
      if (me) {
        setReferences(await listMyReferences(me.id))
        setTraining(await getMyTraining(me.id))
        setVerification(await getMyVerification(me.id))
      }
    }
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

  if (!signedIn) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200/70 p-6 text-center">
          <h1 className="font-bold text-slate-900">Necesitás una cuenta</h1>
          <p className="text-sm text-slate-500 mt-2">
            El alta de Visit Partner queda asociada a tu cuenta de VARA.
          </p>
          <Link href="/login"
            className="inline-block mt-5 rounded-xl bg-brand-600 hover:bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors">
            Entrar o crear cuenta
          </Link>
        </div>
      </div>
    )
  }

  const idx = ONBOARDING_STEPS.indexOf(step)

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 lg:px-6 py-6">
        <Link href="/partner"
          className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm mb-4 transition-colors">
          <ArrowLeft size={14} aria-hidden="true" /> Volver al portal
        </Link>

        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Alta de Visit Partner
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Paso {idx + 1} de {ONBOARDING_STEPS.length}: {ONBOARDING_STEP_LABELS[step]}
        </p>

        {/* Los pasos posteriores se desbloquean recién cuando existe el perfil. */}
        <nav className="flex flex-wrap gap-1.5 mt-4" aria-label="Pasos del alta">
          {ONBOARDING_STEPS.map((s, i) => {
            const reachable = i <= idx || !!partner
            return (
              <button key={s} onClick={() => reachable && setStep(s)} disabled={!reachable}
                aria-current={s === step ? 'step' : undefined}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors',
                  s === step ? 'bg-brand-600 text-white'
                    : i < idx ? 'bg-brand-50 text-brand-700'
                    : reachable ? 'bg-white border border-slate-200 text-slate-500'
                    : 'bg-slate-100 text-slate-300 cursor-not-allowed',
                )}>
                {i + 1}. {ONBOARDING_STEP_LABELS[s]}
              </button>
            )
          })}
        </nav>

        <div className="mt-5">
          {step === 'PERSONAL_DATA' && (
            <PersonalStep partner={partner} onSaved={async () => { await load(); setStep('WORK_ZONE') }} />
          )}
          {step === 'WORK_ZONE' && partner && (
            <ZoneStep partner={partner} onSaved={async () => { await load(); setStep('IDENTITY') }} />
          )}
          {step === 'IDENTITY' && (
            <IdentityStep verification={verification} onNext={() => setStep('REFERENCES')} />
          )}
          {step === 'REFERENCES' && partner && (
            <ReferencesStep partnerId={partner.id} references={references}
              onChanged={load} onNext={() => setStep('INTERVIEW')} />
          )}
          {step === 'INTERVIEW' && (
            <InterviewStep verification={verification} onNext={() => setStep('TRAINING')} />
          )}
          {step === 'TRAINING' && partner && (
            <TrainingStep partnerId={partner.id} training={training}
              onChanged={load} onNext={() => setStep('SUPERVISED_VISITS')} />
          )}
          {step === 'SUPERVISED_VISITS' && <SupervisedStep verification={verification} />}
        </div>
      </div>
    </div>
  )
}
