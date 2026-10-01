import Link from 'next/link'
import { Shield, Zap, TrendingUp, CheckCircle2, ChevronRight, Sparkles, Globe, FileText, BarChart3, ArrowRight } from 'lucide-react'
import { VaraLogo } from '@/components/ui/VaraLogo'
import { HeroInteractive } from '@/components/home/HeroInteractive'

const risks = [
  { label: 'Dominial', desc: 'Observación en cadena de titularidad', color: 'text-red-600', bg: 'bg-red-50', dot: 'bg-red-500', badge: 'ALTO' },
  { label: 'Fiscal', desc: 'Verificar estado de inhibiciones', color: 'text-amber-600', bg: 'bg-amber-50', dot: 'bg-amber-400', badge: 'MEDIO' },
  { label: 'Documental', desc: 'Falta plano actualizado', color: 'text-slate-600', bg: 'bg-slate-50', dot: 'bg-slate-400', badge: 'BAJO' },
]

const costItems = [
  { label: 'Sellos Prov. Buenos Aires', val: 'USD 3.330', src: 'ARBA · Ley Impositiva 2026' },
  { label: 'Honorarios escribano', val: 'USD 2.220', src: 'Colegio Escribanos PBA' },
  { label: 'Inscripción Registro', val: 'USD 370', src: 'Min. Justicia · Arancel vigente' },
]

const features = [
  {
    icon: BarChart3,
    badge: 'Motor Regulatorio',
    title: 'Costos de escrituración con fuente, jurisdicción y nivel de confianza',
    body: 'VARA calcula sellos, honorarios e inscripción para 24 provincias usando fuentes legales. Cada dato muestra su fuente, jurisdicción y nivel de confianza: verificado, parcial o estimado.',
    stat: '24', statLabel: 'provincias con cobertura',
    cta: '/costos',
  },
  {
    icon: Shield,
    badge: 'Risk Engine',
    title: 'Detectamos los riesgos antes de que te cuesten plata',
    body: 'Inhibición de bienes, deudas de ABL, documentación faltante, problemas dominiales. Cada riesgo tiene severidad, evidencia y recomendación accionable.',
    stat: '6', statLabel: 'categorías de riesgo',
    cta: '/dashboard',
  },
  {
    icon: FileText,
    badge: 'Visual Intelligence',
    title: 'IA que transforma cualquier ambiente — antes de comprar',
    body: 'Subí una foto del living o la cocina y VARA analiza qué reformas aplicar, cuánto costarían en USD y cómo quedaría el resultado con DALL-E 3.',
    stat: 'IA', statLabel: 'GPT-4o + DALL-E 3',
    cta: '/propiedades',
  },
]

const steps = [
  { n: '01', title: 'Cargás tu operación', desc: 'Tipo, precio, provincia y si comprás o vendés.' },
  { n: '02', title: 'VARA calcula y detecta', desc: 'Costos con fuente declarada, riesgos por categoría y documentos requeridos.' },
  { n: '03', title: 'Avanzás con claridad', desc: 'Cada paso tiene una acción concreta, sin ambigüedad.' },
]

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        * { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
        .vara-gradient {
          background: linear-gradient(135deg, #5b5fe6 0%, #7c7ff0 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .product-shadow { box-shadow: 0 4px 6px -1px rgba(0,0,0,0.06), 0 24px 64px -12px rgba(91,95,230,0.12), 0 0 0 1px rgba(0,0,0,0.06); }
        .card-shadow { box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.05); }
      `}</style>

      {/* Nav */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <VaraLogo size={26} />
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-500">
            <Link href="/#como-funciona" className="hover:text-slate-900 transition-colors">Cómo funciona</Link>
            <Link href="/vara-labs" className="flex items-center gap-1 hover:text-slate-900 transition-colors">
              <Sparkles size={12} className="text-brand-500" /> Labs
            </Link>
            <Link href="/dashboard" className="hover:text-slate-900 transition-colors">Demo</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
              Entrar
            </Link>
            <Link href="/onboarding" className="bg-brand-600 hover:bg-brand-500 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm">
              Empezar gratis <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero — two-column layout */}
      <section className="max-w-7xl mx-auto px-5 pt-16 pb-20 lg:pt-20 lg:pb-24">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: interactive entry point */}
          <div>
            <div className="inline-flex items-center gap-2 bg-brand-50 border border-brand-100 text-brand-700 text-[11px] font-bold px-3 py-1.5 rounded-full mb-5 uppercase tracking-widest">
              <Globe size={10} /> Argentina · México · LATAM
            </div>
            <h1 className="text-4xl md:text-5xl font-black leading-[1.1] mb-3 tracking-tight text-balance text-slate-900">
              Comprá o vendé<br />
              <span className="vara-gradient">sin sorpresas.</span>
            </h1>
            <p className="text-base text-slate-500 mb-7 leading-relaxed">
              VARA te acompaña en cada paso: costos con fuente declarada, riesgos detectados, documentos y negociación.
            </p>

            <HeroInteractive />

            <div className="mt-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-100" />
              <span className="text-xs text-slate-300 font-medium">o</span>
              <div className="h-px flex-1 bg-slate-100" />
            </div>
            <div className="mt-3 text-center">
              <Link href="/dashboard" className="text-sm text-slate-400 hover:text-brand-600 transition-colors font-medium">
                Ver demo sin registrarme →
              </Link>
            </div>
          </div>

          {/* Right: product mockup — light UI */}
          <div className="product-shadow rounded-2xl overflow-hidden border border-slate-200/80 bg-white">
            {/* App chrome */}
            <div className="bg-slate-50 border-b border-slate-200/80 px-4 py-2.5 flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              </div>
              <div className="flex-1 bg-white border border-slate-200 rounded-md text-[10px] text-slate-400 px-3 py-0.5 text-center font-medium">
                vara.app
              </div>
            </div>

            {/* Top bar with tabs */}
            <div className="border-b border-slate-100 px-5 pt-4 pb-0">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Buenos Aires · Compra · USD 185.000</div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-black text-slate-900 text-lg">Compra de departamento</h3>
                <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> En curso
                </div>
              </div>
              <div className="flex gap-4 text-[11px] font-semibold">
                {['Operación', 'Documentos', 'Costos', 'Riesgos', 'Negociación'].map((t, i) => (
                  <span key={t} className={i === 0 ? 'text-brand-600 border-b-2 border-brand-500 pb-2' : 'text-slate-400 pb-2'}>{t}</span>
                ))}
              </div>
            </div>

            <div className="p-5 space-y-3">
              {/* Progress */}
              <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
                <div className="flex-1">
                  <div className="flex justify-between mb-1.5">
                    <span className="text-xs font-semibold text-slate-700">Progreso de operación</span>
                    <span className="text-xs font-black text-brand-600">42%</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full">
                    <div className="w-[42%] h-full bg-brand-500 rounded-full" />
                  </div>
                </div>
              </div>

              {/* Next action */}
              <div className="bg-brand-600 rounded-xl p-3.5 flex items-center gap-3">
                <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Zap size={13} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-white/70 uppercase tracking-wider mb-0.5">Tu próximo paso</p>
                  <p className="text-sm font-bold text-white">Solicitar escritura</p>
                </div>
                <ChevronRight size={14} className="text-white/50 flex-shrink-0" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Riesgos */}
                <div className="border border-slate-100 rounded-xl p-3 card-shadow">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <Shield size={11} className="text-slate-500" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Riesgos</span>
                    </div>
                    <span className="bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">3</span>
                  </div>
                  <div className="space-y-1.5">
                    {risks.map(r => (
                      <div key={r.label} className={`${r.bg} rounded-lg px-2 py-1.5 flex items-center gap-1.5`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${r.dot} flex-shrink-0`} />
                        <span className={`text-[10px] font-bold ${r.color} flex-1`}>{r.label}</span>
                        <span className={`text-[9px] font-bold ${r.color} opacity-70`}>{r.badge}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Costos */}
                <div className="border border-slate-100 rounded-xl p-3 card-shadow">
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <TrendingUp size={11} className="text-slate-500" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Costos</span>
                  </div>
                  <div className="space-y-1.5">
                    {costItems.map(c => (
                      <div key={c.label} className="flex justify-between gap-1">
                        <p className="text-[10px] text-slate-500 truncate">{c.label.split(' ')[0]}</p>
                        <span className="text-[10px] font-bold text-brand-600 flex-shrink-0">{c.val}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between">
                    <span className="text-[10px] text-slate-400">Total</span>
                    <span className="text-xs font-black text-slate-900">USD 5.920</span>
                  </div>
                </div>
              </div>

              {/* VARA recomienda */}
              <div className="border border-brand-100 bg-brand-50 rounded-xl p-3 flex items-start gap-2.5">
                <Sparkles size={11} className="text-brand-600 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-brand-800 leading-snug">
                  <strong>VARA recomienda:</strong> Pedile la inhibición de bienes antes de firmar el boleto.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <div className="border-y border-slate-100 bg-slate-50">
        <div className="max-w-4xl mx-auto px-5 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { n: '24', label: 'provincias con costos reales' },
            { n: '6', label: 'categorías de riesgo cubiertas' },
            { n: 'IA', label: 'análisis visual de ambientes' },
            { n: '0', label: 'costos sin fuente declarada' },
          ].map(({ n, label }) => (
            <div key={label} className="text-center">
              <div className="text-3xl font-black text-brand-600 mb-1">{n}</div>
              <div className="text-xs text-slate-500 leading-relaxed">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <section id="como-funciona" className="max-w-5xl mx-auto px-5 py-20">
        <div className="text-center mb-14">
          <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-3">Cómo funciona</p>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 text-balance">
            De la confusión a la claridad<br className="hidden md:block" /> en tres pasos
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((s) => (
            <div key={s.n} className="border border-slate-100 rounded-2xl p-6 card-shadow bg-white">
              <div className="text-4xl font-black text-slate-100 mb-4 leading-none">{s.n}</div>
              <h3 className="font-bold text-slate-900 mb-2">{s.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-slate-50 border-y border-slate-100 py-20 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-3">Capacidades</p>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 text-balance">
              Toda la complejidad en VARA.<br className="hidden md:block" /> Cero en tu cabeza.
            </h2>
          </div>

          <div className="space-y-3">
            {features.map((f) => {
              const Icon = f.icon
              return (
                <div key={f.badge} className="bg-white border border-slate-100 rounded-2xl p-6 md:p-7 hover:border-brand-200 hover:shadow-sm transition-all group card-shadow">
                  <div className="flex flex-col md:flex-row md:items-start gap-5">
                    <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Icon size={18} className="text-brand-600" />
                    </div>
                    <div className="flex-1">
                      <div className="inline-flex items-center gap-1.5 bg-brand-50 text-brand-700 text-[10px] font-black px-2 py-0.5 rounded-full mb-3 uppercase tracking-wider">
                        {f.badge}
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mb-2 leading-snug">{f.title}</h3>
                      <p className="text-slate-500 text-sm leading-relaxed mb-4">{f.body}</p>
                      <Link href={f.cta} className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-600 hover:text-brand-500 transition-colors">
                        Ver en el producto <ArrowRight size={13} />
                      </Link>
                    </div>
                    <div className="md:w-24 text-center md:text-right flex-shrink-0 hidden md:block">
                      <div className="text-5xl font-black text-slate-100 group-hover:text-brand-100 transition-colors leading-none">{f.stat}</div>
                      <div className="text-[10px] text-slate-400 mt-1 leading-snug">{f.statLabel}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Trust quote */}
      <section className="max-w-3xl mx-auto px-5 py-20 text-center">
        <div className="border border-slate-100 rounded-2xl p-10 card-shadow bg-white">
          <div className="text-3xl text-brand-400 mb-5 font-serif leading-none">&ldquo;</div>
          <blockquote className="text-xl md:text-2xl font-bold text-slate-900 leading-snug mb-5 text-balance">
            Si VARA no tiene suficiente información para determinarlo, VARA dice que no sabe.
          </blockquote>
          <p className="text-slate-400 text-sm mb-6">Toda la inteligencia tiene fuente, jurisdicción y nivel de confianza declarado.</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {['Fuente verificada', 'Jurisdicción declarada', 'Nivel de confianza declarado'].map(t => (
              <span key={t} className="flex items-center gap-1.5 text-xs text-slate-500">
                <CheckCircle2 size={13} className="text-emerald-500" /> {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="px-5 pb-24">
        <div className="max-w-3xl mx-auto">
          <div className="bg-brand-600 rounded-2xl p-10 md:p-14 text-center text-white">
            <h2 className="text-3xl md:text-4xl font-black mb-4 text-balance">
              Tu próxima compra o venta,<br className="hidden md:block" /> con claridad total
            </h2>
            <p className="text-brand-200 mb-8 text-base">Gratis. Sin registro. Listo en 2 minutos.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/onboarding" className="bg-white text-brand-700 font-black px-8 py-3.5 rounded-xl transition-all hover:bg-brand-50 flex items-center justify-center gap-2 text-base shadow-sm">
                Empezar mi operación <ArrowRight size={15} />
              </Link>
              <Link href="/vara-labs" className="bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-3.5 rounded-xl border border-white/20 transition-colors flex items-center justify-center gap-2">
                <Sparkles size={14} /> Ver VARA Labs
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 px-5 py-8 bg-white">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <VaraLogo size={22} />
          <p className="text-xs text-slate-400">© 2026 VARA · Plataforma inmobiliaria</p>
          <div className="flex items-center gap-5 text-xs text-slate-400">
            <Link href="/vara-labs" className="hover:text-slate-700 transition-colors">Labs</Link>
            <Link href="/dashboard" className="hover:text-slate-700 transition-colors">Explorar</Link>
            <Link href="/costos" className="hover:text-slate-700 transition-colors">Costos</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
