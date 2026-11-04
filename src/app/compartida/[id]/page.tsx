'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, FileText, Loader2, Lock, MapPin } from 'lucide-react'
import { getSharedOperation, ROLE_LABELS, type SharingError } from '@/lib/supabase/sharing'
import { DOCUMENT_CATEGORY_LABELS, DOCUMENT_STATUS_LABELS, type DocumentCategory, type DocumentStatus } from '@/lib/documents/model'
import type { SharedOperationView } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'

/** Vista de solo lectura para quien fue invitado a una operación. */

const STATUS_STYLE: Record<string, string> = {
  APPROVED: 'bg-emerald-50 text-emerald-700',
  RECEIVED: 'bg-blue-50 text-blue-700',
  IN_REVIEW: 'bg-amber-50 text-amber-700',
  REJECTED: 'bg-red-50 text-red-700',
  EXPIRED: 'bg-red-50 text-red-700',
  PENDING: 'bg-slate-100 text-slate-600',
}

export default function SharedOperationPage() {
  const { id } = useParams<{ id: string }>()
  const [view, setView] = useState<SharedOperationView | null>(null)
  const [error, setError] = useState<SharingError | 'NOT_MEMBER' | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    void getSharedOperation(id).then(r => {
      if (!alive) return
      setView(r.data)
      setError(r.error ?? (r.data ? null : 'NOT_MEMBER'))
      setLoading(false)
    })
    return () => { alive = false }
  }, [id])

  if (loading) {
    return (
      <div role="status" className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={20} className="animate-spin text-slate-300" aria-label="Cargando" />
      </div>
    )
  }

  if (!view) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <Lock size={26} className="mx-auto text-slate-400" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-extrabold text-slate-900">No tenés acceso a esta operación</h1>
        <p className="mt-2 text-sm text-slate-600">
          {error === 'NOT_READY'
            ? 'El acceso compartido todavía no está activado en VARA.'
            : 'Puede que la invitación haya sido revocada o que hayas entrado con otra cuenta.'}
        </p>
        <Link href="/compartida" className="mt-5 inline-block text-sm font-semibold text-brand-600 hover:underline">
          Ver operaciones compartidas conmigo
        </Link>
      </div>
    )
  }

  const op = view.operation
  const place = [op.city, op.province].filter(Boolean).join(', ')
  const received = view.documents.filter(d => d.status === 'APPROVED' || d.status === 'RECEIVED').length

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-6 pb-12">
      <Link href="/compartida" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={14} aria-hidden="true" /> Operaciones compartidas
      </Link>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {op.type === 'SELL_PROPERTY' ? 'Venta' : 'Compra'}
          </span>
          <span className="rounded-full border border-brand-100 bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
            Participás como {ROLE_LABELS[view.role].toLowerCase()}
          </span>
        </div>
        <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-slate-900">{op.title || 'Operación'}</h1>
        {place && (
          <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500">
            <MapPin size={12} aria-hidden="true" /> {place}
          </p>
        )}
        {op.ownerName && <p className="mt-2 text-sm text-slate-600">Te invitó {op.ownerName}.</p>}
      </header>

      <section aria-label="Documentos" className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-slate-50 px-4 py-3.5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <FileText size={15} className="text-slate-400" aria-hidden="true" /> Documentos
          </h2>
          <span className="text-xs text-slate-400">{received}/{view.documents.length} recibidos</span>
        </div>
        {view.documents.length === 0 ? (
          <p className="px-4 py-5 text-sm text-slate-500">Todavía no hay documentos cargados en esta operación.</p>
        ) : (
          <ul className="divide-y divide-slate-50">
            {view.documents.map((d, i) => (
              <li key={`${d.name}-${i}`} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-800">{d.name}</span>
                  <span className="block text-[11px] text-slate-400">
                    {DOCUMENT_CATEGORY_LABELS[d.category as DocumentCategory] ?? d.category}
                  </span>
                </span>
                <span className={cn('flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_STYLE[d.status] ?? STATUS_STYLE.PENDING)}>
                  {DOCUMENT_STATUS_LABELS[d.status as DocumentStatus] ?? d.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-500">
        <Lock size={12} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
        Ves el estado de la operación y de sus documentos. Los archivos, las notas y la negociación
        siguen siendo privados de quien te invitó.
      </p>
    </main>
  )
}
