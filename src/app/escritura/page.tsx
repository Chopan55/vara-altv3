'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, FileSearch, Loader2, ChevronRight, AlertTriangle,
  CheckCircle2, AlertCircle, Info, FileText, Sparkles,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import { useOperations } from '@/hooks/useOperations'
import { tryCreateClient } from '@/lib/supabase/client'
import type { OperationDocumentRow } from '@/lib/supabase/types'
import type { DocSummary } from '@/app/api/doc-intelligence/route'
import { cn } from '@/lib/utils'

const CATEGORY_LABELS: Record<string, string> = {
  ESCRITURA:    'Escritura',
  PLANOS:       'Planos',
  INFORMES:     'Informe de dominio',
  IMPUESTOS:    'Impuestos',
  EXPENSAS:     'Expensas',
  SERVICIOS:    'Servicios',
  CERTIFICADOS: 'Certificado',
  CONTRATOS:    'Boleto / Contrato',
  RESERVA:      'Reserva',
  TASACIONES:   'Tasación',
  OTROS:        'Otro',
}

const STATUS_LABELS: Record<string, string> = {
  PENDING:   'Pendiente',
  RECEIVED:  'Recibido',
  IN_REVIEW: 'En revisión',
  APPROVED:  'Aprobado',
  REJECTED:  'Rechazado',
  EXPIRED:   'Vencido',
}

function statusChipClass(status: string) {
  if (status === 'APPROVED') return 'bg-emerald-100 text-emerald-700'
  if (status === 'REJECTED' || status === 'EXPIRED') return 'bg-red-100 text-red-700'
  if (status === 'IN_REVIEW') return 'bg-brand-100 text-brand-700'
  return 'bg-slate-100 text-slate-500'
}

function DocSummaryCard({ summary }: { summary: DocSummary }) {
  const [open, setOpen] = useState(false)
  const hasIssues = summary.encumbrances.length > 0 || summary.restrictions.length > 0
  const hasAlerts = summary.alerts.length > 0

  return (
    <div className="mt-3 rounded-xl border border-slate-200 overflow-hidden">
      {/* Semáforo */}
      <div
        className={cn(
          'flex items-center gap-2 px-4 py-3',
          hasAlerts ? 'bg-amber-50' : hasIssues ? 'bg-red-50' : 'bg-emerald-50',
        )}
      >
        {hasAlerts ? (
          <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
        ) : hasIssues ? (
          <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
        ) : (
          <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
        )}
        <p
          className={cn(
            'text-xs font-bold flex-1',
            hasAlerts ? 'text-amber-800' : hasIssues ? 'text-red-800' : 'text-emerald-800',
          )}
        >
          {hasAlerts
            ? `${summary.alerts.length} alerta${summary.alerts.length !== 1 ? 's' : ''} para revisar con un profesional`
            : hasIssues
            ? 'Se detectaron cargas o restricciones'
            : 'Sin cargas ni restricciones detectadas'}
        </p>
        <button
          onClick={() => setOpen(v => !v)}
          className="text-slate-400 hover:text-slate-700 flex-shrink-0"
        >
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {open && (
        <div className="p-4 space-y-4 bg-white">
          {/* Titulares */}
          {summary.holders.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                Titulares / Partes
              </p>
              <div className="space-y-1">
                {summary.holders.map((h, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0" />
                    <p className="text-xs text-slate-700">{h}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cargas */}
          {summary.encumbrances.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-red-500 mb-1.5">
                Cargas detectadas
              </p>
              <div className="space-y-1">
                {summary.encumbrances.map((e, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <AlertCircle size={11} className="text-red-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-red-700">{e}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Restricciones */}
          {summary.restrictions.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mb-1.5">
                Restricciones de dominio
              </p>
              <div className="space-y-1">
                {summary.restrictions.map((r, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <AlertTriangle size={11} className="text-amber-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-700">{r}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Alertas profesionales */}
          {summary.alerts.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-1.5">
                Revisar con un profesional
              </p>
              <div className="space-y-1">
                {summary.alerts.map((a, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Info size={11} className="text-amber-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-slate-700">{a}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <p className="text-[10px] text-slate-400 pt-2 border-t border-slate-100 leading-relaxed">
            Análisis generado por IA a partir del texto del documento.
            No reemplaza la revisión de un escribano o abogado.
          </p>
        </div>
      )}
    </div>
  )
}

interface DocRow extends OperationDocumentRow {
  analysisState: 'idle' | 'loading' | 'done' | 'error' | 'unavailable'
  summary: DocSummary | null
  errorMsg: string | null
}

export default function EscrituraPage() {
  const { operations: allOps, loaded, activeOperationId } = useOperations()
  const activeOps = useMemo(
    () => allOps.filter(o => o.status === 'ACTIVE'),
    [allOps],
  )
  const [selectedOpId, setSelectedOpId] = useState<string | null>(null)
  const [docs, setDocs] = useState<DocRow[]>([])
  const [docsLoading, setDocsLoading] = useState(false)

  const opId = selectedOpId ?? activeOperationId ?? activeOps[0]?.id ?? null

  useEffect(() => {
    if (!opId) return
    const client = tryCreateClient()
    if (!client) return
    let alive = true
    setDocsLoading(true)
    void (async () => {
      try {
        const { data } = await client
          .from('operation_documents')
          .select('*')
          .eq('operation_id', opId)
          .order('created_at', { ascending: false })
        if (!alive) return
        setDocs(
          (data ?? []).map(d => ({
            ...d,
            analysisState: 'idle' as const,
            summary: null,
            errorMsg: null,
          })),
        )
      } catch {
        // leave docs empty
      } finally {
        if (alive) setDocsLoading(false)
      }
    })()
    return () => { alive = false }
  }, [opId])

  function analyze(docId: string) {
    setDocs(prev =>
      prev.map(d => d.id === docId ? { ...d, analysisState: 'loading', summary: null, errorMsg: null } : d),
    )
    fetch('/api/doc-intelligence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: docId }),
    })
      .then(async res => {
        if (res.status === 403) {
          setDocs(prev => prev.map(d => d.id === docId ? { ...d, analysisState: 'unavailable' } : d))
          return
        }
        if (!res.ok) throw new Error(`${res.status}`)
        const data = await res.json() as { summary: DocSummary }
        setDocs(prev =>
          prev.map(d => d.id === docId ? { ...d, analysisState: 'done', summary: data.summary } : d),
        )
      })
      .catch(() => {
        setDocs(prev =>
          prev.map(d =>
            d.id === docId
              ? { ...d, analysisState: 'error', errorMsg: 'No se pudo analizar el documento. Intentá de nuevo.' }
              : d,
          ),
        )
      })
  }

  const isLoading = !loaded

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard" className="text-slate-400 hover:text-slate-700 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-[var(--foreground)] leading-tight">
              Resumen de documentación
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Análisis IA de escrituras y documentos del inmueble
            </p>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20 gap-2">
            <Loader2 size={16} className="animate-spin text-slate-300" />
            <p className="text-xs text-slate-400">Cargando operaciones…</p>
          </div>
        )}

        {!isLoading && activeOps.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-8 text-center">
            <div className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <FileSearch size={22} className="text-brand-500" />
            </div>
            <p className="text-sm font-semibold text-slate-800 mb-2">Sin operaciones activas</p>
            <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
              Cuando tengas una operación activa con documentos cargados, VARA puede analizar
              la escritura y detectar cargas, restricciones y alertas.
            </p>
            <Link
              href="/dashboard"
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
            >
              Ir al dashboard <ChevronRight size={12} />
            </Link>
          </div>
        )}

        {!isLoading && activeOps.length > 0 && (
          <div className="space-y-4">

            {/* Selector de operación */}
            {activeOps.length > 1 && (
              <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4">
                <label className="text-xs font-semibold text-slate-600 block mb-2">
                  Operación
                </label>
                <select
                  value={opId ?? ''}
                  onChange={e => setSelectedOpId(e.target.value)}
                  className="w-full text-sm text-slate-800 bg-slate-50 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-200"
                >
                  {activeOps.map(op => (
                    <option key={op.id} value={op.id}>
                      {op.type === 'SELL' ? 'Venta' : 'Compra'} — {op.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Lista de documentos */}
            {docsLoading ? (
              <div className="flex items-center justify-center py-12 gap-2">
                <Loader2 size={14} className="animate-spin text-slate-300" />
                <p className="text-xs text-slate-400">Cargando documentos…</p>
              </div>
            ) : docs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-6 text-center">
                <FileText size={22} className="text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700 mb-1">Sin documentos cargados</p>
                <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                  Esta operación aún no tiene documentos. Cargá la escritura, el boleto o
                  el informe de dominio desde el detalle de la operación.
                </p>
                {opId && (
                  <Link
                    href={`/operacion/${opId}`}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
                  >
                    Ir a la operación <ChevronRight size={12} />
                  </Link>
                )}
              </div>
            ) : (
              <section>
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                  Documentos · {docs.length}
                </h2>
                <div className="space-y-3">
                  {docs.map(doc => {
                    const canAnalyze = !!doc.storage_path &&
                      (doc.storage_path.endsWith('.pdf') || doc.category === 'ESCRITURA')
                    return (
                      <div
                        key={doc.id}
                        className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                            <FileText size={16} className="text-brand-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-slate-800 leading-tight">
                                {doc.name}
                              </p>
                              <span className={cn(
                                'text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0',
                                statusChipClass(doc.status),
                              )}>
                                {STATUS_LABELS[doc.status] ?? doc.status}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {CATEGORY_LABELS[doc.category] ?? doc.category}
                              {doc.document_date ? ` · ${doc.document_date}` : ''}
                            </p>

                            {canAnalyze && doc.analysisState === 'idle' && (
                              <button
                                onClick={() => analyze(doc.id)}
                                className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-bold text-brand-600 bg-brand-50 hover:bg-brand-100 px-2.5 py-1 rounded-lg transition-colors"
                              >
                                <Sparkles size={10} /> Analizar con IA
                              </button>
                            )}

                            {doc.analysisState === 'loading' && (
                              <div className="mt-2 flex items-center gap-1.5">
                                <Loader2 size={11} className="animate-spin text-brand-400" />
                                <span className="text-[10px] text-slate-400">Analizando…</span>
                              </div>
                            )}

                            {doc.analysisState === 'unavailable' && (
                              <p className="mt-2 text-[10px] text-slate-400">
                                Análisis IA no disponible en este momento.
                              </p>
                            )}

                            {doc.analysisState === 'error' && (
                              <p className="mt-2 text-[10px] text-red-500">{doc.errorMsg}</p>
                            )}

                            {!canAnalyze && !doc.storage_path && (
                              <p className="mt-1.5 text-[10px] text-slate-400">
                                Sin archivo — subí el PDF para activar el análisis IA
                              </p>
                            )}
                          </div>
                        </div>

                        {doc.analysisState === 'done' && doc.summary && (
                          <DocSummaryCard summary={doc.summary} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Info */}
            <div className="bg-brand-50 rounded-2xl border border-brand-100 p-4">
              <div className="flex items-start gap-2">
                <Info size={14} className="text-brand-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-brand-700 mb-1">Qué analiza VARA</p>
                  <p className="text-xs text-brand-600 leading-relaxed">
                    Para PDFs de escrituras, boletos e informes de dominio: extrae titulares,
                    detecta hipotecas, embargos, inhibiciones, restricciones de dominio y genera
                    alertas para revisar con tu escribano. El análisis es informativo — no reemplaza
                    la revisión profesional.
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
