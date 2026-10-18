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
    a: 'Entender es gratis. Los planes pagos todavía se están definiendo; podés ver el borrador en la página de Planes. Pagás por lo que necesitás.' },
  { q: '¿Me ayudan a publicar mi propiedad?', keys: ['publicar', 'publicacion', 'aviso', 'portal'],
    a: 'Te ayudamos a preparar el material (descripción y datos). VARA no publica automáticamente en los portales: eso lo hacés vos o quien elijas.' },
  { q: '¿Qué es VARA Visit?', keys: ['visit', 'visita', 'acompañ', 'partner'],
    a: 'Es la capa física: una persona verificada de la red de VARA muestra o acompaña una visita. Empieza con un PIN que le das vos, hace un checklist y te deja un reporte.' },
  { q: '¿Puedo analizar una propiedad que ya encontré?', keys: ['analizar', 'link', 'aviso', 'encontre'],
    a: 'Sí. Podés cargar los datos o pegar el link del aviso y VARA te muestra costos, riesgos y qué falta.' },
  { q: '¿VARA reemplaza al escribano o al abogado?', keys: ['escribano', 'abogado', 'reemplaza', 'profesional'],
    a: 'No. VARA te explica documentos y riesgos en lenguaje claro y te dice qué pedirle a cada profesional, pero no los reemplaza.' },
  { q: '¿Cómo empiezo?', keys: ['empiezo', 'empezar', 'comenzar', 'registro', 'cuenta'],
    a: 'Tocá “Empezar gratis”. Podés usar VARA sin cuenta (tus datos quedan en tu navegador) o crear una para guardar todo.' },
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
