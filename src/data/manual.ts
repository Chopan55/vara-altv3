/**
 * Contenido del manual «Cómo usar VARA» que no son las guías paso a paso:
 * los beneficios y el catálogo de TODAS las funciones que un cliente puede usar hoy.
 * Fuente: inventario de rutas y menús hecho por Codex sobre el código (24/11/2026),
 * revisado por Claude. Lo que está apagado o es experimental no entra.
 * Si cambia una función o un nombre de menú, se cambia acá (lo usan la web y el PDF).
 */

export type Requisito = 'gratis' | 'cuenta' | 'beta'

export const REQUISITO_TEXTO: Record<Requisito, string> = {
  gratis: 'Gratis, sin cuenta',
  cuenta: 'Con tu cuenta',
  beta: 'En prueba, por invitación',
}

export interface Funcion {
  nombre: string
  /** Para qué te sirve: el beneficio, en una frase simple. */
  beneficio: string
  /** Cómo se usa, con los nombres reales de botones entre «». */
  uso: string
  /** Dónde está, como lo ve la persona en la pantalla. */
  donde: string
  requisito: Requisito
}

export interface GrupoFunciones { id: string; titulo: string; intro: string; funciones: Funcion[] }

export const BENEFICIOS: { titulo: string; texto: string; emoji: string }[] = [
  { emoji: '💰', titulo: 'Ahorrás la comisión inmobiliaria', texto: 'Comprás o vendés directo con el dueño o el comprador. VARA no cobra un porcentaje de la propiedad: hay planes mensuales y analizar un aviso es gratis.' },
  { emoji: '🧾', titulo: 'Sabés cuánto te sale de verdad', texto: 'No solo el precio: los impuestos, los honorarios del escribano y los trámites, cada uno con su fuente, antes de comprometerte.' },
  { emoji: '⚖️', titulo: 'Sabés si el precio está alto o bajo', texto: 'VARA compara la propiedad con avisos parecidos de la zona y te muestra dónde cae el precio. Te sirve para negociar.' },
  { emoji: '❓', titulo: 'Sabés qué preguntar antes de dar plata', texto: 'Te arma las preguntas para el vendedor y la consulta para el escribano, listas para mandar por WhatsApp.' },
  { emoji: '✍️', titulo: 'Con un escribano de tu lado', texto: 'Podés ir con el tuyo o pedirle a VARA que te recomiende uno. Él revisa los papeles y firma.' },
  { emoji: '🗂️', titulo: 'Todo ordenado en un solo lugar', texto: 'Tareas, papeles, ofertas, visitas y plata de tu operación, con lo que sigue siempre a la vista. Menos nervios, menos olvidos.' },
]

export const FUNCIONES: GrupoFunciones[] = [
  {
    id: 'f-comprar',
    titulo: 'Para comprar',
    intro: 'En el menú de la izquierda, con «Comprando» elegido, dentro de «Herramientas de compra».',
    funciones: [
      { nombre: 'Analizar propiedad', beneficio: 'Saber en un minuto cuánto te sale una propiedad, si el precio está bien y qué preguntar.', uso: 'Pegá el link del aviso y tocá «Ver cuánto sale». Si no se puede leer, usá «Pegar el texto» o «Cargar a mano».', donde: 'Página de inicio, o «Analizar propiedad» en el menú.', requisito: 'gratis' },
      { nombre: 'Mi búsqueda', beneficio: 'Que VARA sepa qué buscás (zona, presupuesto, dormitorios) y te diga qué tan bien encaja cada propiedad.', uso: 'Completá zona, tipo, presupuesto y dormitorios, y tocá «Guardar».', donde: '«Mi búsqueda» en el menú.', requisito: 'gratis' },
      { nombre: 'Propiedades', beneficio: 'Tener todas las propiedades que estás mirando en una lista, sin perderlas.', uso: 'Tocá «Sumar una propiedad», pegá el link o el texto del aviso y confirmá. Marcalas como «Favorita», «Visitada» o «Descartar».', donde: '«Propiedades» en el menú.', requisito: 'gratis' },
      { nombre: 'Comparar', beneficio: 'Ver dos o más propiedades lado a lado según lo que más te importa, para decidir sin dudas.', uso: 'Elegí las propiedades que querés comparar y miralas lado a lado. Lo que más te importa lo ajustás en «Criterios y pesos», dentro de «Propiedades».', donde: '«Comparar» en el menú.', requisito: 'gratis' },
      { nombre: 'Checklist de visita', beneficio: 'No olvidarte de nada cuando vas a ver una propiedad.', uso: 'Marcá lo que revisaste (exterior, interior, entorno y papeles) y agregá notas. Ves tu «Score de visita».', donde: '«Checklist de visita» en el menú.', requisito: 'gratis' },
      { nombre: 'Visitas agendadas', beneficio: 'Seguir las visitas que pediste con VARA Visit y contar cómo te fue.', uso: 'Abrí una visita para ver el detalle, dejar una reseña o «Reportar un problema».', donde: '«Visitas agendadas» en el menú.', requisito: 'cuenta' },
      { nombre: 'Financiamiento', beneficio: 'Entender cómo podrías pagar la compra si necesitás un crédito.', uso: 'En «Dinero», abrí la pestaña «Financiamiento» y completá tus datos.', donde: '«Dinero» en el menú.', requisito: 'cuenta' },
    ],
  },
  {
    id: 'f-vender',
    titulo: 'Para vender',
    intro: 'En el menú de la izquierda, con «Vendiendo» elegido, dentro de «Herramientas de venta».',
    funciones: [
      { nombre: 'Papeles de la venta', beneficio: 'Tener los papeles listos antes de publicar, para que no se caiga la venta cuando aparece el comprador.', uso: 'Tocá «Empezar una venta» y marcá cada papel que ya tenés.', donde: '«Papeles de la venta» en el menú.', requisito: 'cuenta' },
      { nombre: 'Mi propiedad (armar el aviso)', beneficio: 'Un aviso completo y prolijo, sin depender de una inmobiliaria.', uso: 'Seguí los pasos «Preparación», «Revisión» y «Publicación». Elegís Zonaprop, Argenprop o MercadoLibre: VARA copia el texto y abre el portal.', donde: '«Mi propiedad» en el menú.', requisito: 'gratis' },
      { nombre: 'Precio', beneficio: 'Un punto de partida para el precio de publicación, y seguir consultas, visitas y ofertas.', uso: 'Cargá la superficie, el precio que querés y los datos de la propiedad; mirá la estrategia sugerida.', donde: '«Precio» en el menú.', requisito: 'cuenta' },
      { nombre: 'Ficha para interesados', beneficio: 'Una ficha linda de tu propiedad para mandar o imprimir.', uso: 'Completá los datos que falten y tocá «Guardar como PDF».', donde: 'En «Fotos y video», tocá «Ficha para interesados».', requisito: 'gratis' },
      { nombre: 'Video con tus fotos', beneficio: 'Un video simple de tu propiedad para compartir, hecho con tus fotos.', uso: 'Subí las fotos, ordenalas, elegí la música, tocá «Armar recorrido» y después «Descargar».', donde: '«Fotos y video» en el menú.', requisito: 'gratis' },
      { nombre: 'Interesados', beneficio: 'Anotar a cada persona que consulta y en qué etapa está, para no perder a nadie.', uso: 'Tocá «Agregar», cargá nombre, de dónde vino y una nota, y cambiá su estado a medida que avanza.', donde: '«Interesados» en el menú.', requisito: 'cuenta' },
      { nombre: 'Visitas', beneficio: 'Ordenar los pedidos de visita a tu propiedad.', uso: 'Abrí cada pedido y elegí «Confirmar», «Rechazar» o «Realizada».', donde: '«Visitas» en el menú.', requisito: 'cuenta' },
      { nombre: 'Ofertas', beneficio: 'Comparar las ofertas que recibís por precio y condiciones, y elegir la mejor.', uso: 'Seleccioná las ofertas y abrí la «Comparativa de ofertas». Podés dejar tus notas.', donde: '«Ofertas» en el menú.', requisito: 'cuenta' },
    ],
  },
  {
    id: 'f-ambos',
    titulo: 'Para comprar y para vender',
    intro: 'Están en el menú principal y en «Más».',
    funciones: [
      { nombre: 'Inicio', beneficio: 'Ver de un vistazo cómo va tu operación y qué conviene hacer ahora.', uso: 'Seguí el botón de la próxima acción. Si algo no se entiende, tocá «Explicámelo simple».', donde: '«Inicio» en el menú.', requisito: 'cuenta' },
      { nombre: 'Qué hago ahora', beneficio: 'Tus próximos pasos ordenados, para no olvidarte de nada.', uso: 'Abrí una acción y seguí su botón.', donde: '«Qué hago ahora» en el menú.', requisito: 'cuenta' },
      { nombre: 'Mi operación', beneficio: 'Toda tu operación en un lugar: tareas, riesgos, documentos, ofertas, costos, historial y quién participa.', uso: 'Usá las pestañas «Tareas», «Riesgos», «Documentos», «Ofertas», «Costos», «Qué pasó» y «Equipo».', donde: '«Mi operación» en el menú.', requisito: 'cuenta' },
      { nombre: 'Documentos', beneficio: 'Saber qué papeles tenés, cuáles faltan y a quién pedírselos.', uso: 'Abrí «Documentos» y revisá el estado de cada uno.', donde: '«Documentos» en el menú.', requisito: 'cuenta' },
      { nombre: 'Dinero', beneficio: 'Saber cuánto vas a pagar (si comprás) o cuánto te queda (si vendés).', uso: 'Poné el valor de la propiedad y elegí la provincia o el estado. Los montos son estimados: los confirma el escribano.', donde: '«Dinero» en el menú.', requisito: 'cuenta' },
      { nombre: 'Riesgos', beneficio: 'Ver a tiempo lo que podría demorar o encarecer la operación.', uso: 'Leé cada riesgo y lo que conviene hacer.', donde: '«Riesgos» en el menú.', requisito: 'cuenta' },
      { nombre: 'Escribanos y profesionales', beneficio: 'Tener a mano a tu escribano (o notario) y otros profesionales, o pedirle uno a VARA.', uso: 'Tocá «Agregar» y cargá nombre y contacto, o «Pedirle un escribano a VARA».', donde: '«Escribanos y profesionales» en el menú.', requisito: 'cuenta' },
      { nombre: 'VARA Visit', beneficio: 'Que alguien con experiencia te acompañe a visitar o muestre tu propiedad.', uso: 'Tocá «Pedir una visita», elegí qué necesitás, zona, día y hora. Ves el precio antes de confirmar.', donde: '«VARA Visit» en «Más».', requisito: 'cuenta' },
      { nombre: 'Ayuda (guía)', beneficio: 'Entender qué significa cada paso de la compra o la venta, en palabras simples.', uso: 'Buscá un tema y abrí la explicación.', donde: '«Ayuda» en el menú.', requisito: 'gratis' },
      { nombre: 'País y alertas', beneficio: 'Usar VARA con las reglas de tu país (Argentina o México).', uso: 'Elegí el país y confirmá.', donde: '«País y alertas» en «Más».', requisito: 'cuenta' },
      { nombre: 'Compartidas conmigo', beneficio: 'Ver una operación que otra persona compartió con vos (por ejemplo, tu pareja).', uso: 'Abrí la operación de la lista. Si te llegó un link de invitación, abrilo y aceptá.', donde: '«Compartidas conmigo» en «Más».', requisito: 'beta' },
    ],
  },
  {
    id: 'f-ia',
    titulo: 'Con inteligencia artificial (en prueba)',
    intro: 'Funciones nuevas que estamos probando con un grupo de usuarios invitados. Pueden cambiar.',
    funciones: [
      { nombre: 'Asistente VARA', beneficio: 'Preguntar cualquier duda de tu operación (costos, plazos, papeles) y recibir una respuesta clara.', uso: 'Escribí tu pregunta y enviala; también podés escuchar la respuesta.', donde: '«Asistente» en «Más», o «VARA AI» abajo en el menú.', requisito: 'beta' },
      { nombre: 'Ayuda para negociar', beneficio: 'Preparar tu oferta o contraoferta con una estrategia, sin el conflicto de interés de una inmobiliaria.', uso: 'Cargá tu objetivo y la posición de la otra parte, y mirá la estrategia y la próxima jugada sugeridas.', donde: '«Negociación» en «Mi operación».', requisito: 'beta' },
      { nombre: 'Texto del aviso', beneficio: 'Un título y una descripción que venden mejor tu propiedad.', uso: 'Completá los datos de tu propiedad y pedí el texto sugerido.', donde: '«Mi propiedad» en el menú.', requisito: 'beta' },
      { nombre: 'Revisar publicación', beneficio: 'Saber qué le falta a un aviso que ya publicaste para atraer más interesados.', uso: 'Pegá el link o el texto de tu aviso y tocá «Revisar».', donde: '«Publicación» en el menú (vendiendo).', requisito: 'beta' },
      { nombre: 'Fotos que venden', beneficio: 'Ver cómo quedaría un ambiente pintado, renovado o vacío.', uso: 'Elegí una foto, contá qué querés cambiar y tocá «Pedir».', donde: '«Fotos y video» en el menú.', requisito: 'beta' },
    ],
  },
]
