'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Loader2, Lock, ShieldAlert, Check, X, MapPin, Clock,
  AlertTriangle, Users, Inbox, Radio,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  SERVICE_LABELS, VISIT_STATUS_LABELS, PARTNER_STATUS_LABELS,
  INCIDENT_CATEGORY_LABELS, INCIDENT_SEVERITY_LABELS, INCIDENT_STATUS_LABELS,
  tierLabel,
  type PartnerPublicProfile, type SafetyIncident, type VisitBooking,
  type IncidentStatus,
} from '@/types/varaVisit'
import {
  adminListPartners, adminApprovePartner, adminSetPartnerStatus,
  adminUpsertVerification, adminGetVerification,
  adminListIncidents, adminResolveIncident,
  adminListUnassigned, adminListCoverageRequests,
} from '@/lib/supabase/visitsAdmin'
import { getMyRole, listActivePartners, assignPartner } from '@/lib/supabase/visits'
import type { CoverageRequestRow } from '@/lib/supabase/visitRows'
import { PartnerAvatar, TierBadge } from '@/components/visit/PartnerCard'

/**
 * Trust & Safety Center.
 *
 * Pantalla interna. No aparece en la navegación y está cerrada por rol: quien
 * no es ADMIN no ve nada, ni siquiera un esqueleto vacío. Igual, lo que
 * realmente protege los datos es RLS — si alguien llegara acá sin rol, cada
 * consulta volvería vacía.
 *
 * Es deliberadamente densa. La usan dos personas del equipo para tomar
 * decisiones sobre gente real; lo que necesita es que todo esté a la vista.
 */

type Tab = 'partners' | 'incidentes' | 'sin-asignar' | 'cobertura'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'incidentes', label: 'Incidentes', icon: ShieldAlert },
  { id: 'partners', label: 'Partners', icon: Users },
  { id: 'sin-asignar', label: 'Sin asignar', icon: Inbox },
  { id: 'cobertura', label: 'Cobertura pedida', icon: Radio },
]

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 p-8 text-center">
      <p className="text-sm text-slate-500">{children}</p>
    </div>
  )
}

function Flag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
      ok ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400',
    )}>
      {ok ? <Check size={9} aria-hidden="true" /> : <X size={9} aria-hidden="true" />}
      {label}
    </span>
  )
}

function AdminBtn({
  onClick, disabled, children,
}: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="rounded-lg bg-white border border-slate-200 hover:border-slate-300 disabled:opacity-40 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors">
      {children}
    </button>
  )
}

function IncidentsTab({
  incidents, onChanged,
}: {
  incidents: SafetyIncident[]
  onChanged: () => Promise<void>
}) {
  const [busyId, setBusyId] = useState<string | null>(null)

  async function resolve(i: SafetyIncident, status: IncidentStatus) {
    const resolution = window.prompt('Resolución (queda registrada):') ?? ''
    if (!resolution.trim()) return
    setBusyId(i.id)
    await adminResolveIncident(i.id, status, resolution.trim())
    await onChanged()
    setBusyId(null)
  }

  if (incidents.length === 0) return <Empty>No hay incidentes reportados.</Empty>

  return (
    <div className="space-y-3">
      {incidents.map(i => (
        <div key={i.id} className={cn(
          'bg-white rounded-2xl border p-4',
          i.severity === 'LEVEL_3_CRITICAL' ? 'border-red-300' : 'border-slate-200/70',
        )}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn(
                'rounded-lg px-2 py-0.5 text-[10px] font-bold',
                i.severity === 'LEVEL_3_CRITICAL' ? 'bg-red-100 text-red-700'
                  : i.severity === 'LEVEL_2_REVIEW' ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-100 text-slate-600',
              )}>
                {INCIDENT_SEVERITY_LABELS[i.severity]}
              </span>
              <span className="text-xs font-semibold text-slate-700">
                {INCIDENT_CATEGORY_LABELS[i.category]}
              </span>
              <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                {INCIDENT_STATUS_LABELS[i.status]}
              </span>
            </div>
            <p className="text-sm text-slate-800 mt-2 leading-relaxed">{i.description}</p>
            <p className="text-[11px] text-slate-400 mt-2">
              {new Date(i.createdAt).toLocaleString('es-AR')}
              {i.contextLocation && ' · con ubicación registrada'}
              {i.bookingId && ' · asociado a una visita'}
            </p>
            {i.resolution && (
              <p className="text-xs text-slate-600 mt-2 rounded-lg bg-slate-50 px-3 py-2">
                <strong>Resolución:</strong> {i.resolution}
              </p>
            )}
          </div>

          {(i.status === 'OPEN' || i.status === 'IN_REVIEW') && (
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100">
              <button onClick={() => resolve(i, 'ACTION_TAKEN')} disabled={busyId === i.id}
                className="rounded-lg bg-slate-900 hover:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition-colors">
                Registrar acción tomada
              </button>
              <button onClick={() => resolve(i, 'CLOSED')} disabled={busyId === i.id}
                className="rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors">
                Cerrar
              </button>
              <button onClick={() => resolve(i, 'DISMISSED')} disabled={busyId === i.id}
                className="rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors">
                Desestimar
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function PartnersTab({
  partners, onChanged,
}: {
  partners: PartnerPublicProfile[]
  onChanged: () => Promise<void>
}) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function approve(p: PartnerPublicProfile) {
    setBusyId(p.id)
    const r = await adminApprovePartner(p.id)
    setBusyId(null)
    if (!r.ok) {
      // No se activa "a mano" salteando el proceso. Decimos exactamente qué falta.
      setMessage(`No se puede activar a ${p.displayName}. Falta: ${r.missing.join(', ')}.`)
      return
    }
    setMessage(`${p.displayName} quedó activo.`)
    await onChanged()
  }

  async function setStatus(p: PartnerPublicProfile, status: 'SUSPENDED' | 'ACTIVE') {
    setBusyId(p.id)
    await adminSetPartnerStatus(p.id, status)
    await onChanged()
    setBusyId(null)
  }

  async function verify(
    p: PartnerPublicProfile,
    field: 'identity' | 'document' | 'references' | 'interview',
  ) {
    const v = await adminGetVerification(p.id)
    setBusyId(p.id)
    await adminUpsertVerification(p.id, v?.partnerId ?? p.id, {
      ...(field === 'identity' ? { identityStatus: 'VERIFIED' as const } : {}),
      ...(field === 'document' ? { documentVerificationStatus: 'VERIFIED' as const } : {}),
      ...(field === 'references' ? { referenceCheckStatus: 'VERIFIED' as const } : {}),
      ...(field === 'interview' ? { interviewStatus: 'VERIFIED' as const } : {}),
    })
    await onChanged()
    setBusyId(null)
  }

  if (partners.length === 0) {
    return <Empty>Todavía no hay nadie dado de alta como Visit Partner.</Empty>
  }

  return (
    <div className="space-y-3">
      {message && (
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 flex items-start gap-2">
          <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs text-slate-700 flex-1">{message}</p>
          <button onClick={() => setMessage(null)} aria-label="Cerrar">
            <X size={13} className="text-slate-400" aria-hidden="true" />
          </button>
        </div>
      )}

      {partners.map(p => (
        <div key={p.id} className="bg-white rounded-2xl border border-slate-200/70 p-4">
          <div className="flex items-start gap-3">
            <PartnerAvatar partner={p} size={40} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-slate-900 text-sm">{p.displayName}</p>
                <TierBadge tier={p.tier} />
                <span className={cn(
                  'rounded-lg px-2 py-0.5 text-[10px] font-bold',
                  p.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700'
                    : p.status === 'SUSPENDED' ? 'bg-red-50 text-red-700'
                    : 'bg-amber-50 text-amber-700',
                )}>
                  {PARTNER_STATUS_LABELS[p.status]}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {p.homeZoneLabel} · {tierLabel(p.tier)} · {p.metrics.completedVisits} visitas
                {p.metrics.incidentCount > 0 && (
                  <span className="text-red-600 font-semibold"> · {p.metrics.incidentCount} incidentes</span>
                )}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <Flag ok={p.verifiedIdentity} label="Identidad" />
                <Flag ok={p.verifiedDocument} label="Documento" />
                <Flag ok={p.certified} label="Certificado" />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100">
            {!p.verifiedIdentity && (
              <AdminBtn onClick={() => verify(p, 'identity')} disabled={busyId === p.id}>
                Verificar identidad
              </AdminBtn>
            )}
            {!p.verifiedDocument && (
              <AdminBtn onClick={() => verify(p, 'document')} disabled={busyId === p.id}>
                Verificar documento
              </AdminBtn>
            )}
            <AdminBtn onClick={() => verify(p, 'references')} disabled={busyId === p.id}>
              Referencias OK
            </AdminBtn>
            <AdminBtn onClick={() => verify(p, 'interview')} disabled={busyId === p.id}>
              Entrevista OK
            </AdminBtn>

            {p.status !== 'ACTIVE' && (
              <button onClick={() => approve(p)} disabled={busyId === p.id}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors flex items-center gap-1">
                <Check size={12} aria-hidden="true" /> Activar
              </button>
            )}
            {p.status === 'ACTIVE' && (
              <button onClick={() => setStatus(p, 'SUSPENDED')} disabled={busyId === p.id}
                className="rounded-lg bg-red-600 hover:bg-red-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors">
                Suspender
              </button>
            )}
            {p.status === 'SUSPENDED' && (
              <button onClick={() => setStatus(p, 'ACTIVE')} disabled={busyId === p.id}
                className="rounded-lg bg-slate-900 hover:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition-colors">
                Reactivar
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function UnassignedTab({
  bookings, onChanged,
}: {
  bookings: VisitBooking[]
  onChanged: () => Promise<void>
}) {
  const [candidates, setCandidates] = useState<PartnerPublicProfile[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => { void listActivePartners().then(setCandidates) }, [])

  async function assign(b: VisitBooking, partnerId: string) {
    setBusyId(b.id)
    await assignPartner(b.id, partnerId)
    await onChanged()
    setBusyId(null)
  }

  if (bookings.length === 0) return <Empty>No hay visitas esperando asignación.</Empty>

  return (
    <div className="space-y-3">
      {bookings.map(b => (
        <div key={b.id} className="bg-white rounded-2xl border border-slate-200/70 p-4">
          <p className="font-mono text-[10px] text-slate-400">{b.visitCode}</p>
          <p className="font-semibold text-slate-900 text-sm mt-0.5">
            {SERVICE_LABELS[b.serviceType]}
          </p>
          <p className="flex items-center gap-1 text-xs text-slate-500 mt-1">
            <MapPin size={10} aria-hidden="true" />{b.locationLabel}
            <span className="mx-1">·</span>
            <Clock size={10} aria-hidden="true" />{b.requestedDate} {b.requestedTime}
          </p>
          <span className="inline-block mt-2 rounded-lg bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
            {VISIT_STATUS_LABELS[b.status]}
          </span>

          <div className="mt-3 pt-3 border-t border-slate-100">
            {candidates.length === 0 ? (
              <p className="text-xs text-slate-500">
                No hay partners activos para asignar. Hay que sumar cobertura en esta zona.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {candidates.map(c => (
                  <button key={c.id} onClick={() => assign(b, c.id)} disabled={busyId === b.id}
                    className="rounded-lg bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors">
                    Asignar a {c.displayName}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function CoverageTab({ requests }: { requests: CoverageRequestRow[] }) {
  if (requests.length === 0) return <Empty>Nadie pidió cobertura todavía.</Empty>

  // Agrupado por zona: dice a qué barrio conviene ir a buscar partners.
  const byZone = requests.reduce<Record<string, number>>((acc, r) => {
    acc[r.zone_label] = (acc[r.zone_label] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 p-4">
      <h2 className="text-sm font-bold text-slate-900">Dónde nos están pidiendo cobertura</h2>
      <p className="text-xs text-slate-500 mt-1">
        Ordenado por demanda. Es la lista de zonas donde conviene sumar partners.
      </p>
      <ul className="mt-3 divide-y divide-slate-100">
        {Object.entries(byZone)
          .sort((a, b) => b[1] - a[1])
          .map(([zone, count]) => (
            <li key={zone} className="flex items-center justify-between py-2.5">
              <span className="text-sm text-slate-800">{zone}</span>
              <span className="text-sm font-bold text-slate-900 tabular-nums">
                {count} pedido{count > 1 ? 's' : ''}
              </span>
            </li>
          ))}
      </ul>
    </div>
  )
}

export default function AdminVisitasPage() {
  const [role, setRole] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('incidentes')
  const [partners, setPartners] = useState<PartnerPublicProfile[]>([])
  const [incidents, setIncidents] = useState<SafetyIncident[]>([])
  const [unassigned, setUnassigned] = useState<VisitBooking[]>([])
  const [coverage, setCoverage] = useState<CoverageRequestRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const r = await getMyRole()
    setRole(r)
    if (r === 'ADMIN') {
      setPartners(await adminListPartners())
      setIncidents(await adminListIncidents())
      setUnassigned(await adminListUnassigned())
      setCoverage(await adminListCoverageRequests())
    }
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-slate-400" aria-hidden="true" />
      </div>
    )
  }

  if (role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <Lock size={28} className="text-slate-300 mx-auto mb-3" aria-hidden="true" />
          <h1 className="font-bold text-slate-900">Área interna</h1>
          <p className="text-sm text-slate-500 mt-2">Esta pantalla es del equipo de VARA.</p>
          <Link href="/dashboard" className="inline-block mt-5 text-sm font-semibold text-brand-700 underline">
            Volver al inicio
          </Link>
        </div>
      </div>
    )
  }

  const openIncidents = incidents.filter(i => i.status === 'OPEN' || i.status === 'IN_REVIEW')
  const pendingPartners = partners.filter(p => p.status !== 'ACTIVE' && p.status !== 'DEACTIVATED')

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 lg:px-6 py-6">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Trust &amp; Safety
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Panel interno de VARA Visit. Lo que se decide acá afecta a personas reales.
        </p>

        <nav className="flex flex-wrap gap-1 border-b border-slate-200 mt-5" aria-label="Secciones">
          {TABS.map(t => {
            const Icon = t.icon
            const count = t.id === 'incidentes' ? openIncidents.length
              : t.id === 'partners' ? pendingPartners.length
              : t.id === 'sin-asignar' ? unassigned.length
              : coverage.length
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-semibold border-b-2 transition-colors',
                  tab === t.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500',
                )}>
                <Icon size={14} aria-hidden="true" />
                {t.label}
                {count > 0 && (
                  <span className="rounded-full bg-red-100 text-red-700 px-1.5 text-[10px] font-bold">
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="mt-5">
          {tab === 'incidentes' && <IncidentsTab incidents={incidents} onChanged={load} />}
          {tab === 'partners' && <PartnersTab partners={partners} onChanged={load} />}
          {tab === 'sin-asignar' && <UnassignedTab bookings={unassigned} onChanged={load} />}
          {tab === 'cobertura' && <CoverageTab requests={coverage} />}
        </div>
      </div>
    </div>
  )
}
