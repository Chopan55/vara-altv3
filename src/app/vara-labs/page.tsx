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
    id: 'lf-019',
    nombre: 'Visual Intelligence — Transformá fotos',
    descripcion: 'Subí una foto de un ambiente y VARA te muestra cómo quedaría renovado con IA.',
    detalle: 'VARA edita la foto que cargás (no genera una propiedad inventada) y te da un presupuesto estimado por reforma: pintura de fachada, renovación de interior, cocina, baño, jardín o dejar el ambiente vacío para fotografiar. También calcula el impacto en el costo total de adquisición.',
    estado: 'LISTO',
    href: '/propiedades',
    icon: Sparkles,
    tag: 'Vendedores',
  },
  {
    id: 'lf-004',
    nombre: 'Comparar propiedades',
    descripcion: 'Hasta 3 propiedades lado a lado: precio, superficie, costo por m².',
    detalle: 'Seleccioná propiedades de tu lista y VARA las pone en una tabla comparativa. No hay un puntaje único: VARA marca cuál gana en cada dato y el peso te lo das vos.',
    estado: 'LISTO',
    href: '/propiedades',
    icon: BarChart3,
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
  {
    id: 'lf-012',
    nombre: 'Next Best Action (engine real)',
    descripcion: 'VARA detecta tu situación y te dice exactamente qué hacer ahora.',
    detalle: 'No es un banner estático: es un engine que cruza el estado de tu operación (tareas, documentos, ofertas, fechas) y genera una acción priorizada. "Falta la inhibición del vendedor — pedila antes de avanzar" o "Pasaron 5 días sin respuesta, es hora de hacer un seguimiento".',
    estado: 'LISTO',
    href: '/acciones',
    icon: Brain,
    tag: 'Todos',
  },
  {
    id: 'lf-014',
    nombre: 'Cross-Transaction Intelligence',
    descripcion: 'Detecta conflictos entre operaciones: fechas, liquidez, dependencias.',
    detalle: 'Si estás vendiendo tu departamento para comprar una casa, VARA cruza las dos operaciones: "La escritura de venta está pactada para el 15, pero la de compra requiere el dinero el 10. Hay un gap de 5 días — esto se puede resolver con un puente financiero".',
    estado: 'LISTO',
    href: '/inteligencia-cruzada',
    icon: Network,
    tag: 'Todos',
  },
  {
    id: 'lf-009',
    nombre: 'Negotiation Intelligence avanzada',
    descripcion: 'Análisis del historial completo de ofertas y recomendaciones de estrategia.',
    detalle: 'Va más allá del coaching de mensajes individuales: VARA analiza la cadena de ofertas, el momentum de la negociación, el ajuste acumulado y te dice en qué ronda estás, qué margen queda y cuál es el próximo movimiento óptimo.',
    estado: 'LISTO',
    href: '/negociacion/cadena',
    icon: BarChart3,
    tag: 'Todos',
  },

  // ── BETA ──
  {
    id: 'lf-010',
    nombre: 'LATAM Ready — Multi-país',
    descripcion: 'Argentina y México hoy. Chile, Colombia y más países, en camino.',
    detalle: 'Elegís tu país y VARA usa su terminología, moneda y reglas. Hoy hay paquetes para Argentina y México. Los demás países se suman de a uno, a medida que validamos sus reglas con profesionales locales.',
    estado: 'BETA',
    href: '/configuracion',
    icon: Globe,
    tag: 'Todos',
  },
  {
    id: 'lf-011',
    nombre: 'Trust Passport',
    descripcion: 'Identidad, verificaciones y señales de confianza de todos los participantes.',
    detalle: 'Hoy ves tus propias señales de confianza: email confirmado, nombre, teléfono e historial en VARA. Próximo paso: verificación de identidad y que la contraparte pueda ver tu pasaporte antes de avanzar.',
    estado: 'BETA',
    href: '/trust-passport',
    icon: Shield,
    tag: 'Todos',
  },
  {
    id: 'lf-013',
    nombre: 'Shared Transaction State',
    descripcion: 'Comprador, vendedor y profesionales trabajando en la misma operación.',
    detalle: 'Hoy cargás a los participantes de tu operación (contraparte, escribano, inmobiliaria) y tenés sus datos a mano. En desarrollo: que cada uno entre a la operación con su cuenta y vea solo lo que le corresponde.',
    estado: 'BETA',
    href: '/estado-operacion',
    icon: Users,
    tag: 'Todos',
  },

  {
    id: 'lf-003',
    nombre: 'Resumen de escritura',
    descripcion: 'Subí el PDF. VARA extrae titularidad, hipotecas y restricciones.',
    detalle: 'Trabaja sobre el documento que cargues, no sobre registros públicos. VARA lee la escritura y te da un resumen estructurado con los titulares, las cargas y las alertas que un profesional debería revisar.',
    estado: 'LISTO',
    href: '/escritura',
    icon: FileSearch,
    tag: 'Todos',
  },
  {
    id: 'lf-001',
    nombre: 'Alertas sobre la documentación',
    descripcion: 'VARA cruza tus documentos y te avisa qué falta, qué venció y qué frena la escrituración.',
    detalle: 'Cruza las fechas de vencimiento, los documentos faltantes y el estado de cada tarea para generar alertas accionables. El historial registral hay que pedirlo al Registro: eso no lo podemos automatizar, pero sí te decimos cuándo pedirlo.',
    estado: 'LISTO',
    href: '/alertas',
    icon: Bell,
    tag: 'Compradores',
  },
  {
    id: 'lf-015',
    nombre: 'Event Engine + Workflow Engine',
    descripcion: 'Reglas que revisan tus operaciones y te avisan: tareas vencidas, ofertas sin responder, operaciones frenadas.',
    detalle: 'Activás las reglas que te sirven y, cada vez que abrís VARA, revisan tus tareas, documentos, ofertas y actividad. Lo que detectan aparece en Automatizaciones. Por ahora son avisos dentro de la app: todavía no mandan mails ni crean tareas solas.',
    estado: 'LISTO',
    href: '/workflows',
    icon: Workflow,
    tag: 'Técnico',
  },
  {
    id: 'lf-016',
    nombre: 'B2B / VARA Pro',
    descripcion: 'API de lectura en preview. White label e integraciones, en roadmap.',
    detalle: 'Hoy: una API v1 de lectura en preview para consultar operaciones desde otro sistema. En roadmap: webhooks, white label y panel para equipos con roles.',
    estado: 'BETA',
    href: '/vara-pro',
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
  BETA:          { label: 'Beta',           color: 'text-amber-700',   bg: 'bg-amber-50'   },
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
      <div className="p-4 flex items-start gap-3">
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
          isLocked ? 'bg-slate-100' : 'bg-brand-50')}>
          <Icon size={16} className={isLocked ? 'text-slate-400' : 'text-brand-600'} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 text-sm leading-snug">{feature.nombre}</p>
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', cfg.bg, cfg.color)}>
              {cfg.label}
            </span>
            {feature.tag && feature.tag !== 'Todos' && (
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">
                {feature.tag}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 leading-relaxed mt-1.5">{feature.descripcion}</p>
          <div className="flex items-center gap-4 mt-2.5">
            {feature.href && (
              <Link
                href={feature.href}
                className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-700 transition-colors"
              >
                Abrir <ChevronRight size={12} aria-hidden="true" />
              </Link>
            )}
            <button
              type="button"
              onClick={() => setOpen(o => !o)}
              aria-expanded={open}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700"
            >
              {open ? 'Menos' : 'Cómo funciona'}
              <ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 border-t border-slate-100">
          <p className="text-sm text-slate-700 leading-relaxed mt-3 whitespace-pre-line">{feature.detalle}</p>
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
        <Section label="Beta activo"           color="bg-amber-100 text-amber-700"     features={byEstado('BETA')} />
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
