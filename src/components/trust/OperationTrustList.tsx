'use client'
import { useEffect, useState } from 'react'
import { Check, ShieldCheck, X } from 'lucide-react'
import { getOperationTrust } from '@/lib/supabase/identity'
import { tryCreateClient } from '@/lib/supabase/client'
import { participantRoleLabel } from '@/lib/participants/roles'
import type { OperationTrustEntry } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'

function Signal({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
      ok ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
      {ok ? <Check size={9} aria-hidden="true" /> : <X size={9} aria-hidden="true" />} {label}
    </span>
  )
}

/** Señales de confianza de los demás participantes de una operación compartida. */
export function OperationTrustList({ operationId, country }: { operationId: string; country?: string }) {
  const [entries, setEntries] = useState<OperationTrustEntry[] | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      const me = (await tryCreateClient()?.auth.getUser())?.data.user?.id
      const list = await getOperationTrust(operationId)
      if (alive) setEntries(list.filter(e => e.userId !== me))
    })()
    return () => { alive = false }
  }, [operationId])

  if (!entries || entries.length === 0) return null

  return (
    <section aria-label="Pasaporte de los participantes" className="rounded-2xl border border-slate-200/70 bg-white shadow-card">
      <h2 className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-800">
        <ShieldCheck size={14} className="text-brand-500" aria-hidden="true" /> Con quién estás operando
      </h2>
      <ul className="divide-y divide-slate-50">
        {entries.map(e => (
          <li key={e.userId} className="px-4 py-3">
            <p className="text-sm font-semibold text-slate-800">
              {e.name ?? 'Sin nombre cargado'}
              <span className="ml-1.5 text-xs font-normal text-slate-500">
                {e.isOwner ? 'Dueño de la operación' : participantRoleLabel(e.role, country)}
              </span>
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Signal ok={e.identityVerified} label="Identidad verificada" />
              <Signal ok={e.emailVerified} label="Email confirmado" />
              <Signal ok={e.hasPhone} label="Teléfono" />
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                {e.operationsCount} operación{e.operationsCount !== 1 ? 'es' : ''} en VARA
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
