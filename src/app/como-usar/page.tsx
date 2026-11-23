import Link from 'next/link'
import { ArrowRight, Search, Home, KeyRound, Users, Lightbulb } from 'lucide-react'
import { VaraLogo } from '@/components/ui/VaraLogo'
import { ProductFrame } from '@/components/ui/ProductFrame'

export const metadata = {
  title: 'Cómo usar VARA',
  description: 'Guía paso a paso: analizar un aviso, seguir tu compra, vender tu propiedad, pedir un escribano y VARA Visit.',
}

/**
 * Manual de usuario. Cada paso sale de lo que la app hace hoy (rutas y botones
 * verificados en el código el 23/11/2026). Si cambia un botón, se cambia acá.
 */

type Step = { title: string; body: React.ReactNode }
type Guide = { id: string; icon: typeof Search; title: string; intro: string; steps: Step[]; cta?: { href: string; label: string }; note?: string }

const B = ({ children }: { children: React.ReactNode }) => (
  <span className="whitespace-nowrap rounded-md bg-brand-50 px-1.5 py-0.5 font-semibold text-brand-800">{children}</span>
)

const GUIDES: Guide[] = [
  {
    id: 'analizar',
    icon: Search,
    title: 'Analizar una propiedad',
    intro: 'Gratis y sin cuenta. En un minuto sabés cuánto te sale de verdad y qué preguntar.',
    steps: [
      { title: 'Copiá el link del aviso', body: <>Abrí el aviso en Zonaprop, Argenprop, MercadoLibre o Inmuebles24 y copiá la dirección de arriba de la pantalla.</> },
      { title: 'Pegalo en la portada', body: <>En la portada de VARA, pegalo donde dice <B>Pegá el link del aviso</B> y tocá <B>Ver cuánto sale</B>.</> },
      { title: 'Si el portal no deja leerlo', body: <>Tocá <B>Pegar el texto</B> y pegá todo el texto del aviso, o <B>Cargar a mano</B> con el precio y los metros. No hace falta el link.</> },
      { title: 'Leé el resultado de arriba hacia abajo', body: <>Arriba ves el precio, el <strong>total con gastos</strong> y dónde cae el precio frente a avisos parecidos. Abajo: <strong>Tu plan para esta propiedad</strong>, qué preguntarle al vendedor y qué sabemos, qué estimamos y qué falta confirmar.</> },
      { title: 'Mejorá la comparación', body: <>Si viste otros avisos parecidos, sumalos en <B>Sumar un aviso parecido</B>. Con 3 o más, VARA arma un rango para ver dónde cae el precio; cuantos más avisos, más confiable.</> },
      { title: 'Compartilo o guardalo', body: <>Con <B>Compartir por WhatsApp</B> se lo mandás a quien decide con vos (no ve tus preferencias). Con <B>Guardar análisis como PDF</B> te lo llevás.</> },
    ],
    cta: { href: '/analizar?ejemplo=1', label: 'Ver un análisis real de ejemplo' },
  },
  {
    id: 'comprar',
    icon: Home,
    title: 'Seguir tu compra hasta la escritura',
    intro: 'Cuando una propiedad te interesa, VARA te ordena todo lo que viene.',
    steps: [
      { title: 'Empezá desde el análisis', body: <>Tocá <B>Preparar mi compra</B> o <B>Seguir esta compra con VARA</B>. Si no tenés cuenta, la creás en el paso siguiente.</> },
      { title: 'Contale a VARA lo básico', body: <>Tu nombre, <B>Quiero comprar</B>, el país y la provincia o estado. Después <B>Empezar mi operación</B>.</> },
      { title: 'Seguí tus tareas', body: <>En <B>Mi operación</B> tenés las tareas en orden, los riesgos, los documentos, las ofertas y los costos. Siempre ves qué hacer ahora.</> },
      { title: 'Ordená los papeles', body: <>En <B>Documentos</B> subís lo que te mandan y ves qué falta pedir.</> },
      { title: 'Calculá la plata', body: <>En <B>Dinero</B> tenés los costos y, si lo necesitás, el financiamiento.</> },
      { title: 'Antes de visitar', body: <>Usá el <B>Checklist de visita</B>: exterior, interior, entorno y documentación, con tus notas.</> },
    ],
  },
  {
    id: 'vender',
    icon: KeyRound,
    title: 'Vender tu propiedad sin inmobiliaria',
    intro: 'Preparás los papeles y armás tu aviso. Lo publicás vos, en el portal que elijas.',
    steps: [
      { title: 'Prepará la venta', body: <>Entrá a VARA y elegí <B>Quiero vender</B>. En <strong>Preparar venta</strong> marcás los papeles que ya tenés.</> },
      { title: 'Armá tu aviso', body: <>En <strong>Publicar</strong> seguís tres pasos: <B>Preparación</B> (datos, fotos y descripción), <B>Revisión</B> y <B>Publicación</B>.</> },
      { title: 'Publicalo en el portal que elijas', body: <>Elegís Zonaprop, Argenprop o MercadoLibre: VARA te copia el texto y abre el portal. La publicación la hacés vos: el aviso es tuyo.</> },
    ],
  },
  {
    id: 'ayuda',
    icon: Users,
    title: 'Escribano y VARA Visit',
    intro: 'Nunca estás solo: tu escribano decide lo legal y, si querés, alguien te acompaña a visitar.',
    steps: [
      { title: 'Llevale la consulta a tu escribano', body: <>Al final del análisis, en <strong>Llegá a tu escribano con las preguntas claras</strong>, copiás la consulta o la mandás por WhatsApp.</> },
      { title: '¿No tenés escribano?', body: <>Tocá <B>Pedirle un escribano a VARA</B> (o <strong>Pedí tu escribano</strong> en el menú de la portada) y te respondemos por mail.</> },
      { title: 'Pedí que te acompañen a una visita', body: <>En <strong>VARA Visit</strong> tocá <B>Pedir una visita</B>, elegí zona, fecha y hora, y <B>Confirmar visita</B>. Ves el precio antes de confirmar. Necesitás cuenta.</> },
    ],
    note: 'Si en tu zona todavía no hay acompañantes, te podés anotar para que te avisemos.',
  },
]

const TIPS = [
  'En México, donde dice escribano es notario, y seña es apartado.',
  'Los precios de los avisos son pedidos, no de venta: sirven para negociar.',
  'Antes de dar plata, pedí lo que está en «Lo que falta confirmar».',
  'Las funciones con IA están en beta, por invitación.',
]

export default function ComoUsarPage() {
  return (
    <main className="min-h-screen bg-surface text-ink">
      <header className="border-b border-line bg-white/80">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <VaraLogo size={26} />
          <Link href="/analizar" className="text-sm font-bold text-brand-700 hover:underline">Analizar un aviso</Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 pb-6 pt-12">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Guía rápida</p>
        <h1 className="font-display mt-2 text-4xl font-extrabold leading-tight text-brand-900 text-balance md:text-5xl">Cómo usar VARA</h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-soft">Elegí qué querés hacer. Cada guía son pocos pasos, con el nombre exacto de cada botón.</p>
        <nav aria-label="Guías" className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {GUIDES.map(g => (
            <a key={g.id} href={`#${g.id}`}
              className="group flex items-center gap-3 rounded-2xl border border-line bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><g.icon size={20} aria-hidden="true" /></span>
              <span className="font-semibold text-brand-900">{g.title}</span>
            </a>
          ))}
        </nav>
      </section>

      {GUIDES.map((g, gi) => (
        <section key={g.id} id={g.id} className={`scroll-mt-6 ${gi % 2 ? 'bg-white' : ''}`}>
          <div className="mx-auto max-w-5xl px-5 py-14">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-700 text-white"><g.icon size={22} aria-hidden="true" /></span>
              <h2 className="font-display text-2xl font-extrabold text-brand-900 md:text-3xl">{g.title}</h2>
            </div>
            <p className="mt-2 max-w-2xl text-ink-soft">{g.intro}</p>
            <div className={g.id === 'analizar' ? 'mt-8 grid items-start gap-10 lg:grid-cols-[1fr_0.8fr]' : 'mt-8'}>
              <ol className="space-y-3">
                {g.steps.map((s, i) => (
                  <li key={s.title} className="flex gap-4 rounded-2xl border border-line bg-white p-4 shadow-sm">
                    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white">{i + 1}</span>
                    <div>
                      <p className="font-semibold text-ink">{s.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-ink-soft">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
              {g.id === 'analizar' && (
                <ProductFrame src="/marketing/real/analisis-palermo.jpg"
                  alt="Así se ve un análisis de VARA: precio publicado, total con gastos y rango de avisos parecidos"
                  caption="Así se ve un análisis real (departamento en Palermo, 22/11/2026)." />
              )}
            </div>
            {g.note && <p className="mt-4 text-sm text-ink-soft">{g.note}</p>}
            {g.cta && (
              <Link href={g.cta.href} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-700 px-5 font-semibold text-white hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">
                {g.cta.label} <ArrowRight size={16} aria-hidden="true" />
              </Link>
            )}
          </div>
        </section>
      ))}

      <section className="mx-auto max-w-5xl px-5 py-14">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <p className="flex items-center gap-2 font-display text-lg font-bold text-amber-900"><Lightbulb size={20} aria-hidden="true" /> Para tener en cuenta</p>
          <ul className="mt-3 space-y-2 text-sm text-amber-900">
            {TIPS.map(t => <li key={t}>• {t}</li>)}
          </ul>
        </div>
        <p className="mt-8 text-ink-soft">¿Te quedó una duda? <Link href="/#preguntas" className="font-semibold text-brand-700 hover:underline">Mirá las preguntas frecuentes</Link> o <Link href="/#contacto" className="font-semibold text-brand-700 hover:underline">hablá con una persona</Link>. Los precios están en <Link href="/planes" className="font-semibold text-brand-700 hover:underline">Planes</Link>.</p>
      </section>
    </main>
  )
}
