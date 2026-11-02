'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Building2, Check, ChevronRight, Code2, Globe,
  Key, Layers, Lock, Shield, Sparkles, Users, Zap,
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
      'API v1 con 10k requests/mes',
      'Múltiples usuarios con roles',
      'Automatizaciones (Event Engine)',
      'Webhook para tu CRM',
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
      'White label — tu marca, tu dominio',
      'API ilimitada + SLA 99.9%',
      'SSO / SAML',
      'Soporte dedicado 24/7',
      'Onboarding personalizado',
      'Integración con tu sistema',
    ],
    cta: 'Hablar con ventas',
    ctaVariant: 'outline',
  },
]

const API_FEATURES = [
  { icon: Code2, title: 'REST API v1', desc: 'Endpoints para operaciones, documentos y tareas. JSON limpio, autenticación con API key.' },
  { icon: Zap, title: 'Webhooks', desc: 'Recibí eventos en tiempo real en tu sistema: tarea completada, documento subido, oferta recibida.' },
  { icon: Globe, title: 'White Label', desc: 'Tu marca, tu dominio. VARA desaparece del front. Ideal para desarrolladoras.' },
  { icon: Layers, title: 'Multi-Workspace', desc: 'Una cuenta, múltiples inmobiliarias o sucursales. Panel unificado con permisos granulares.' },
  { icon: Users, title: 'Roles y permisos', desc: 'Admin, broker, escribano, Visit Partner. Cada rol ve lo que necesita.' },
  { icon: Shield, title: 'Enterprise Security', desc: 'SOC 2 (en preparación), SSO, auditoría de acciones, data residency.' },
]

const SAMPLE_ENDPOINT = `GET /api/v1/operations
Authorization: Bearer vara_live_xxxxxxxxxxxx

// Response
{
  "data": [
    {
      "id": "op_abc123",
      "title": "Cabello 1234, CABA",
      "type": "SELL",
      "status": "ACTIVE",
      "tasks_done": 4,
      "tasks_total": 7,
      "updated_at": "2026-11-02T14:30:00Z"
    }
  ],
  "meta": { "total": 1, "page": 1 }
}`

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
            <p className="text-xs text-slate-400 mt-0.5">API, white label e integración para inmobiliarias</p>
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
            Integrá la inteligencia de VARA en tu sistema. API limpia, webhooks en tiempo real,
            white label y panel enterprise para tu equipo.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          {API_FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4">
              <div className="w-8 h-8 bg-brand-50 rounded-xl flex items-center justify-center mb-3">
                <Icon size={14} className="text-brand-600" />
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
              La API v1 está en modo preview. Solicitá acceso anticipado y obtenés tu API key
              de sandbox para empezar a integrar hoy.
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
              a: 'Está en modo preview. Podés solicitar acceso anticipado para integrar y dar feedback antes del lanzamiento oficial.',
            },
            {
              q: '¿Qué significa White Label?',
              a: 'VARA desaparece del frontend. Tus usuarios ven tu marca, tu dominio, tus colores. VARA trabaja por debajo.',
            },
            {
              q: '¿Puedo integrar VARA con mi CRM?',
              a: 'Sí. Con webhooks podés recibir eventos de VARA en tu CRM en tiempo real. También hay endpoints para crear y actualizar operaciones desde tu sistema.',
            },
            {
              q: '¿Cuánto tiempo toma la integración?',
              a: 'Una integración básica con la API REST es cuestión de horas. La integración profunda con white label y SSO toma días, dependiendo de tu stack.',
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
