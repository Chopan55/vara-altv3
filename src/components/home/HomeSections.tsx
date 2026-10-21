import Link from 'next/link'
import { ArrowRight, Check, KeyRound, ShieldCheck, FileText, Eye, Hand, Users } from 'lucide-react'
import { Section } from '@/components/ui/Section'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { ButtonLink } from '@/components/ui/Button'
import { ProductFrame } from '@/components/ui/ProductFrame'
import { Card } from '@/components/ui/Card'

/**
 * Secciones de la home pública. Orden: promesa → resultados → producto → profundidad.
 * Regla: solo se promete lo que la app ya hace. Sin métricas ni logos inventados.
 */

/** Titular de sección: etiqueta + título + bajada. */
function Heading({ eyebrow, title, body, light }: { eyebrow?: string; title: React.ReactNode; body?: string; light?: boolean }) {
  return (
    <div className="max-w-2xl">
      {eyebrow && <Eyebrow tone={light ? 'light' : 'brand'}>{eyebrow}</Eyebrow>}
      <h2 className={`font-display mt-4 text-3xl md:text-5xl font-extrabold leading-[1.08] text-balance ${light ? 'text-white' : 'text-brand-900'}`}>
        {title}
      </h2>
      {body && <p className={`mt-5 text-lg leading-relaxed ${light ? 'text-brand-200' : 'text-ink-soft'}`}>{body}</p>}
    </div>
  )
}

/** Bloque producto: texto a un lado, captura real al otro. `reverse` alterna el lado. */
function Showcase({
  id, eyebrow, title, body, points, src, alt, reverse, tone = 'base',
}: {
  id?: string; eyebrow: string; title: string; body: string; points: string[]
  src: string; alt: string; reverse?: boolean; tone?: 'base' | 'alt'
}) {
  return (
    <Section id={id} tone={tone} width="wide">
      <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.35fr] lg:gap-20">
        <div className={reverse ? 'lg:order-2' : ''}>
          <Heading eyebrow={eyebrow} title={title} body={body} />
          <ul className="mt-8 space-y-3">
            {points.map(p => (
              <li key={p} className="flex gap-3 text-base text-ink">
                <Check size={18} className="mt-0.5 flex-shrink-0 text-accent" aria-hidden="true" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <ProductFrame src={src} alt={alt} className={reverse ? 'lg:order-1' : ''} />
      </div>
    </Section>
  )
}

export function ParadigmSection() {
  return (
    <Section tone="alt" width="narrow">
      <p className="text-center font-display text-3xl md:text-5xl font-extrabold leading-[1.1] text-brand-900 text-balance">
        Encontrar una propiedad ya es digital.
        <span className="text-ink-soft"> Comprar o venderla todavía no.</span>
      </p>
      <p className="mt-8 text-center text-xl text-brand-700 font-semibold">VARA empieza donde terminan los portales.</p>
    </Section>
  )
}

const BENEFITS = [
  { n: '1', t: 'Entendé antes de decidir', d: 'Precio, costos, riesgos y documentos de una propiedad, en lenguaje claro y con la fuente de cada dato.' },
  { n: '2', t: 'Mantené el control', d: 'Siempre sabés dónde estás en tu operación, qué falta y qué sigue. La decisión final es tuya.' },
  { n: '3', t: 'Usá solo la ayuda que necesitás', d: 'Software cuando alcanza. Personas y profesionales cuando agregan valor.' },
]

export function BenefitsSection() {
  return (
    <Section id="como-funciona">
      <Heading title="Tres ideas para comprar o vender con más tranquilidad." />
      <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-12">
        {BENEFITS.map(b => (
          <div key={b.n} className="border-t-2 border-brand-600 pt-6">
            <p className="font-display text-sm font-bold text-brand-600">0{b.n}</p>
            <h3 className="font-display mt-3 text-xl font-bold text-brand-900">{b.t}</h3>
            <p className="mt-3 leading-relaxed text-ink-soft">{b.d}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

export function AnalyzeSection() {
  return (
    <Showcase
      id="comprar"
      tone="alt"
      eyebrow="Analizar"
      title="Entendé una propiedad antes de avanzar."
      body="Pegás el aviso y VARA te muestra el costo real de adquirir esa propiedad y cómo se ubica frente al mercado de la zona."
      points={['Costo real de adquisición, no solo el precio de lista', 'Comparación con la referencia de mercado (estimada)', 'Margen de negociación sugerido']}
      src="/marketing/real/propiedad.jpg"
      alt="Ficha de propiedad en VARA con costo real de adquisición y posición frente al mercado"
    />
  )
}

export function CompareSection() {
  return (
    <Showcase
      eyebrow="Comparar"
      title="Compará según lo que realmente importa para vos."
      body="Indicás qué pesa más (precio por m², superficie, estado, expensas) y VARA ordena tus propiedades con esa vara. Sin un puntaje opaco."
      points={['Hasta 3 propiedades lado a lado', 'Vos definís la importancia de cada criterio', 'Perfiles de ejemplo: familia, inversión, mudanza']}
      src="/marketing/real/comparar.jpg"
      alt="Comparador de VARA con tres propiedades y los criterios ponderables"
      reverse
    />
  )
}

export function OperationSection() {
  return (
    <Showcase
      id="vender"
      tone="alt"
      eyebrow="Toda la operación"
      title="Documentos, riesgos y costos en un solo lugar."
      body="Hoy una operación vive entre WhatsApp, mails, PDFs y portales. En VARA queda ordenada por etapas, con lo pendiente a la vista."
      points={['Checklist documental según la provincia', 'Riesgos detectados con qué hacer', 'Compra y venta separadas, sin mezclar datos']}
      src="/marketing/real/documentos.jpg"
      alt="Operación de compra en VARA con documentos pendientes y próxima acción"
    />
  )
}

const NEGOTIATE = ['Preparás ofertas y contraofertas con contexto', 'La IA explica y redacta; no decide por vos', 'Una buena recomendación puede ser “no avances”']

export function NegotiateSection() {
  return (
    <Section width="narrow">
      <Heading eyebrow="Negociar" title="Llegá mejor preparado a cada conversación." body="Antes de ofertar o contraofertar, VARA te ayuda a ordenar qué sabés, qué falta y qué conviene pedir." />
      <ul className="mt-8 space-y-3">
        {NEGOTIATE.map(p => (
          <li key={p} className="flex gap-3 text-base text-ink">
            <Check size={18} className="mt-0.5 flex-shrink-0 text-accent" aria-hidden="true" />{p}
          </li>
        ))}
      </ul>
    </Section>
  )
}

const VISIT_STEPS = [
  { icon: Users, t: 'Una persona verificada', d: 'Identidad validada por VARA antes de su primera visita.' },
  { icon: KeyRound, t: 'Empieza con tu PIN', d: 'Sin tu PIN la visita no arranca. Queda registrado inicio y cierre.' },
  { icon: FileText, t: 'Reporte con hechos', d: 'Qué se vio y qué se preguntó, separado de las opiniones.' },
]

export function VisitSection() {
  return (
    <Section tone="brand" width="wide">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div>
          <Heading light eyebrow="VARA Visit" title="Presencia física cuando la necesitás." body="Una persona de la red de VARA muestra tu propiedad o te acompaña a ver otra. Cobertura piloto, disponible por zonas." />
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/vara-visit" variant="secondary" size="lg">Conocer VARA Visit <ArrowRight size={16} /></ButtonLink>
            <ButtonLink href="/partner/entrar" variant="ghost" size="lg" className="!text-white hover:!bg-white/10">Soy Visit Partner</ButtonLink>
          </div>
        </div>
        <ul className="space-y-4">
          {VISIT_STEPS.map(s => (
            <li key={s.t} className="flex gap-4 rounded-[var(--radius-card)] bg-white/[0.06] p-5 ring-1 ring-white/10">
              <s.icon size={20} className="mt-0.5 flex-shrink-0 text-accent" aria-hidden="true" />
              <div>
                <p className="font-display font-bold text-white">{s.t}</p>
                <p className="mt-1 text-sm leading-relaxed text-brand-200">{s.d}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  )
}

const STAGES = ['Propiedades', 'Visitas', 'Documentos', 'Costos', 'Riesgos', 'Ofertas', 'Cierre']

export function JourneySection() {
  return (
    <Section>
      <Heading eyebrow="El recorrido" title="Una operación, de la primera visita a la escritura." />
      <ol className="relative mt-16 grid grid-cols-2 gap-y-10 sm:grid-cols-4 lg:grid-cols-7">
        <span aria-hidden="true" className="absolute left-0 right-0 top-[14px] hidden h-px bg-line lg:block" />
        {STAGES.map((s, i) => (
          <li key={s} className="relative">
            <span className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">{i + 1}</span>
            <p className="font-display mt-3 font-bold text-brand-900">{s}</p>
          </li>
        ))}
      </ol>
    </Section>
  )
}

const ASK = ['¿Qué falta para avanzar?', '¿Qué cambió desde ayer?', '¿Qué haría ahora?']

export function AiSection() {
  return (
    <Section tone="alt" width="wide">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <Heading eyebrow="VARA AI" title="No estás solo durante la operación." body="VARA sabe en qué etapa estás, qué falta y qué sigue, y te lo explica. Responde con la información de tu operación; si no sabe algo, te lo dice." />
        <div className="space-y-3">
          {ASK.map(q => (
            <Card key={q} className="flex items-center gap-3 text-base font-medium text-ink">
              <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-accent">?</span>
              {q}
            </Card>
          ))}
          <p className="pt-2 text-sm text-ink-soft">Preguntale a VARA dentro de la app, en cada pantalla.</p>
        </div>
      </div>
    </Section>
  )
}

const PRODUCTS = [
  { t: 'VARA Comprar', d: 'Analizá, compará y avanzá con criterio.', href: '/login', cta: 'Entrar a VARA' },
  { t: 'VARA Vender', d: 'Preparate, publicá y negociá con control.', href: '/login', cta: 'Entrar a VARA' },
  { t: 'VARA Visit', d: 'Presencia verificada en la propiedad.', href: '/vara-visit', cta: 'Ver cómo funciona' },
]

export function ProductsSection() {
  return (
    <Section>
      <Heading title="Elegí cuánto acompañamiento necesitás." body="Usá y pagá solo por lo que necesitás. Los planes están en definición y te mostramos el precio completo antes de contratar." />
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {PRODUCTS.map(p => (
          <Card key={p.t} className="flex flex-col p-7">
            <h3 className="font-display text-xl font-bold text-brand-900">{p.t}</h3>
            <p className="mt-2 flex-1 text-ink-soft">{p.d}</p>
            <Link href={p.href} className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-900">
              {p.cta} <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </Card>
        ))}
      </div>
      <p className="mt-6 text-sm text-ink-soft">
        <Link href="/planes" className="font-semibold text-brand-700 hover:underline">Ver los planes</Link> · VARA Check (revisión de alquileres): próximamente.
      </p>
    </Section>
  )
}

const TRUST = [
  { icon: ShieldCheck, t: 'Cada dato con su fuente', d: 'Costos y regulaciones muestran jurisdicción y nivel de confianza: verificado, parcial o estimado.' },
  { icon: Hand, t: 'Vos decidís', d: 'VARA no decide por vos. La IA explica y prepara; no inventa hechos.' },
  { icon: Eye, t: 'Qué hace y qué no hace', d: 'No es una inmobiliaria ni un estudio jurídico. No reemplaza al escribano; te ayuda a llegar mejor preparado.' },
]

export function TrustSection() {
  return (
    <Section tone="alt">
      <Heading eyebrow="Confianza" title="Transparencia por diseño." />
      <div className="mt-12 grid gap-10 md:grid-cols-3">
        {TRUST.map(t => (
          <div key={t.t}>
            <t.icon size={22} className="text-brand-600" aria-hidden="true" />
            <h3 className="font-display mt-4 text-lg font-bold text-brand-900">{t.t}</h3>
            <p className="mt-2 leading-relaxed text-ink-soft">{t.d}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}
