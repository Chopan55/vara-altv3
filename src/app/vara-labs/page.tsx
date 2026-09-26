'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Sparkles, Zap, Brain, FlaskConical,
  ChevronRight, ChevronDown, Globe, Shield, Users,
  Network, Workflow, Building2, TrendingUp, Handshake,
  FileSearch, MapPin, Bell, BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Estado = 'LISTO' | 'BETA' | 'EN_DESARROLLO' | 'PRONTO' | 'EXPERIMENTO' | 'FUTURO'

interface LabFeature {
  id: string
  nombre: string
  descripcion: string
  detalle: string
  estado: Estado
  href?: string
  icon: React.ElementType
  tag?: string
}

const FEATURES: LabFeature[] = [
  // ── YA DISPONIBLES ──
  {
    id: 'lf-004',
    nombre: 'Comparar propiedades',
    descripcion: 'Hasta 3 propiedades lado a lado: precio, superficie, costo por m².',
    detalle: 'Seleccioná propiedades de tu lista y VARA las pone en una tabla comparativa. No hay un puntaje único: VARA marca cuál gana en cada dato y el peso te lo das vos.',
    estado: 'LISTO',
    href: '/propiedades',
    icon: Sparkles,
    tag: 'Compradores',
  },
  {
    id: 'lf-007',
    nombre: 'Comparar contra el mercado',
    descripcion: 'Pegá links de avisos similares y VARA te dice dónde cae tu precio.',
    detalle: 'Funciona con MercadoLibre (lee la ficha oficial) y con otros portales (lee la publicación). Te da el precio por m² de la competencia y lo compara con el tuyo.',
    estado: 'LISTO',
    href: '/dinero?tab=precios',
    icon: Zap,
    tag: 'Vendedores',
  },
  {
    id: 'lf-008',
    nombre: 'Coach de Negociación',
    descripcion: 'Pegá lo que te mandaron por WhatsApp o mail. VARA te dice qué responder.',
    detalle: 'VARA analiza el mensaje, detecta el perfil de la contraparte (agresivo, empático, racional, difícil), identifica las señales clave y te genera una respuesta lista para copiar. También te dice qué no decir.',
    estado: 'LISTO',
    href: '/negociacion',
    icon: Handshake,
    tag: 'Todos',
  },

  // ── EN DESARROLLO ──
  {
    id: 'lf-010',
    nombre: 'LATAM Ready — Multi-país',
    descripcion: 'VARA adaptado a México, Chile, Colombia y más países de LATAM.',
    detalle: 'Selector de país con terminología local (escritura vs. escrituración vs. promesa de compraventa), moneda, locale y reglas fiscales por jurisdicción. Los Jurisdiction Packs reemplazan el hardcoding actual de Argentina. Primer target: México.',
    estado: 'EN_DESARROLLO',
    icon: Globe,
    tag: 'Todos',
  },
  {
    id: 'lf-011',
    nombre: 'Trust Passport',
    descripcion: 'Identidad, verificaciones y señales de confianza de todos los participantes.',
    detalle: 'Cada comprador, vendedor, Visit Partner y profesional tiene un "pasaporte" con sus verificaciones (identidad, ingresos, referencias) y su historial en VARA. Permite que la contraparte sepa con quién está cerrando antes de avanzar.',
    estado: 'EN_DESARROLLO',
    icon: Shield,
    tag: 'Todos',
  },
  {
    id: 'lf-012',
    nombre: 'Next Best Action (engine real)',
    descripcion: 'VARA detecta tu situación y te dice exactamente qué hacer ahora.',
    detalle: 'No es un banner estático: es un engine que cruza el estado de tu operación (tareas, documentos, ofertas, fechas) y genera una acción priorizada. "Falta la inhibición del vendedor — pedila antes de avanzar" o "Pasaron 5 días sin respuesta, es hora de hacer un seguimiento".',
    estado: 'EN_DESARROLLO',
    icon: Brain,
    tag: 'Todos',
  },
  {
    id: 'lf-013',
    nombre: 'Shared Transaction State',
    descripcion: 'Comprador, vendedor y profesionales trabajando en la misma operación.',
    detalle: 'Una operación compartida donde cada parte ve lo que le corresponde con sus propios permisos. El comprador ve el estado de los documentos del vendedor. El escribano puede cargar tareas. El Visit Partner reporta desde el campo. Todo sincronizado en tiempo real.',
    estado: 'EN_DESARROLLO',
    icon: Users,
    tag: 'Todos',
  },
  {
    id: 'lf-014',
    nombre: 'Cross-Transaction Intelligence',
    descripcion: 'Detecta conflictos entre operaciones: fechas, liquidez, dependencias.',
    detalle: 'Si estás vendiendo tu departamento para comprar una casa, VARA cruza las dos operaciones: "La escritura de venta está pactada para el 15, pero la de compra requiere el dinero el 10. Hay un gap de 5 días — esto se puede resolver con un puente financiero". Hoy no existe nada así en el mercado.',
    estado: 'EN_DESARROLLO',
    icon: Network,
    tag: 'Todos',
  },
  {
    id: 'lf-009',
    nombre: 'Negotiation Intelligence avanzada',
    descripcion: 'Análisis del historial completo de ofertas y recomendaciones de estrategia.',
    detalle: 'Va más allá del coaching de mensajes individuales: VARA analiza la cadena de ofertas, el momentum de la negociación, el ajuste acumulado y te dice en qué ronda estás, qué margen queda y cuál es el próximo movimiento óptimo.',
    estado: 'EN_DESARROLLO',
    icon: BarChart3,
    tag: 'Todos',
  },

  // ── PRÓXIMAMENTE ──
  {
    id: 'lf-003',
    nombre: 'Resumen de escritura',
    descripcion: 'Subí el PDF. VARA extrae titularidad, hipotecas y restricciones.',
    detalle: 'Trabaja sobre el documento que cargues, no sobre registros públicos. VARA lee la escritura y te da un resumen estructurado con los titulares, las cargas y las alertas que un profesional debería revisar.',
    estado: 'PRONTO',
    icon: FileSearch,
    tag: 'Todos',
  },
  {
    id: 'lf-001',
    nombre: 'Alertas sobre la documentación',
    descripcion: 'VARA cruza tus documentos y te avisa qué falta, qué venció y qué frena la escrituración.',
    detalle: 'Cruza las fechas de vencimiento, los documentos faltantes y el estado de cada tarea para generar alertas accionables. El historial registral hay que pedirlo al Registro: eso no lo podemos automatizar, pero sí te decimos cuándo pedirlo.',
    estado: 'PRONTO',
    icon: Bell,
    tag: 'Compradores',
  },
  {
    id: 'lf-015',
    nombre: 'Event Engine + Workflow Engine',
    descripcion: 'Automatizaciones, triggers y workflows configurables por país.',
    detalle: 'La base técnica para que VARA pueda automatizar: "cuando el comprador sube la inhibición, notificá al escribano y creá la tarea de revisión". Habilita integraciones B2B y customización por país sin tocar código.',
    estado: 'PRONTO',
    icon: Workflow,
    tag: 'Técnico',
  },
  {
    id: 'lf-016',
    nombre: 'B2B / VARA Pro',
    descripcion: 'API pública, white label e integración para inmobiliarias y desarrolladoras.',
    detalle: 'VARA embebido en la plataforma de una inmobiliaria. API que alimenta sistemas propios. White label con marca del partner. Panel Enterprise con múltiples operaciones, usuarios y roles. La API v1 ya existe en modo preview.',
    estado: 'PRONTO',
    icon: Building2,
    tag: 'B2B',
  },

  // ── FUTURO / EXPERIMENTAL ──
  {
    id: 'lf-017',
    nombre: 'VARA Invest — Comparar vehículos',
    descripcion: 'Compará propiedad directa vs. pozo vs. REIT vs. fractional vs. renta vs. deuda.',
    detalle: 'Un solo panel donde ponés el capital disponible y VARA te muestra cómo rinde en cada vehículo inmobiliario: propiedad directa, propiedad para renta, desarrollos en pozo, fondos inmobiliarios, REITs, fractional real estate, real estate debt, project equity e income-producing assets. Con benchmarks reales (Growie, Fondo Ciclo Nova).\n\n⚠️ FUTURO / EXPERIMENTAL / NO COMPROMETIDO.',
    estado: 'FUTURO',
    icon: TrendingUp,
    tag: 'Inversores',
  },
  {
    id: 'lf-018',
    nombre: 'Portfolio Intelligence',
    descripcion: 'Visión consolidada de todas tus inversiones inmobiliarias.',
    detalle: 'Propiedades, inversiones, renta, deuda, cash flow, exposición por país y moneda, riesgo y liquidez en un solo lugar. Diseñado para inversores con múltiples activos que hoy tienen esa información en planillas dispersas.\n\n⚠️ FUTURO / EXPERIMENTAL / NO COMPROMETIDO.',
    estado: 'FUTURO',
    icon: MapPin,
    tag: 'Inversores',
  },
]

const ESTADO_CONFIG: Record<Estado, { label: string; color: string; bg: string }> = {
  LISTO:         { label: 'Ya está',        color: 'text-emerald-700', bg: 'bg-emerald-50' },
  BETA:          { label: 'Beta',           color: 'text-emerald-700', bg: 'bg-emerald-50' },
  EN_DESARROLLO: { label: 'En desarrollo',  color: 'text-blue-700',    bg: 'bg-blue-50' },
  PRONTO:        { label: 'Próximamente',   color: 'text-slate-600',   bg: 'bg-slate-100' },
  EXPERIMENTO:   { label: 'Experimento',    color: 'text-purple-700',  bg: 'bg-purple-50' },
  FUTURO:        { label: 'Futuro',         color: 'text-orange-700',  bg: 'bg-orange-50' },
}

function FeatureCard({ feature }: { feature: LabFeature }) {
  const [open, setOpen] = useState(false)
  const cfg = ESTADO_CONFIG[feature.estado]
  const Icon = feature.icon
  const isLocked = feature.estado === 'PRONTO' || feature.estado === 'FUTURO'

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left p-4 flex items-start gap-3"
      >
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
          isLocked ? 'bg-slate-100' : 'bg-brand-50')}>
          <Icon size={16} className={isLocked ? 'text-slate-400' : 'text-brand-600'} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="font-semibold text-slate-900 text-sm">{feature.nombre}</p>
            <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', cfg.bg, cfg.color)}>
              {cfg.label}
            </span>
            {feature.tag && (
              <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                {feature.tag}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">{feature.descripcion}</p>
        </div>
        <ChevronDown size={14} className={cn('flex-shrink-0 mt-1 text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="px-4 pb-4 pt-0 border-t border-slate-100">
          <p className="text-sm text-slate-700 leading-relaxed mt-3 whitespace-pre-line">{feature.detalle}</p>
          {feature.href && (
            <Link
              href={feature.href}
              className="flex items-center gap-1 mt-3 text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors"
            >
              Abrir ahora <ChevronRight size={12} />
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

function Section({ label, color, features }: { label: string; color: string; features: LabFeature[] }) {
  if (!features.length) return null
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide', color)}>
          {label}
        </span>
        <div className="h-px bg-slate-200 flex-1" />
      </div>
      <div className="space-y-3">
        {features.map(f => <FeatureCard key={f.id} feature={f} />)}
      </div>
    </section>
  )
}

export default function VaraLabsPage() {
  const byEstado = (e: Estado) => FEATURES.filter(f => f.estado === e)

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="px-4 lg:px-6 pt-8 pb-3">
        <div className="max-w-4xl mx-auto">
          <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm mb-4 transition-colors">
            <ArrowLeft size={14} /> Volver al inicio
          </Link>
          <div className="flex items-center gap-2 mb-1">
            <FlaskConical size={18} className="text-brand-500" />
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">VARA Labs</h1>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed">
            Hacia dónde va VARA. Tocá cada tarjeta para ver qué va a hacer.
          </p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-5 pb-20 space-y-6">
        <Section label="Ya podés usarlo"       color="bg-emerald-100 text-emerald-700" features={byEstado('LISTO')} />
        <Section label="Beta activo"           color="bg-emerald-100 text-emerald-700" features={byEstado('BETA')} />
        <Section label="En desarrollo"         color="bg-blue-100 text-blue-700"       features={byEstado('EN_DESARROLLO')} />
        <Section label="Próximamente"          color="bg-slate-100 text-slate-600"     features={byEstado('PRONTO')} />
        <Section label="Experimentos"          color="bg-purple-100 text-purple-700"   features={byEstado('EXPERIMENTO')} />
        <Section label="Futuro / Experimental" color="bg-orange-100 text-orange-700"   features={byEstado('FUTURO')} />

        <div className="bg-slate-900 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0">
              <span className="text-[9px] font-extrabold text-slate-900">V</span>
            </div>
            <p className="text-xs font-bold text-white uppercase tracking-wide">Ayudanos a priorizar</p>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed mb-4">
            ¿Cuál de estas funcionalidades necesitás primero? Tu feedback decide qué hacemos en el próximo sprint.
          </p>
          <Link
            href="/asistente"
            className="flex items-center justify-center gap-2 w-full bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold py-3 rounded-xl transition-colors"
          >
            <Sparkles size={13} /> Decirle a VARA qué necesito
          </Link>
        </div>
      </div>
    </div>
  )
}
