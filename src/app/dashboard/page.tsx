'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowRight, MapPin, AlertTriangle, FileText, DollarSign, MessageSquare, Clock, ChevronRight, TrendingUp, ShieldAlert, CheckCircle2, CircleDot, Users, Sparkles, Plus, Link2, Home, CheckSquare, BarChart2, ShoppingCart, Tag, Building2, Trash2, Zap, Briefcase, Shield, Calendar } from 'lucide-react'
import { VaraLogo } from '@/components/ui/VaraLogo'
import { Progress } from '@/components/ui/Progress'
import { InfoTip } from '@/components/ui/InfoTip'
import { generateChecklist } from '@/lib/regulations'
import type { ProvinceCode } from '@/data/regulations/types'
import { formatPrice } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { useVaraState } from '@/hooks/useVaraState'
import { useOperations, useGlobalNextBestAction } from '@/hooks/useOperations'
import { GuidanceBanner } from '@/components/guidance/GuidanceBanner'
import { loadUserProperties, type UserProperty } from '@/lib/userProperties'
import type { UserOperationSummary, Transaction } from '@/types'
import { computeNextActions, CATEGORY_LABELS } from '@/lib/nba/engine'

function computeIntelligence(txn: Transaction) {
  const allTasks = txn.stages.flatMap(s => s.tasks)
  const blockedTasks = allTasks.filter(t => t.status === 'BLOCKED')
  const pendingDocs = txn.documents.filter(d => d.status === 'PENDING')
  const currentStage = txn.stages.find(s => s.id === txn.currentStageId)
  const nextTask = currentStage?.tasks.find(t => t.status === 'IN_PROGRESS' || t.status === 'TODO')

  const propertyPrice = txn.property?.price ?? 0
  const checklist = generateChecklist(txn.provinceCode as ProvinceCode, txn.type, propertyPrice)
  const totalBuyerMin = checklist.costs.totalBuyer.min
  const totalBuyerMax = checklist.costs.totalBuyer.max

  const risks = [
    blockedTasks.length > 0 && { severity: 'HIGH' as const, label: 'Tareas bloqueadas', detail: `${blockedTasks.length} tarea${blockedTasks.length > 1 ? 's' : ''} no puede${blockedTasks.length > 1 ? 'n' : ''} avanzar` },
    pendingDocs.filter(d => ['ESCRITURA', 'PLANOS'].includes(d.category)).length > 0 && { severity: 'HIGH' as const, label: 'Documentación crítica pendiente', detail: 'Escritura y/o planos sin recibir' },
    pendingDocs.length > 0 && { severity: 'MEDIUM' as const, label: `${pendingDocs.length} documento${pendingDocs.length > 1 ? 's' : ''} pendiente${pendingDocs.length > 1 ? 's' : ''}`, detail: 'Requeridos para avanzar a negociación' },
  ].filter(Boolean) as { severity: 'HIGH' | 'MEDIUM' | 'LOW'; label: string; detail: string }[]

  const operationStatus: 'ON_TRACK' | 'ATTENTION' | 'BLOCKED' =
    blockedTasks.length > 0 ? 'BLOCKED' :
    pendingDocs.length >= 3 ? 'ATTENTION' : 'ON_TRACK'

  return { blockedTasks, pendingDocs, currentStage, nextTask, risks, totalBuyerMin, totalBuyerMax, propertyPrice, operationStatus, checklist }
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function EmptyState({ userName, propertyUrl }: { userName: string; propertyUrl: string }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="px-4 lg:px-6 pt-8 pb-3">
        <div className="max-w-2xl mx-auto">
          <p className="text-sm text-slate-400 mb-0.5">{greeting()}, {userName.split(' ')[0]}</p>
          <h1 className="text-xl font-bold text-slate-900">Bienvenido a VARA</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        {/* Hero CTA */}
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
          <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Plus size={24} className="text-brand-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Empezá tu operación</h2>
          <p className="text-sm text-slate-400 mb-6 max-w-sm mx-auto">
            VARA te guía en cada paso — desde la primera visita hasta la escritura. Sin sorpresas.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold px-6 py-3 rounded-xl transition-colors"
            >
              Crear mi operación <ArrowRight size={16} />
            </Link>
            <Link
              href="/operacion/txn-001"
              className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
            >
              Ver demo →
            </Link>
          </div>
        </div>

        {/* Si tiene URL de propiedad */}
        {propertyUrl && (
          <div className="bg-white rounded-2xl shadow-card p-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-brand-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Link2 size={16} className="text-brand-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 mb-0.5">Propiedad en análisis</p>
                <a href={propertyUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-brand-600 hover:underline truncate block max-w-full">
                  {propertyUrl}
                </a>
              </div>
              <Link href="/propiedades" className="text-xs text-brand-600 font-semibold hover:underline flex-shrink-0">
                Analizar →
              </Link>
            </div>
          </div>
        )}

        {/* Quick access */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: '/costos', icon: DollarSign, label: 'Calculá tus costos', sub: 'Sellos, escribano y más' },
            { href: '/asistente', icon: MessageSquare, label: 'Preguntale a VARA', sub: 'Cualquier duda inmobiliaria' },
            { href: '/propiedades', icon: FileText, label: 'Analizar una propiedad', sub: 'Riesgos y potencial con IA' },
            { href: '/vara-labs', icon: Sparkles, label: 'VARA Labs', sub: 'Lo que viene próximamente' },
          ].map(({ href, icon: Icon, label, sub }) => (
            <Link key={href} href={href}
              className="bg-white rounded-2xl p-4 shadow-card hover:shadow-elevated transition-shadow flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Icon size={14} className="text-slate-400" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 text-xs leading-tight truncate">{label}</p>
                <p className="text-[11px] text-slate-400 mt-0.5 truncate">{sub}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

interface ChecklistItemState {
  id: string
  label: string
  detail: string
  done: boolean
  dueDate?: string  // YYYY-MM-DD
}

const SELLER_CHECKLIST_BASE: ChecklistItemState[] = [
  { id: 'docs',      label: 'Reunir documentación del inmueble', detail: 'Título, planos, impuestos al día',       done: false },
  { id: 'price',     label: 'Definir precio de publicación',     detail: 'Basado en comparables de la zona',      done: false },
  { id: 'photos',    label: 'Fotos profesionales',               detail: 'Al menos 12 fotos de buena calidad',    done: false },
  { id: 'publish',   label: 'Publicar en portales',              detail: 'Zonaprop, Argenprop, MercadoLibre',     done: false },
  { id: 'visits',    label: 'Organizar visitas',                 detail: 'Coordinar con potenciales compradores', done: false },
  { id: 'offer',     label: 'Evaluar ofertas recibidas',         detail: 'Reserva y boleto de compraventa',       done: false },
  { id: 'escritura', label: 'Escriturar',                        detail: 'Con escribano y comprador',             done: false },
]

/** Días estimados desde hoy para cada paso de una venta típica en Argentina. */
const ESTIMATED_DAYS: Record<string, number> = {
  docs: 7, price: 3, photos: 10, publish: 14,
  visits: 30, offer: 60, escritura: 120,
}

const CHECKLIST_KEY_V2 = 'vara_seller_checklist_v2'

function isoDate(daysFromNow: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString().slice(0, 10)
}

function fmtDueDate(iso: string): string {
  const [y, m, day] = iso.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

function loadChecklist(): ChecklistItemState[] {
  try {
    const v2 = localStorage.getItem(CHECKLIST_KEY_V2)
    if (v2) {
      const saved = JSON.parse(v2) as ChecklistItemState[]
      if (Array.isArray(saved) && saved[0]?.id) {
        return SELLER_CHECKLIST_BASE.map(base => {
          const s = saved.find(x => x.id === base.id)
          return s ? { ...base, done: s.done, dueDate: s.dueDate } : base
        })
      }
    }
    // Migra el formato viejo (string[] de done ids)
    const legacy = localStorage.getItem('vara_seller_checklist')
    if (legacy) {
      const doneIds: string[] = JSON.parse(legacy)
      return SELLER_CHECKLIST_BASE.map(item => ({ ...item, done: doneIds.includes(item.id) }))
    }
  } catch {}
  return SELLER_CHECKLIST_BASE.map(i => ({ ...i }))
}

function saveChecklist(list: ChecklistItemState[]): void {
  try { localStorage.setItem(CHECKLIST_KEY_V2, JSON.stringify(list)) } catch {}
}

function SellerDashboard({ userName, province }: { userName: string; province: string }) {
  const [checklist, setChecklist] = useState<ChecklistItemState[]>(() => loadChecklist())
  const [editingDateId, setEditingDateId] = useState<string | null>(null)

  const toggleItem = (id: string) => {
    setChecklist(prev => {
      const next = prev.map(i => i.id === id ? { ...i, done: !i.done } : i)
      saveChecklist(next)
      return next
    })
  }

  const setItemDate = (id: string, date: string) => {
    setChecklist(prev => {
      const next = prev.map(i => i.id === id ? { ...i, dueDate: date || undefined } : i)
      saveChecklist(next)
      return next
    })
  }

  const estimateDates = () => {
    setChecklist(prev => {
      const next = prev.map(item => ({
        ...item,
        dueDate: item.done ? item.dueDate : isoDate(ESTIMATED_DAYS[item.id] ?? 30),
      }))
      saveChecklist(next)
      return next
    })
  }

  const done = checklist.filter(i => i.done).length
  const progress = Math.round((done / checklist.length) * 100)

  const sellerCosts = [
    { label: 'Comisión inmobiliaria', value: '3–4% del precio' },
    { label: 'Honorarios escribano', value: '~1% del precio' },
    { label: 'ITI / Ganancia', value: '1.5–3% según caso' },
    { label: 'Plusvalía municipal', value: 'Varía por provincia' },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="px-4 lg:px-6 pt-8 pb-3">
        <div className="max-w-2xl mx-auto">
          <p className="text-sm text-slate-400 mb-0.5">{greeting()}, {userName.split(' ')[0]}</p>
          <h1 className="text-xl font-bold text-slate-900">Tu operación de venta</h1>
          <p className="text-sm text-slate-400 mt-0.5 flex items-center gap-1">
            <MapPin size={11} /> {province}
          </p>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* PROGRESS CARD */}
        <div className="bg-white rounded-2xl shadow-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
                Progreso de venta
                <InfoTip label="Cómo se calcula el progreso">
                  Es el porcentaje de tareas completadas sobre el total de la operación.
                  No mide tiempo ni plata: mide cuántos pasos del proceso ya resolviste.
                </InfoTip>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">{done} de {checklist.length} pasos completados</p>
            </div>
            <span className="text-2xl font-extrabold text-slate-900">{progress}%</span>
          </div>
          <Progress value={progress} showLabel={false} />
        </div>

        {/* NEXT BEST ACTION */}
        {(() => {
          const next = checklist.find(i => !i.done)
          if (!next) return null
          return (
            <div className="bg-amber-500 rounded-2xl p-5 text-slate-900">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={13} className="opacity-50" />
                <p className="text-xs font-bold opacity-50 uppercase tracking-widest">Próximo paso</p>
              </div>
              <h3 className="font-extrabold text-base mb-1 leading-tight">{next.label}</h3>
              <p className="text-sm opacity-70 leading-relaxed mb-4">{next.detail}</p>
              <button
                onClick={() => toggleItem(next.id)}
                className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors"
              >
                Marcar como hecho <ArrowRight size={14} />
              </button>
            </div>
          )
        })()}

        {/* CHECKLIST */}
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center">
                <CheckSquare size={15} className="text-amber-500" />
              </div>
              <h3 className="font-semibold text-slate-800 text-sm">Checklist de venta</h3>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={estimateDates}
                className="flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700 transition-colors"
              >
                <Sparkles size={10} /> Estimar fechas
              </button>
              <span className="text-xs text-slate-400">{done}/{checklist.length}</span>
            </div>
          </div>
          <div className="divide-y divide-slate-50">
            {checklist.map(item => (
              <div key={item.id} className="flex items-center gap-2 px-5 py-3 hover:bg-slate-50 transition-colors">
                {/* Zona de toggle: checkbox + texto */}
                <button
                  onClick={() => toggleItem(item.id)}
                  className="flex items-center gap-3 flex-1 text-left min-w-0"
                >
                  <div className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                    item.done ? 'bg-brand-600 border-brand-600' : 'border-slate-200'
                  )}>
                    {item.done && <CheckCircle2 size={12} className="text-white" strokeWidth={3} />}
                  </div>
                  <div className="min-w-0">
                    <p className={cn('text-sm font-medium leading-tight', item.done ? 'text-slate-400 line-through' : 'text-slate-800')}>
                      {item.label}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{item.detail}</p>
                  </div>
                </button>
                {/* Fecha: manual o estimada */}
                <div className="flex-shrink-0">
                  {editingDateId === item.id ? (
                    <input
                      type="date"
                      autoFocus
                      value={item.dueDate ?? ''}
                      onChange={e => setItemDate(item.id, e.target.value)}
                      onBlur={() => setEditingDateId(null)}
                      className="text-xs border border-brand-300 rounded-lg px-2 py-1 text-slate-700 outline-none focus:border-brand-500 bg-white"
                    />
                  ) : (
                    <button
                      onClick={() => setEditingDateId(item.id)}
                      title={item.dueDate ? 'Cambiar fecha' : 'Fijar fecha'}
                      className={cn(
                        'text-[11px] px-2 py-1 rounded-lg transition-colors flex items-center gap-1',
                        item.dueDate
                          ? 'text-brand-600 bg-brand-50 hover:bg-brand-100 font-semibold'
                          : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'
                      )}
                    >
                      {item.dueDate ? fmtDueDate(item.dueDate) : <Calendar size={11} />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PRICING INTELLIGENCE */}
        <div className="bg-white rounded-2xl shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center">
                <BarChart2 size={15} className="text-slate-400" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 text-sm">Inteligencia de precio</h3>
                <p className="text-xs text-slate-400 mt-0.5">{province} · Referencia de mercado</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Rango estimado de publicación</p>
              <p className="text-xl font-extrabold text-slate-900 text-sm text-slate-400">Pendiente de análisis</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400 mb-0.5">Zona</p>
              <p className="text-sm font-bold text-slate-700">{province}</p>
            </div>
          </div>
          <p className="text-xs text-slate-300">
            Referencia estimada. Usá el Asistente VARA para un análisis más preciso de tu propiedad.
          </p>
          <Link href="/asistente" className="mt-3 flex items-center gap-2 text-xs font-semibold text-amber-600 hover:underline">
            Analizar mi propiedad con IA <ArrowRight size={12} />
          </Link>
        </div>

        {/* SELLER COSTS */}
        <div className="bg-white rounded-2xl shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 text-sm">Costos del vendedor</h3>
            <Link href="/costos" className="text-xs text-amber-600 font-semibold hover:underline">Calculadora →</Link>
          </div>
          <div className="space-y-2">
            {sellerCosts.map((c, i) => (
              <div key={i} className="flex items-center justify-between">
                <p className="text-xs text-slate-500">{c.label}</p>
                <p className="text-xs font-semibold text-slate-700">{c.value}</p>
              </div>
            ))}
          </div>
          <div className="h-px bg-slate-100 mt-3 mb-3" />
          <p className="text-xs text-slate-300">Varían según precio, provincia y tipo de inmueble.</p>
        </div>

        {/* QUICK ACCESS */}
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { href: '/asistente', icon: MessageSquare, label: 'Asistente VARA', sub: 'Preguntá lo que necesitás' },
            { href: '/vara-labs', icon: Sparkles, label: 'VARA Labs', sub: 'Negociación y simuladores' },
            { href: '/costos', icon: DollarSign, label: 'Calculá tus costos', sub: 'Costos del vendedor' },
            { href: '/profesionales', icon: Users, label: 'Profesionales', sub: 'Escribanos e inmobiliarias' },
          ].map(({ href, icon: Icon, label, sub }) => (
            <Link key={href} href={href}
              className="bg-white rounded-2xl p-4 shadow-card hover:shadow-elevated transition-shadow flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Icon size={14} className="text-slate-400" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 text-xs leading-tight truncate">{label}</p>
                <p className="text-[11px] text-slate-400 mt-0.5 truncate">{sub}</p>
              </div>
            </Link>
          ))}
        </div>

      </div>
    </div>
  )
}

function OperationCard({ op, isActive, onSelect, getTransactionData, onDelete, isDemo }: {
  op: UserOperationSummary
  isActive: boolean
  onSelect: (id: string) => void
  getTransactionData: (id: string) => import('@/types').Transaction | null
  onDelete?: (id: string) => void
  isDemo?: boolean
}) {
  const txn = getTransactionData(op.id)
  const blockedCount = txn ? txn.stages.flatMap(s => s.tasks).filter(t => t.status === 'BLOCKED').length : 0
  const pendingDocs = txn ? txn.documents.filter(d => d.status === 'PENDING').length : 0

  const typeLabel = op.type === 'BUY' ? 'Compra' : 'Venta'
  const TypeIcon = op.type === 'BUY' ? ShoppingCart : Tag

  const stageLabel = txn?.stages.find(s => s.id === txn.currentStageId)?.label ?? 'Sin etapa'
  // La próxima acción sale del motor NBA, no de una lectura directa del stage.
  // Así es coherente con el RightRail y con la vista de operación.
  const primaryNba = txn ? computeNextActions({ transaction: txn }).find(a => a.id !== 'all_clear') : undefined
  const cover = txn?.property?.images?.[0]

  const urgency = blockedCount > 0
    ? { label: 'Urgente', className: 'bg-red-50 text-red-600 border-red-100' }
    : pendingDocs > 0
      ? { label: 'Media', className: 'bg-amber-50 text-amber-700 border-amber-100' }
      : { label: 'Baja', className: 'bg-green-50 text-green-700 border-green-100' }

  return (
    <div
      className={cn(
        'bg-white rounded-2xl shadow-card overflow-hidden border transition-all',
        isActive ? 'border-brand-300 ring-1 ring-brand-100' : 'border-slate-200/70'
      )}
    >
      <div className="flex flex-col sm:flex-row">
        {/* Foto de la propiedad. Si todavía no hay ninguna cargada no inventamos
            una imagen de stock: dejamos un lugar neutro que se nota vacío. */}
        <div className="relative sm:w-44 sm:flex-shrink-0 h-36 sm:h-auto bg-slate-100">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Building2 size={26} className="text-slate-300" aria-hidden="true" />
            </div>
          )}
          <span className={cn(
            'absolute top-2.5 left-2.5 rounded-lg px-2 py-0.5 text-[10px] font-bold',
            op.type === 'BUY' ? 'bg-white/95 text-blue-600' : 'bg-white/95 text-amber-600'
          )}>
            <TypeIcon size={9} className="inline mr-1 -mt-0.5" aria-hidden="true" />
            {typeLabel}
          </span>
        </div>

        <div className="flex-1 min-w-0 p-4">
          <div className="flex items-start justify-between gap-3">
            <button onClick={() => onSelect(op.id)} className="text-left min-w-0">
              <h3 className="font-bold text-slate-900 text-base leading-tight truncate">{op.title}</h3>
              <p className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                <MapPin size={10} aria-hidden="true" />{op.city}{op.province ? `, ${op.province}` : ''}
                {op.country && op.country !== 'AR' && (
                  <span className="ml-1 text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                    {op.country}
                  </span>
                )}
              </p>
            </button>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className={cn('rounded-lg border px-2 py-0.5 text-[10px] font-bold', urgency.className)}>
                {urgency.label}
              </span>
              {isDemo ? (
                <span className="text-[10px] font-semibold text-slate-400">Ejemplo</span>
              ) : onDelete && (
                <button
                  onClick={() => { if (confirm(`¿Borrar "${op.title}"? No se puede deshacer.`)) onDelete(op.id) }}
                  title="Borrar operación"
                  aria-label={`Borrar ${op.title}`}
                  className="text-slate-300 hover:text-red-500 p-1 rounded-lg transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>

          <div className="mt-3.5">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-slate-600">{stageLabel}</p>
              <span className="text-xs font-bold text-slate-700 tabular-nums">{op.progress}%</span>
            </div>
            <Progress value={op.progress} showLabel={false} />
          </div>

          <div className={cn(
            'mt-3.5 flex items-center gap-3 rounded-xl px-3 py-2.5',
            primaryNba?.blocking ? 'bg-red-50' : 'bg-slate-50'
          )}>
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <Zap size={14} className={cn('flex-shrink-0', primaryNba?.blocking ? 'text-red-500' : 'text-brand-600')} aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Próxima acción</p>
                <p className={cn('text-xs truncate', primaryNba?.blocking ? 'text-red-700 font-medium' : 'text-slate-700')}>
                  {primaryNba?.title ?? 'Revisá el detalle de la operación'}
                </p>
              </div>
            </div>
            <Link
              href={primaryNba?.cta.href ?? `/operacion/${op.id}`}
              className="flex-shrink-0 rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900 transition-colors"
            >
              {primaryNba?.cta.label ?? 'Ver operación'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Columna derecha del diseño nuevo: lo que hay que mirar hoy, siempre a la vista.
 * Es la respuesta al "no sé dónde están las cosas" — en vez de buscar en el menú,
 * la pantalla te dice qué sigue.
 *
 * Todo lo que muestra sale de las operaciones reales del usuario. Si no hay nada
 * pendiente, lo dice; no llenamos la columna con avisos inventados.
 */
function RightRail({
  alerts,
  operations,
  getTransactionData,
}: {
  alerts: ReturnType<typeof useGlobalNextBestAction>
  operations: UserOperationSummary[]
  getTransactionData: (id: string) => import('@/types').Transaction | null
}) {
  /*
   * Los proximos pasos salen del motor de Next Best Action, no de una
   * heuristica escrita aca. Asi el consejo del dashboard, el de la operacion
   * y el del asistente son el mismo, y cambian juntos cuando cambia el estado.
   *
   * Sin fechas: el modelo de tareas no las tiene e inventarlas seria peor que
   * no mostrarlas.
   */
  const nextSteps = operations
    .flatMap(op => {
      const txn = getTransactionData(op.id)
      if (!txn) return []
      return computeNextActions({ transaction: txn })
        .filter(a => a.id !== 'all_clear')
        .map(action => ({ opTitle: op.title, action }))
    })
    .sort((a, b) => a.action.priority - b.action.priority)
    .slice(0, 4)

  return (
    <aside className="space-y-4 lg:sticky lg:top-20">
      <section className="rounded-2xl bg-white border border-slate-200/70 shadow-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-900">Qué requiere atención hoy</h2>
          {alerts.length > 0 && (
            <span className="rounded-full bg-red-50 text-red-600 text-[10px] font-bold w-5 h-5 flex items-center justify-center">
              {alerts.length}
            </span>
          )}
        </div>

        {alerts.length === 0 ? (
          <div className="flex items-start gap-2.5 rounded-xl bg-green-50 px-3 py-2.5">
            <CheckCircle2 size={14} className="text-green-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-xs text-green-800">No hay nada bloqueado. Seguí con los próximos pasos.</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {alerts.map((alert, i) => (
              <li key={i}>
                <Link
                  href={`/operacion/${alert.operationId}`}
                  className="flex items-start gap-2.5 rounded-xl px-3 py-2.5 hover:bg-slate-50 transition-colors"
                >
                  <AlertTriangle size={13} className="text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 truncate">{alert.title}</p>
                    <p className="text-[11px] text-slate-500">{alert.label}</p>
                  </div>
                  <span className={cn(
                    'flex-shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold',
                    alert.severity === 'HIGH' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'
                  )}>
                    {alert.severity === 'HIGH' ? 'Urgente' : 'Media'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl bg-white border border-slate-200/70 shadow-card p-4">
        <h2 className="text-sm font-bold text-slate-900 mb-3">Próximos pasos</h2>
        {nextSteps.length === 0 ? (
          <p className="text-xs text-slate-500">Cuando avances en la operación, acá aparece lo que sigue.</p>
        ) : (
          <ul className="space-y-0.5">
            {nextSteps.map(({ opTitle, action }) => (
              <li key={`${opTitle}-${action.id}`}>
                <Link
                  href={action.cta.href}
                  className="flex items-start gap-2.5 rounded-xl px-2 py-2 hover:bg-slate-50 transition-colors"
                >
                  <CircleDot
                    size={12}
                    className={cn('flex-shrink-0 mt-1', action.blocking ? 'text-red-500' : 'text-brand-500')}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-800 leading-snug">{action.title}</p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {opTitle} · {CATEGORY_LABELS[action.category]}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl bg-brand-600 text-white p-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={14} aria-hidden="true" />
          <h2 className="text-sm font-bold">VARA AI</h2>
        </div>
        <p className="text-xs text-brand-100 leading-relaxed mb-3.5">
          Preguntale cualquier duda sobre tu operación: seña, boleto, sellos, escritura.
          Responde con la información de VARA, no con lo que encuentre por ahí.
        </p>
        <Link
          href="/asistente"
          className="block rounded-xl bg-white/15 hover:bg-white/25 px-3 py-2.5 text-center text-xs font-bold transition-colors"
        >
          Hacer una consulta →
        </Link>
      </section>

      <section className="rounded-2xl bg-white border border-slate-200/70 shadow-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={14} className="text-amber-500" aria-hidden="true" />
          <h2 className="text-sm font-bold text-slate-900">VARA Labs</h2>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed mb-3">
          Negociación inteligente, simuladores, análisis IA y lo que viene.
        </p>
        <Link
          href="/vara-labs"
          className="block rounded-xl bg-amber-50 hover:bg-amber-100 px-3 py-2.5 text-center text-xs font-bold text-amber-700 transition-colors"
        >
          Explorar Labs →
        </Link>
      </section>
    </aside>
  )
}

export default function Dashboard() {
  const vara = useVaraState()
  const { operations, activeOperationId, getTransactionData, usingDemo, deleteOperation } = useOperations()
  const globalAlerts = useGlobalNextBestAction()
  const activeTxnData = activeOperationId ? getTransactionData(activeOperationId) : null
  // Sin datos reales no se cae a `mockTransaction`: el panel de la operacion
  // simplemente no se muestra. Antes VARA mostraba una casa inventada en Pilar
  // como si fuera la del usuario (P0-1 de VARA_ALT_MASTER_AUDIT.md).
  const txn = activeTxnData
  const couldNotLoadOperation = operations.length > 0 && !activeTxnData

  const [importedProp, setImportedProp] = useState<UserProperty | null>(null)
  useEffect(() => {
    let alive = true
    loadUserProperties().then(list => {
      if (alive) setImportedProp(list.find(p => p.source === 'imported') ?? null)
    })
    return () => { alive = false }
  }, [])
  const intel = txn ? computeIntelligence(txn) : null
  const [expandRisks, setExpandRisks] = useState(false)

  const statusConfig = intel ? {
    ON_TRACK: { label: 'En curso', color: 'text-green-600', dot: 'bg-green-500', bg: 'bg-green-50 border-green-100' },
    ATTENTION: { label: 'Requiere atención', color: 'text-amber-600', dot: 'bg-amber-500', bg: 'bg-amber-50 border-amber-100' },
    BLOCKED: { label: 'Acción requerida', color: 'text-red-600', dot: 'bg-red-500', bg: 'bg-red-50 border-red-100' },
  }[intel.operationStatus] : null

  // Sin operaciones propias no caemos en la demo: mostramos el estado vacío real.
  if (vara.loaded && (!vara.onboardingDone || operations.length === 0)) {
    return <EmptyState userName={vara.userName} propertyUrl={vara.propertyUrl} />
  }

  if (vara.loaded && vara.journeyType === 'SELL_PROPERTY') {
    return <SellerDashboard userName={vara.userName} province={vara.province} />
  }

  const displayName = vara.loaded && vara.userName ? vara.userName.split(' ')[0] : ''
  const buyCount = operations.filter(o => o.type === 'BUY').length
  const sellCount = operations.filter(o => o.type === 'SELL').length

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-6xl mx-auto px-4 lg:px-6 py-6">
        {/* Saludo + promesa del producto, uno al lado del otro como en el diseño nuevo. */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Hola{displayName ? `, ${displayName}` : ''} <span aria-hidden="true">👋</span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">Todo en un solo lugar. Avanzá con tranquilidad.</p>
          </div>
          <div className="flex items-start gap-2.5 rounded-2xl bg-brand-50 border border-brand-100 px-4 py-3 lg:max-w-sm">
            <Shield size={15} className="text-brand-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-xs font-bold text-slate-800">VARA te acompaña en todas tus operaciones</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Más claridad. Mejores decisiones. Menos estrés.</p>
            </div>
          </div>
        </div>

        {/* Resumen de cartera: cuántas operaciones y de qué tipo, antes del detalle. */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl bg-white border border-slate-200/70 shadow-card px-4 py-4 mb-6">
          <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
            <Briefcase size={19} className="text-brand-600" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-900">
              Tenés {operations.length} {operations.length === 1 ? 'operación activa' : 'operaciones activas'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {[
                buyCount > 0 && `${buyCount} ${buyCount === 1 ? 'compra' : 'compras'}`,
                sellCount > 0 && `${sellCount} ${sellCount === 1 ? 'venta' : 'ventas'}`,
              ].filter(Boolean).join(' · ') || 'Sin clasificar'}
            </p>
          </div>
          <Link
            href="/propiedades"
            className="flex-shrink-0 rounded-xl bg-brand-50 hover:bg-brand-100 px-4 py-2.5 text-sm font-semibold text-brand-700 transition-colors text-center"
          >
            Ver todas mis propiedades →
          </Link>
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
      <div className="space-y-4 min-w-0">

        {/* GUIDANCE BANNER — NBA contextual */}
        <GuidanceBanner />

        {/* GLOBAL NBA — alertas cross-operación */}
        {globalAlerts.length > 0 && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 space-y-1.5">
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert size={13} className="text-red-500" />
              <p className="text-xs font-bold text-red-700 uppercase tracking-wide">Alertas en tus operaciones</p>
            </div>
            {globalAlerts.map((alert, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertTriangle size={11} className="text-red-500 flex-shrink-0" />
                  <p className="text-xs text-red-700 truncate"><span className="font-semibold">{alert.title}:</span> {alert.label}</p>
                </div>
                <Link href={`/operacion/${alert.operationId}`} className="text-xs font-semibold text-red-600 hover:underline flex-shrink-0">
                  Resolver →
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* Con operaciones propias siempre mostramos la lista: ahí vive el botón de borrar. */}
        {(operations.length > 1 || !usingDemo) && (
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-sm font-bold text-slate-700">
                {usingDemo ? 'Operaciones de ejemplo' : 'Tus operaciones activas'}
              </p>
              <span className="text-xs text-slate-400">
                {usingDemo ? 'no son tuyas' : `${operations.length} ${operations.length === 1 ? 'activa' : 'activas'}`}
              </span>
            </div>
            {usingDemo && (
              <div className="flex items-start gap-2 bg-slate-100 rounded-xl px-3 py-2.5 mb-3">
                <AlertTriangle size={12} className="text-slate-500 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-600 flex-1">
                  Estas operaciones son un ejemplo para que veas cómo funciona. Cuando crees la tuya, las reemplaza.
                </p>
                <Link href="/onboarding" className="text-[11px] font-bold text-brand-600 whitespace-nowrap hover:underline">
                  Crear la mía →
                </Link>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3">
              {operations.map(op => (
                <OperationCard
                  key={op.id}
                  op={op}
                  isActive={op.id === activeOperationId}
                  onSelect={vara.setOperationId}
                  getTransactionData={getTransactionData}
                  isDemo={usingDemo}
                  onDelete={deleteOperation}
                />
              ))}
            </div>
          </div>
        )}

        {/* No pudimos resolver los datos de la operacion activa. Lo decimos:
            antes se rellenaba con una operacion ficticia. */}
        {couldNotLoadOperation && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3">
            <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
            <p className="text-xs text-amber-800 flex-1">
              No pudimos cargar el detalle de esta operación. Tus datos están guardados;
              abrí la operación para verlos.
            </p>
          </div>
        )}

        {/* PROPIEDAD IMPORTADA — el aviso que el usuario trajo de un portal */}
        {importedProp && (
          <div className="bg-white rounded-2xl shadow-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-50">
              <div className="flex items-center gap-2">
                <Building2 size={14} className="text-brand-500" />
                <h3 className="font-semibold text-slate-800 text-sm">La propiedad que estás mirando</h3>
              </div>
              {importedProp.portal && (
                <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full">
                  {importedProp.portal}
                </span>
              )}
            </div>
            <div className="flex gap-3 p-4">
              {importedProp.images[0] ? (
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={importedProp.images[0]} alt={importedProp.title} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0">
                  <Building2 size={20} className="text-slate-300" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 text-sm leading-tight truncate">{importedProp.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {[importedProp.neighborhood, importedProp.city].filter(Boolean).join(', ') || 'Ubicación sin cargar'}
                </p>
                <div className="flex items-center gap-3 mt-1.5">
                  {importedProp.price > 0 && (
                    <p className="text-sm font-extrabold text-slate-900">
                      {formatPrice(importedProp.price, importedProp.currency)}
                    </p>
                  )}
                  {importedProp.surface > 0 && (
                    <p className="text-xs text-slate-400">{importedProp.surface} m²</p>
                  )}
                  {importedProp.rooms > 0 && (
                    <p className="text-xs text-slate-400">{importedProp.rooms} amb.</p>
                  )}
                </div>
              </div>
            </div>
            {importedProp.incompleteFields.length > 0 && (
              <div className="mx-4 mb-3 flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                <AlertTriangle size={11} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-[10px] text-amber-700">
                  Falta cargar: {importedProp.incompleteFields.join(', ')}. Con esos datos el cálculo de costos se vuelve exacto.
                </p>
              </div>
            )}
            <div className="flex items-center justify-between px-4 pb-4">
              {importedProp.sourceUrl ? (
                <a href={importedProp.sourceUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-slate-400 hover:text-slate-600">Ver aviso original</a>
              ) : <span />}
              <Link href={`/propiedades/${importedProp.id}`}
                className="text-xs font-semibold text-brand-600 hover:underline">Ver ficha completa →</Link>
            </div>
          </div>
        )}

        {txn && intel && statusConfig && (<>
        {/* OPERATION CORE CARD */}
        <Link href={`/operacion/${txn.id}`} className="block bg-white rounded-2xl shadow-card p-5 hover:shadow-elevated transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{txn.type === 'BUY_PROPERTY' ? 'Compra' : 'Venta'}</span>
                <span className={cn('flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full border', statusConfig.bg, statusConfig.color)}>
                  <span className={cn('w-1.5 h-1.5 rounded-full', statusConfig.dot)} />
                  {statusConfig.label}
                </span>
              </div>
              <h2 className="font-bold text-slate-900 text-lg leading-tight">{txn.title}</h2>
              <p className="text-sm text-slate-400 flex items-center gap-1 mt-0.5">
                <MapPin size={11} /> {txn.city}, {txn.province}
              </p>
            </div>
            <ChevronRight size={18} className="text-slate-300 flex-shrink-0 mt-1" />
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-slate-400">{intel.currentStage?.label}</span>
              <span className="text-xs font-bold text-slate-700">{txn.progress}% avance</span>
            </div>
            <Progress value={txn.progress} showLabel={false} />
          </div>

          <div className="grid grid-cols-3 gap-3 border-t border-slate-50 pt-4">
            <div className="text-center">
              <p className="text-lg font-bold text-slate-900">{intel.risks.length}</p>
              <p className="text-xs text-slate-400">riesgo{intel.risks.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="text-center border-x border-slate-100">
              <p className="text-lg font-bold text-slate-900">{intel.pendingDocs.length}</p>
              <p className="text-xs text-slate-400">docs pendientes</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-slate-900">~{Math.round((intel.totalBuyerMin + intel.totalBuyerMax) / 2 / 1000)}K</p>
              <p className="text-xs text-slate-400">gastos USD</p>
            </div>
          </div>
        </Link>

        {/* NEXT BEST ACTION */}
        {intel.nextTask && (
          <div className="bg-brand-600 rounded-2xl p-5 text-white">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={13} className="opacity-50" />
              <p className="text-xs font-bold opacity-50 uppercase tracking-widest">Próxima acción</p>
            </div>
            <h3 className="font-extrabold text-base mb-1 leading-tight">{intel.nextTask.title}</h3>
            <p className="text-sm opacity-70 leading-relaxed mb-4">{intel.nextTask.why}</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs opacity-60">
                <Users size={12} />
                <span>{intel.nextTask.responsibleRole}</span>
              </div>
              <Link href={`/operacion/${txn.id}`}
                className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors">
                Resolver ahora <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        )}

        {/* RISKS */}
        {intel.risks.length > 0 && (
          <div className="bg-white rounded-2xl shadow-card overflow-hidden">
            <button
              onClick={() => setExpandRisks(o => !o)}
              className="w-full flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <ShieldAlert size={15} className="text-red-500" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-slate-800">
                    {intel.risks.filter(r => r.severity === 'HIGH').length > 0
                      ? `${intel.risks.filter(r => r.severity === 'HIGH').length} riesgo${intel.risks.filter(r => r.severity === 'HIGH').length > 1 ? 's' : ''} alto${intel.risks.filter(r => r.severity === 'HIGH').length > 1 ? 's' : ''}`
                      : `${intel.risks.length} aviso${intel.risks.length > 1 ? 's' : ''}`}
                  </p>
                  <p className="text-xs text-slate-400">Pueden afectar el avance de tu operación</p>
                </div>
              </div>
              <ChevronRight size={16} className={cn('text-slate-300 transition-transform', expandRisks && 'rotate-90')} />
            </button>
            {expandRisks && (
              <div className="border-t border-slate-50 divide-y divide-slate-50">
                {intel.risks.map((risk, i) => (
                  <div key={i} className="flex items-start gap-3 px-5 py-3.5">
                    <AlertTriangle size={14} className={cn('flex-shrink-0 mt-0.5', risk.severity === 'HIGH' ? 'text-red-500' : 'text-amber-500')} />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{risk.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{risk.detail}</p>
                    </div>
                  </div>
                ))}
                <div className="px-5 py-3">
                  <Link href={`/operacion/${txn.id}`} className="text-xs font-semibold text-brand-600 hover:underline">
                    Ver tareas pendientes →
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* COST SUMMARY */}
        <div className="bg-white rounded-2xl shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Costos de tu operación</h3>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                {intel.checklist.provinceName} · {intel.checklist.dataConfidence === 'VERIFIED' ? 'VERIFICADO' : intel.checklist.dataConfidence === 'PARTIAL' ? 'PARCIAL' : 'ESTIMADO'}
                <InfoTip label="Qué significa la confianza del dato" align="right">
                  <strong>VERIFICADO</strong>: alícuotas tomadas del organismo oficial (ARBA, AGIP) y contrastadas.{' '}
                  <strong>PARCIAL</strong>: parte de fuente oficial, parte de fuente secundaria.{' '}
                  <strong>ESTIMADO</strong>: sin fuente oficial confirmada — tomalo como referencia y validá con tu escribano.
                </InfoTip>
              </p>
            </div>
            <Link href="/costos" className="text-xs text-brand-600 font-semibold hover:underline">Calculadora →</Link>
          </div>
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Precio de la propiedad</p>
              <p className="text-xl font-extrabold text-slate-900">{formatPrice(intel.propertyPrice)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400 mb-0.5">Gastos del comprador</p>
              <p className="text-lg font-bold text-slate-700">
                {formatPrice(intel.totalBuyerMin)} – {formatPrice(intel.totalBuyerMax)}
              </p>
            </div>
          </div>
          <div className="space-y-1.5 mb-3">
            {[
              intel.checklist.costs.stampTaxBuyer,
              intel.checklist.costs.notaryFeeBuyer,
              intel.checklist.costs.registryFee,
              intel.checklist.costs.certificates,
            ].map((c, i) => (
              <div key={i} className="flex items-center justify-between">
                <p className="text-xs text-slate-400">{c.label}</p>
                <p className="text-xs font-medium text-slate-600">
                  {c.minAmount === c.maxAmount ? formatPrice(c.minAmount, c.currency) : `${formatPrice(c.minAmount, c.currency)} – ${formatPrice(c.maxAmount, c.currency)}`}
                </p>
              </div>
            ))}
          </div>
          <div className="h-px bg-slate-100 mb-3" />
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 font-medium">Total estimado</p>
            <p className="text-sm font-extrabold text-slate-900">
              {formatPrice(intel.propertyPrice + intel.totalBuyerMin)} – {formatPrice(intel.propertyPrice + intel.totalBuyerMax)}
            </p>
          </div>
          <p className="text-xs text-slate-300 mt-2">
            +{intel.checklist.costs.totalBuyer.percentMin.toFixed(1)}%–{intel.checklist.costs.totalBuyer.percentMax.toFixed(1)}% sobre el precio · Fuente: {intel.checklist.costs.stampTaxBuyer.source}
          </p>
        </div>

        {/* DOCS SNAPSHOT */}
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
            <h3 className="font-semibold text-slate-800 text-sm">Documentación</h3>
            <Link href={`/operacion/${txn.id}`} className="text-xs text-brand-600 font-semibold hover:underline">Ver todo →</Link>
          </div>
          <div className="divide-y divide-slate-50">
            {txn.documents.slice(0, 4).map(doc => {
              const statusMap = {
                PENDING: { label: 'Pendiente', color: 'text-amber-600 bg-amber-50', icon: <CircleDot size={11} /> },
                RECEIVED: { label: 'Recibido', color: 'text-blue-600 bg-blue-50', icon: <Clock size={11} /> },
                IN_REVIEW: { label: 'En revisión', color: 'text-blue-600 bg-blue-50', icon: <Clock size={11} /> },
                APPROVED: { label: 'Aprobado', color: 'text-green-600 bg-green-50', icon: <CheckCircle2 size={11} /> },
                REJECTED: { label: 'Rechazado', color: 'text-red-600 bg-red-50', icon: <AlertTriangle size={11} /> },
                EXPIRED: { label: 'Vencido', color: 'text-red-600 bg-red-50', icon: <AlertTriangle size={11} /> },
              }[doc.status] ?? { label: doc.status, color: 'text-slate-500 bg-slate-100', icon: null }
              return (
                <div key={doc.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <FileText size={14} className="text-slate-300 flex-shrink-0" />
                    <p className="text-sm text-slate-700">{doc.name}</p>
                  </div>
                  <span className={cn('flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full', statusMap.color)}>
                    {statusMap.icon}{statusMap.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* TIMELINE ESTIMATE */}
        <div className="bg-white rounded-2xl shadow-card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <Clock size={15} className="text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Tiempo estimado</p>
              <p className="text-xs text-slate-400">Desde hoy hasta escritura</p>
            </div>
            <p className="ml-auto text-sm font-semibold text-slate-400">Depende de la etapa</p>
          </div>
          <div className="flex gap-1.5">
            {['Docs', 'Negociación', 'Reserva', 'Títulos', 'Escritura'].map((step, i) => (
              <div key={step} className="flex-1 text-center">
                <div className={cn('h-1.5 rounded-full mb-1.5', i === 0 ? 'bg-brand-500' : 'bg-slate-100')} />
                <p className="text-[10px] text-slate-400 leading-tight">{step}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-300 mt-3">
            Resolver bloqueantes actuales puede reducir el plazo estimado.
          </p>
        </div>

        {/* WHAT CHANGED */}
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
            <h3 className="font-semibold text-slate-800 text-sm">Qué cambió</h3>
            <Link href={`/operacion/${txn.id}`} className="text-xs text-brand-600 font-semibold hover:underline">Ver timeline →</Link>
          </div>
          <div className="divide-y divide-slate-50">
            {[...txn.timeline].reverse().slice(0, 4).map(event => {
              const iconMap = {
                TASK_COMPLETED: <CheckCircle2 size={12} className="text-green-500" />,
                DOCUMENT_ADDED: <FileText size={12} className="text-blue-500" />,
                STAGE_CHANGED: <TrendingUp size={12} className="text-brand-500" />,
                PROFESSIONAL_ADDED: <Users size={12} className="text-purple-500" />,
                NOTE: <MessageSquare size={12} className="text-slate-400" />,
                SYSTEM: <Clock size={12} className="text-slate-400" />,
              }[event.type] ?? <Clock size={12} className="text-slate-400" />
              const d = new Date(event.date)
              const dateStr = d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
              return (
                <div key={event.id} className="flex items-start gap-3 px-5 py-3">
                  <div className="w-6 h-6 bg-slate-50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    {iconMap}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 font-medium leading-tight">{event.title}</p>
                    {event.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{event.description}</p>}
                  </div>
                  <span className="text-[11px] text-slate-300 flex-shrink-0 mt-0.5">{dateStr}{event.actor ? ` · ${event.actor}` : ''}</span>
                </div>
              )
            })}
          </div>
        </div>

        </>)}
        {/* QUICK ACCESS */}
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { href: '/costos', icon: DollarSign, label: 'Calculadora de costos', sub: 'Buenos Aires Prov.' },
            { href: '/asistente', icon: MessageSquare, label: 'Asistente VARA', sub: 'Preguntá lo que necesitás' },
            { href: '/profesionales', icon: Users, label: 'Profesionales', sub: 'Escribanos, abogados y más' },
            { href: '/propiedades', icon: FileText, label: 'Propiedades', sub: 'Explorar opciones' },
          ].map(({ href, icon: Icon, label, sub }) => (
            <Link key={href} href={href}
              className="bg-white rounded-2xl p-4 shadow-card hover:shadow-elevated transition-shadow flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Icon size={14} className="text-slate-400" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 text-xs leading-tight truncate">{label}</p>
                <p className="text-[11px] text-slate-400 mt-0.5 truncate">{sub}</p>
              </div>
            </Link>
          ))}
        </div>

      </div>

      <RightRail alerts={globalAlerts} operations={operations} getTransactionData={getTransactionData} />
      </div>
    </div>
    </div>
  )
}
