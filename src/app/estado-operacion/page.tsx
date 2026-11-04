'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Users, Loader2, ChevronRight, ClipboardCheck, AlertCircle,
} from 'lucide-react'
import { useOperations } from '@/hooks/useOperations'
import { tryCreateClient } from '@/lib/supabase/client'
import { InviteManager } from '@/components/sharing/InviteManager'
import { OperationTrustList } from '@/components/trust/OperationTrustList'
import { cn } from '@/lib/utils'

/**
 * Shared Transaction State — estado compartido de la operación.
 *
 * El dueño invita por email (src/lib/supabase/sharing.ts). El invitado ve una
 * vista de solo lectura en /compartida/[id], sin archivos ni notas.
 */

interface ParticipantRow {
  id: string
  name: string
  role: string
  email?: string | null
  phone?: string | null
}

const ROLE_LABELS: Record<string, string> = {
  NOTARY:      'Escribano/a',
  BROKER:      'Martillero / Inmobiliaria',
  ACCOUNTANT:  'Contador/a',
  LAWYER:      'Abogado/a',
  APPRAISER:   'Tasador/a',
  COUNTERPARTY:'La otra parte',
  BANK:        'Banco',
  OTHER:       'Otro',
}

function useOperationParticipants(operationId: string | null) {
  const [participants, setParticipants] = useState<ParticipantRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!operationId) return
    const client = tryCreateClient()
    if (!client) return
    setLoading(true)
    client
      .from('operation_participants')
      .select('id, name, role, email, phone')
      .eq('operation_id', operationId)
      .then(({ data }) => {
        setParticipants((data as ParticipantRow[]) ?? [])
        setLoading(false)
      })
  }, [operationId])

  return { participants, loading }
}

export default function EstadoOperacionPage() {
  const { operations, loaded } = useOperations()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = operations.find(o => o.id === selectedId) ?? null

  const { participants, loading: loadingParticipants } = useOperationParticipants(selectedId)

  // Auto-select first operation once loaded
  useEffect(() => {
    if (loaded && operations.length > 0 && !selectedId) {
      setSelectedId(operations[0].id)
    }
  }, [loaded, operations, selectedId])


  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard" className="text-slate-400 hover:text-slate-700 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-[var(--foreground)] leading-tight">
              Estado compartido
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Invitá a la contraparte y a los profesionales a seguir la operación
            </p>
          </div>
        </div>

        {!loaded && (
          <div className="flex items-center justify-center py-20 gap-2">
            <Loader2 size={16} className="animate-spin text-slate-300" />
            <p className="text-xs text-slate-400">Cargando operaciones…</p>
          </div>
        )}

        {loaded && operations.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-8 text-center">
            <div className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Users size={22} className="text-brand-500" />
            </div>
            <p className="text-sm font-semibold text-slate-800 mb-2">
              No tenés operaciones activas
            </p>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              El estado compartido requiere al menos una operación activa en VARA.
            </p>
            <Link
              href="/dashboard"
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
            >
              Crear una operación <ChevronRight size={12} />
            </Link>
          </div>
        )}

        {loaded && operations.length > 0 && (
          <div className="space-y-4">
            {/* Selector de operación */}
            {operations.length > 1 && (
              <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4">
                <p className="text-xs font-semibold text-slate-600 mb-2">Operación</p>
                <select
                  value={selectedId ?? ''}
                  onChange={e => setSelectedId(e.target.value)}
                  className="w-full text-sm text-slate-800 bg-slate-50 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-200"
                >
                  {operations.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.type === 'BUY' ? 'Compra' : 'Venta'} — {o.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selected && (
              <>
                {/* Cabecera de operación */}
                <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                    {selected.type === 'BUY' ? 'Compra' : 'Venta'}
                  </p>
                  <p className="font-bold text-slate-900 text-sm leading-tight">{selected.title}</p>
                </div>

                <InviteManager operationId={selected.id} />

                <OperationTrustList operationId={selected.id} />

                {/* Participantes */}
                <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-800">Participantes del equipo</h2>
                    <Link
                      href={`/operacion/${selected.id}`}
                      className="text-[10px] font-semibold text-brand-600 hover:underline"
                    >
                      Editar →
                    </Link>
                  </div>

                  {loadingParticipants && (
                    <div className="flex items-center justify-center py-8 gap-2">
                      <Loader2 size={14} className="animate-spin text-slate-300" />
                      <p className="text-xs text-slate-400">Cargando participantes…</p>
                    </div>
                  )}

                  {!loadingParticipants && participants.length === 0 && (
                    <div className="px-4 py-6 text-center">
                      <p className="text-sm text-slate-500 mb-2">Sin participantes cargados</p>
                      <Link
                        href={`/operacion/${selected.id}`}
                        className="text-xs font-semibold text-brand-600 hover:underline"
                      >
                        Agregar participantes →
                      </Link>
                    </div>
                  )}

                  {!loadingParticipants && participants.length > 0 && (
                    <div className="divide-y divide-slate-100">
                      {participants.map(p => (
                        <div key={p.id} className="px-4 py-3 flex items-start gap-3">
                          <div className="w-8 h-8 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                            <Users size={14} className="text-brand-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{p.name}</p>
                            <p className="text-[10px] text-slate-500">
                              {ROLE_LABELS[p.role] ?? p.role}
                              {p.email ? ` · ${p.email}` : ''}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Qué ve cada uno, hoy */}
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertCircle size={13} className="text-slate-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs font-semibold text-slate-600">Qué ve cada uno</p>
                  </div>
                  <div className="space-y-2">
                    {[
                      { rol: 'Vos', items: 'Todo: tareas, documentos, archivos, negociación, riesgos y notas', color: 'text-brand-600' },
                      { rol: 'Invitados', items: 'Estado de la operación y checklist de documentos (sin archivos ni notas). Solo lectura.', color: 'text-slate-600' },
                    ].map(row => (
                      <div key={row.rol} className="flex items-start gap-2">
                        <span className={cn('text-[10px] font-bold min-w-[70px]', row.color)}>{row.rol}</span>
                        <span className="text-[10px] text-slate-500 leading-relaxed">{row.items}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Link a la operación completa */}
                <Link
                  href={`/operacion/${selected.id}`}
                  className="flex items-center justify-between gap-2 bg-white rounded-2xl border border-slate-200/70 shadow-card px-4 py-3 hover:border-brand-200 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-brand-50 rounded-xl flex items-center justify-center">
                      <ClipboardCheck size={14} className="text-brand-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Ver operación completa</p>
                      <p className="text-[10px] text-slate-400">Tareas, docs, negociación, riesgos</p>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-400" />
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
