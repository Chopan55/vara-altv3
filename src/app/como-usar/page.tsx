import Link from 'next/link'
import { ArrowRight, Search, Home, KeyRound, Users, Lightbulb, BookOpen, Link2, Download, ShieldAlert, LifeBuoy } from 'lucide-react'
import { VaraLogo } from '@/components/ui/VaraLogo'

export const metadata = {
  title: 'Cómo usar VARA',
  description: 'Guía paso a paso, con fotos, para comprar o vender sin inmobiliaria aunque nunca hayas usado una aplicación así.',
}

/**
 * Manual de usuario para personas con poca experiencia en tecnología. Cada paso sale
 * de lo que la app hace hoy (botones verificados en el código el 23-24/11/2026 y
 * auditados por Codex y Gemini). Las capturas son de VARA, sin datos de nadie.
 * Si cambia un botón, se cambia acá y en el PDF (public/manual/Manual_VARA.pdf).
 */

type Step = { title: string; body: React.ReactNode; img?: { src: string; alt: string } }
type Guide = { id: string; icon: typeof Search; title: string; intro: string; steps: Step[]; extra?: React.ReactNode; cta: { href: string; label: string } }

const M = '/marketing/manual/'

/** Nombre exacto de un botón, resaltado. Puede cortar línea en el celular. */
const B = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded-md bg-brand-50 px-1.5 py-0.5 font-semibold text-brand-800">{children}</span>
)

const Box = ({ tone, title, children }: { tone: 'tip' | 'warn' | 'info' | 'mx'; title: string; children: React.ReactNode }) => {
  const c = {
    tip: 'border-emerald-500 bg-emerald-50 text-emerald-950',
    warn: 'border-amber-500 bg-amber-50 text-amber-950',
    info: 'border-sky-500 bg-sky-50 text-sky-950',
    mx: 'border-pink-500 bg-pink-50 text-pink-950',
  }[tone]
  return (
    <div className={`mt-4 rounded-2xl border-l-4 p-4 ${c}`}>
      <p className="font-bold">{title}</p>
      <div className="mt-1 text-sm leading-relaxed">{children}</div>
    </div>
  )
}

const GUIDES: Guide[] = [
  {
    id: 'analizar',
    icon: Search,
    title: 'Analizar una propiedad',
    intro: 'Gratis y sin cuenta. En un minuto sabés cuánto te sale y qué preguntar.',
    steps: [
      { title: 'Entrá a VARA', body: <>Abrí en tu navegador <strong>vara-ar.vercel.app</strong>. Vas a ver la página de inicio de VARA.</> },
      { title: 'Pegá el link y tocá «Ver cuánto sale»', body: <>En el casillero que dice <B>Pegá el link del aviso</B>, pegá el link que copiaste (<a href="#link" className="font-semibold text-brand-700 underline">cómo copiarlo</a>). Después tocá <B>Ver cuánto sale</B>.</>, img: { src: `${M}00-pegar-link.jpg`, alt: 'Casillero de la página de inicio para pegar el link, con el botón Ver cuánto sale' } },
      { title: 'Mirá el resultado', body: <>Arriba ves el <strong>precio publicado</strong> y el <strong>total estimado con gastos</strong> (un cálculo aproximado: lo confirmás con tu escribano). Abajo, <strong>dónde cae el precio</strong>: la barrita oscura es esta propiedad y la franja clara, los avisos parecidos.</>, img: { src: `${M}01-resultado.jpg`, alt: 'Resultado del análisis: precio publicado, total estimado con gastos y rango de avisos parecidos' } },
      { title: 'Seguí «Tu plan para esta propiedad»', body: <>Los pasos en orden: qué resolver primero, qué pedirle al vendedor, cuándo ir al escribano y si querés ir acompañado a la visita.</>, img: { src: `${M}02-plan.jpg`, alt: 'Tu plan para esta propiedad, con cuatro pasos numerados' } },
      { title: 'Preguntale al vendedor', body: <>Las preguntas más importantes para hacer antes de dar plata. Tocá <B>Preguntar por WhatsApp</B> o <B>Copiar las preguntas</B>.</>, img: { src: `${M}03-preguntas.jpg`, alt: 'Preguntas para el vendedor con botones para mandarlas por WhatsApp o copiarlas' } },
      { title: 'Sabé qué es seguro y qué no', body: <>En <strong>De dónde sale cada cosa</strong>: lo que sabemos (dato del aviso), lo que estimamos (cálculo de VARA) y lo que falta confirmar antes de dar plata.</>, img: { src: `${M}04-semaforo.jpg`, alt: 'Tres columnas: lo que sabemos, lo que estimamos y lo que falta confirmar' } },
      { title: 'Compartilo con quien decide con vos', body: <>Tocá <B>Compartir por WhatsApp</B>. La otra persona ve el precio y los gastos, no tus preferencias.</>, img: { src: `${M}06-compartir.jpg`, alt: 'Recuadro para compartir el análisis por WhatsApp o copiar el link' } },
    ],
    extra: (
      <>
        <Box tone="tip" title="Si VARA no puede leer el aviso (camino alternativo)">Algunos portales no dejan leer el link. En ese caso VARA te ofrece <B>Pegar el texto</B> (copiás todo el texto del aviso y lo pegás) o <B>Cargar a mano</B> (escribís el precio y los metros).</Box>
        <Box tone="info" title="Para guardarlo y comparar mejor">Al final del análisis está <B>Guardar análisis como PDF</B>. Si viste otras propiedades parecidas, sumalas en <B>Sumar un aviso parecido</B>: con 3 o más avisos, VARA puede mostrarte un rango para comparar el precio.</Box>
      </>
    ),
    cta: { href: '/analizar?ejemplo=1', label: 'Ver un análisis real de ejemplo' },
  },
  {
    id: 'comprar',
    icon: Home,
    title: 'Seguir tu compra hasta la escritura',
    intro: 'Cuando una propiedad te interesa en serio, VARA te ordena todo lo que viene.',
    steps: [
      { title: 'Empezá desde el análisis', body: <>Tocá <B>Preparar mi compra</B>. Si no tenés cuenta, VARA te pide entrar o crear una en ese momento (con tu mail y una contraseña).</> },
      { title: 'Contale a VARA dónde es', body: <>Elegís el país y la provincia (en México, el estado). Si empezás desde cero, antes te pide tu nombre y si querés comprar o vender. Al final, <B>Empezar mi operación</B>.</>, img: { src: `${M}07-onboarding.jpg`, alt: 'Pantalla para elegir país (Argentina o México) y provincia' } },
      { title: 'Tu página de inicio te dice qué sigue', body: <>Siempre ves <strong>lo siguiente para avanzar</strong>, con un botón para hacerlo. Si algo no se entiende, tocá <B>Explicámelo simple</B>.</>, img: { src: `${M}09-inicio.jpg`, alt: 'Página de inicio con lo siguiente para avanzar' } },
      { title: 'Mi operación: tareas, riesgos y papeles', body: <>En el menú de la izquierda (en el celular, abajo) tocá <B>Mi operación</B>. Ahí están las tareas en orden, los riesgos, los documentos, las ofertas y los costos.</>, img: { src: `${M}10-operacion.jpg`, alt: 'Mi operación con la próxima tarea y las pestañas de documentos, ofertas y costos' } },
      { title: 'Dinero: cuánto vas a pagar', body: <>En <B>Dinero</B> ponés el valor de la propiedad y elegís la provincia (o el estado). VARA estima impuestos, honorarios y gastos; los montos finales los confirma el escribano.</>, img: { src: `${M}12-dinero.jpg`, alt: 'Pantalla Dinero con los costos de compra' } },
      { title: 'Checklist de visita', body: <>Antes de ir a ver la propiedad, abrí el <B>Checklist de visita</B> (en <strong>Herramientas de compra</strong>). Marcás lo que revisaste: exterior, interior, entorno y papeles, con notas.</>, img: { src: `${M}13-checklist.jpg`, alt: 'Checklist de visita con exterior, interior, entorno y documentación' } },
    ],
    extra: <Box tone="warn" title="Importante">VARA te ayuda a ordenar y entender, pero no reemplaza al escribano. Antes de firmar o dejar plata, consultalo con él.</Box>,
    cta: { href: '/analizar', label: 'Empezar analizando una propiedad' },
  },
  {
    id: 'vender',
    icon: KeyRound,
    title: 'Vender tu propiedad',
    intro: 'Juntás los papeles y armás tu aviso. Lo publicás vos, sin inmobiliaria.',
    steps: [
      { title: 'Elegí «Quiero vender»', body: <>Al crear tu operación, elegí <B>Quiero vender</B>. En <strong>Preparar la venta</strong> tocá <B>Empezar una venta</B> y marcá los papeles que ya tenés.</> },
      { title: 'Armá tu aviso en 3 pasos', body: <>En <strong>Preparar publicación</strong>: <B>Preparación</B> (datos, fotos y descripción), <B>Revisión</B> y <B>Publicación</B>.</>, img: { src: `${M}15-publicar.jpg`, alt: 'Preparar publicación en tres pasos: preparación, revisión y publicación' } },
      { title: 'Publicalo en el portal que elijas', body: <>Elegís Zonaprop, Argenprop o MercadoLibre. VARA te copia el texto y abre el portal; la publicación la terminás vos ahí. El aviso es tuyo.</> },
    ],
    cta: { href: '/onboarding?intent=SELL', label: 'Empezar mi venta' },
  },
  {
    id: 'ayuda',
    icon: Users,
    title: 'Tu escribano y VARA Visit',
    intro: 'Nunca estás solo: el escribano decide lo legal y, si querés, alguien te acompaña a visitar.',
    steps: [
      { title: 'Llevale la consulta a tu escribano', body: <>Al final de cada análisis VARA te arma un mensaje con todo lo que tenés que preguntarle. Tocá <B>Copiar consulta</B> o <B>Abrir en WhatsApp</B>.</>, img: { src: `${M}05-escribano.jpg`, alt: 'Consulta armada para el escribano con botones para copiarla o abrirla en WhatsApp' } },
      { title: '¿No tenés escribano?', body: <>Tocá <B>Pedirle un escribano a VARA</B> (o <strong>Pedí tu escribano</strong> en el menú de arriba de la página de inicio). Dejás tus datos y te respondemos por mail.</> },
      { title: 'Pedí que te acompañen a una visita', body: <>Entrá a <strong>VARA Visit</strong> y tocá <B>Pedir una visita</B>. Primero elegís qué necesitás (que te acompañen o que muestren tu propiedad), después zona, día y hora, y ves el precio antes de confirmar. Para pedirla necesitás una cuenta. Si en tu zona todavía no hay acompañantes, con tu cuenta te podés anotar para que te avisemos.</>, img: { src: `${M}08-visit.jpg`, alt: 'Página de VARA Visit para pedir que alguien te acompañe a una visita' } },
    ],
    cta: { href: '/vara-visit', label: 'Conocer VARA Visit' },
  },
]

const GLOSARIO: [string, string][] = [
  ['Aviso', 'La publicación de una casa o departamento en venta, con fotos y precio.'],
  ['Portal', 'La página donde están los avisos: Zonaprop, Argenprop, MercadoLibre, Inmuebles24.'],
  ['Link (o enlace)', 'La dirección de una página de internet. Empieza con «https://».'],
  ['Pegar', 'Poner en otro lugar lo que copiaste. En el celular: dejá el dedo apretado sobre el casillero y tocá «Pegar».'],
  ['Gastos de escritura', 'Lo que se paga además del precio: impuestos, honorarios del escribano y trámites.'],
  ['Escribano (en México, notario)', 'El profesional que revisa que los papeles estén bien y firma la compraventa.'],
  ['Seña (en México, apartado)', 'La plata que se deja para reservar la propiedad. Antes de darla, conviene preguntar y revisar.'],
  ['Expensas (en México, mantenimiento)', 'Lo que se paga por mes en un edificio o barrio cerrado.'],
  ['Avisos parecidos', 'Otras propiedades similares de la zona. Sirven para saber si un precio está alto o bajo.'],
  ['Cuenta', 'Tu usuario en VARA (tu mail y una contraseña). Sirve para guardar tu operación y verla en cualquier dispositivo.'],
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

      {/* Portada */}
      <section className="mx-auto max-w-5xl px-5 pt-10">
        <div className="rounded-3xl bg-gradient-to-br from-brand-900 via-brand-700 to-violet-600 p-8 text-white md:p-12">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-100">Guía para empezar</p>
          <h1 className="font-display mt-2 text-4xl font-black leading-tight md:text-6xl">Cómo usar VARA</h1>
          <p className="mt-4 max-w-2xl text-lg text-brand-50 md:text-xl">Paso a paso y con fotos, para comprar o vender tu casa o departamento sin inmobiliaria, aunque nunca hayas usado una aplicación así.</p>
          <a href="/manual/Manual_VARA.pdf" download
            className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-5 font-semibold text-brand-800 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            <Download size={18} aria-hidden="true" /> Descargar la guía en PDF
          </a>
        </div>

        <nav aria-label="Elegí qué querés hacer" className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { href: '#glosario', icon: BookOpen, t: 'Palabras que vas a leer' },
            { href: '#link', icon: Link2, t: 'Cómo copiar el link de un aviso' },
            ...GUIDES.map(g => ({ href: `#${g.id}`, icon: g.icon, t: g.title })),
            { href: '#consejos', icon: LifeBuoy, t: 'Consejos y dónde pedir ayuda' },
          ].map(x => (
            <a key={x.href} href={x.href}
              className="flex min-h-14 items-center gap-3 rounded-2xl border border-line bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><x.icon size={20} aria-hidden="true" /></span>
              <span className="font-semibold text-brand-900">{x.t}</span>
            </a>
          ))}
        </nav>
      </section>

      {/* Glosario */}
      <section id="glosario" className="mx-auto max-w-5xl scroll-mt-6 px-5 py-12">
        <h2 className="font-display text-2xl font-extrabold text-brand-900 md:text-3xl">Palabras que vas a leer</h2>
        <p className="mt-2 text-ink-soft">Si alguna palabra no te suena, buscala acá.</p>
        <dl className="mt-6 grid gap-3 md:grid-cols-2">
          {GLOSARIO.map(([t, d]) => (
            <div key={t} className="rounded-2xl border border-line bg-white p-4">
              <dt className="font-bold text-brand-900">{t}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-ink-soft">{d}</dd>
            </div>
          ))}
        </dl>
        <Box tone="mx" title="Si estás en México">VARA funciona igual. Donde esta guía dice escribano, es notario; seña es apartado; y expensas es mantenimiento.</Box>
      </section>

      {/* Cómo copiar un link */}
      <section id="link" className="scroll-mt-6 bg-white">
        <div className="mx-auto max-w-5xl px-5 py-12">
          <h2 className="font-display text-2xl font-extrabold text-brand-900 md:text-3xl">Cómo copiar el link de un aviso</h2>
          <p className="mt-2 text-ink-soft">Es lo primero que vas a hacer. Elegí cómo lo estás mirando.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-line p-5">
              <p className="font-bold text-brand-900">📱 Desde el celular</p>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-ink-soft">
                <li>Abrí el aviso que te interesa (en la aplicación del portal o en internet).</li>
                <li>Buscá el botón <B>Compartir</B>. Suele ser un ícono con una flechita o con tres puntitos unidos.</li>
                <li>Tocá <B>Copiar enlace</B> (o <B>Copiar link</B>). Listo: el link quedó guardado en tu celular.</li>
              </ol>
            </div>
            <div className="rounded-2xl border border-line p-5">
              <p className="font-bold text-brand-900">💻 Desde la computadora</p>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-ink-soft">
                <li>Abrí el aviso en tu navegador (Chrome, Safari o el que uses).</li>
                <li>Hacé un clic en la barra de arriba de todo, donde está la dirección que empieza con «https://». Se pinta de azul.</li>
                <li>Apretá a la vez <strong>Ctrl + C</strong> (en Mac, <strong>Cmd + C</strong>). Listo: quedó copiado.</li>
              </ol>
            </div>
          </div>
          <Box tone="tip" title="¿No encontrás el link?">No pasa nada. En VARA también podés pegar el texto del aviso o escribir vos el precio y los metros.</Box>
        </div>
      </section>

      {/* Guías */}
      {GUIDES.map((g, gi) => (
        <section key={g.id} id={g.id} className={`scroll-mt-6 ${gi % 2 ? 'bg-white' : ''}`}>
          <div className="mx-auto max-w-5xl px-5 py-12">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-700 text-white"><g.icon size={22} aria-hidden="true" /></span>
              <h2 className="font-display text-2xl font-extrabold text-brand-900 md:text-3xl">{g.title}</h2>
            </div>
            <p className="mt-2 max-w-2xl text-ink-soft">{g.intro}</p>
            <ol className="mt-6 space-y-3">
              {g.steps.map((s, i) => (
                <li key={s.title} className="flex gap-4 rounded-2xl border border-line bg-white p-4 shadow-sm">
                  <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 font-bold text-white">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-semibold text-ink">{s.title}</p>
                    <p className="mt-1 leading-relaxed text-ink-soft">{s.body}</p>
                    {s.img && (
                      <a href={s.img.src} target="_blank" rel="noopener noreferrer" className="mt-3 block max-w-xl" aria-label={`Ver en grande: ${s.img.alt}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={s.img.src} alt={s.img.alt} loading="lazy" className="w-full rounded-xl border border-line shadow-sm" />
                        <span className="mt-1 block text-xs text-ink-soft">Tocá la imagen para verla en grande</span>
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            {g.extra}
            <Link href={g.cta.href} className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand-700 px-5 font-semibold text-white hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">
              {g.cta.label} <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </section>
      ))}

      {/* Consejos */}
      <section id="consejos" className="mx-auto max-w-5xl scroll-mt-6 px-5 py-12">
        <h2 className="font-display flex items-center gap-2 text-2xl font-extrabold text-brand-900 md:text-3xl"><Lightbulb size={26} aria-hidden="true" /> Consejos y dónde pedir ayuda</h2>
        <Box tone="tip" title="Buenas prácticas">
          <ol className="list-decimal space-y-1 pl-5">
            <li>Antes de dar plata, pedí todo lo que aparece en «Lo que falta confirmar».</li>
            <li>Los precios de los avisos son los que se piden, no los que se pagan: sirven para negociar.</li>
            <li>Compará al menos 3 propiedades parecidas antes de ofertar.</li>
            <li>Mandale al escribano la consulta que te arma VARA: vas a llegar con las preguntas claras.</li>
          </ol>
        </Box>
        <Box tone="warn" title="Cuidado con">
          <ol className="list-decimal space-y-1 pl-5">
            <li>Dejar una seña sin papeles revisados.</li>
            <li>Firmar algo que no entendés: preguntá antes.</li>
            <li>Pasar tu contraseña a otra persona: no la compartas con nadie, aunque diga que es de VARA.</li>
          </ol>
        </Box>
        <Box tone="info" title="Si te trabás">
          <ol className="list-decimal space-y-1 pl-5">
            <li>En la página de inicio, bajá hasta <Link href="/#preguntas" className="font-semibold underline">¿Todavía tenés dudas?</Link>: ahí están las preguntas frecuentes.</li>
            <li>Si no encontrás la respuesta, completá <Link href="/#contacto" className="font-semibold underline">Hablá con una persona</Link>. Te respondemos por mail.</li>
            <li>Los precios están en <Link href="/planes" className="font-semibold underline">Planes</Link>. Analizar un aviso es gratis.</li>
          </ol>
        </Box>
        <p className="mt-6 flex items-start gap-2 text-xs text-ink-soft"><ShieldAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" /> VARA no es una inmobiliaria ni reemplaza al escribano o notario. Los costos son estimaciones con su fuente: confirmalos con tu escribano antes de firmar. Las funciones con inteligencia artificial están en prueba, por invitación. Las capturas son de VARA al 23/11/2026 y pueden cambiar.</p>
      </section>
    </main>
  )
}
