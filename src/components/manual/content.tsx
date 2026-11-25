import { Search, Home, KeyRound, Users } from 'lucide-react'
import type { Requisito } from '@/data/manual'

/** Contenido compartido del manual (web y PDF): guías paso a paso, glosario y piezas visuales. */
export type Step = { title: string; body: React.ReactNode; img?: { src: string; alt: string } }
/** Encabezado estándar de cada guía (buena práctica de NN/g): qué necesitás, cuánto tarda, qué obtenés. */
export type GuideMeta = { necesitas: string; tarda: string; resultado: string }
export type Guide = { id: string; icon: typeof Search; title: string; intro: string; meta: GuideMeta; steps: Step[]; extra?: React.ReactNode; cta: { href: string; label: string } }

export const M = '/marketing/manual/'

/** Nombre exacto de un botón, resaltado. Puede cortar línea en el celular. */
export const B = ({ children }: { children: React.ReactNode }) => (
  <strong className="font-semibold text-brand-800">«{children}»</strong>
)

export const REQ_COLOR: Record<Requisito, string> = {
  gratis: 'bg-emerald-100 text-emerald-900',
  cuenta: 'bg-sky-100 text-sky-900',
  beta: 'bg-violet-100 text-violet-900',
}

export const Box = ({ tone, title, children }: { tone: 'tip' | 'warn' | 'info' | 'mx'; title: string; children: React.ReactNode }) => {
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

export const GUIDES: Guide[] = [
  {
    id: 'analizar',
    meta: { necesitas: 'El link del aviso (o su texto, o el precio y los metros).', tarda: 'Unos 2 minutos.', resultado: 'Cuánto te puede salir, si el precio está alto o bajo y qué preguntar.' },
    icon: Search,
    title: 'Analizar una propiedad',
    intro: 'Gratis y sin cuenta. En un minuto sabés cuánto te sale y qué preguntar.',
    steps: [
      { title: 'Entrá a VARA', body: <>Abrí en tu navegador <strong>vara-ar.vercel.app</strong>. Vas a ver la página de inicio de VARA.</> },
      { title: 'Pegá el link y tocá «Ver cuánto sale»', body: <>En el casillero que dice <B>Pegá el link del aviso</B>, pegá el link que copiaste (<a href="#link" className="font-semibold text-brand-700 underline">cómo copiarlo</a>). Después tocá <B>Ver cuánto sale</B>.</>, img: { src: `${M}00-pegar-link.jpg`, alt: 'Casillero de la página de inicio para pegar el link, con el botón Ver cuánto sale' } },
      { title: 'Mirá el resultado', body: <>Arriba ves el <strong>precio publicado</strong> y el <strong>total estimado con gastos</strong> (un cálculo aproximado: lo confirmás con tu escribano). Abajo, <strong>dónde cae el precio</strong>: la barra oscura muestra esta propiedad y la franja clara, las propiedades parecidas. Si la barra oscura está más a la izquierda, es más barata que las parecidas.</>, img: { src: `${M}01-resultado.jpg`, alt: 'Resultado del análisis: precio publicado, total estimado con gastos y rango de avisos parecidos' } },
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
    meta: { necesitas: 'Una cuenta en VARA (tu mail y una contraseña).', tarda: '5 minutos para empezar; después la usás durante toda la compra.', resultado: 'Tu compra ordenada: tareas, papeles, plata y visitas.' },
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
    meta: { necesitas: 'Una cuenta en VARA, los datos y fotos de tu propiedad.', tarda: 'Unos 20 minutos para armar el aviso.', resultado: 'Tu aviso listo para publicar en el portal que elijas.' },
    icon: KeyRound,
    title: 'Vender tu propiedad',
    intro: 'Juntás los papeles y armás tu aviso. Lo publicás vos, sin inmobiliaria.',
    steps: [
      { title: 'Elegí «Quiero vender»', body: <>Al crear tu operación, elegí <B>Quiero vender</B>. En <strong>Preparar la venta</strong> tocá <B>Empezar una venta</B> y marcá los papeles que ya tenés.</> },
      { title: 'Armá tu aviso en 3 pasos', body: <>En <strong>Preparar publicación</strong>: <B>Preparación</B> (datos, fotos y descripción), <B>Revisión</B> y <B>Publicación</B>.</>, img: { src: `${M}15-publicar.jpg`, alt: 'Preparar publicación en tres pasos: preparación, revisión y publicación' } },
      { title: 'Publicalo en el portal que elijas', body: <>Elegís Zonaprop, Argenprop o MercadoLibre. VARA prepara el texto y abre el portal; la publicación la terminás vos ahí, con tu usuario de ese portal. El aviso es tuyo.</> },
    ],
    cta: { href: '/onboarding?intent=SELL', label: 'Empezar mi venta' },
  },
  {
    id: 'ayuda',
    meta: { necesitas: 'Un análisis hecho (para la consulta) o una cuenta (para VARA Visit).', tarda: '2 minutos.', resultado: 'Llegás al escribano con las preguntas claras o pedís que te acompañen.' },
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

export const GLOSARIO: [string, string][] = [
  ['Aviso', 'La publicación de una casa o departamento en venta, con fotos y precio.'],
  ['Portal', 'La página donde están los avisos: Zonaprop, Argenprop, MercadoLibre, Inmuebles24. Para publicar tu propiedad, VARA te lleva a Zonaprop, Argenprop o MercadoLibre.'],
  ['Link (o enlace)', 'La dirección de una página de internet. Empieza con «https://».'],
  ['Pegar', 'Poner en otro lugar lo que copiaste. En el celular: dejá el dedo apretado sobre el casillero y tocá «Pegar».'],
  ['Gastos de escritura', 'Lo que se paga además del precio: impuestos, honorarios del escribano y trámites.'],
  ['Escribano (en México, notario)', 'El profesional que revisa que los papeles estén bien y firma la compraventa.'],
  ['Seña (en México, apartado)', 'La plata que se deja para reservar la propiedad. Antes de darla, conviene preguntar y revisar.'],
  ['Expensas (en México, mantenimiento)', 'Lo que se paga por mes en un edificio o barrio cerrado.'],
  ['Avisos parecidos', 'Otras propiedades similares de la zona. Sirven para saber si un precio está alto o bajo.'],
  ['Cuenta', 'Tu usuario en VARA (tu mail y una contraseña). Sirve para guardar tu operación y verla en cualquier dispositivo.'],
  ['Operación', 'Tu compra o tu venta dentro de VARA, con todas sus tareas, papeles y fechas.'],
  ['Puntaje de visita («Score de visita»)', 'El porcentaje de cosas que ya revisaste en el checklist de una visita.'],
  ['Timeline', 'La lista de fechas e hitos de tu operación, en orden.'],
  ['En prueba (beta)', 'Una función nueva que estamos probando con algunas personas invitadas. Puede cambiar.'],
]
