'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, ArrowRight, BarChart2, Building2, Calendar, CheckCircle2, CheckSquare, ChevronRight, Clock, DollarSign, FileText, Home,
  Loader2, MapPin, Plus, ShieldAlert, Sparkles, Trash2,
} from 'lucide-react'
import { Progress } from '@/components/ui/Progress'
import { cn, formatPrice } from '@/lib/utils'
import { priceRef } from '@/lib/market/priceReference'
import { CATEGORY_LABELS, type NextAction } from '@/lib/nba/engine'
import type { AttentionItem, BuyerCosts, DashboardProperty, FirstValue, OperationHealth, Uncertainty } from '@/lib/dashboard/firstValue'
import { fetchActivity, getLastSeen, markSeen } from '@/lib/supabase/activity'
import { newSince, isMilestone, familyOf } from '@/lib/activity/model'
import type { SellerTaskState } from '@/lib/supabase/sellerTasks'

const HEALTH_STYLE: Record<OperationHealth, { chip: string; dot: string }> = {
  NEW: { chip: 'bg-brand-50 text-brand-700 border-brand-100', dot: 'bg-brand-500' },
  ON_TRACK: { chip: 'bg-green-50 text-green-700 border-green-100', dot: 'bg-green-500' },
  ATTENTION: { chip: 'bg-amber-50 text-amber-700 border-amber-100', dot: 'bg-amber-500' },
  BLOCKED: { chip: 'bg-red-50 text-red-700 border-red-100', dot: 'bg-red-500' },
}

export interface OperationRef {
  id: string
  title: string
  type: 'BUY' | 'SELL'
  progress: number
}

/** Qué operación, en qué estado y por qué: lo primero que se lee. */
export function OperationHeader({ fv, title, place, operations, activeId, onSelect }: {
  fv: FirstValue
  title: string
  place: string
  operations: OperationRef[]
  activeId: string
  onSelect: (id: string) => void
}) {
  const style = HEALTH_STYLE[fv.health]
  return (
    <header>
      {operations.length > 1 && (
        <nav aria-label="Tus operaciones" className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
          {operations.map(o => (
            <button
              key={o.id}
              type="button"
              onClick={() => onSelect(o.id)}
              aria-pressed={o.id === activeId}
              className={cn(
                'flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                o.id === activeId ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
              )}
            >
              {o.type === 'BUY' ? 'Compra' : 'Venta'} · {o.title}
            </button>
          ))}
        </nav>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{fv.kindLabel}</span>
        <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold', style.chip)} data-testid="health">
          <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', style.dot)} />
          {fv.healthLabel}
        </span>
      </div>
      <h1 className="mt-1.5 text-2xl font-extrabold leading-tight tracking-tight text-slate-900">{title}</h1>
      {place && (
        <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500">
          <MapPin size={12} aria-hidden="true" /> {place}
        </p>
      )}
      <p className="mt-2 text-sm text-slate-600" data-testid="health-reason">{fv.healthReason}</p>

      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-medium text-slate-500">
            {fv.stage ? `Etapa ${fv.stage.index} de ${fv.stage.total} · ${fv.stage.label}` : 'Sin etapa'}
          </span>
          <span className="font-bold tabular-nums text-slate-700">{fv.progress}%</span>
        </div>
        <Progress value={fv.progress} showLabel={false} />
      </div>
    </header>
  )
}

/** Lo que no sabemos y por qué importa. Nunca se rellena con un número en cero. */
export function UncertaintyNotice({ items }: { items: Uncertainty[] }) {
  if (items.length === 0) return null
  return (
    <section aria-label="Lo que falta saber" className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-amber-700">Lo que falta saber</p>
      <ul className="space-y-2">
        {items.map(u => (
          <li key={u.id} className="flex items-start gap-2 text-sm text-amber-900">
            <AlertTriangle size={13} className="mt-1 flex-shrink-0 text-amber-500" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              {u.text}
              {u.cta && (
                <>
                  {' '}
                  <Link href={u.cta.href} className="font-semibold underline underline-offset-2">{u.cta.label}</Link>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Las dos acciones que siguen. Compactas: la que importa ya está arriba. */
export function UpNextList({ actions }: { actions: NextAction[] }) {
  if (actions.length === 0) return null
  return (
    <section aria-label="Después de esto" className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-card">
      <h2 className="mb-1 text-sm font-bold text-slate-900">Después de esto</h2>
      <ul>
        {actions.map(a => (
          <li key={a.id}>
            <Link href={a.cta.href} className="flex items-center gap-3 rounded-xl px-1 py-2.5 transition-colors hover:bg-slate-50">
              <span aria-hidden="true" className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-500" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-800">{a.title}</span>
                <span className="block text-[11px] text-slate-400">{CATEGORY_LABELS[a.category]}</span>
              </span>
              <ChevronRight size={14} className="flex-shrink-0 text-slate-300" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function AttentionCard({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) return null
  return (
    <section aria-label="Lo que frena la operación" className="rounded-2xl border border-red-100 bg-white p-4 shadow-card">
      <div className="mb-2 flex items-center gap-2">
        <ShieldAlert size={15} className="text-red-500" aria-hidden="true" />
        <h2 className="text-sm font-bold text-slate-900">Qué la frena</h2>
      </div>
      <ul className="space-y-2.5">
        {items.map(i => (
          <li key={i.id} className="flex items-start gap-2.5">
            <AlertTriangle size={13} className={cn('mt-0.5 flex-shrink-0', i.severity === 'HIGH' ? 'text-red-500' : 'text-amber-500')} aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800">{i.label}</p>
              <p className="text-xs text-slate-500">{i.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function PropertyCard({ property, label }: { property: DashboardProperty; label: string }) {
  return (
    <section aria-label={label} className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card">
      <div className="flex gap-3 p-4">
        {property.images?.[0] ? (
          <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={property.images[0]} alt="" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-xl bg-slate-50">
            <Building2 size={20} className="text-slate-300" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
          <p className="truncate text-sm font-bold leading-tight text-slate-900">{property.title}</p>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {[property.neighborhood, property.city].filter(Boolean).join(', ') || 'Ubicación sin cargar'}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
            {property.price > 0 ? <span className="text-sm font-extrabold text-slate-900">{formatPrice(property.price, property.currency)}</span> : <span>Precio sin cargar</span>}
            {property.surface > 0 && <span>{property.surface} m²</span>}
            {property.rooms > 0 && <span>{property.rooms} amb.</span>}
          </div>
        </div>
      </div>
      <div className="border-t border-slate-50 px-4 py-2.5 text-right">
        <Link href={`/propiedades/${property.id}`} className="text-xs font-semibold text-brand-600 hover:underline">Ver ficha completa →</Link>
      </div>
    </section>
  )
}

const CONFIDENCE_LABEL = { VERIFIED: 'Verificado', PARTIAL: 'Parcial', ESTIMATED: 'Estimado' } as const

/** Solo con costos calculados de verdad. Si no hay precio, la incertidumbre lo explica: no se muestra "$0". */
export function CostsCard({ costs }: { costs: BuyerCosts }) {
  if (!costs.known) return null
  return (
    <section aria-label="Costos estimados" className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-card">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Cuánto te sale</h2>
          <p className="mt-0.5 text-xs text-slate-500">{costs.provinceName} · {CONFIDENCE_LABEL[costs.confidence]}</p>
        </div>
        <Link href="/costos" className="flex-shrink-0 text-xs font-semibold text-brand-600 hover:underline">Calculadora →</Link>
      </div>
      <p className="text-xs text-slate-500">Gastos del comprador (aparte del precio)</p>
      <p className="text-xl font-extrabold text-slate-900">{formatPrice(costs.min, 'USD')} – {formatPrice(costs.max, 'USD')}</p>
      <p className="mt-0.5 text-xs text-slate-400">≈ {costs.percentMin.toFixed(1)}%–{costs.percentMax.toFixed(1)}% sobre el precio</p>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold text-slate-500">Ver el detalle</summary>
        <ul className="mt-2 space-y-1.5">
          {costs.lines.map(l => (
            <li key={l.label} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-500">{l.label}</span>
              <span className="flex-shrink-0 font-medium text-slate-700">
                {l.min === l.max ? formatPrice(l.min, 'USD') : `${formatPrice(l.min, 'USD')} – ${formatPrice(l.max, 'USD')}`}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-slate-400">Fuente: {costs.source}</p>
      </details>
    </section>
  )
}

export function DocsRow({ pending, operationId }: { pending: number; operationId: string }) {
  return (
    <Link
      href={`/operacion/${operationId}?tab=documentos`}
      className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white px-4 py-3 shadow-card transition-shadow hover:shadow-elevated"
    >
      <FileText size={15} className="flex-shrink-0 text-slate-400" aria-hidden="true" />
      <span className="flex-1 text-sm text-slate-700">
        {pending > 0 ? <><strong className="font-bold text-slate-900">{pending}</strong> {pending === 1 ? 'documento pendiente' : 'documentos pendientes'}</> : 'Sin documentos pendientes'}
      </span>
      <span className="text-xs font-semibold text-brand-600">Ver →</span>
    </Link>
  )
}

/** Estado vacío: una sola decisión. Sin demos ni promociones. */
export function EmptyDashboard() {
  return (
    <div className="mx-auto min-h-[70vh] max-w-xl px-4 py-12">
      <div className="rounded-3xl border border-slate-200/70 bg-white p-7 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50">
          <Plus size={24} className="text-brand-600" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Empezá tu operación</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
          Contanos si comprás o vendés y en qué provincia. VARA arma tu plan, tus costos y tus próximos pasos.
        </p>
        <Link
          href="/onboarding"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-700"
        >
          Crear mi operación <ArrowRight size={16} aria-hidden="true" />
        </Link>
        <p className="mt-4 text-xs text-slate-400">
          ¿Tenés un aviso para revisar?{' '}
          <Link href="/analizar" className="font-semibold text-brand-600 hover:underline">Analizar una propiedad</Link>
        </p>
      </div>
    </div>
  )
}

export function DashboardLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Cargando">
      <Loader2 size={20} className="animate-spin text-slate-300" />
    </div>
  )
}

/** Otras operaciones y administración (borrar). Colapsado: no compite con la acción. */
export function OperationsPanel({ operations, activeId, onSelect, onDelete }: {
  operations: OperationRef[]
  activeId: string
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <details className="rounded-2xl border border-slate-200/70 bg-white shadow-card">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-700">
        {operations.length > 1 ? `Tus operaciones (${operations.length})` : 'Administrar esta operación'}
      </summary>
      <ul className="divide-y divide-slate-50 border-t border-slate-50">
        {operations.map(o => (
          <li key={o.id} className="flex items-center gap-3 px-4 py-3">
            <button type="button" onClick={() => onSelect(o.id)} className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-medium text-slate-800">{o.title}{o.id === activeId ? ' · activa' : ''}</span>
              <span className="block text-[11px] text-slate-400">{o.type === 'BUY' ? 'Compra' : 'Venta'} · {o.progress}%</span>
            </button>
            <button
              type="button"
              onClick={() => { if (confirm(`¿Borrar "${o.title}"? No se puede deshacer.`)) onDelete(o.id) }}
              aria-label={`Borrar ${o.title}`}
              title="Borrar operación"
              className="rounded-lg p-1.5 text-slate-300 transition-colors hover:text-red-500"
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
    </details>
  )
}

/** Novedades reales (eventos de actividad) desde la última visita. Si no hay, no se muestra nada. */
export function NovedadesWidget({ operationId }: { operationId: string }) {
  const [events, setEvents] = useState<ReturnType<typeof newSince>>(null)

  useEffect(() => {
    let alive = true
    const lastSeen = getLastSeen(operationId)
    markSeen(operationId)
    fetchActivity(operationId).then(all => {
      if (alive) setEvents(newSince(all.filter(isMilestone), lastSeen))
    })
    return () => { alive = false }
  }, [operationId])

  if (!events || events.length === 0) return null

  const icon = (kind: (typeof events)[0]['kind']) => {
    const f = familyOf(kind)
    if (f === 'DOCUMENT') return <FileText size={12} className="text-blue-500" />
    if (f === 'OFFER') return <DollarSign size={12} className="text-green-500" />
    if (f === 'PROPERTY') return <Home size={12} className="text-brand-500" />
    return <Clock size={12} className="text-slate-400" />
  }

  return (
    <section aria-label="Novedades" className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-card">
      <div className="flex items-center gap-2 border-b border-slate-50 bg-brand-50/40 px-4 py-3">
        <Sparkles size={13} className="text-brand-500" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-slate-800">
          {events.length === 1 ? 'Una novedad desde tu última visita' : `${events.length} novedades desde tu última visita`}
        </h2>
      </div>
      <ul className="divide-y divide-slate-50">
        {events.slice(0, 5).map(e => (
          <li key={e.id} className="flex items-start gap-3 px-4 py-3">
            <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-50">{icon(e.kind)}</span>
            <p className="min-w-0 flex-1 text-sm leading-snug text-slate-700">{e.summary}</p>
            <span className="mt-0.5 flex-shrink-0 whitespace-nowrap text-[11px] text-slate-300">
              {new Date(e.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ───────────────────────── Venta ─────────────────────────

/** Días estimados desde hoy para cada paso de una venta típica en Argentina. */
const ESTIMATED_DAYS: Record<string, number> = { docs: 7, price: 3, photos: 10, publish: 14, visits: 30, offer: 60, escritura: 120 }

export function isoDate(daysFromNow: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString().slice(0, 10)
}

export function estimatedDueDate(key: string): string {
  return isoDate(ESTIMATED_DAYS[key] ?? 30)
}

function fmtDueDate(iso: string): string {
  const [y, m, day] = iso.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

export function SellerChecklist({ tasks, onToggle, onDate, onEstimate }: {
  tasks: SellerTaskState[]
  onToggle: (key: string) => void
  onDate: (key: string, date: string) => void
  onEstimate: () => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  if (tasks.length === 0) return null
  const done = tasks.filter(t => t.done).length
  return (
    <section aria-label="Plan de venta" className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-slate-50 px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <CheckSquare size={15} className="text-amber-500" aria-hidden="true" />
          <h2 className="text-sm font-bold text-slate-900">Tu plan de venta</h2>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onEstimate} className="flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700">
            <Sparkles size={10} aria-hidden="true" /> Estimar fechas
          </button>
          <span className="text-xs text-slate-400">{done}/{tasks.length}</span>
        </div>
      </div>
      <ul className="divide-y divide-slate-50">
        {tasks.map(task => (
          <li key={task.key} className="flex items-center gap-2 px-4 py-3">
            <button type="button" onClick={() => onToggle(task.key)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <span className={cn('flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors', task.done ? 'border-brand-600 bg-brand-600' : 'border-slate-200')}>
                {task.done && <CheckCircle2 size={12} className="text-white" strokeWidth={3} />}
              </span>
              <span className="min-w-0">
                <span className={cn('block text-sm font-medium leading-tight', task.done ? 'text-slate-400 line-through' : 'text-slate-800')}>{task.title}</span>
                <span className="mt-0.5 block truncate text-xs text-slate-400">{task.description}</span>
              </span>
            </button>
            <div className="flex-shrink-0">
              {editing === task.key ? (
                <input
                  type="date"
                  autoFocus
                  value={task.dueDate ?? ''}
                  onChange={e => onDate(task.key, e.target.value)}
                  onBlur={() => setEditing(null)}
                  className="rounded-lg border border-brand-300 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-brand-500"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing(task.key)}
                  title={task.dueDate ? 'Cambiar fecha' : 'Fijar fecha'}
                  className={cn('flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] transition-colors', task.dueDate ? 'bg-brand-50 font-semibold text-brand-600 hover:bg-brand-100' : 'text-slate-300 hover:bg-slate-100 hover:text-slate-500')}
                >
                  {task.dueDate ? fmtDueDate(task.dueDate) : <Calendar size={11} />}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Referencias generales de la venta, colapsadas: son orientativas, no un cálculo del caso del usuario. */
export function SellerReferences({ province }: { province: string }) {
  const [m2, setM2] = useState('')
  const ref = priceRef(province)
  const n = parseFloat(m2)
  const has = !isNaN(n) && n > 0
  const estMin = has ? Math.round((n * ref.min) / 1000) * 1000 : null
  const estMax = has ? Math.round((n * ref.max) / 1000) * 1000 : null
  const costs = [
    { label: 'Comisión inmobiliaria', value: '3–4% del precio' },
    { label: 'Honorarios escribano', value: '~1% del precio' },
    { label: 'ITI / Ganancia', value: '1.5–3% según caso' },
    { label: 'Plusvalía municipal', value: 'Varía por provincia' },
  ]
  return (
    <details className="rounded-2xl border border-slate-200/70 bg-white shadow-card">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-700">
        <BarChart2 size={14} className="text-amber-500" aria-hidden="true" /> Referencias de precio y costos
      </summary>
      <div className="space-y-4 border-t border-slate-50 px-4 py-4">
        <div>
          <p className="text-xs text-slate-500">{ref.label} · referencia histórica 2024–2025, por m²</p>
          <p className="mt-1 text-sm font-bold text-slate-900">USD {ref.min.toLocaleString('es-AR')} – {ref.max.toLocaleString('es-AR')}</p>
          <label className="mb-1.5 mt-3 block text-xs font-semibold text-slate-500" htmlFor="seller-m2">¿Cuántos m² tiene tu propiedad?</label>
          <input
            id="seller-m2"
            type="number"
            value={m2}
            onChange={e => setM2(e.target.value)}
            placeholder="Ej: 75"
            className="w-full rounded-xl border-2 border-slate-100 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-brand-400"
          />
          {estMin && estMax && (
            <p className="mt-2 rounded-xl border border-brand-100 bg-brand-50 p-3 text-sm font-bold text-slate-900">
              <span className="block text-[10px] font-bold uppercase tracking-wide text-brand-600">Estimado · rango de publicación</span>
              USD {estMin.toLocaleString('es-AR')} – {estMax.toLocaleString('es-AR')}
              <span className="mt-0.5 block text-[11px] font-normal text-slate-400">{m2} m² × referencia. Verificalo con comparables reales.</span>
            </p>
          )}
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-600">Costos del vendedor (valores generales, no calculados para tu caso)</p>
          <ul className="space-y-1.5">
            {costs.map(c => (
              <li key={c.label} className="flex items-center justify-between text-xs">
                <span className="text-slate-500">{c.label}</span>
                <span className="font-semibold text-slate-700">{c.value}</span>
              </li>
            ))}
          </ul>
          <Link href="/costos" className="mt-2 inline-block text-xs font-semibold text-brand-600 hover:underline">Calculadora →</Link>
        </div>
      </div>
    </details>
  )
}
