import Link from 'next/link'
import { ArrowRight, Lightbulb, BookOpen, Link2, Download, ShieldAlert, LifeBuoy, Sparkles, LayoutGrid } from 'lucide-react'
import { VaraLogo } from '@/components/ui/VaraLogo'
import { B, Box, GLOSARIO, GUIDES, REQ_COLOR } from '@/components/manual/content'
import { GuideImage } from '@/components/manual/GuideImage'
import { HelpSearch } from '@/components/manual/HelpSearch'
import { BENEFICIOS, FUNCIONES, PROBLEMAS, REQUISITO_TEXTO, type Requisito } from '@/data/manual'

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

export default function ComoUsarPage() {
  return (
    <main className="min-h-screen bg-surface text-ink">
      <header className="border-b border-line bg-white/80 print:hidden">
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
          <p className="mt-3 max-w-2xl text-brand-100">VARA te estima los costos, te muestra si el precio está alto o bajo, te avisa los riesgos y te dice qué sigue. No reemplaza al escribano ni publica por vos.</p>
          <a href="/manual/Manual_VARA.pdf" download
            className="mt-6 print:hidden inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-5 font-semibold text-brand-800 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            <Download size={18} aria-hidden="true" /> Descargar la guía en PDF
          </a>
        </div>

        <HelpSearch entries={[
          ...PROBLEMAS.map(p => ({ href: `#${p.id}`, title: p.titulo, terms: [p.porQue, ...p.solucion].join(' ') })),
          ...GUIDES.map(g => ({ href: `#${g.id}`, title: g.title, terms: [g.intro, ...g.steps.map(step => step.title)].join(' ') })),
          ...FUNCIONES.map(g => ({ href: `#${g.id}`, title: g.titulo, terms: g.funciones.map(f => f.nombre).join(' ') })),
          { href: '#glosario', title: 'Palabras que vas a leer', terms: GLOSARIO.map(([term]) => term).join(' ') },
        ]} />

        <nav aria-label="Elegí qué querés hacer" className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 print:hidden">
          {[
            { href: '#beneficios', icon: Sparkles, t: 'Lo que VARA hace por vos' },
            { href: '#glosario', icon: BookOpen, t: 'Palabras que vas a leer' },
            { href: '#link', icon: Link2, t: 'Cómo copiar el link de un aviso' },
            ...GUIDES.map(g => ({ href: `#${g.id}`, icon: g.icon, t: g.title })),
            { href: '#funciones', icon: LayoutGrid, t: 'Todas las funciones' },
            { href: '#problemas', icon: LifeBuoy, t: 'Resolver un problema' },
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

      {/* Beneficios */}
      <section id="beneficios" className="mx-auto max-w-5xl scroll-mt-6 px-5 pt-12 print:break-before-page">
        <h2 className="font-display text-2xl font-extrabold text-brand-900 md:text-3xl">Lo que VARA hace por vos</h2>
        <p className="mt-2 text-ink-soft">VARA es una página web que te acompaña para comprar o vender una propiedad por tu cuenta. La usás desde el celular o la computadora.</p>
        <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {BENEFICIOS.map(b => (
            <div key={b.titulo} className="rounded-2xl border border-line bg-white p-5 break-inside-avoid">
              <p className="text-2xl" aria-hidden="true">{b.emoji}</p>
              <h3 className="mt-2 font-bold text-brand-900">{b.titulo}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{b.texto}</p>
            </div>
          ))}
        </div>
        <Box tone="info" title="Qué necesitás para empezar">Un celular o computadora con internet y el aviso de la propiedad que te interesa. Para analizar un aviso <strong>no hace falta crear una cuenta</strong>. Para guardar y seguir tu operación, sí (con tu mail y una contraseña).</Box>
      </section>

      {/* Empezá por acá */}
      <section className="mx-auto max-w-5xl px-5 pt-10">
        <div className="rounded-3xl border-2 border-brand-200 bg-brand-50 p-6">
          <h2 className="font-display text-2xl font-extrabold text-brand-900">Empezá por acá: tu primer análisis en 3 pasos</h2>
          <ol className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              ['Copiá el link del aviso', 'El aviso de la propiedad que te interesa, en Zonaprop, Argenprop, MercadoLibre o Inmuebles24.', '#link'],
              ['Pegalo en VARA', 'En la página de inicio, donde dice «Pegá el link del aviso», y tocá «Ver cuánto sale».', '#analizar'],
              ['Mirá el resultado', 'Precio, gastos estimados, si está caro o barato y qué preguntar antes de dar plata.', '#analizar'],
            ].map(([t, d, h], i) => (
              <li key={t} className="rounded-2xl bg-white p-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 font-bold text-white" aria-hidden="true">{i + 1}</span>
                <h3 className="mt-2 font-bold text-brand-900">{t}</h3>
                <p className="mt-1 text-sm text-ink-soft">{d}</p>
                <a href={h} className="mt-2 inline-block text-sm font-semibold text-brand-700 underline print:hidden">Ver cómo</a>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Glosario */}
      <section id="glosario" className="mx-auto max-w-5xl scroll-mt-6 px-5 py-12 print:break-before-page">
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
      <section id="link" className="scroll-mt-6 bg-white print:break-before-page">
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
        <section key={g.id} id={g.id} className={`scroll-mt-6 print:break-before-page ${gi % 2 ? 'bg-white' : ''}`}>
          <div className="mx-auto max-w-5xl px-5 py-12">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-700 text-white"><g.icon size={22} aria-hidden="true" /></span>
              <h2 className="font-display text-2xl font-extrabold text-brand-900 md:text-3xl">{g.title}</h2>
            </div>
            <p className="mt-2 max-w-2xl text-ink-soft">{g.intro}</p>
            <dl className="mt-4 grid gap-3 rounded-2xl bg-brand-50 p-4 text-sm sm:grid-cols-3">
              {[
                ['Qué necesitás', g.meta.necesitas],
                ['Tiempo estimado', g.meta.tarda],
                ['Qué obtenés', g.meta.resultado],
              ].map(([title, value]) => (
                <div key={title}><dt className="font-bold text-brand-900">{title}</dt><dd className="mt-1 text-ink-soft">{value}</dd></div>
              ))}
            </dl>
            <ol className="mt-6 space-y-3">
              {g.steps.map((s, i) => (
                <li key={s.title} className="flex gap-4 rounded-2xl border border-line bg-white p-4 shadow-sm break-inside-avoid">
                  <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 font-bold text-white">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-semibold text-ink">{s.title}</h3>
                    <p className="mt-1 leading-relaxed text-ink-soft">{s.body}</p>
                    {s.img && <GuideImage src={s.img.src} alt={s.img.alt} />}
                  </div>
                </li>
              ))}
            </ol>
            {g.extra}
            <Link href={g.cta.href} className="mt-6 print:hidden inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand-700 px-5 font-semibold text-white hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">
              {g.cta.label} <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </section>
      ))}

      {/* Todas las funciones */}
      <section id="funciones" className="scroll-mt-6 bg-white print:break-before-page">
        <div className="mx-auto max-w-5xl px-5 py-12">
          <h2 className="font-display text-2xl font-extrabold text-brand-900 md:text-3xl">Todas las funciones</h2>
          <p className="mt-2 text-ink-soft">Qué podés hacer con VARA, para qué te sirve cada cosa y dónde la encontrás.</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            {(Object.keys(REQUISITO_TEXTO) as Requisito[]).map(r => <span key={r} className={`rounded-full px-2.5 py-1 ${REQ_COLOR[r]}`}>{REQUISITO_TEXTO[r]}</span>)}
          </div>
          {FUNCIONES.map(g => (
            <div key={g.id} id={g.id} className="mt-10 scroll-mt-6">
              <h3 className="font-display text-xl font-extrabold text-brand-900">{g.titulo}</h3>
              <p className="mt-1 text-sm text-ink-soft">{g.intro}</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {g.funciones.map(f => (
                  <article key={f.nombre} className="rounded-2xl border border-line p-4 break-inside-avoid">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h4 className="font-bold text-ink">{f.nombre}</h4>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${REQ_COLOR[f.requisito]}`}>{REQUISITO_TEXTO[f.requisito]}</span>
                    </div>
                    <p className="mt-2 text-sm"><span className="font-semibold text-emerald-800">Para qué te sirve: </span><span className="text-ink-soft">{f.beneficio}</span></p>
                    <p className="mt-1 text-sm"><span className="font-semibold text-brand-800">Cómo se usa: </span><span className="text-ink-soft">{f.uso}</span></p>
                    <p className="mt-1 text-sm"><span className="font-semibold text-slate-700">Dónde está: </span><span className="text-ink-soft">{f.donde}</span></p>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="problemas" className="mx-auto max-w-5xl scroll-mt-6 px-5 py-12">
        <h2 className="font-display text-2xl font-extrabold text-brand-900 md:text-3xl">Resolvé un problema</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {PROBLEMAS.map(problem => (
            <article key={problem.id} id={problem.id} className="scroll-mt-6 break-inside-avoid rounded-2xl border border-line bg-white p-5">
              <h3 className="font-bold text-ink">{problem.titulo}</h3>
              <p className="mt-2 text-sm text-ink-soft">{problem.porQue}</p>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-ink">
                {problem.solucion.map(step => <li key={step}>{step}</li>)}
              </ol>
              {problem.link && <Link href={problem.link.href} className="mt-3 inline-block font-semibold text-brand-800 underline">{problem.link.label}</Link>}
            </article>
          ))}
        </div>
      </section>

      {/* Consejos */}
      <section id="consejos" className="mx-auto max-w-5xl scroll-mt-6 px-5 py-12 print:break-before-page">
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
