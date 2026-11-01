'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Users, Share2, Check, Loader2, ChevronRight,
  FileText, ClipboardCheck, AlertCircle, Eye,
} from 'lucide-react'
import { useOperations } from '@/hooks/useOperations'
import { tryCreateClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

/**
 * Shared Transaction State — estado compartido de la operación.
 *
 * Muestra el panel unificado de una operación: participantes, estado de
 * documentos/tareas por rol, y un link compartible para que todas las
 * partes vean lo que les corresponde.
 *
 * MVP: genera un link tipo /operacion/[id] que el usuario puede compartir
 * manualmente con su equipo.
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

const ROLE_PERMISSIONS: Record<string, string[]> = {
  NOTARY:       ['Documentos legales', 'Estado de tareas', 'Timeline de cierre'],
  BROKER:       ['Datos de la operación', 'Comunicación entre partes', 'Estado general'],
  ACCOUNTANT:   ['Documentos impositivos', 'Estructura de pago'],
  LAWYER:       ['Documentos legales', 'Historial de negociación'],
  APPRAISER:    ['Datos de la propiedad', 'Informe de tasación'],
  COUNTERPARTY: ['Estado general', 'Documentos compartidos'],
  BANK:         ['Documentos financieros', 'Verificaciones de identidad'],
  OTHER:        ['Estado general'],
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
  const [copied, setCopied] = useState(false)

  const selected = operations.find(o => o.id === selectedId) ?? null

  const { participants, loading: loadingParticipants } = useOperationParticipants(selectedId)

  // Auto-select first operation once loaded
  useEffect(() => {
    if (loaded && operations.length > 0 && !selectedId) {
      setSelectedId(operations[0].id)
    }
  }, [loaded, operations, selectedId])

  const shareUrl = typeof window !== 'undefined' && selectedId
    ? `${window.location.origin}/operacion/${selectedId}`
    : null

  const handleShare = useCallback(async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      /* clipboard not available */
    }
  }, [shareUrl])

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
              Todas las partes, una sola operación
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
                {/* Cabecera de operación + botón compartir */}
                <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                        {selected.type === 'BUY' ? 'Compra' : 'Venta'}
                      </p>
                      <p className="font-bold text-slate-900 text-sm leading-tight">{selected.title}</p>
                    </div>
                    <button
                      onClick={handleShare}
                      className={cn(
                        'flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition-all flex-shrink-0',
                        copied
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-brand-50 text-brand-700 hover:bg-brand-100',
                      )}
                    >
                      {copied ? (
                        <><Check size={12} /> Copiado</>
                      ) : (
                        <><Share2 size={12} /> Compartir</>
                      )}
                    </button>
                  </div>
                  {shareUrl && (
                    <p className="text-[10px] text-slate-400 mt-2 font-mono truncate">{shareUrl}</p>
                  )}
                </div>

                {/* Participantes */}
                <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-800">Participantes del equipo</h2>
                    <Link
                      href={`/operacion/${selected.id}?tab=participantes`}
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
                        href={`/operacion/${selected.id}?tab=participantes`}
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
                            {ROLE_PERMISSIONS[p.role] && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {ROLE_PERMISSIONS[p.role].map(perm => (
                                  <span
                                    key={perm}
                                    className="inline-flex items-center gap-0.5 text-[9px] font-semibold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full"
                                  >
                                    <Eye size={8} /> {perm}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Qué puede ver cada rol */}
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertCircle size={13} className="text-slate-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs font-semibold text-slate-600">Visibilidad por rol</p>
                  </div>
                  <div className="space-y-2">
                    {[
                      { rol: 'Vos (propietario/a)', items: ['Todo: tareas, documentos, negociación, riesgos, mensajes'], color: 'text-brand-600' },
                      { rol: 'Contraparte', items: ['Estado general, documentos compartidos, mensajes'], color: 'text-slate-600' },
                      { rol: 'Profesionales', items: ['Documentos de su área, tareas asignadas, timeline'], color: 'text-slate-600' },
                    ].map(row => (
                      <div key={row.rol} className="flex items-start gap-2">
                        <span className={cn('text-[10px] font-bold min-w-[110px]', row.color)}>{row.rol}</span>
                        <span className="text-[10px] text-slate-500 leading-relaxed">{row.items.join(', ')}</span>
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
