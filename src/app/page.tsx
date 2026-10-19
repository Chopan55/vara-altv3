import Link from 'next/link'
import { VaraLogo } from '@/components/ui/VaraLogo'
import { Section } from '@/components/ui/Section'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { ButtonLink } from '@/components/ui/Button'
import { ProductFrame } from '@/components/ui/ProductFrame'
import { HeroInteractive } from '@/components/home/HeroInteractive'
import { ContactForm } from '@/components/home/ContactForm'
import { FaqAssistant } from '@/components/home/FaqAssistant'
import {
  ParadigmSection, BenefitsSection, AnalyzeSection, CompareSection, OperationSection,
  NegotiateSection, VisitSection, JourneySection, AiSection, ProductsSection, TrustSection,
} from '@/components/home/HomeSections'

/**
 * Home pública. Primero la promesa, después los resultados, después el producto real.
 * El estilo vive en los tokens de globals.css y en components/ui (no hay estilos propios de página).
 */
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
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden px-3 py-2 text-sm font-semibold text-ink-soft transition-colors hover:text-ink sm:inline">Entrar</Link>
            <ButtonLink href="/onboarding">Empezar</ButtonLink>
          </div>
        </div>
      </header>

      {/* 1 · Hero: la promesa y el producto real. */}
      <Section space="md" width="wide" className="pt-6 md:pt-10">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Argentina · México · LATAM</Eyebrow>
          <h1 className="font-display mt-6 text-5xl font-extrabold leading-[1.04] text-brand-900 text-balance md:text-7xl">
            Comprá y vendé <span className="text-brand-gradient">a tu manera.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
            Más libertad para decidir. Más control para avanzar. Menos costos innecesarios.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="/onboarding" size="lg">Empezar</ButtonLink>
            <ButtonLink href="#como-funciona" variant="secondary" size="lg">Ver cómo funciona</ButtonLink>
          </div>
        </div>
        <div className="mx-auto mt-14 max-w-6xl md:mt-20">
          <ProductFrame
            src="/marketing/real/dashboard.jpg"
            alt="Inicio de VARA: la tarea más importante de tu operación, con el motivo y los próximos pasos"
            priority
          />
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
      </Section>

      {/* CTA final: elegir por dónde empezar. */}
      <Section id="empezar" tone="brand" width="narrow">
        <h2 className="font-display text-center text-3xl font-extrabold text-white text-balance md:text-5xl">Empezá por donde estás.</h2>
        <p className="mb-10 mt-4 text-center text-lg text-brand-200">Contanos qué querés hacer y VARA arma tu recorrido.</p>
        <div className="rounded-[var(--radius-card)] bg-white p-5 text-ink md:p-7">
          <HeroInteractive />
        </div>
      </Section>

      {/* Hablar con una persona. */}
      <Section id="contacto" width="narrow" space="md">
        <h2 className="font-display text-center text-3xl font-extrabold text-brand-900 text-balance md:text-4xl">Hablá con una persona</h2>
        <p className="mb-8 mt-3 text-center text-ink-soft">Contanos qué querés hacer y te respondemos por mail.</p>
        <ContactForm />
      </Section>

      <footer className="border-t border-line bg-surface px-5 py-10 md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 md:flex-row">
          <VaraLogo size={22} />
          <p className="text-xs text-ink-soft">© 2026 VARA · Plataforma inmobiliaria</p>
          <nav aria-label="Pie" className="flex flex-wrap items-center justify-center gap-5 text-xs text-ink-soft">
            <Link href="/costos" className="hover:text-ink">Costos</Link>
            <Link href="/demo" className="hover:text-ink">Demo</Link>
            <Link href="/labs" className="hover:text-ink">Labs</Link>
            <Link href="/vara-visit" className="hover:text-ink">VARA Visit</Link>
            <Link href="/partner/entrar" className="hover:text-ink">Visit Partners</Link>
          </nav>
        </div>
      </footer>
    </main>
  )
}
