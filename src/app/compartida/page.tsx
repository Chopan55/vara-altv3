'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Loader2, Users } from 'lucide-react'
import { listSharedOperations } from '@/lib/supabase/sharing'
import { participantRoleLabel } from '@/lib/participants/roles'
import type { SharedOperationSummary } from '@/lib/supabase/types'

/** Operaciones de otras personas en las que participo por invitación. */
export default function SharedOperationsPage() {
  const [list, setList] = useState<SharedOperationSummary[] | null>(null)

  useEffect(() => { void listSharedOperations().then(setList) }, [])

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 pb-12">
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Compartidas conmigo</h1>
      <p className="mt-1 text-sm text-slate-500">Operaciones de otras personas en las que te invitaron a participar.</p>

      {list === null && (
        <p role="status" className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 size={15} className="animate-spin" aria-hidden="true" /> Cargando…
        </p>
      )}

      {list !== null && list.length === 0 && (
        <div className="mt-5 rounded-2xl border border-slate-200/70 bg-white p-5 text-center shadow-card">
          <Users size={22} className="mx-auto text-slate-300" aria-hidden="true" />
          <p className="mt-2 text-sm text-slate-600">Nadie te compartió una operación todavía.</p>
          <p className="mt-1 text-xs text-slate-400">Cuando te inviten, vas a recibir un link para aceptar.</p>
        </div>
      )}

      {list !== null && list.length > 0 && (
        <ul className="mt-5 space-y-2.5">
          {list.map(o => (
            <li key={o.operationId}>
              <Link href={`/compartida/${o.operationId}`}
                className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white px-4 py-3.5 shadow-card hover:shadow-elevated">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-slate-900">{o.title || 'Operación'}</span>
                  <span className="block text-xs text-slate-500">
                    {o.type === 'SELL_PROPERTY' ? 'Venta' : 'Compra'} · {participantRoleLabel(o.role)}
                  </span>
                </span>
                <ChevronRight size={15} className="text-slate-300" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
