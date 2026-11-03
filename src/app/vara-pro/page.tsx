'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Building2, Check, ChevronRight, Code2, Globe,
  Key, Layers, Lock, Shield, Sparkles, Zap,
  Copy, CheckCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Plan {
  id: string
  name: string
  tagline: string
  price: string
  period: string
  highlight: boolean
  features: string[]
  cta: string
  ctaVariant: 'primary' | 'outline'
}

const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'Para inmobiliarias pequeñas',
    price: 'Gratis',
    period: '',
    highlight: false,
    features: [
      'Hasta 5 operaciones activas',
      'Acceso a todas las herramientas VARA',
      'Soporte por email',
      'Branding VARA visible',
    ],
    cta: 'Empezar gratis',
    ctaVariant: 'outline',
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Para equipos en crecimiento',
    price: 'USD 49',
    period: '/mes',
    highlight: true,
    features: [
      'Operaciones ilimitadas',
      'API v1 de lectura (preview)',
      'Múltiples usuarios con roles (próximamente)',
      'Automatizaciones (Event Engine)',
      'Webhook para tu CRM (próximamente)',
      'Soporte prioritario',
    ],
    cta: 'Solicitar acceso',
    ctaVariant: 'primary',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Para desarrolladoras e inmobiliarias',
    price: 'A medida',
    period: '',
    highlight: false,
    features: [
      'White label: tu marca, tu dominio (próximamente)',
      'API ilimitada con SLA acordado (próximamente)',
      'SSO / SAML (próximamente)',
      'Soporte dedicado',
      'Onboarding personalizado',
      'Integración con tu sistema',
    ],
    cta: 'Hablar con ventas',
    ctaVariant: 'outline',
  },
]

/** HOY = existe en el código. ROADMAP = planificado, no disponible. No se mezclan. */
const API_FEATURES: { icon: React.ElementType; title: string; desc: string; status: 'HOY' | 'ROADMAP' }[] = [
  { icon: Code2, title: 'API v1 de lectura', desc: 'Consultá tus operaciones y su estado desde tu sistema. JSON, con el token de tu sesión.', status: 'HOY' },
  { icon: Zap, title: 'Webhooks', desc: 'Eventos hacia tu sistema: tarea completada, documento subido, oferta recibida.', status: 'ROADMAP' },
  { icon: Key, title: 'API keys y escritura', desc: 'Claves por integración y endpoints para crear y actualizar operaciones.', status: 'ROADMAP' },
  { icon: Globe, title: 'White label', desc: 'Tu marca y tu dominio, con VARA por debajo.', status: 'ROADMAP' },
  { icon: Layers, title: 'Multi-workspace', desc: 'Varias inmobiliarias o sucursales en un panel, con permisos por rol.', status: 'ROADMAP' },
  { icon: Shield, title: 'Seguridad enterprise', desc: 'SSO, auditoría de acciones y data residency.', status: 'ROADMAP' },
]

const SAMPLE_ENDPOINT = `GET /api/v1/operations
Authorization: Bearer <token de sesión>

// Respuesta
{
  "data": [
    {
      "id": "8f2c…",
      "title": "Cabello 1234, CABA",
      "type": "SELL",
      "status": "ACTIVE",
      "province_code": "CABA",
      "created_at": "2026-10-28T10:12:00Z",
      "updated_at": "2026-11-02T14:30:00Z"
    }
  ]
}

GET /api/v1/operations/{id}   // una operación`

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <div className={cn(
      'bg-white rounded-2xl border p-5 flex flex-col',
      plan.highlight
        ? 'border-brand-400 shadow-lg ring-1 ring-brand-200'
        : 'border-slate-200/70 shadow-card',
    )}>
      {plan.highlight && (
        <div className="flex items-center justify-center mb-3">
          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 uppercase tracking-wide">
            Más popular
          </span>
        </div>
      )}
      <div className="mb-4">
        <h3 className="font-extrabold text-slate-900 text-base">{plan.name}</h3>
        <p className="text-xs text-slate-400 mt-0.5">{plan.tagline}</p>
      </div>
      <div className="mb-5">
        <span className="text-3xl font-black text-slate-900">{plan.price}</span>
        {plan.period && <span className="text-sm text-slate-400 ml-1">{plan.period}</span>}
      </div>
      <ul className="space-y-2 flex-1 mb-5">
        {plan.features.map(f => (
          <li key={f} className="flex items-start gap-2">
            <Check size={12} className="text-brand-500 flex-shrink-0 mt-1" />
            <span className="text-xs text-slate-600 leading-relaxed">{f}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/asistente"
        className={cn(
          'flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-bold transition-colors',
          plan.ctaVariant === 'primary'
            ? 'bg-brand-600 hover:bg-brand-700 text-white'
            : 'border border-slate-300 text-slate-700 hover:bg-slate-50',
        )}
      >
        {plan.cta} <ChevronRight size={12} />
      </Link>
    </div>
  )
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="relative bg-slate-900 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/60" />
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white transition-colors"
        >
          {copied ? <CheckCheck size={11} className="text-emerald-400" /> : <Copy size={11} />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <pre className="px-4 py-4 text-[11px] text-slate-300 overflow-x-auto leading-relaxed font-mono whitespace-pre">
        {code}
      </pre>
    </div>
  )
}

export default function VaraProPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-2xl mx-auto px-4 py-6 pb-20">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/dashboard" className="text-slate-400 hover:text-slate-700 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Building2 size={18} className="text-brand-500" />
              <h1 className="text-lg font-bold text-[var(--foreground)] leading-tight">VARA Pro</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Beta</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">VARA para inmobiliarias y desarrolladoras</p>
          </div>
        </div>

        {/* Hero */}
        <div className="bg-slate-900 rounded-2xl p-6 mb-8 text-center">
          <div className="w-12 h-12 bg-brand-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Sparkles size={22} className="text-brand-400" />
          </div>
          <h2 className="text-xl font-extrabold text-white mb-2">
            VARA en tu plataforma
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed max-w-sm mx-auto">
            Hoy: una API de lectura en preview para consultar tus operaciones. Lo que sigue
            (webhooks, white label, panel enterprise) lo construimos con las primeras inmobiliarias.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          {API_FEATURES.map(({ icon: Icon, title, desc, status }) => (
            <div key={title} className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', status === 'HOY' ? 'bg-brand-50' : 'bg-slate-100')}>
                  <Icon size={14} className={status === 'HOY' ? 'text-brand-600' : 'text-slate-400'} />
                </div>
                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                  status === 'HOY' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
                  {status === 'HOY' ? 'Disponible' : 'En roadmap'}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-900 mb-1">{title}</p>
              <p className="text-[11px] text-slate-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* API Preview */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Key size={14} className="text-slate-400" />
            <h2 className="text-sm font-bold text-slate-800">API v1 — Preview</h2>
            <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">Preview</span>
          </div>
          <CodeBlock code={SAMPLE_ENDPOINT} />
          <div className="mt-3 bg-amber-50 rounded-xl border border-amber-100 p-3 flex items-start gap-2">
            <Lock size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700 leading-relaxed">
              La API v1 está en preview y es solo de lectura: devuelve las operaciones del usuario
              autenticado. Solicitá acceso anticipado para que la habilitemos en tu cuenta.
            </p>
          </div>
        </div>

        {/* Planes */}
        <div className="mb-8">
          <h2 className="text-sm font-bold text-slate-800 mb-4">Planes</h2>
          <div className="space-y-4">
            {PLANS.map(plan => <PlanCard key={plan.id} plan={plan} />)}
          </div>
        </div>

        {/* FAQ */}
        <div className="space-y-3 mb-8">
          <h2 className="text-sm font-bold text-slate-800">Preguntas frecuentes</h2>

          {[
            {
              q: '¿La API v1 ya está disponible?',
              a: 'En preview y solo de lectura: podés consultar tus operaciones y su estado. Pedí acceso anticipado y te la habilitamos.',
            },
            {
              q: '¿Puedo integrar VARA con mi CRM?',
              a: 'Hoy podés leer tus operaciones desde tu CRM con la API v1. Los webhooks y los endpoints de escritura están en el roadmap: si los necesitás, contanos tu caso y lo priorizamos.',
            },
            {
              q: '¿Qué significa white label?',
              a: 'Que tus usuarios vean tu marca y tu dominio, con VARA trabajando por debajo. Está en el roadmap; lo armamos con las primeras inmobiliarias que lo pidan.',
            },
          ].map(({ q, a }) => (
            <div key={q} className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4">
              <p className="text-xs font-bold text-slate-900 mb-1">{q}</p>
              <p className="text-xs text-slate-500 leading-relaxed">{a}</p>
            </div>
          ))}
        </div>

        {/* CTA final */}
        <div className="bg-brand-600 rounded-2xl p-5 text-center">
          <p className="text-sm font-bold text-white mb-1">¿Querés integrar VARA?</p>
          <p className="text-xs text-brand-100 mb-4 leading-relaxed">
            Hablemos. Te mostramos la API, evaluamos tu caso y armamos la integración juntos.
          </p>
          <Link
            href="/asistente"
            className="inline-flex items-center justify-center gap-2 bg-white text-brand-700 text-xs font-bold py-2.5 px-5 rounded-xl hover:bg-brand-50 transition-colors"
          >
            <Building2 size={13} /> Solicitar acceso Pro
          </Link>
        </div>

      </div>
    </div>
  )
}
