'use client'
import { useState } from 'react'
import { AlertTriangle, Clock, Loader2, Lock, ShieldCheck, Upload } from 'lucide-react'
import { checkIdentityFile, submitIdentity, type IdentityError } from '@/lib/supabase/identity'
import type { IdentityVerificationRow } from '@/lib/supabase/types'

const ERRORS: Record<IdentityError, string> = {
  NOT_READY: 'La verificación de identidad todavía no está activada en VARA.',
  NO_SESSION: 'Entrá a tu cuenta para verificar tu identidad.',
  BAD_FILE: 'Subí una foto (JPG, PNG o WEBP) o un PDF de hasta 8 MB.',
  FAILED: 'No pudimos enviar los archivos. Probá de nuevo.',
}

/** Envío de DNI + selfie. El veredicto lo da una persona de VARA, no la app. */
export function IdentityVerificationCard({ row, notReady, onSubmitted }: {
  row: IdentityVerificationRow | null
  notReady: boolean
  onSubmitted: () => void
}) {
  const [doc, setDoc] = useState<File | null>(null)
  const [selfie, setSelfie] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<IdentityError | null>(notReady ? 'NOT_READY' : null)

  if (row?.status === 'VERIFIED') {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
        <ShieldCheck size={16} aria-hidden="true" /> Identidad verificada por VARA
      </div>
    )
  }

  if (row?.status === 'SUBMITTED') {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
          <Clock size={15} aria-hidden="true" /> Documentos en revisión
        </p>
        <p className="mt-1 text-xs text-amber-900/80">
          Una persona de VARA los revisa. Te avisamos acá cuando esté listo.
        </p>
      </div>
    )
  }

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!doc || !selfie) return
    if (!checkIdentityFile(doc) || !checkIdentityFile(selfie)) { setError('BAD_FILE'); return }
    setBusy(true)
    const r = await submitIdentity(doc, selfie)
    setBusy(false)
    if (!r.ok) { setError(r.error ?? 'FAILED'); return }
    setError(null)
    onSubmitted()
  }

  return (
    <form onSubmit={send} className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-card">
      <h2 className="text-sm font-bold text-slate-800">Verificá tu identidad</h2>
      {row?.status === 'REJECTED' && (
        <p className="mt-2 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
          No pudimos validarla: {row.rejection_reason ?? 'revisá los archivos'}. Podés enviarla de nuevo.
        </p>
      )}
      <p className="mt-1 text-xs text-slate-500">
        Subí el frente de tu DNI y una selfie sosteniéndolo. Una persona de VARA los compara: subirlos no te verifica solo.
      </p>
      <div className="mt-3 space-y-2.5">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">DNI (frente)</span>
          <input type="file" accept="image/*,application/pdf" onChange={e => setDoc(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-brand-700" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">Selfie con el DNI</span>
          <input type="file" accept="image/*" capture="user" onChange={e => setSelfie(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-brand-700" />
        </label>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-rose-600">{ERRORS[error]}</p>}
      <button type="submit" disabled={!doc || !selfie || busy || error === 'NOT_READY'}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
        {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Upload size={14} aria-hidden="true" />}
        Enviar para revisión
      </button>
      <p className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-400">
        <Lock size={11} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
        Tus archivos quedan privados: solo los ve el equipo de VARA para revisarlos. La contraparte ve únicamente si estás verificado.
      </p>
    </form>
  )
}
