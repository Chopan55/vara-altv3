'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, X, Check, Loader2, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ISSUE_CATEGORY_LABELS, checklistFor,
  type VisitBooking, type VisitSession, type ReportedIssue,
} from '@/types/varaVisit'
import {
  getBookingByCode, getSession, getMyPartner, submitReport, getReport,
} from '@/lib/supabase/visits'

/**
 * Reporte de visita.
 *
 * El formulario está diseñado para empujar hacia HECHOS.
 *
 *   MAL:  "Los compradores estaban desesperados."
 *   BIEN: "Preguntaron dos veces cuál era el plazo mínimo para reservar."
 *
 * Por eso las preguntas están formuladas como "qué preguntaron" y "qué viste",
 * y no como "qué te pareció". VARA AI interpreta después, sobre hechos. Si el
 * partner interpreta, VARA razona sobre una opinión y se equivoca con confianza.
 *
 * Los ejemplos dentro de cada campo no son decoración: son el mecanismo por el
 * que alguien apurado entiende qué se espera sin leer el manual.
 */

/** Lista editable de textos cortos. Un ítem por vez, agregado uno por uno. */
function TextList({
  label, hint, placeholder, items, onChange,
}: {
  label: string
  hint: string
  placeholder: string
  items: string[]
  onChange: (next: string[]) => void
}) {
  const [draft, setDraft] = useState('')

  function add() {
    const v = draft.trim()
    if (!v) return
    onChange([...items, v])
    setDraft('')
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 p-4">
      <p className="text-sm font-bold text-slate-900">{label}</p>
      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{hint}</p>

      {items.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {items.map((it, i) => (
            <li key={`${it}-${i}`} className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2">
              <span className="text-sm text-slate-700 flex-1">{it}</span>
              <button
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                aria-label={`Quitar: ${it}`}
                className="text-slate-400 hover:text-red-500 flex-shrink-0"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 mt-3">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder={placeholder}
          aria-label={label}
          className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        />
        <button onClick={add} disabled={!draft.trim()}
          aria-label={`Agregar a ${label}`}
          className="rounded-xl bg-slate-900 disabled:bg-slate-200 px-3.5 text-white transition-colors">
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

function IssuesEditor({
  issues, onChange,
}: {
  issues: ReportedIssue[]
  onChange: (next: ReportedIssue[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<ReportedIssue['category']>('PROPERTY_CONDITION')
  const [severity, setSeverity] = useState<ReportedIssue['severity']>('MEDIUM')
  const [description, setDescription] = useState('')

  function add() {
    const d = description.trim()
    if (!d) return
    onChange([...issues, { id: `i-${Date.now()}`, category, severity, description: d }])
    setDescription('')
    setOpen(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 p-4">
      <p className="text-sm font-bold text-slate-900">Problemas detectados</p>
      <p className="text-[11px] text-slate-500 mt-0.5">
        Solo si hubo alguno. Un reporte sin problemas es un buen reporte.
      </p>

      {issues.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {issues.map(i => (
            <li key={i.id} className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2">
              <span className={cn(
                'rounded-md px-1.5 py-0.5 text-[10px] font-bold flex-shrink-0',
                i.severity === 'HIGH' ? 'bg-red-100 text-red-700'
                  : i.severity === 'MEDIUM' ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-200 text-slate-600',
              )}>
                {ISSUE_CATEGORY_LABELS[i.category]}
              </span>
              <span className="text-sm text-slate-700 flex-1">{i.description}</span>
              <button onClick={() => onChange(issues.filter(x => x.id !== i.id))}
                aria-label="Quitar problema" className="text-slate-400 hover:text-red-500 flex-shrink-0">
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <div className="mt-3 space-y-2">
          <select value={category} onChange={e => setCategory(e.target.value as ReportedIssue['category'])}
            aria-label="Categoría del problema"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
            {(Object.keys(ISSUE_CATEGORY_LABELS) as ReportedIssue['category'][]).map(c => (
              <option key={c} value={c}>{ISSUE_CATEGORY_LABELS[c]}</option>
            ))}
          </select>
          <div className="flex gap-2">
            {(['LOW', 'MEDIUM', 'HIGH'] as const).map(s => (
              <button key={s} onClick={() => setSeverity(s)}
                className={cn(
                  'flex-1 rounded-xl py-2 text-xs font-semibold transition-colors',
                  severity === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600',
                )}>
                {s === 'LOW' ? 'Menor' : s === 'MEDIUM' ? 'Medio' : 'Alto'}
              </button>
            ))}
          </div>
          <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)}
            aria-label="Descripción del problema"
            placeholder="Qué viste, dónde"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm resize-none" />
          <div className="flex gap-2">
            <button onClick={() => setOpen(false)}
              className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
              Cancelar
            </button>
            <button onClick={add} disabled={!description.trim()}
              className="flex-1 rounded-xl bg-slate-900 disabled:bg-slate-200 py-2 text-xs font-semibold text-white">
              Agregar
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)}
          className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline">
          <Plus size={13} aria-hidden="true" /> Agregar un problema
        </button>
      )}
    </div>
  )
}

export default function ReportePage() {
  const params = useParams()
  const router = useRouter()
  const code = typeof params.code === 'string' ? params.code : ''

  const [booking, setBooking] = useState<VisitBooking | null>(null)
  const [session, setSession] = useState<VisitSession | null>(null)
  const [partnerId, setPartnerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [attendees, setAttendees] = useState('')
  const [rooms, setRooms] = useState<string[]>([])
  const [questions, setQuestions] = useState<string[]>([])
  const [observations, setObservations] = useState<string[]>([])
  const [photoPaths, setPhotoPaths] = useState<string[]>([])
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [issues, setIssues] = useState<ReportedIssue[]>([])

  const load = useCallback(async () => {
    const b = await getBookingByCode(code)
    setBooking(b)
    if (b) {
      setSession(await getSession(b.id))
      const existing = await getReport(b.id)
      if (existing) {
        // Se puede volver a editar: un reporte a medias es mejor que ninguno,
        // y obligar a completarlo de una sola vez produce reportes apurados.
        setAttendees(String(existing.attendeesCount))
        setRooms(existing.roomsShown)
        setQuestions(existing.questionsAsked)
        setObservations(existing.observations)
        setIssues(existing.issues)
      }
    }
    setPartnerId((await getMyPartner())?.id ?? null)
    setLoading(false)
  }, [code])

  useEffect(() => { void load() }, [load])

  async function save() {
    if (!booking || !partnerId) return
    setSaving(true); setError(null)
    const ok = await submitReport(booking.id, partnerId, {
      attendeesCount: Number(attendees) || 0,
      roomsShown: rooms,
      questionsAsked: questions,
      observations,
      issues,
      photoPaths,
      checklistResults: session?.checklistState ?? {},
    })
    setSaving(false)
    if (!ok) { setError('No pudimos guardar el reporte. Probá de nuevo.'); return }
    setSaved(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-slate-500" aria-hidden="true" />
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
        <p className="text-sm text-slate-400">No encontramos esta visita.</p>
      </div>
    )
  }

  if (saved) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
        <div className="text-center max-w-xs">
          <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
            <Check size={26} className="text-emerald-400" aria-hidden="true" />
          </div>
          <h1 className="font-bold text-lg">Reporte enviado</h1>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            El cliente ya lo puede ver, y VARA lo usa para su operación.
          </p>
          <Link href="/partner"
            className="inline-block mt-6 rounded-xl bg-brand-500 hover:bg-brand-400 px-5 py-3 text-sm font-bold text-white transition-colors">
            Volver a mis visitas
          </Link>
        </div>
      </div>
    )
  }

  const checklistItems = checklistFor(booking.serviceType)

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      <div className="max-w-2xl mx-auto px-4 lg:px-6 py-6">
        <button onClick={() => router.push(`/visit/${code}`)}
          className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm mb-4 transition-colors">
          <ArrowLeft size={14} aria-hidden="true" /> Volver a la visita
        </button>

        <p className="font-mono text-[11px] text-slate-400">{booking.visitCode}</p>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
          Reporte de la visita
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {booking.locationLabel} · {booking.requestedDate}
        </p>

        {/* La regla del reporte, arriba de todo. Es lo que más se olvida. */}
        <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-3">
          <Info size={15} className="text-brand-700 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-xs text-slate-700 leading-relaxed">
            <p className="font-bold text-slate-800">Escribí hechos, no impresiones.</p>
            <p className="mt-1">
              En vez de <em>&ldquo;estaban muy interesados&rdquo;</em>, poné{' '}
              <em>&ldquo;preguntaron dos veces por el plazo de escrituración&rdquo;</em>.
              VARA interpreta después; si interpretás vos, se razona sobre una opinión.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="bg-white rounded-2xl border border-slate-200/70 p-4">
            <label htmlFor="att" className="text-sm font-bold text-slate-900 block">
              Cuántas personas estuvieron presentes
            </label>
            <input id="att" type="number" min={0} max={50} value={attendees}
              onChange={e => setAttendees(e.target.value)}
              className="mt-2 w-28 rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
            {booking.guestsExpected !== null && (
              <p className="text-[11px] text-slate-500 mt-1.5">
                El cliente informó {booking.guestsExpected}.
                {Number(attendees) > booking.guestsExpected && (
                  <span className="text-amber-700 font-medium">
                    {' '}Vinieron más de las informadas — anotalo en observaciones.
                  </span>
                )}
              </p>
            )}
          </div>

          <TextList
            label="Ambientes recorridos"
            hint="Los que efectivamente se mostraron."
            placeholder="Ej: Cocina"
            items={rooms}
            onChange={setRooms}
          />

          <TextList
            label="Preguntas que hicieron"
            hint="Textuales, como se preguntaron. Son la señal más útil para el cliente."
            placeholder="Ej: ¿Cuál es el plazo mínimo para reservar?"
            items={questions}
            onChange={setQuestions}
          />

          <TextList
            label="Observaciones"
            hint="Lo observable: ubicación, tamaño, estado. Nada de diagnósticos ni causas."
            placeholder="Ej: Mancha de humedad de 40 cm en pared norte de la cocina"
            items={observations}
            onChange={setObservations}
          />

          {/*
            La foto es la unica prueba de como quedo la propiedad cuando la
            persona duena no estuvo presente. El campo existia desde el
            principio y se guardaba siempre vacio.
          */}
          <div className="bg-white rounded-2xl border border-slate-200/70 p-4">
            <p className="text-sm font-bold text-slate-900">Fotos</p>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
              De lo que observaste. Se guardan en privado y solo las ve quien
              pidio la visita.
            </p>

            {photoError && (
              <p className="text-[11px] text-rose-600 mt-2">{photoError}</p>
            )}

            {photoPaths.length > 0 && (
              <p className="text-[11px] text-emerald-600 mt-2">
                {photoPaths.length} {photoPaths.length === 1 ? 'foto cargada' : 'fotos cargadas'}
              </p>
            )}

            <label className="mt-3 flex items-center justify-center gap-1.5 border-2 border-dashed border-slate-200 hover:border-slate-300 text-slate-500 text-xs font-semibold py-2.5 rounded-xl transition-colors cursor-pointer">
              <input
                type="file" accept="image/*" capture="environment" className="hidden"
                disabled={photoBusy || !booking}
                onChange={async e => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (!f || !booking) return
                  setPhotoBusy(true); setPhotoError(null)
                  const { uploadVisitPhoto } = await import('@/lib/supabase/visitPhotos')
                  const r = await uploadVisitPhoto(booking.id, f)
                  if (r.ok && r.path) setPhotoPaths(list => [...list, r.path!])
                  else setPhotoError(r.error ?? 'No pudimos subir la foto.')
                  setPhotoBusy(false)
                }}
              />
              {photoBusy ? 'Subiendo...' : 'Sacar o elegir una foto'}
            </label>
          </div>

          <IssuesEditor issues={issues} onChange={setIssues} />

          {checklistItems.length > 0 && session && (
            <div className="bg-white rounded-2xl border border-slate-200/70 p-4">
              <p className="text-sm font-bold text-slate-900">Checklist de la visita</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Se guarda tal como lo completaste durante la visita.
              </p>
              <ul className="mt-3 space-y-1.5">
                {checklistItems.map(i => (
                  <li key={i.id} className="flex items-center gap-2 text-xs">
                    <span className={cn(
                      'w-4 h-4 rounded flex items-center justify-center flex-shrink-0',
                      session.checklistState[i.id] ? 'bg-emerald-500' : 'bg-slate-200',
                    )}>
                      {session.checklistState[i.id] && <Check size={10} className="text-white" aria-hidden="true" />}
                    </span>
                    <span className={session.checklistState[i.id] ? 'text-slate-700' : 'text-slate-400'}>
                      {i.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
              <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-slate-200 px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <button onClick={save} disabled={saving}
            className="w-full rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 py-4 text-sm font-bold text-white transition-colors flex items-center justify-center gap-2">
            {saving
              ? <><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Guardando…</>
              : 'Enviar reporte'}
          </button>
        </div>
      </div>
    </div>
  )
}
