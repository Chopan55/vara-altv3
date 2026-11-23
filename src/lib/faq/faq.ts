/**
 * Preguntas frecuentes del asistente público. Respuestas escritas a mano: el
 * asistente nunca inventa; si no encuentra una, lo dice y ofrece hablar con una persona.
 */
export type Faq = { q: string; a: string; keys: string[] }

export const FAQS: Faq[] = [
  { q: '¿Qué es VARA?', keys: ['que es', 'vara', 'para que sirve', 'hace'],
    a: 'VARA te ayuda a analizar, comparar, preparar, negociar y cerrar una compra o venta de una propiedad. Empieza donde terminan los portales: vos decidís y VARA te da claridad y control.' },
  { q: '¿VARA es una inmobiliaria?', keys: ['inmobiliaria', 'corredor', 'agente'],
    a: 'No. VARA no vende ni intermedia tu propiedad. Es una capa de información, coordinación y ejecución que puede convivir con una inmobiliaria si querés trabajar con una.' },
  { q: '¿Puedo vender sin inmobiliaria?', keys: ['vender', 'sin inmobiliaria', 'venta'],
    a: 'Sí, podés preparar y gestionar tu venta por tu cuenta. VARA te ayuda con costos, documentos, descripción, negociación y próximos pasos. Si en algún momento querés sumar a alguien, también se puede.' },
  { q: '¿Puedo usar VARA si ya trabajo con una inmobiliaria?', keys: ['ya trabajo', 'con inmobiliaria', 'convivir'],
    a: 'Sí. VARA no necesita reemplazarla para ayudarte a entender costos, riesgos y documentos.' },
  { q: '¿Cuánto cuesta?', keys: ['cuanto', 'cuesta', 'precio', 'plan', 'gratis', 'pagar'],
    a: 'Analizar un aviso es gratis. Para seguir tu operación hay tres planes mensuales: Esencial $30.000, Operación $80.000 y Full $100.000 (en México, el equivalente en pesos mexicanos). No cobramos comisión. Durante la beta privada no se cobra.' },
  { q: '¿Me ayudan a publicar mi propiedad?', keys: ['publicar', 'publicacion', 'aviso', 'portal'],
    a: 'Te ayudamos a preparar el material (descripción y datos). VARA no publica automáticamente en los portales: eso lo hacés vos o quien elijas.' },
  { q: '¿Qué es VARA Visit?', keys: ['visit', 'visita', 'acompañ', 'partner'],
    a: 'Es la capa física: una persona verificada de la red de VARA muestra o acompaña una visita. Empieza con un PIN que le das vos, hace un checklist y te deja un reporte.' },
  { q: '¿Puedo analizar una propiedad que ya encontré?', keys: ['analizar', 'link', 'aviso', 'encontre'],
    a: 'Sí. Podés cargar los datos o pegar el link del aviso y VARA te muestra costos, riesgos y qué falta.' },
  { q: '¿VARA reemplaza al escribano o al abogado?', keys: ['escribano', 'abogado', 'reemplaza', 'profesional'],
    a: 'No. VARA te explica documentos y riesgos en lenguaje claro y te arma la consulta para el escribano, pero no lo reemplaza. Podés ir con el tuyo o pedirle a VARA que te recomiende uno.' },
  { q: '¿Qué pasa si la operación se cae?', keys: ['se cae', 'cancela', 'seña', 'reserva', 'garantia', 'pierdo'],
    a: 'VARA no toca la plata de la operación: la seña o reserva se acuerda entre las partes, por escrito y con el escribano. VARA te ayuda a saber qué pedir y qué revisar antes de dar plata, para que no se caiga por algo que se podía ver antes.' },
  { q: '¿En qué países funciona?', keys: ['pais', 'paises', 'argentina', 'mexico', 'donde funciona'],
    a: 'En Argentina y México. Los costos de escritura e impuestos se calculan según la provincia o el estado.' },
  { q: '¿Cómo empiezo?', keys: ['empiezo', 'empezar', 'comenzar', 'registro', 'cuenta'],
    a: 'Pegá el link del aviso en la portada, o tocá «Ver un ejemplo real» para ver cómo es un análisis. No hace falta cuenta. Para seguir una operación, tocá «Entrar». La guía paso a paso está en «Cómo usar VARA», al pie de la portada.' },
]

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function answer(question: string): Faq | null {
  const text = norm(question)
  if (text.trim().length < 3) return null
  let best: { faq: Faq; score: number } | null = null
  for (const faq of FAQS) {
    const score = faq.keys.reduce((s, k) => (text.includes(norm(k)) ? s + 1 : s), 0)
    if (score > 0 && (!best || score > best.score)) best = { faq, score }
  }
  return best?.faq ?? null
}
