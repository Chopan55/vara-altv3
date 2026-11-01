'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Calendar, Clock, User, CheckCircle2, XCircle,
  Phone, MessageSquare, MapPin, ChevronDown, ChevronUp, Plus,
  Sparkles, Loader2, Copy, ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { tryCreateClient } from '@/lib/supabase/client'
import type { VisitStatusDb } from '@/lib/supabase/types'

type SolicitudEstado = 'PENDIENTE' | 'CONFIRMADA' | 'RECHAZADA' | 'REALIZADA'

interface SolicitudVisita {
  id: string
  compradorNombre: string
  compradorTelefono: string
  fecha: string
  hora: string
  mensaje?: string
  estado: SolicitudEstado
  agente?: string
  isMockData: true
}

const MOCK_SOLICITUDES: SolicitudVisita[] = [
  {
    id: 'sv-001',
    compradorNombre: 'Martín Gutiérrez',
    compradorTelefono: '+54 11 5555-1234',
    fecha: '2026-09-22',
    hora: '11:00',
    mensaje: 'Tengo pre-aprobación hipotecaria. Quiero ver especialmente el garaje y el jardín.',
    estado: 'PENDIENTE',
    agente: 'Inmobiliaria del Norte',
    isMockData: true,
  },
  {
    id: 'sv-002',
    compradorNombre: 'Valeria Moreno',
    compradorTelefono: '+54 11 5555-5678',
    fecha: '2026-09-23',
    hora: '16:30',
    mensaje: 'Vengo con mi pareja. Nos interesan los ambientes y la luz.',
    estado: 'CONFIRMADA',
    isMockData: true,
  },
  {
    id: 'sv-003',
    compradorNombre: 'Pablo Herrera',
    compradorTelefono: '+54 11 5555-9012',
    fecha: '2026-09-19',
    hora: '10:00',
    estado: 'REALIZADA',
    agente: 'RE/MAX Pilar',
    isMockData: true,
  },
  {
    id: 'sv-004',
    compradorNombre: 'Claudia Ríos',
    compradorTelefono: '+54 11 5555-3456',
    fecha: '2026-09-18',
    hora: '15:00',
    mensaje: 'Cancelé por viaje de trabajo.',
    estado: 'RECHAZADA',
    isMockData: true,
  },
]

/** PIN determinístico de 6 dígitos derivado del ID de la visita. */
function generatePin(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return String(hash % 1000000).padStart(6, '0')
}

const ESTADO_CONFIG: Record<SolicitudEstado, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  PENDIENTE:  { label: 'Pendiente',  color: 'text-amber-700',   bg: 'bg-amber-50',   icon: Clock },
  CONFIRMADA: { label: 'Confirmada', color: 'text-emerald-700', bg: 'bg-emerald-50', icon: CheckCircle2 },
  RECHAZADA:  { label: 'Rechazada', color: 'text-red-600',     bg: 'bg-red-50',     icon: XCircle },
  REALIZADA:  { label: 'Realizada',  color: 'text-slate-500',   bg: 'bg-slate-100',  icon: CheckCircle2 },
}

function formatFecha(fecha: string) {
  const d = new Date(fecha + 'T12:00:00')
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function VisitasVendedorPage() {
  const [solicitudes, setSolicitudes] = useState<SolicitudVisita[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [tab, setTab] = useState<'proximas' | 'historial'>('proximas')
  const [loaded, setLoaded] = useState(false)
  const [analyzing, setAnalyzing] = useState<Record<string, boolean>>({})
  const [analysis, setAnalysis] = useState<Record<string, string>>({})
  const [pinCopied, setPinCopied] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let alive = true
    const supabase = tryCreateClient()
    if (!supabase) { setLoaded(true); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase as any).auth.getUser().then(({ data }: any) => {
      const userId: string | null = data?.user?.id ?? null
      if (!userId) { setLoaded(true); return }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(supabase as any)
        .from('visit_requests')
        .select('id, buyer_name, buyer_phone, visit_date, visit_time, message, status, agent')
        .eq('user_id', userId)
        .order('visit_date', { ascending: false })
        .then(({ data: rows }: { data: unknown[] | null }) => {
          if (!alive) return
          if (rows) {
            setSolicitudes(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (rows as any[]).map(r => ({
                id: r.id as string,
                compradorNombre: r.buyer_name as string,
                compradorTelefono: (r.buyer_phone ?? '') as string,
                fecha: r.visit_date as string,
                hora: (r.visit_time ?? '') as string,
                mensaje: r.message as string | undefined,
                estado: r.status as SolicitudEstado,
                agente: r.agent as string | undefined,
                isMockData: false as unknown as true,
              }))
            )
          }
          setLoaded(true)
        })
        .catch(() => setLoaded(true))
    })
    return () => { alive = false }
  }, [])

  const showingExample = solicitudes.some(s => s.isMockData)

  const loadExample = () => {
    setSolicitudes(MOCK_SOLICITUDES)
    setExpanded('sv-001')
  }

  const clearAll = () => {
    setSolicitudes([])
    setExpanded(null)
  }

  const analyzeMessage = async (id: string, mensaje: string) => {
    if (analyzing[id]) return
    setAnalyzing(prev => ({ ...prev, [id]: true }))
    try {
      const res = await fetch('/api/negotiation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'analyze',
          message: mensaje,
          context: { counterpartyRole: 'Comprador interesado' },
          country: 'AR',
        }),
      })
      const data = await res.json() as { suggestedReply?: string; analysis?: string; error?: string }
      const text = data.analysis ?? data.suggestedReply ?? data.error ?? 'Sin análisis disponible.'
      setAnalysis(prev => ({ ...prev, [id]: text }))
    } catch {
      setAnalysis(prev => ({ ...prev, [id]: 'No se pudo analizar. Revisá tu conexión.' }))
    } finally {
      setAnalyzing(prev => ({ ...prev, [id]: false }))
    }
  }

  const updateEstado = (id: string, estado: SolicitudEstado) => {
    setSolicitudes(prev => prev.map(s => s.id === id ? { ...s, estado } : s))
    const supabase = tryCreateClient()
    if (supabase) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      void (supabase as any).from('visit_requests').update({ status: estado as VisitStatusDb }).eq('id', id)
    }
  }

  const proximas = solicitudes.filter(s => s.estado === 'PENDIENTE' || s.estado === 'CONFIRMADA')
  const historial = solicitudes.filter(s => s.estado === 'REALIZADA' || s.estado === 'RECHAZADA')
  const pendientes = solicitudes.filter(s => s.estado === 'PENDIENTE').length

  const lista = tab === 'proximas' ? proximas : historial

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="px-4 lg:px-6 pt-8 pb-3">
        <div className="max-w-4xl mx-auto">
                      <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm mb-4 transition-colors">
              <ArrowLeft size={14} /> Volver al inicio
            </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Visitas</h1>
              <p className="text-sm text-slate-500 mt-1">
                {solicitudes.length === 0
                  ? 'Sin solicitudes todavía'
                  : `${solicitudes.length} solicitud${solicitudes.length > 1 ? 'es' : ''} total${solicitudes.length > 1 ? 'es' : ''}`}
              </p>
            </div>
            {pendientes > 0 && (
              <span className="flex items-center gap-1 text-xs font-bold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">
                <Clock size={11} /> {pendientes} pendiente{pendientes > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-5 pb-20 space-y-4">

        {showingExample && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3">
            <Clock size={14} className="text-amber-500 flex-shrink-0" />
            <p className="text-xs text-amber-800 flex-1">
              Estás viendo un <strong>ejemplo</strong>. Estos compradores no son reales.
            </p>
            <button onClick={clearAll} className="text-xs font-bold text-amber-700 hover:text-amber-900 whitespace-nowrap">
              Vaciar
            </button>
          </div>
        )}

        {loaded && solicitudes.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-8 text-center">
            <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar size={24} className="text-slate-300" />
            </div>
            <p className="font-bold text-slate-900 mb-1">Todavía no recibiste solicitudes</p>
            <p className="text-sm text-slate-400 mb-5 max-w-sm mx-auto leading-relaxed">
              Cuando publiques tu propiedad y un comprador pida verla, la solicitud aparece acá para que la confirmes o rechaces.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Link href="/publicar"
                className="flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 text-sm font-bold px-4 py-2.5 rounded-xl transition-colors">
                <Plus size={14} /> Publicar mi propiedad
              </Link>
              <button onClick={loadExample}
                className="flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-500 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
                Ver un ejemplo
              </button>
            </div>
          </div>
        )}

        {solicitudes.length > 0 && (
        <>
        {/* Resumen */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Pendientes', value: solicitudes.filter(s => s.estado === 'PENDIENTE').length, color: 'text-amber-600' },
            { label: 'Confirmadas', value: solicitudes.filter(s => s.estado === 'CONFIRMADA').length, color: 'text-emerald-600' },
            { label: 'Realizadas', value: solicitudes.filter(s => s.estado === 'REALIZADA').length, color: 'text-slate-700' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-slate-100 p-4 text-center">
              <p className={cn('text-2xl font-extrabold', color)}>{value}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-2xl p-1">
          {([
            { id: 'proximas' as const, label: `Próximas (${proximas.length})`, Icon: Calendar },
            { id: 'historial' as const, label: `Historial (${historial.length})`, Icon: Clock },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all',
                tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <t.Icon size={12} /> {t.label}
            </button>
          ))}
        </div>

        {/* Lista */}
        {lista.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
            <p className="text-slate-400 text-sm">Sin solicitudes en esta sección</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lista.map(s => {
              const cfg = ESTADO_CONFIG[s.estado]
              const StatusIcon = cfg.icon
              const isOpen = expanded === s.id
              return (
                <div key={s.id} className="bg-white rounded-2xl border border-slate-200/70 shadow-card overflow-hidden">
                  <button
                    className="w-full flex items-center gap-3 p-4 text-left"
                    onClick={() => setExpanded(isOpen ? null : s.id)}
                  >
                    <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', cfg.bg)}>
                      <StatusIcon size={16} className={cfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900 text-sm">{s.compradorNombre}</p>
                        <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', cfg.bg, cfg.color)}>
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                        <Calendar size={10} /> {formatFecha(s.fecha)} · {s.hora}hs
                      </p>
                    </div>
                    {isOpen ? <ChevronUp size={14} className="text-slate-300 flex-shrink-0" /> : <ChevronDown size={14} className="text-slate-300 flex-shrink-0" />}
                  </button>

                  {isOpen && (
                    <div className="border-t border-slate-50 px-4 pb-4 pt-3 space-y-3">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <User size={12} className="flex-shrink-0" />
                        <span>{s.compradorNombre}</span>
                        {s.agente && <span className="text-slate-300">·</span>}
                        {s.agente && <span>{s.agente}</span>}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <MapPin size={12} className="flex-shrink-0" />
                        <span>Av. Los Robles 432, La Lonja · Pilar</span>
                      </div>
                      {s.mensaje && (
                        <div className="bg-slate-50 rounded-xl p-3">
                          <p className="text-xs text-slate-600 italic">&ldquo;{s.mensaje}&rdquo;</p>
                        </div>
                      )}

                      <div className="flex gap-2 flex-wrap">
                        {s.compradorTelefono && (
                          <a
                            href={`tel:${s.compradorTelefono}`}
                            className="flex items-center gap-1.5 bg-slate-100 text-slate-700 text-[11px] font-semibold px-3 py-2 rounded-xl hover:bg-slate-200 transition-colors"
                          >
                            <Phone size={11} /> {s.compradorTelefono}
                          </a>
                        )}
                        {s.mensaje && (
                          <button
                            onClick={() => analyzeMessage(s.id, s.mensaje!)}
                            disabled={!!analyzing[s.id]}
                            className="flex items-center gap-1.5 bg-brand-50 text-brand-700 text-[11px] font-semibold px-3 py-2 rounded-xl hover:bg-brand-100 disabled:opacity-60 transition-colors"
                          >
                            {analyzing[s.id]
                              ? <Loader2 size={11} className="animate-spin" />
                              : <Sparkles size={11} />
                            }
                            {analysis[s.id] ? 'Re-analizar' : 'Analizar con VARA'}
                          </button>
                        )}
                      </div>

                      {analysis[s.id] && (
                        <div className="bg-brand-50 rounded-xl p-3 border border-brand-100">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Sparkles size={11} className="text-brand-600" />
                            <span className="text-[10px] font-bold text-brand-700 uppercase tracking-widest">Análisis VARA</span>
                          </div>
                          <p className="text-xs text-slate-700 leading-relaxed">{analysis[s.id]}</p>
                        </div>
                      )}

                      {s.estado === 'PENDIENTE' && (
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => updateEstado(s.id, 'CONFIRMADA')}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold py-2.5 rounded-xl transition-colors"
                          >
                            <CheckCircle2 size={13} /> Confirmar visita
                          </button>
                          <button
                            onClick={() => updateEstado(s.id, 'RECHAZADA')}
                            className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 text-[11px] font-semibold px-4 py-2.5 rounded-xl transition-colors"
                          >
                            <XCircle size={13} /> Rechazar
                          </button>
                        </div>
                      )}

                      {s.estado === 'CONFIRMADA' && (() => {
                        const pin = generatePin(s.id)
                        const waText = encodeURIComponent(`Hola ${s.compradorNombre}, tu visita está confirmada. Tu PIN de verificación es: ${pin} — presentalo cuando llegues.`)
                        const copyPin = () => {
                          navigator.clipboard.writeText(pin).catch(() => {})
                          setPinCopied(prev => ({ ...prev, [s.id]: true }))
                          setTimeout(() => setPinCopied(prev => ({ ...prev, [s.id]: false })), 2000)
                        }
                        return (
                          <>
                            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <ShieldCheck size={13} className="text-emerald-600" />
                                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">PIN de verificación</span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-2xl font-extrabold text-slate-900 tracking-widest font-mono">{pin}</span>
                                <div className="flex gap-2">
                                  <button
                                    onClick={copyPin}
                                    className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-white border border-emerald-200 px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
                                  >
                                    {pinCopied[s.id] ? <CheckCircle2 size={11} /> : <Copy size={11} />}
                                    {pinCopied[s.id] ? 'Copiado' : 'Copiar'}
                                  </button>
                                  {s.compradorTelefono && (
                                    <a
                                      href={`https://wa.me/${s.compradorTelefono.replace(/\D/g, '')}?text=${waText}`}
                                      target="_blank" rel="noopener noreferrer"
                                      className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-white border border-emerald-200 px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
                                    >
                                      <Phone size={11} /> Enviar por WhatsApp
                                    </a>
                                  )}
                                </div>
                              </div>
                              <p className="text-[10px] text-emerald-600 mt-1.5 leading-relaxed">
                                Compartí este PIN con el comprador. Pedíselo cuando llegue para confirmar que es quien dijo ser.
                              </p>
                            </div>
                            <button
                              onClick={() => updateEstado(s.id, 'REALIZADA')}
                              className="w-full flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold py-2.5 rounded-xl transition-colors"
                            >
                              <CheckCircle2 size={13} /> Marcar como realizada
                            </button>
                          </>
                        )
                      })()}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        </>
        )}

      </div>
    </div>
  )
}
