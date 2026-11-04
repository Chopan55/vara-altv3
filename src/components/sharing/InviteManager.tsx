'use client'
import { useCallback, useState } from 'react'
import { participantRoleLabels } from '@/lib/participants/roles'
import { useLoad } from '@/hooks/useLoad'
import { Check, Copy, Loader2, Send, UserPlus, X } from 'lucide-react'
import {
  createInvite, inviteUrl, listInvites, revokeInvite, type SharingError,
} from '@/lib/supabase/sharing'
import type { OperationMemberRow, ParticipantRoleDb } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'

const ROLES: ParticipantRoleDb[] = ['COUNTERPARTY', 'NOTARY', 'BROKER', 'LAWYER', 'ACCOUNTANT', 'APPRAISER', 'BANK', 'OTHER']

const ERRORS: Record<SharingError, string> = {
  NOT_READY: 'El acceso compartido todavía no está activado en la base de VARA (falta correr una migración).',
  NO_SESSION: 'Necesitás entrar a tu cuenta para invitar.',
  DUPLICATE: 'Ya hay una invitación activa para ese email.',
  FAILED: 'No pudimos crear la invitación. Probá de nuevo.',
}

/** Invitaciones de solo lectura a una operación: email + rol → link para mandar por WhatsApp o mail. */
export function InviteManager({ operationId, country }: { operationId: string; country?: string }) {
  const roleLabels = participantRoleLabels(country)
  const [invites, setInvites] = useState<OperationMemberRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<SharingError | null>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<ParticipantRoleDb>('COUNTERPARTY')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await listInvites(operationId)
    setInvites(r.data)
    setError(r.error === 'NOT_READY' || r.error === 'NO_SESSION' ? r.error : null)
    setLoading(false)
  }, [operationId])

  useLoad(load)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return
    setBusy(true)
    const r = await createInvite(operationId, email, role)
    setBusy(false)
    if (r.error) { setError(r.error); return }
    setError(null)
    setEmail('')
    await load()
    if (r.data) await copy(r.data)
  }

  async function copy(inv: OperationMemberRow) {
    try {
      await navigator.clipboard.writeText(inviteUrl(inv.invite_token, window.location.origin))
      setCopied(inv.id)
      setTimeout(() => setCopied(null), 2500)
    } catch { /* sin portapapeles: el link igual se puede volver a copiar */ }
  }

  async function revoke(inv: OperationMemberRow) {
    if (!confirm(`¿Quitarle el acceso a ${inv.invited_email}?`)) return
    await revokeInvite(inv.id)
    await load()
  }

  return (
    <section aria-label="Invitar a la operación" className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <UserPlus size={14} className="text-brand-500" aria-hidden="true" /> Invitar a la operación
        </h2>
        <p className="mt-0.5 text-[11px] text-slate-500">
          El invitado entra con su cuenta y ve el estado y el checklist de documentos. No ve archivos, notas ni la negociación.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-2 px-4 py-3">
        <div className="flex gap-2">
          <label htmlFor="inv-email" className="sr-only">Email</label>
          <input id="inv-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="email@ejemplo.com" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
          <label htmlFor="inv-role" className="sr-only">Rol</label>
          <select id="inv-role" value={role} onChange={e => setRole(e.target.value as ParticipantRoleDb)}
            className="rounded-xl border border-slate-200 bg-white px-2 py-2.5 text-sm">
            {ROLES.map(r => <option key={r} value={r}>{roleLabels[r]}</option>)}
          </select>
        </div>
        <button type="submit" disabled={busy || !email.trim() || error === 'NOT_READY'}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
          {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
          Crear invitación y copiar link
        </button>
        {error && <p role="alert" className="text-xs text-rose-600">{ERRORS[error]}</p>}
      </form>

      {loading ? (
        <p role="status" className="flex items-center justify-center gap-2 py-4 text-xs text-slate-400">
          <Loader2 size={13} className="animate-spin" aria-hidden="true" /> Cargando invitaciones…
        </p>
      ) : invites.length > 0 && (
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {invites.map(inv => (
            <li key={inv.id} className="flex items-center gap-2 px-4 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-slate-800">{inv.invited_email}</span>
                <span className="block text-[11px] text-slate-500">
                  {roleLabels[inv.role]} · {inv.accepted_at ? 'Aceptó' : 'Pendiente'}
                </span>
              </span>
              {!inv.accepted_at && (
                <button type="button" onClick={() => copy(inv)} aria-label={`Copiar link de ${inv.invited_email}`}
                  className={cn('rounded-lg px-2 py-1 text-[11px] font-semibold',
                    copied === inv.id ? 'bg-emerald-50 text-emerald-700' : 'bg-brand-50 text-brand-700 hover:bg-brand-100')}>
                  {copied === inv.id ? <><Check size={11} className="inline" aria-hidden="true" /> Copiado</> : <><Copy size={11} className="inline" aria-hidden="true" /> Link</>}
                </button>
              )}
              <button type="button" onClick={() => revoke(inv)} aria-label={`Quitar acceso a ${inv.invited_email}`}
                className="rounded-lg p-1 text-slate-300 hover:text-rose-500">
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
