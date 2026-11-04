'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, FileSearch, Loader2, ChevronRight, AlertTriangle,
  CheckCircle2, AlertCircle, Info, FileText, Sparkles,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import { useOperations } from '@/hooks/useOperations'
import { tryCreateClient } from '@/lib/supabase/client'
import type { OperationDocumentRow } from '@/lib/supabase/types'
import { isPdfPath, sanitizeDocSummary, summaryTone, type DocSummary } from '@/lib/documents/summary'
import { apiErrorMessage } from '@/lib/api/client'
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

const TONE = {
  unreadable: { bg: 'bg-slate-100', text: 'text-slate-700', icon: Info, iconCls: 'text-slate-500' },
  issues: { bg: 'bg-red-50', text: 'text-red-800', icon: AlertCircle, iconCls: 'text-red-500' },
  alerts: { bg: 'bg-amber-50', text: 'text-amber-800', icon: AlertTriangle, iconCls: 'text-amber-600' },
  clear: { bg: 'bg-emerald-50', text: 'text-emerald-800', icon: CheckCircle2, iconCls: 'text-emerald-500' },
} as const

function DocSummaryCard({ summary }: { summary: DocSummary }) {
  const tone = summaryTone(summary)
  const [open, setOpen] = useState(tone !== 'clear')
  const t = TONE[tone]
  const Icon = t.icon
  const issues = summary.encumbrances.length + summary.restrictions.length

  return (
    <div className="mt-3 rounded-xl border border-slate-200 overflow-hidden">
      {/* Semáforo: las cargas pesan más que las alertas, y "no se pudo leer" nunca se muestra como verde */}
      <div className={cn('flex items-center gap-2 px-4 py-3', t.bg)}>
        <Icon size={14} className={cn('flex-shrink-0', t.iconCls)} aria-hidden="true" />
        <p className={cn('text-xs font-bold flex-1', t.text)}>
          {tone === 'unreadable'
            ? 'No pudimos leer el texto de este PDF'
            : tone === 'issues'
            ? `${issues} carga${issues !== 1 ? 's' : ''} o restricción${issues !== 1 ? 'es' : ''} detectada${issues !== 1 ? 's' : ''}`
            : tone === 'alerts'
            ? `${summary.alerts.length} alerta${summary.alerts.length !== 1 ? 's' : ''} para revisar con un profesional`
            : 'No se detectaron cargas ni restricciones en el texto'}
        </p>
        <button
          onClick={() => setOpen(v => !v)}
          aria-label={open ? 'Ocultar detalle' : 'Ver detalle'}
          className="text-slate-400 hover:text-slate-700 flex-shrink-0"
        >
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {open && tone === 'unreadable' && (
        <p className="p-4 bg-white text-xs text-slate-600 leading-relaxed">
          Puede ser un escaneo o una foto convertida a PDF. Que no veamos cargas no significa que no las tenga:
          pedí una copia digital del documento o revisalo con tu escribano.
        </p>
      )}

      {open && tone !== 'unreadable' && (
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
  analysisState: 'idle' | 'loading' | 'done' | 'error'
  summary: DocSummary | null
  errorMsg: string | null
  analyzedAt?: string
  retryFailed?: boolean
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
  const analyzeDebounce = useRef<Set<string>>(new Set())

  const opId = selectedOpId ?? activeOperationId ?? activeOps[0]?.id ?? null

  useEffect(() => {
    if (!opId) return
    const client = tryCreateClient()
    if (!client) return
    let alive = true
    setDocsLoading(true)
    void (async () => {
      try {
        const { data: docsData } = await client
          .from('operation_documents')
          .select('*')
          .eq('operation_id', opId)
          .order('created_at', { ascending: false })
        const ids = (docsData ?? []).map(d => d.id)
        const { data: summariesData } = ids.length
          ? await client.from('document_ai_summaries').select('document_id, summary, updated_at').in('document_id', ids)
          : { data: [] }
        if (!alive) return
        // Los análisis guardados también pasan por la validación: uno viejo o roto no rompe la pantalla.
        const summaryMap = new Map<string, { summary: DocSummary; updated_at: string }>()
        for (const row of summariesData ?? []) {
          const summary = sanitizeDocSummary(row.summary)
          if (summary) summaryMap.set(row.document_id, { summary, updated_at: row.updated_at as string })
        }
        setDocs(
          (docsData ?? []).map(d => {
            const saved = summaryMap.get(d.id)
            return {
              ...d,
              analysisState: saved ? ('done' as const) : ('idle' as const),
              summary: saved?.summary ?? null,
              errorMsg: null,
              analyzedAt: saved?.updated_at,
            }
          }),
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
    if (analyzeDebounce.current.has(docId)) return
    analyzeDebounce.current.add(docId)
    setTimeout(() => analyzeDebounce.current.delete(docId), 2000)


    let prevSummary: DocSummary | null = null
    let prevAnalyzedAt: string | undefined
    setDocs(prev =>
      prev.map(d => {
        if (d.id === docId) {
          prevSummary = d.summary
          prevAnalyzedAt = d.analyzedAt
          return { ...d, analysisState: 'loading' as const, errorMsg: null, retryFailed: false }
        }
        return d
      }),
    )
    fetch('/api/doc-intelligence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: docId }),
    })
      .then(async res => {
        const data = await res.json().catch(() => ({})) as { summary?: unknown; error?: string }
        if (!res.ok) {
          // Los códigos ("ai_unavailable") no se muestran; las frases del control de IA sí.
          const human = typeof data.error === 'string' && data.error.includes(' ') ? data.error : undefined
          const msg = res.status === 403 && !human ? 'Análisis IA no disponible en este momento.' : apiErrorMessage(res.status, human)
          setDocs(prev => prev.map(d => d.id === docId
            ? { ...d, analysisState: d.summary ? 'done' : 'error', errorMsg: d.summary ? null : msg, retryFailed: !!d.summary }
            : d))
          return
        }
        const summary = sanitizeDocSummary(data.summary)
        if (!summary) throw new Error('respuesta inválida')
        setDocs(prev =>
          prev.map(d => d.id === docId
            ? { ...d, analysisState: 'done', summary, analyzedAt: new Date().toISOString(), retryFailed: false }
            : d),
        )
      })
      .catch(() => {
        setDocs(prev =>
          prev.map(d =>
            d.id === docId
              ? {
                  ...d,
                  analysisState: prevSummary ? ('done' as const) : ('error' as const),
                  summary: prevSummary,
                  analyzedAt: prevAnalyzedAt,
                  errorMsg: prevSummary ? null : 'No se pudo analizar el documento. Intentá de nuevo.',
                  retryFailed: !!prevSummary,
                }
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
                    const canAnalyze = isPdfPath(doc.storage_path)
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
                            {canAnalyze && doc.analysisState === 'done' && (
                              <div className="mt-2 space-y-1">
                                <div className="flex items-center gap-3">
                                  <button
                                    onClick={() => analyze(doc.id)}
                                    className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 bg-slate-50 hover:bg-brand-50 hover:text-brand-600 px-2.5 py-1 rounded-lg border border-slate-200 hover:border-brand-200 transition-colors"
                                  >
                                    <Sparkles size={10} /> Re-analizar
                                  </button>
                                  {doc.analyzedAt && (
                                    <span className="text-[10px] text-slate-400">
                                      Analizado {new Date(doc.analyzedAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                  )}
                                </div>
                                {doc.retryFailed && (
                                  <p className="text-[10px] text-amber-600 flex items-center gap-1">
                                    <AlertTriangle size={9} /> No se pudo re-analizar. Se muestra el análisis anterior.
                                  </p>
                                )}
                              </div>
                            )}

                            {doc.analysisState === 'loading' && (
                              <div className="mt-2 flex items-center gap-1.5">
                                <Loader2 size={11} className="animate-spin text-brand-400" />
                                <span className="text-[10px] text-slate-400">Analizando…</span>
                              </div>
                            )}

                            {doc.analysisState === 'error' && (
                              <p className="mt-2 text-[10px] text-red-500">{doc.errorMsg}</p>
                            )}

                            {!canAnalyze && (
                              <p className="mt-1.5 text-[10px] text-slate-400">
                                {doc.storage_path
                                  ? 'El análisis IA lee solo PDF. Subí este documento en PDF para analizarlo.'
                                  : 'Sin archivo — subí el PDF para activar el análisis IA'}
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
