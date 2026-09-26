import Link from 'next/link'
import { ArrowRight, Shield, Zap, TrendingUp, CheckCircle2, ChevronRight, Sparkles, Globe } from 'lucide-react'
import { VaraLogo } from '@/components/ui/VaraLogo'

const risks = [
  { label: 'DOMINIAL', color: 'text-red-400', bg: 'bg-red-400/10', dot: 'bg-red-400' },
  { label: 'FISCAL', color: 'text-brand-400', bg: 'bg-brand-400/10', dot: 'bg-brand-400' },
  { label: 'DOCUMENTAL', color: 'text-emerald-400', bg: 'bg-emerald-400/10', dot: 'bg-emerald-400' },
]

const costItems = [
  { label: 'Sellos Prov. Buenos Aires', val: 'USD 3.330', src: 'ARBA · Ley Impositiva 2026' },
  { label: 'Honorarios escribano', val: 'USD 2.220', src: 'Colegio Escribanos PBA' },
  { label: 'Inscripción Registro', val: 'USD 370', src: 'Min. Justicia · Arancel vigente' },
]

const features = [
  {
    badge: 'Motor Regulatorio',
    title: 'Los costos reales de escrituración — calculados desde la fuente',
    body: 'VARA calcula sellos, honorarios e inscripción para las 24 provincias usando las fuentes legales vigentes. Cada número tiene jurisdicción, fuente y fecha de actualización.',
    stat: '24', statLabel: 'provincias cubiertas',
    cta: '/costos',
  },
  {
    badge: 'Risk Engine',
    title: 'Detectamos los riesgos antes de que te cuesten plata',
    body: 'Inhibición de bienes, deudas de ABL, documentación faltante, problemas dominiales. Cada riesgo tiene severidad, evidencia y recomendación accionable.',
    stat: '6', statLabel: 'categorías de riesgo',
    cta: '/dashboard',
  },
  {
    badge: 'Visual Intelligence',
    title: 'IA que transforma cualquier ambiente — antes de comprar',
    body: 'Subí una foto del living o la cocina y VARA analiza qué reformas aplicar, cuánto costarían en USD y cómo quedaría el resultado con DALL-E 3.',
    stat: 'IA', statLabel: 'GPT-4o + DALL-E 3',
    cta: '/propiedades',
  },
]

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#141233] text-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        * { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
        .gradient-text {
          background: linear-gradient(135deg, #a5a9f0 0%, #8b8fe6 40%, #ffffff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .card-glow { box-shadow: 0 0 0 1px rgba(139,143,230,0.20), 0 20px 60px rgba(0,0,0,0.5); }
        .hero-glow { background: radial-gradient(ellipse 80% 50% at 50% -10%, rgba(139,143,230,0.16) 0%, transparent 70%); }
        .feature-line { background: linear-gradient(90deg, transparent, rgba(139,143,230,0.35), transparent); height: 1px; }
      `}</style>

      {/* Nav */}
      <header className="sticky top-0 z-50 bg-[#141233]/85 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <VaraLogo size={26} />
          <div className="flex items-center gap-4">
            <Link href="/vara-labs" className="hidden sm:flex items-center gap-1.5 text-sm text-slate-400 font-medium hover:text-white transition-colors">
              <Sparkles size={13} className="text-brand-400" /> Labs
            </Link>
            <Link href="/dashboard" className="hidden sm:block text-sm text-slate-400 font-medium hover:text-white transition-colors">Explorar</Link>
            <Link href="/login" className="text-sm text-slate-300 font-semibold hover:text-white transition-colors">
              Entrar
            </Link>
            <Link href="/onboarding" className="bg-brand-500 hover:bg-brand-400 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5">
              Empezar <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="hero-glow relative pt-24 pb-20 px-5">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-brand-400/10 border border-brand-400/20 text-brand-300 text-[11px] font-bold px-3 py-1.5 rounded-full mb-8 uppercase tracking-widest">
            <Globe size={10} /> Argentina · México · LATAM
          </div>
          <h1 className="text-5xl md:text-7xl font-black leading-[1.05] mb-6 tracking-tight text-balance">
            Tu próxima operación<br />
            <span className="gradient-text">sin sorpresas</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-8 leading-relaxed text-balance">
            VARA calcula los costos reales, detecta los riesgos y te dice exactamente qué hacer en cada paso de tu compra o venta inmobiliaria.
          </p>

          {/* Comprar / Vender — explicit above the fold */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
              <div className="w-2 h-2 rounded-full bg-brand-400" />
              <span className="text-sm font-semibold text-slate-300">Comprando</span>
              <span className="text-xs text-slate-600">costos · riesgos · negociación</span>
            </div>
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-sm font-semibold text-slate-300">Vendiendo</span>
              <span className="text-xs text-slate-600">publicación · ofertas · checklist</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
            <Link href="/onboarding" className="bg-brand-500 hover:bg-brand-400 text-white font-bold px-8 py-4 rounded-2xl transition-all hover:scale-[1.02] flex items-center justify-center gap-2 text-base shadow-lg shadow-brand-500/30">
              Empezar operación gratis <ArrowRight size={16} />
            </Link>
            <Link href="/dashboard" className="bg-white/5 hover:bg-white/10 text-white font-semibold px-8 py-4 rounded-2xl border border-white/10 transition-colors text-base">
              Ver el producto →
            </Link>
          </div>
          <p className="text-xs text-slate-600">Sin registro · Empezá en 2 minutos</p>
        </div>

        {/* Product mockup — 6-story: operación / estado / riesgos / costos / bloqueo / recomendación */}
        <div className="max-w-3xl mx-auto mt-16">
          <div className="card-glow bg-[#1e1b47] rounded-3xl overflow-hidden border border-white/5">
            {/* Fake browser bar */}
            <div className="bg-slate-800/60 px-5 py-3 flex items-center gap-3 border-b border-white/5">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-brand-500/60" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
              </div>
              <div className="flex-1 bg-slate-700/50 rounded-lg text-[11px] text-slate-500 px-3 py-1 text-center">
                vara.app
              </div>
            </div>

            <div className="p-5 md:p-8">
              {/* 1 + 2: operación y estado */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="text-[10px] font-bold text-brand-400 uppercase tracking-widest mb-1">Buenos Aires · Compra · USD 185.000</div>
                  <h3 className="text-white font-black text-xl">Compra de casa</h3>
                  <p className="text-slate-500 text-sm mt-0.5">Pilar · Av. Los Robles 432</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-black text-white">42%</div>
                  <div className="text-slate-500 text-xs">completado</div>
                  <div className="w-16 h-1.5 bg-slate-700 rounded-full mt-2 ml-auto">
                    <div className="w-[42%] h-full bg-brand-400 rounded-full" />
                  </div>
                </div>
              </div>

              {/* 5: bloqueo */}
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-3 mb-4">
                <div className="w-2 h-2 bg-red-400 rounded-full flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-red-400 font-bold text-xs">Bloqueada ·</span>
                  <span className="text-slate-400 text-xs ml-1">Solicitar escritura · Comprador/Escribano</span>
                </div>
                <span className="text-xs text-slate-500 flex-shrink-0">4 docs pendientes</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* 3: riesgos */}
                <div className="bg-slate-800/50 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield size={13} className="text-slate-400" />
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Riesgos detectados</span>
                    <span className="ml-auto bg-red-500/20 text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">3</span>
                  </div>
                  <div className="space-y-2">
                    {risks.map(r => (
                      <div key={r.label} className={`${r.bg} rounded-xl px-3 py-2 flex items-center gap-2`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${r.dot} flex-shrink-0`} />
                        <span className={`text-xs font-bold ${r.color}`}>{r.label}</span>
                        <ChevronRight size={10} className="ml-auto text-slate-600" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4: costos */}
                <div className="bg-slate-800/50 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp size={13} className="text-slate-400" />
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Costos reales</span>
                  </div>
                  <div className="space-y-2">
                    {costItems.map(c => (
                      <div key={c.label} className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs text-slate-300 font-medium truncate">{c.label}</p>
                          <p className="text-[10px] text-slate-600 truncate">{c.src}</p>
                        </div>
                        <span className="text-xs font-bold text-brand-400 flex-shrink-0">{c.val}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-700 flex justify-between">
                    <span className="text-xs text-slate-400">Total gastos</span>
                    <span className="text-sm font-black text-white">USD 5.920</span>
                  </div>
                </div>
              </div>

              {/* 6: VARA recomienda */}
              <div className="bg-brand-400/10 border border-brand-400/20 rounded-xl p-3 flex items-start gap-3">
                <Zap size={13} className="text-brand-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-brand-400 font-bold text-xs">VARA recomienda ahora: </span>
                  <span className="text-slate-300 text-xs">Pedile al vendedor la inhibición de bienes antes de firmar el boleto — sin esto la operación no puede avanzar.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <div className="feature-line" />
      <section className="max-w-4xl mx-auto px-5 py-14 grid grid-cols-2 md:grid-cols-4 gap-6">
        {[
          { n: '24', label: 'provincias con costos reales' },
          { n: '6', label: 'categorías de riesgo cubiertas' },
          { n: 'IA', label: 'análisis visual de ambientes' },
          { n: '0', label: 'costos sin fuente declarada' },
        ].map(({ n, label }) => (
          <div key={label} className="text-center">
            <div className="text-4xl font-black text-brand-400 mb-1">{n}</div>
            <div className="text-xs text-slate-500 leading-relaxed">{label}</div>
          </div>
        ))}
      </section>
      <div className="feature-line" />

      {/* Features */}
      <section className="py-20 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-brand-400 uppercase tracking-widest mb-3">Capacidades</p>
            <h2 className="text-3xl md:text-4xl font-black text-white text-balance">
              Toda la complejidad en VARA.<br className="hidden md:block" /> Cero en tu cabeza.
            </h2>
          </div>

          <div className="space-y-4">
            {features.map((f) => (
              <div key={f.badge} className="bg-[#1e1b47] border border-white/8 rounded-3xl p-6 md:p-8 hover:border-brand-400/20 transition-colors group">
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                  <div className="flex-1">
                    <div className="inline-flex items-center gap-1.5 bg-brand-400/10 border border-brand-400/20 text-brand-400 text-[10px] font-black px-2.5 py-1 rounded-full mb-4 uppercase tracking-wider">
                      <Zap size={9} /> {f.badge}
                    </div>
                    <h3 className="text-xl md:text-2xl font-bold text-white mb-3 leading-snug">{f.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed mb-5">{f.body}</p>
                    <Link href={f.cta} className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-400 hover:text-brand-300 transition-colors group-hover:gap-2.5">
                      Ver en el producto <ArrowRight size={13} />
                    </Link>
                  </div>
                  <div className="md:w-32 text-center md:text-right flex-shrink-0">
                    <div className="text-5xl md:text-6xl font-black text-white/10 group-hover:text-brand-400/20 transition-colors leading-none">{f.stat}</div>
                    <div className="text-xs text-slate-600 mt-1 leading-snug">{f.statLabel}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="px-5 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <div className="bg-[#1e1b47] border border-white/8 rounded-3xl p-10 card-glow">
            <div className="text-4xl text-brand-400 mb-6 font-serif leading-none">&ldquo;</div>
            <blockquote className="text-xl md:text-2xl font-bold text-white leading-snug mb-6 text-balance">
              Si VARA no tiene suficiente información para determinarlo, VARA dice que no sabe.
            </blockquote>
            <p className="text-slate-500 text-sm">Toda la inteligencia tiene fuente, jurisdicción y nivel de confianza declarado.</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {['Fuente verificada', 'Jurisdicción declarada', 'Nivel de confianza declarado'].map(t => (
                <span key={t} className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <CheckCircle2 size={11} className="text-emerald-400" /> {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="px-5 pb-20">
        <div className="max-w-3xl mx-auto text-center">
          <div className="bg-gradient-to-br from-brand-400/20 via-brand-400/5 to-transparent border border-brand-400/20 rounded-3xl p-12">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4 text-balance">
              Tu próxima compra o venta,<br className="hidden md:block" /> con claridad total
            </h2>
            <p className="text-slate-400 mb-8 text-balance">Gratis. Sin registro. Listo en 2 minutos.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/onboarding" className="bg-brand-500 hover:bg-brand-400 text-white font-black px-8 py-4 rounded-2xl transition-all hover:scale-[1.02] flex items-center justify-center gap-2 text-base shadow-xl shadow-brand-500/30">
                Empezar mi operación <ArrowRight size={16} />
              </Link>
              <Link href="/vara-labs" className="bg-white/5 hover:bg-white/10 text-white font-semibold px-8 py-4 rounded-2xl border border-white/10 transition-colors flex items-center justify-center gap-2">
                <Sparkles size={14} className="text-brand-400" /> Ver VARA Labs
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 px-5 py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <VaraLogo size={22} />
          <p className="text-xs text-slate-600">© 2026 VARA · Plataforma inmobiliaria</p>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <Link href="/vara-labs" className="hover:text-slate-400 transition-colors">Labs</Link>
            <Link href="/dashboard" className="hover:text-slate-400 transition-colors">Explorar</Link>
            <Link href="/costos" className="hover:text-slate-400 transition-colors">Costos</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
