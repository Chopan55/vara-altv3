'use client'
import Link from 'next/link'
import { ArrowLeft, Sparkles, Zap, Brain, FlaskConical, Lock, ChevronRight } from 'lucide-react'
import { VaraLogo } from '@/components/ui/VaraLogo'
import { cn } from '@/lib/utils'

interface LabFeature {
  id: string
  nombre: string
  descripcion: string
  estado: 'LISTO' | 'BETA' | 'PRONTO' | 'EXPERIMENTO'
  href?: string
  icon: React.ElementType
  tag?: string
}

/*
 * Esta pantalla dice hacia dónde va el producto, así que es la más fácil de
 * usar para prometer cualquier cosa. Cada tarjeta se revisó contra lo que se
 * puede construir de verdad con los datos que existen hoy en Argentina.
 *
 * Dos quedaron afuera:
 *
 *  - "Predictor de precio de cierre" necesitaba precios de venta y tiempo de
 *    publicación. Ningún portal expone ninguno de los dos. No es cuestión de
 *    esfuerzo: el dato no existe.
 *  - "Auto-publicación multi-portal" prometía publicar en Zonaprop con un
 *    click. Zonaprop no tiene API y bloquea el acceso automático (medido).
 *
 * Y una ya estaba hecha sin que la pantalla se enterara.
 */
const FEATURES: LabFeature[] = [
  {
    id: 'lf-004',
    nombre: 'Comparar propiedades',
    descripcion: 'Poné hasta 3 de tu lista y mirá precio, superficie y costo por m² lado a lado. No hay un puntaje único: VARA marca cuál gana en cada dato y el peso se lo das vos.',
    estado: 'LISTO',
    href: '/propiedades',
    icon: Sparkles,
    tag: 'Compradores',
  },
  {
    id: 'lf-007',
    nombre: 'Comparar contra el mercado',
    descripcion: 'Pegá el link de avisos parecidos al tuyo y VARA te dice dónde cae tu precio por m². De MercadoLibre lee la ficha oficial; del resto, la publicación.',
    estado: 'LISTO',
    href: '/dinero?tab=precios',
    icon: Zap,
    tag: 'Vendedores',
  },
  {
    id: 'lf-003',
    nombre: 'Resumen de escritura',
    descripcion: 'Subí la escritura en PDF y VARA la lee: titularidad, hipotecas y restricciones. Trabaja sobre el documento que cargues, no sobre registros públicos.',
    estado: 'PRONTO',
    icon: FlaskConical,
    tag: 'Todos',
  },
  {
    id: 'lf-001',
    nombre: 'Alertas sobre la documentación',
    descripcion: 'VARA cruza los papeles que subiste y te avisa qué falta, qué venció y qué frena la escrituración. El historial registral hay que pedirlo al Registro: eso no lo podemos automatizar.',
    estado: 'PRONTO',
    icon: Brain,
    tag: 'Compradores',
  },
  {
    id: 'lf-005',
    nombre: 'Simulador de negociación',
    descripcion: 'Entrenate antes de hacer una oferta. El agente simula un vendedor con distintos perfiles y te prepara para la conversación real.',
    estado: 'EXPERIMENTO',
    icon: Brain,
    tag: 'Compradores',
  },
]

const ESTADO_CONFIG = {
  LISTO:       { label: 'Ya está',      color: 'text-emerald-700', bg: 'bg-emerald-50' },
  BETA:        { label: 'Beta',         color: 'text-emerald-700', bg: 'bg-emerald-50' },
  PRONTO:      { label: 'Próximamente', color: 'text-blue-700',    bg: 'bg-blue-50' },
  EXPERIMENTO: { label: 'Experimento',  color: 'text-purple-700',  bg: 'bg-purple-50' },
}

function FeatureCard({ feature, locked }: { feature: LabFeature; locked?: boolean }) {
  const cfg = ESTADO_CONFIG[feature.estado]
  const Icon = feature.icon
  return (
    <div className={cn('bg-white rounded-2xl border border-slate-200/70 shadow-card p-4', locked && 'opacity-80')}>
      <div className="flex items-start gap-3">
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
          locked ? 'bg-slate-100' : 'bg-brand-50')}>
          {locked
            ? <Lock size={16} className="text-slate-400" />
            : <Icon size={16} className="text-brand-600" />}
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
          {/* Solo enlazamos lo que existe de verdad: un "Probar ahora" que
              termina en el chat genérico promete algo que todavía no hacemos. */}
          {!locked && feature.href && (
            <Link
              href={feature.href}
              className="flex items-center gap-1 mt-2 text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors"
            >
              Probar ahora <ChevronRight size={12} />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

export default function VaraLabsPage() {
  const listo = FEATURES.filter(f => f.estado === 'LISTO')
  const beta = FEATURES.filter(f => f.estado === 'BETA')
  const pronto = FEATURES.filter(f => f.estado === 'PRONTO')
  const experimentos = FEATURES.filter(f => f.estado === 'EXPERIMENTO')

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="px-4 lg:px-6 pt-8 pb-3">
        <div className="max-w-4xl mx-auto">
                      <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm mb-4 transition-colors">
              <ArrowLeft size={14} /> Volver al inicio
            </Link>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={18} className="text-brand-500" />
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">VARA Labs</h1>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed">
            Hacia dónde va VARA, y qué ya podés usar. Lo que dice &ldquo;Próximamente&rdquo;
            todavía no existe: cuando exista, lo vas a ver dentro de tu operación.
          </p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-5 pb-20 space-y-6">

        {/* Lo que ya se puede usar va primero: es lo único accionable hoy. */}
        {listo.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase tracking-wide">Ya podés usarlo</span>
              <div className="h-px bg-slate-200 flex-1" />
            </div>
            <div className="space-y-3">
              {listo.map(f => <FeatureCard key={f.id} feature={f} />)}
            </div>
          </section>
        )}

        {beta.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase tracking-wide">Beta activo</span>
              <div className="h-px bg-slate-200 flex-1" />
            </div>
            <div className="space-y-3">
              {beta.map(f => <FeatureCard key={f.id} feature={f} />)}
            </div>
          </section>
        )}

        {pronto.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase tracking-wide">Próximamente</span>
              <div className="h-px bg-slate-200 flex-1" />
            </div>
            <div className="space-y-3">
              {pronto.map(f => <FeatureCard key={f.id} feature={f} locked />)}
            </div>
          </section>
        )}

        {experimentos.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full uppercase tracking-wide">Experimentos</span>
              <div className="h-px bg-slate-200 flex-1" />
            </div>
            <div className="space-y-3">
              {experimentos.map(f => <FeatureCard key={f.id} feature={f} locked />)}
            </div>
          </section>
        )}

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
