'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { Handshake, History } from 'lucide-react'
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, AlertCircle, Lock, ChevronDown, ChevronUp, MapPin, FileText, User, DollarSign, Calendar, ShieldAlert, Zap, Shield, Sparkles } from 'lucide-react'
import { VaraLogo } from '@/components/ui/VaraLogo'
import { InfoTip } from '@/components/ui/InfoTip'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { mockTransaction } from '@/data/mock'
import { useOperation } from '@/hooks/useOperation'
import { useOperations } from '@/hooks/useOperations'
import { getOperation } from '@/lib/userOperations'
import { buildTransaction } from '@/lib/operationFromChecklist'
import { cn, formatPrice, formatDate, getStatusLabel } from '@/lib/utils'
import { generateChecklist } from '@/lib/regulations'
import { primaryAction } from '@/lib/nba/engine'
import { OperationDocuments } from '@/components/documents/OperationDocuments'
import { OperationOffers } from '@/components/offers/OperationOffers'
import { ActivityLedger } from '@/components/activity/ActivityLedger'
import { OperationParticipants } from '@/components/participants/OperationParticipants'
import { OperationRisks } from '@/components/risks/OperationRisks'
import type { ProvinceCode } from '@/data/regulations/types'
import type { Task } from '@/types'

function computeOperationIntel(txn: typeof mockTransaction) {
  const allTasks = txn.stages.flatMap(s => s.tasks)
  const blockedTasks = allTasks.filter(t => t.status === 'BLOCKED')
  const pendingDocs = txn.documents.filter(d => d.status === 'PENDING' || d.status === 'IN_REVIEW')
  const nextTask = allTasks.find(t => t.status === 'IN_PROGRESS' || t.status === 'TODO')
  const status: 'BLOCKED' | 'ATTENTION' | 'ON_TRACK' = blockedTasks.length > 0 ? 'BLOCKED' : pendingDocs.length >= 3 ? 'ATTENTION' : 'ON_TRACK'

  // Si el array de costs está poblado (txn-002, txn-003) usarlo; si no, derivar del motor regulatorio
  let totalMin = txn.costs.reduce((s, c) => s + c.minAmount, 0)
  let totalMax = txn.costs.reduce((s, c) => s + c.maxAmount, 0)
  if (totalMin === 0 && txn.property) {
    const cl = generateChecklist(txn.provinceCode as ProvinceCode, txn.type, txn.property.price)
    totalMin = cl.costs.totalBuyer.min
    totalMax = cl.costs.totalBuyer.max
  }

  return { blockedTasks, pendingDocs, totalMin, totalMax, nextTask, status }
}

const taskStatusIcon = (status: string) => {
  if (status === 'DONE') return <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" />
  if (status === 'IN_PROGRESS') return <Clock size={18} className="text-brand-500 flex-shrink-0" />
  if (status === 'BLOCKED') return <Lock size={18} className="text-red-400 flex-shrink-0" />
  return <div className="w-[18px] h-[18px] rounded-full border-2 border-slate-300 flex-shrink-0" />
}

function TaskCard({ task }: { task: Task }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={cn('rounded-xl border transition-all', task.status === 'DONE' ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-200')}>
      <button className="w-full flex items-center gap-3 p-3.5 text-left" onClick={() => setOpen(o => !o)}>
        {taskStatusIcon(task.status)}
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-medium', task.status === 'DONE' ? 'text-slate-400 line-through' : 'text-slate-800')}>{task.title}</p>
          {task.responsibleRole && <p className="text-xs text-slate-400 mt-0.5">{task.responsibleRole}</p>}
        </div>
        {task.warnings && task.warnings.length > 0 && <AlertCircle size={14} className="text-amber-500 flex-shrink-0" />}
        {open ? <ChevronUp size={14} className="text-slate-300 flex-shrink-0" /> : <ChevronDown size={14} className="text-slate-300 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Qué tenés que hacer</p>
            <p className="text-sm text-slate-600 leading-relaxed">{task.description}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Por qué importa</p>
            <p className="text-sm text-slate-600 leading-relaxed">{task.why}</p>
          </div>
          {task.warnings && task.warnings.length > 0 && (
            <div className="bg-amber-50 rounded-lg p-3">
              {task.warnings.map((w, i) => <p key={i} className="text-sm text-amber-700 font-medium">{w}</p>)}
            </div>
          )}
          {task.recommendations && task.recommendations.length > 0 && (
            <div className="bg-brand-50 rounded-lg p-3">
              {task.recommendations.map((r, i) => <p key={i} className="text-sm text-brand-700">{r}</p>)}
            </div>
          )}
          {task.documentsRequired.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {task.documentsRequired.map(d => <span key={d} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{d}</span>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

type Tab = 'tareas' | 'documentos' | 'ofertas' | 'actividad' | 'costos' | 'timeline' | 'participantes' | 'riesgos' | 'diseno'

export default function OperacionPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const TAB_IDS = ['tareas','riesgos','documentos','ofertas','actividad','costos','timeline','participantes','diseno'] as const
  const requested = searchParams.get('tab')
  // ?tab=riesgos sigue existiendo como link, pero ahora abre la pestaña fusionada.
  const rawTab = requested === 'riesgos' ? 'documentos' : requested
  const initialTab: Tab = (TAB_IDS as readonly string[]).includes(rawTab ?? '')
    ? (rawTab as Tab)
    : 'tareas'
  const operationId = typeof params.id === 'string' ? params.id : 'txn-001'
  const { operation, notFound } = useOperation(operationId)
  const { relations, getTransactionData } = useOperations()
  const crossRelations = relations.filter(r => r.fromOperationId === operationId || r.toOperationId === operationId)
  const isDemoOperation = ['txn-001', 'txn-002', 'txn-003'].includes(operationId)
  // Para operaciones reales del usuario (guardadas en localStorage), buildTransaction las arma.
  const userOp = !operation && !isDemoOperation ? getOperation(operationId) : null
  const txn = operation ?? (userOp ? buildTransaction(userOp) : null) ?? (isDemoOperation ? mockTransaction : null)

  if (!txn) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText size={24} className="text-slate-300" />
          </div>
          <p className="font-semibold text-slate-700 mb-1">Operación vacía</p>
          <p className="text-sm text-slate-400 mb-5">Esta operación no tiene datos cargados todavía. Completá los pasos del onboarding para comenzar.</p>
          <Link href="/dashboard" className="text-brand-600 text-sm font-semibold hover:underline">← Volver al dashboard</Link>
        </div>
      </div>
    )
  }

  const intel = computeOperationIntel(txn)
  const nextAction = primaryAction({ transaction: txn })
  // El sidebar linkea directo a una pestaña (?tab=documentos). Sin esto,
  // "Documentos" y "Riesgos" del menú caerían siempre en Tareas.
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)
  const [openStage, setOpenStage] = useState<string>(txn.currentStageId)

  const riskCount = txn.risks?.length ?? 0
  const highRisks = txn.risks?.filter(r => r.severity === 'HIGH').length ?? 0

  // Documentos y riesgos van juntos: casi todo riesgo existe porque falta un papel.
  // Separados, el usuario leía el riesgo en una pestaña y tenía que ir a buscar
  // el documento a otra.
  const tabs: { id: Tab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'tareas', label: 'Tareas', icon: CheckCircle2 },
    { id: 'documentos', label: 'Documentos y riesgos', icon: FileText, badge: highRisks > 0 ? highRisks : undefined },
    { id: 'ofertas', label: 'Ofertas', icon: Handshake },
    { id: 'costos', label: 'Costos', icon: DollarSign },
    { id: 'actividad', label: 'Qué pasó', icon: History },
    { id: 'timeline', label: 'Timeline', icon: Calendar },
    { id: 'participantes', label: 'Equipo', icon: User },
    { id: 'diseno', label: 'Diseño', icon: Sparkles },
  ]

  // La IA de diseño trabaja sobre una propiedad, no sobre la operación:
  // si la operación tiene una asociada vamos directo a su ficha.
  const designHref = txn.propertyId ? `/propiedades/${txn.propertyId}` : '/propiedades'

  const statusConfigs = {
    BLOCKED: { label: 'Bloqueada', dot: 'bg-red-500', bar: 'bg-red-50 border-red-100', text: 'text-red-700' },
    ATTENTION: { label: 'Atención', dot: 'bg-amber-500', bar: 'bg-amber-50 border-amber-100', text: 'text-amber-700' },
    ON_TRACK: { label: 'En curso', dot: 'bg-green-500', bar: 'bg-green-50 border-green-100', text: 'text-green-700' },
  }
  const statusConfig = statusConfigs[intel.status]

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="px-4 lg:px-6 pt-8 pb-3">
        <div className="max-w-4xl mx-auto">
                      <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm mb-4 transition-colors">
              <ArrowLeft size={14} /> Volver al inicio
            </Link>
          <div className="flex items-start justify-between mb-3">
            <div>
              <h1 className="font-bold text-slate-900 text-lg">{txn.title}</h1>
              <p className="text-sm text-slate-400 flex items-center gap-1 mt-0.5"><MapPin size={11} />{txn.city}, {txn.province}</p>
              {txn.property && (
                <Link href="/propiedades" className="inline-flex items-center gap-1 text-xs text-brand-600 font-medium mt-1 hover:underline">
                  <MapPin size={10} />{txn.property.address} · {txn.property.surface}m² · {formatPrice(txn.property.price, txn.property.currency)} →
                </Link>
              )}
            </div>
            <Badge variant="brand">{txn.progress}%</Badge>
          </div>
          <Progress value={txn.progress} />
        </div>
      </header>

      {/* Intelligence Header */}
      <div className={cn('border-b px-4 py-3', statusConfig.bar)}>
        <div className="max-w-4xl mx-auto space-y-2.5">
          {/* Status + metrics row */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className={cn('w-2 h-2 rounded-full', statusConfig.dot)} />
              <span className={cn('text-xs font-bold flex items-center gap-1', statusConfig.text)}>
                {statusConfig.label}
                <InfoTip label="Qué significa el estado de la operación">
                  <strong>Bloqueada</strong>: hay una tarea que no puede avanzar hasta resolver otra cosa
                  (por ejemplo, falta un documento).{' '}
                  <strong>Requiere atención</strong>: hay documentos pendientes que van a frenarte más adelante.{' '}
                  <strong>En curso</strong>: nada te está trabando ahora mismo.
                </InfoTip>
              </span>
            </div>
            {intel.blockedTasks.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-red-600 font-medium">
                <Lock size={11} />
                {intel.blockedTasks.length} bloqueada{intel.blockedTasks.length > 1 ? 's' : ''}
              </div>
            )}
            {intel.pendingDocs.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                <FileText size={11} />
                {intel.pendingDocs.length} doc{intel.pendingDocs.length > 1 ? 's' : ''} pendiente{intel.pendingDocs.length > 1 ? 's' : ''}
              </div>
            )}
            <div className="flex items-center gap-1 text-xs text-slate-500 ml-auto">
              <DollarSign size={11} />
              {formatPrice(intel.totalMin)} – {formatPrice(intel.totalMax)}
            </div>
          </div>
          {/* NBA row */}
          {intel.nextTask && (
            <div className="flex items-start gap-2">
              <Zap size={12} className="text-brand-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-slate-700 leading-relaxed">
                <span className="font-semibold">Ahora: </span>{intel.nextTask.title}
                {intel.nextTask.responsibleRole && <span className="text-slate-400"> · {intel.nextTask.responsibleRole}</span>}
              </p>
            </div>
          )}
        </div>
      </div>

      {isDemoOperation && (
        <div className="px-4 pt-3 max-w-4xl mx-auto">
          <div className="bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <AlertCircle size={13} className="text-slate-400 flex-shrink-0" />
            <p className="text-xs text-slate-500 flex-1">Operación de demostración — los datos son ficticios.</p>
            <Link href="/onboarding" className="text-xs font-bold text-brand-600 whitespace-nowrap">Crear la mía →</Link>
          </div>
        </div>
      )}

      {crossRelations.length > 0 && (
        <div className="px-4 pt-3 max-w-4xl mx-auto space-y-2">
          {crossRelations.map(rel => {
            const linkedId = rel.fromOperationId === operationId ? rel.toOperationId : rel.fromOperationId
            const linkedTxn = getTransactionData(linkedId)
            const isFundedBy = rel.type === 'SALE_FUNDS_PURCHASE' && rel.toOperationId === operationId
            if (!linkedTxn) return null
            return (
              <div key={rel.id} className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
                <ShieldAlert size={15} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-amber-800">
                    {isFundedBy ? 'Esta compra depende de tu venta' : 'Esta venta financia una compra'}
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    {isFundedBy
                      ? `Los fondos vienen de la venta de "${linkedTxn.title}". Confirmá el cierre antes de firmar boleto.`
                      : `Financia la compra de "${linkedTxn.title}". Coordiná los cierres.`}
                  </p>
                </div>
                <Link href={`/operacion/${linkedId}`} className="text-[11px] font-bold text-amber-700 hover:text-amber-900 whitespace-nowrap flex-shrink-0">
                  Ver →
                </Link>
              </div>
            )
          })}
        </div>
      )}

      {/*
        * Accion primaria de la operacion.
        *
        * Antes esta pantalla eran seis pestanas sin jerarquia: el usuario
        * elegia pestana, no accion. Ahora lo primero que ve es que hacer,
        * con la evidencia en la que VARA se basa — la misma que muestra el
        * dashboard, porque sale del mismo motor.
        */}
      {nextAction && (
        <div className="max-w-4xl mx-auto px-4 pb-4">
          <div className={cn(
            'rounded-2xl border p-4',
            nextAction.blocking ? 'border-red-200 bg-red-50' : 'border-brand-200 bg-brand-50'
          )}>
            <div className="flex items-start gap-3">
              <div className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                nextAction.blocking ? 'bg-red-100' : 'bg-brand-100'
              )}>
                <Zap size={16} className={nextAction.blocking ? 'text-red-600' : 'text-brand-700'} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn(
                  'text-[10px] font-bold uppercase tracking-wide',
                  nextAction.blocking ? 'text-red-600' : 'text-brand-700'
                )}>
                  {nextAction.blocking ? 'Bloquea la operación' : 'Tu próximo paso'}
                </p>
                <p className="font-bold text-slate-900 mt-0.5">{nextAction.title}</p>
                <p className="text-sm text-slate-700 mt-1 leading-relaxed">{nextAction.why}</p>

                {nextAction.evidence.length > 0 && (
                  <ul className="mt-2.5 space-y-1">
                    {nextAction.evidence.map(e => (
                      <li key={e} className="flex items-start gap-1.5 text-[11px] text-slate-600">
                        <span className="w-1 h-1 rounded-full bg-slate-400 flex-shrink-0 mt-1.5" aria-hidden="true" />
                        {e}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border-b border-slate-100 sticky top-[57px] z-10">
        <div className="max-w-4xl mx-auto px-4 flex overflow-x-auto no-scrollbar">
          {tabs.map(({ id, label, icon: Icon, badge }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={cn('flex items-center gap-1.5 px-3 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0',
                activeTab === id ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400')}>
              <Icon size={14} />{label}
              {badge && <span className="ml-0.5 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">{badge}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4">
        {activeTab === 'tareas' && (
          <div className="space-y-3">
            {txn.stages.map(stage => (
              <div key={stage.id} className="bg-white rounded-2xl border border-slate-200/70 shadow-card overflow-hidden">
                <button className="w-full flex items-center justify-between p-4"
                  onClick={() => setOpenStage(openStage === stage.id ? '' : stage.id)}>
                  <div className="flex items-center gap-3">
                    <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                      stage.status === 'COMPLETED' ? 'bg-green-100 text-green-600' :
                      stage.status === 'CURRENT' ? 'bg-brand-100 text-brand-600' : 'bg-slate-100 text-slate-400')}>
                      {stage.order}
                    </div>
                    <div className="text-left">
                      <p className={cn('font-semibold text-sm', stage.status === 'UPCOMING' ? 'text-slate-400' : 'text-slate-800')}>{stage.label}</p>
                      <p className="text-xs text-slate-400">{stage.tasks.filter(t => t.status === 'DONE').length}/{stage.tasks.length} tareas</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={stage.status === 'COMPLETED' ? 'success' : stage.status === 'CURRENT' ? 'brand' : 'default'} size="sm">
                      {getStatusLabel(stage.status)}
                    </Badge>
                    {openStage === stage.id ? <ChevronUp size={14} className="text-slate-300" /> : <ChevronDown size={14} className="text-slate-300" />}
                  </div>
                </button>
                {openStage === stage.id && (
                  <div className="px-4 pb-4 space-y-2 border-t border-slate-50">
                    {stage.tasks.map(task => <TaskCard key={task.id} task={task} />)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Documentos a la izquierda, riesgos a la derecha: se leen juntos. */}
        <div className={cn(
          'gap-4 items-start',
          activeTab === 'documentos' ? 'grid grid-cols-1 lg:grid-cols-2' : ''
        )}>
        {activeTab === 'documentos' && (
          <div className="space-y-3 lg:order-2">
            <OperationRisks
              operationId={operationId}
              propertyPrice={txn.property?.price}
              provinceName={txn.province}
            />
          </div>
        )}

        {activeTab === 'documentos' && (() => {
          const DOC_META: Record<string, { color: string; bg: string; context: string; action: string; resolves?: string[] }> = {
            ESCRITURA:  { color: 'text-red-700',    bg: 'bg-red-50',    context: 'Confirma quién es el titular legal del inmueble',                    action: 'Solicitar al vendedor o estudio inmobiliario',     resolves: ['r-01', 'r-02'] },
            PLANOS:     { color: 'text-orange-700', bg: 'bg-orange-50', context: 'Verifica que lo construido coincide con lo aprobado municipalmente',  action: 'Solicitar al municipio o al vendedor',            resolves: ['r-03'] },
            IMPUESTOS:  { color: 'text-amber-700',  bg: 'bg-amber-50',  context: 'Certifica que no hay deudas que se transfieran al comprador',         action: 'Tramitar por gestor (5–10 días hábiles)',         resolves: ['r-04'] },
            CONTRATOS:  { color: 'text-blue-700',   bg: 'bg-blue-50',   context: 'Documentación de identidad de las partes',                           action: 'Subir desde tu dispositivo' },
            TASACIONES: { color: 'text-purple-700', bg: 'bg-purple-50', context: 'Valora el inmueble de forma objetiva',                               action: 'Contratar tasador (ver Red de Profesionales)' },
          }
          const received = txn.documents.filter(d => d.status === 'APPROVED' || d.status === 'RECEIVED').length
          const total = txn.documents.length
          const riskLabelMap = Object.fromEntries((txn.risks ?? []).map(r => [r.id, r.label]))

          return (
            <div className="space-y-3 lg:order-1">
              <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-slate-800">Documentación de la operación</p>
                  <span className="text-xs font-bold text-slate-500">{received}/{total} recibidos</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${Math.round((received / total) * 100)}%` }} />
                </div>
              </div>

              {/* Dónde se entregan de verdad los papeles que el checklist pide. */}
              <OperationDocuments operationId={operationId} />

              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide px-1 pt-1">
                Lo que hace falta
              </p>

              {txn.documents.map(doc => {
                const meta = DOC_META[doc.category] ?? { color: 'text-slate-600', bg: 'bg-slate-50', context: '', action: 'Consultar con el escribano' }
                const isPending = doc.status === 'PENDING' || doc.status === 'IN_REVIEW'
                const resolvedRisks = meta.resolves ?? []
                return (
                  <div key={doc.id} className={cn('bg-white rounded-2xl border border-slate-200/70 shadow-card overflow-hidden', isPending && 'border border-amber-100')}>
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', meta.bg)}>
                          <FileText size={14} className={meta.color} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-800 leading-tight">{doc.name}</p>
                            <Badge variant={doc.status === 'APPROVED' ? 'success' : doc.status === 'RECEIVED' ? 'info' : 'warning'} size="sm">
                              {getStatusLabel(doc.status)}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{meta.context}</p>
                          {doc.date && <p className="text-xs text-slate-300 mt-0.5">{formatDate(doc.date)}</p>}
                        </div>
                      </div>
                      {resolvedRisks.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {resolvedRisks.map(rid => riskLabelMap[rid] && (
                            <span key={rid} className="flex items-center gap-1 text-[11px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium">
                              <ShieldAlert size={9} /> {riskLabelMap[rid]}
                            </span>
                          ))}
                        </div>
                      )}
                      {isPending && (
                        <div className="mt-3 bg-amber-50 rounded-xl px-3 py-2.5 flex items-start gap-2">
                          <AlertCircle size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-amber-800 mb-0.5">Qué hacer</p>
                            <p className="text-xs text-amber-700">{meta.action}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()}
        </div>

        {activeTab === 'actividad' && <ActivityLedger operationId={operationId} />}

        {activeTab === 'ofertas' && (
          <OperationOffers
            operationId={operationId}
            propertyId={txn.propertyId}
            askingPrice={txn.property?.price && txn.property.price > 0 ? txn.property.price : undefined}
            currency={txn.property?.currency === 'ARS' ? 'ARS' : 'USD'}
          />
        )}

        {activeTab === 'costos' && (() => {
          /*
           * Sin precio cargado NO inventamos uno.
           *
           * Antes esto era `txn.property?.price ?? 185000`: la pantalla mostraba
           * "Gastos del comprador: USD 5.765 – 7.375" como si fueran los del
           * usuario, calculados sobre una propiedad que no era la suya.
           * Un costo inventado en una operacion real es peor que no mostrar nada.
           */
          const propertyPrice = txn.property?.price ?? 0
          if (propertyPrice <= 0) {
            return (
              <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-6">
                <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
                  <DollarSign size={19} className="text-slate-400" aria-hidden="true" />
                </div>
                <p className="font-bold text-slate-900">Falta el precio de la propiedad</p>
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                  Los sellos, los honorarios y los aranceles se calculan sobre el precio.
                  Sin ese dato podriamos darte un numero, pero no seria el tuyo.
                </p>
                <div className="flex flex-col sm:flex-row gap-2 mt-4">
                  <Link href={txn.propertyId ? `/propiedades/${txn.propertyId}` : '/propiedades'}
                    className="flex-1 rounded-xl bg-brand-600 hover:bg-brand-700 px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors">
                    Cargar el precio
                  </Link>
                  <Link href="/costos"
                    className="flex-1 rounded-xl bg-white border border-slate-200 hover:border-slate-300 px-4 py-2.5 text-center text-sm font-semibold text-slate-700 transition-colors">
                    Calculadora general
                  </Link>
                </div>
              </div>
            )
          }
          const checklist = generateChecklist(txn.provinceCode as ProvinceCode, txn.type, propertyPrice)
          const { costs } = checklist
          const buyerItems = [costs.stampTaxBuyer, costs.notaryFeeBuyer, costs.registryFee, costs.certificates]
          const sellerItems = [costs.stampTaxSeller, costs.notaryFeeSeller]
          const renderCost = (c: typeof buyerItems[0], i: number) => (
            <div key={i} className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-sm text-slate-700">{c.label}</p>
                {c.notes && <p className="text-xs text-slate-400 mt-0.5">{c.notes}</p>}
                <p className="text-xs text-slate-300 mt-0.5">Fuente: {c.source}</p>
              </div>
              <p className="text-sm font-semibold text-slate-800 flex-shrink-0 ml-3">
                {c.minAmount === c.maxAmount ? formatPrice(c.minAmount, c.currency) : `${formatPrice(c.minAmount, c.currency)} – ${formatPrice(c.maxAmount, c.currency)}`}
              </p>
            </div>
          )
          return (
            <div className="space-y-3">
              <div className="bg-slate-900 rounded-2xl p-4 text-white">
                <p className="text-xs opacity-50 mb-1">Precio de la propiedad</p>
                <p className="text-2xl font-extrabold">{formatPrice(propertyPrice)}</p>
                <p className="text-xs opacity-40 mt-1">{checklist.provinceName} · {checklist.dataConfidence === 'VERIFIED' ? 'VERIFICADO' : checklist.dataConfidence === 'PARTIAL' ? 'PARCIAL' : 'ESTIMADO'}</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Gastos del comprador</p>
                  <p className="text-xs font-bold text-slate-700">{formatPrice(costs.totalBuyer.min)} – {formatPrice(costs.totalBuyer.max)}</p>
                </div>
                <div className="p-4 space-y-3">{buyerItems.map(renderCost)}</div>
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex justify-between">
                  <p className="text-xs text-slate-500">Sobre el precio:</p>
                  <p className="text-xs font-semibold text-slate-700">{costs.totalBuyer.percentMin.toFixed(1)}% – {costs.totalBuyer.percentMax.toFixed(1)}%</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Gastos del vendedor</p>
                  <p className="text-xs font-bold text-slate-700">{formatPrice(costs.totalSeller.min)} – {formatPrice(costs.totalSeller.max)}</p>
                </div>
                <div className="p-4 space-y-3">{sellerItems.map(renderCost)}</div>
              </div>
              {checklist.warnings.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4 space-y-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Particularidades de {checklist.provinceName}</p>
                  {checklist.warnings.slice(0, 3).map((w, i) => (
                    <p key={i} className="text-xs text-slate-600 flex gap-2"><span className="text-slate-300">·</span>{w}</p>
                  ))}
                </div>
              )}
              <p className="text-xs text-slate-400 text-center px-4">Valores calculados por el motor regulatorio de VARA. Consultá con tu escribano para la liquidación exacta.</p>
            </div>
          )
        })()}

        {activeTab === 'timeline' && (
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4">
            <div className="space-y-4">
              {txn.timeline.map((event, i) => (
                <div key={event.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={cn('w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0',
                      event.type === 'TASK_COMPLETED' ? 'bg-green-100' : event.type === 'STAGE_CHANGED' ? 'bg-brand-100' : 'bg-slate-100')}>
                      {event.type === 'TASK_COMPLETED' ? <CheckCircle2 size={12} className="text-green-600" /> :
                       event.type === 'DOCUMENT_ADDED' ? <FileText size={12} className="text-blue-600" /> :
                       <Clock size={12} className="text-slate-400" />}
                    </div>
                    {i < txn.timeline.length - 1 && <div className="w-px flex-1 bg-slate-100 my-1" />}
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-medium text-slate-800">{event.title}</p>
                    {event.description && <p className="text-xs text-slate-500 mt-0.5">{event.description}</p>}
                    <p className="text-xs text-slate-400 mt-1">{formatDate(event.date)}{event.actor && ` · ${event.actor}`}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'participantes' && <OperationParticipants operationId={operationId} />}

        {activeTab === 'diseno' && (
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-6 text-center">
            <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles size={24} className="text-amber-500" />
            </div>
            <p className="font-bold text-slate-900 mb-1">Visualizá cómo quedaría</p>
            <p className="text-sm text-slate-500 mb-5 max-w-md mx-auto leading-relaxed">
              Subí la foto de un ambiente y VARA la edita sobre tu propia foto: pintar la fachada,
              renovar el interior, la cocina, el baño, el jardín o vaciar el ambiente.
              Además te estima cuánto costaría cada reforma.
            </p>
            <Link
              href={designHref}
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-900 text-sm font-bold px-5 py-3 rounded-xl transition-colors"
            >
              <Sparkles size={15} /> Abrir diseño
            </Link>
            <p className="text-[11px] text-slate-400 mt-3">Tarda entre 20 y 60 segundos por imagen</p>
          </div>
        )}
      </div>
    </div>
  )
}
