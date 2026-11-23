import { Suspense } from 'react'
import Link from 'next/link'
import { VaraLogo } from '@/components/ui/VaraLogo'
import { Section } from '@/components/ui/Section'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { ButtonLink } from '@/components/ui/Button'
import { ProductFrame } from '@/components/ui/ProductFrame'
import { ContactForm } from '@/components/home/ContactForm'
import { FaqAssistant } from '@/components/home/FaqAssistant'
import { HeroAnalyze } from '@/components/home/HeroAnalyze'
import { FaqList } from '@/components/home/FaqList'
import { StickyCta } from '@/components/home/StickyCta'
import {
  ParadigmSection, BenefitsSection, AnalyzeSection, CompareSection, OperationSection,
  NegotiateSection, VisitSection, JourneySection, AiSection, ProductsSection, TrustSection,
} from '@/components/home/HomeSections'

/**
 * Home pública. Primero la promesa, después los resultados, después el producto real.
 * El estilo vive en los tokens de globals.css y en components/ui (no hay estilos propios de página).
 */
const FEATURE_GROUPS: { title: string; items: { t: string; beta?: boolean }[] }[] = [
  { title: 'Entendé', items: [{ t: 'Cada paso de la operación, hasta la escritura' }, { t: 'Qué preguntarle al escribano y al agrimensor' }, { t: 'Lectura de tus documentos con IA', beta: true }] },
  { title: 'Compará', items: [{ t: 'Costo total con gastos y sus fuentes' }, { t: 'Precio frente a avisos parecidos' }, { t: 'Plata para el cierre, en dólares y pesos' }] },
  { title: 'Negociá y publicá', items: [{ t: 'Ayuda para negociar directo con la otra parte', beta: true }, { t: 'Tu propio aviso: lo armás y elegís dónde publicarlo' }, { t: 'Asistente con IA que responde tus dudas', beta: true }] },
  { title: 'Acompañamiento', items: [{ t: 'VARA Visit: alguien con experiencia te acompaña a visitar' }, { t: 'Tu escribano o uno que te recomendemos' }] },
]

function HeroFeatures() {
  return (
    <div className="mx-auto mt-8 max-w-3xl text-left">
      <div className="grid gap-4 sm:grid-cols-2">
        {FEATURE_GROUPS.map(g => (
          <div key={g.title} className="rounded-xl border border-line bg-surface p-4">
            <h2 className="text-sm font-bold text-brand-900">{g.title}</h2>
            <ul className="mt-2 space-y-1 text-sm text-ink-soft">
              {g.items.map(i => (
                <li key={i.t} className="flex items-start gap-1.5">
                  <span aria-hidden="true" className="mt-0.5 text-brand-700">✓</span>
                  <span>{i.t}{i.beta && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">Beta · por invitación</span>}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-surface text-ink">
      {/* Navegación: agrupada por familia, un solo CTA. */}
      <header className="sticky top-0 z-50 border-b border-line/70 bg-surface/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:px-8">
          <VaraLogo size={26} />
          <nav aria-label="Principal" className="hidden items-center gap-8 text-sm font-medium text-ink-soft md:flex">
            <Link href="/#comprar" className="transition-colors hover:text-ink">Comprar</Link>
            <Link href="/#vender" className="transition-colors hover:text-ink">Vender</Link>
            <Link href="/vara-visit" className="transition-colors hover:text-ink">VARA Visit</Link>
            <Link href="/#como-funciona" className="transition-colors hover:text-ink">Cómo funciona</Link>
            <Link href="/planes" className="transition-colors hover:text-ink">Planes</Link>
            <Link href="/?tema=escribano#contacto" className="transition-colors hover:text-ink">Pedí tu escribano</Link>
          </nav>
          <div className="flex items-center gap-2">
            <ButtonLink href="/login">Entrar</ButtonLink>
          </div>
        </div>
      </header>

      {/* 1 · Hero: la promesa y el producto real. */}
      <Section space="md" width="wide" className="pt-6 md:pt-10">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Argentina · México</Eyebrow>
          <h1 className="font-display mt-6 text-4xl font-extrabold leading-[1.06] text-brand-900 text-balance md:text-6xl">
            Comprá o vendé tu propiedad <span className="text-brand-gradient">sin inmobiliaria</span> y sin pagar comisión
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
            VARA te guía en cada paso, con tu escribano o uno que te recomendemos.
          </p>
          <HeroAnalyze />
          <HeroFeatures />
        </div>
        {/* El producto real arriba: el análisis de un aviso real, no datos de ejemplo. Tocarlo abre ese análisis. */}
        <div className="mx-auto mt-14 max-w-2xl md:mt-20">
          <Link href="/analizar?ejemplo=1" aria-label="Abrir el análisis real de este departamento en Palermo"
            className="block rounded-[var(--radius-card)] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600">
            <ProductFrame
              src="/marketing/real/analisis-palermo.jpg"
              alt="Análisis de VARA de un departamento real en Palermo: precio publicado USD 149.000, total para avanzar USD 153.721 a 155.115 con gastos, y rango de avisos parecidos de USD 115.000 a 230.000"
              caption="Análisis real de VARA de un aviso de Zonaprop (22/11/2026). Tocalo para verlo completo."
              priority
            />
          </Link>
        </div>
      </Section>

      {/* 2 · Cambio de paradigma → 3 · Tres ideas. */}
      <ParadigmSection />
      <BenefitsSection />

      {/* 4–7 · Producto: analizar, comparar, toda la operación, negociar. */}
      <AnalyzeSection />
      <CompareSection />
      <OperationSection />
      <NegotiateSection />

      {/* VARA Visit y el recorrido completo. */}
      <VisitSection />
      <JourneySection />

      {/* VARA AI como capa, después del producto. */}
      <AiSection />

      {/* Familia de productos, precios y confianza. */}
      <ProductsSection />
      <TrustSection />

      {/* Preguntas: el asistente responde solo con textos escritos a mano. */}
      <Section id="preguntas" width="narrow" space="md">
        <h2 className="font-display text-center text-3xl font-extrabold text-brand-900 text-balance md:text-4xl">¿Todavía tenés dudas?</h2>
        <p className="mb-8 mt-3 text-center text-ink-soft">Preguntale a VARA. Si no sabe la respuesta, te lo dice.</p>
        <FaqAssistant />
        <FaqList />
      </Section>

      {/* CTA final: el único acceso para clientes es entrar con su cuenta. */}
      <Section id="entrar" tone="brand" width="narrow">
        <h2 className="font-display text-center text-3xl font-extrabold text-white text-balance md:text-5xl">Tu operación, en un solo lugar.</h2>
        <p className="mb-10 mt-4 text-center text-lg text-brand-200">Entrá con tu cuenta y seguí con tu compra o tu venta.</p>
        <div className="flex justify-center">
          <ButtonLink href="/login" size="lg" variant="secondary">Entrar a VARA</ButtonLink>
        </div>
      </Section>

      {/* Hablar con una persona. */}
      <Section id="contacto" width="narrow" space="md">
        <h2 className="font-display text-center text-3xl font-extrabold text-brand-900 text-balance md:text-4xl">Hablá con una persona</h2>
        <p className="mb-8 mt-3 text-center text-ink-soft">Contanos qué querés hacer y te respondemos por mail.</p>
        {/* El formulario lee ?tema= de la URL: necesita su límite de Suspense para el prerender. */}
        <Suspense fallback={null}><ContactForm /></Suspense>
      </Section>

      <StickyCta />
      <footer className="border-t border-line bg-surface px-5 py-10 md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 md:flex-row">
          <VaraLogo size={22} />
          <p className="text-xs text-ink-soft">© 2026 VARA · Plataforma inmobiliaria</p>
          <nav aria-label="Pie" className="flex flex-wrap items-center justify-center gap-5 text-xs text-ink-soft">
            <Link href="/costos" className="hover:text-ink">Costos</Link>
            <Link href="/labs" className="hover:text-ink">Labs</Link>
            <Link href="/vara-visit" className="hover:text-ink">VARA Visit</Link>
            <Link href="/partner/entrar" className="hover:text-ink">Visit Partners</Link>
          </nav>
        </div>
      </footer>
    </main>
  )
}
