'use client'
import { useCallback, useState } from 'react'
import { useLoad } from '@/hooks/useLoad'
import Link from 'next/link'
import { ArrowLeft, Check, ExternalLink, Loader2, Lock, X } from 'lucide-react'
import { getMyRole } from '@/lib/supabase/visits'
import { adminListIdentity, adminReviewIdentity, adminSignedUrls } from '@/lib/supabase/identity'
import type { IdentityVerificationRow } from '@/lib/supabase/types'

/**
 * Revisión manual de identidad (Trust Passport). La protección real está en la
 * base: RLS solo deja leer y decidir a un ADMIN. Esta pantalla es la herramienta.
 */

function ReviewRow({ row, onDone }: { row: IdentityVerificationRow; onDone: () => void }) {
  const [urls, setUrls] = useState<{ document: string | null; selfie: string | null } | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  async function decide(approve: boolean) {
    if (!approve && !reason.trim()) return
    setBusy(true)
    const ok = await adminReviewIdentity(row.user_id, approve, reason)
    setBusy(false)
    if (ok) onDone()
  }

  return (
    <li className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-card">
      <p className="font-mono text-xs text-slate-500">{row.user_id}</p>
      <p className="text-[11px] text-slate-400">Enviado {new Date(row.submitted_at).toLocaleString('es-AR')}</p>
      {urls === null ? (
        <button onClick={async () => setUrls(await adminSignedUrls(row))}
          className="mt-2 text-xs font-semibold text-brand-600 hover:underline">Ver archivos (link de 5 minutos)</button>
      ) : (
        <div className="mt-2 flex gap-3">
          {urls.document && <a href={urls.document} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600">DNI <ExternalLink size={11} aria-hidden="true" /></a>}
          {urls.selfie && <a href={urls.selfie} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600">Selfie <ExternalLink size={11} aria-hidden="true" /></a>}
        </div>
      )}
      <label htmlFor={`r-${row.user_id}`} className="sr-only">Motivo del rechazo</label>
      <input id={`r-${row.user_id}`} value={reason} onChange={e => setReason(e.target.value)}
        placeholder="Motivo si rechazás (lo ve el usuario)" className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs" />
      <div className="mt-2 flex gap-2">
        <button onClick={() => decide(true)} disabled={busy}
          className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-600 py-2 text-xs font-semibold text-white disabled:opacity-50">
          <Check size={13} aria-hidden="true" /> Verificar
        </button>
        <button onClick={() => decide(false)} disabled={busy || !reason.trim()}
          className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-red-200 py-2 text-xs font-semibold text-red-700 disabled:opacity-40">
          <X size={13} aria-hidden="true" /> Rechazar
        </button>
      </div>
    </li>
  )
}

export default function AdminIdentidadPage() {
  const [role, setRole] = useState<string | null>(null)
  const [rows, setRows] = useState<IdentityVerificationRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const r = await getMyRole()
    setRole(r)
    if (r === 'ADMIN') setRows(await adminListIdentity('SUBMITTED'))
    setLoading(false)
  }, [])

  useLoad(load)

  if (loading) {
    return <div role="status" className="flex min-h-[60vh] items-center justify-center"><Loader2 size={22} className="animate-spin text-slate-300" aria-label="Cargando" /></div>
  }
  if (role !== 'ADMIN') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 text-center">
        <div><Lock size={26} className="mx-auto text-slate-300" aria-hidden="true" /><p className="mt-2 text-sm text-slate-600">Solo para el equipo de VARA.</p></div>
      </div>
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <Link href="/admin/visitas" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={14} aria-hidden="true" /> Admin
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold text-slate-900">Verificación de identidad</h1>
      <p className="mt-1 text-sm text-slate-500">{rows.length} pendiente{rows.length !== 1 ? 's' : ''}. Compará el DNI con la selfie antes de verificar.</p>
      {rows.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-slate-200/70 bg-white p-5 text-center text-sm text-slate-500">No hay identidades para revisar.</p>
      ) : (
        <ul className="mt-5 space-y-3">{rows.map(r => <ReviewRow key={r.user_id} row={r} onDone={load} />)}</ul>
      )}
    </main>
  )
}
