/**
 * Búsqueda global de la barra superior: encuentra FUNCIONES de la plataforma, y siempre
 * ofrece buscar en la Guía y preguntarle a VARA. Antes solo llevaba a la Guía, y quien
 * buscaba "documentos" no llegaba a los documentos de su operación.
 */
export type SearchKind = 'function' | 'guide' | 'assistant'
export interface SearchResult { label: string; hint: string; href: string; kind: SearchKind }

export interface SearchContext {
  journey: 'BUY' | 'SELL'
  operationId?: string | null
  /** Operaciones reales del usuario: con más de una, los resultados de operación salen uno por operación. */
  operations?: { id: string; title: string }[]
}

interface Entry {
  label: string
  hint: string
  keywords: string[]
  mode: 'BUY' | 'SELL' | 'BOTH'
  /** Pestaña de la operación a la que lleva; marca al resultado como propio de una operación. */
  opTab?: { tab: string; base: string }
  href: (ctx: SearchContext) => string
}

const op = (ctx: SearchContext, tab?: string) => `/operacion/${ctx.operationId || 'inicio'}${tab ? `?tab=${tab}` : ''}`

const ENTRIES: Entry[] = [
  { label: 'Documentos de mi operación', hint: 'Lo que ya tenés y lo que falta', keywords: ['documento', 'documentos', 'papeles', 'escritura', 'plano', 'certificado'], mode: 'BOTH', opTab: { tab: 'documentos', base: 'Documentos' }, href: c => op(c, 'documentos') },
  { label: 'Checklist documental de venta', hint: 'Papeles según tu provincia', keywords: ['documento', 'documentos', 'papeles', 'checklist', 'escritura'], mode: 'SELL', href: () => '/preparar-venta' },
  { label: 'Riesgos de mi operación', hint: 'Qué conviene revisar antes de avanzar', keywords: ['riesgo', 'riesgos', 'problema', 'alerta'], mode: 'BOTH', opTab: { tab: 'riesgos', base: 'Riesgos' }, href: c => op(c, 'riesgos') },
  { label: 'Costos de compra', hint: 'Sellos, escribano, inscripción', keywords: ['costo', 'costos', 'gastos', 'sellos', 'escribano', 'impuestos'], mode: 'BUY', href: () => '/dinero?tab=costos' },
  { label: 'Neto estimado de venta', hint: 'Cuánto te queda después de vender', keywords: ['costo', 'costos', 'gastos', 'neto', 'comision', 'impuestos', 'cuanto me queda'], mode: 'SELL', href: () => '/dinero?tab=costos' },
  { label: 'Financiamiento', hint: 'Cómo se puede pagar', keywords: ['financiamiento', 'credito', 'hipoteca', 'prestamo', 'uva'], mode: 'BUY', href: () => '/dinero?tab=financiamiento' },
  { label: 'Precio de venta', hint: 'A cuánto publicar y cuándo revisarlo', keywords: ['precio', 'valor', 'publicar', 'tasacion', 'cuanto vale'], mode: 'SELL', href: () => '/precio-venta' },
  { label: 'Mi búsqueda', hint: 'Qué buscás y qué pesa más', keywords: ['busqueda', 'prioridades', 'preferencias', 'perfil'], mode: 'BUY', href: () => '/mi-busqueda' },
  { label: 'Propiedades que estoy mirando', hint: 'Sumar y analizar propiedades', keywords: ['propiedad', 'propiedades', 'agregar', 'link', 'aviso'], mode: 'BUY', href: () => '/propiedades' },
  { label: 'Comparar propiedades', hint: 'Según tus prioridades', keywords: ['comparar', 'comparacion', 'elegir'], mode: 'BUY', href: () => '/comparar' },
  { label: 'Checklist de visita', hint: 'Qué mirar antes y durante la visita', keywords: ['visita', 'visitas', 'checklist', 'ver la propiedad'], mode: 'BUY', href: () => '/visitas' },
  { label: 'Visitas agendadas', hint: 'Tus visitas confirmadas', keywords: ['visita', 'visitas', 'agenda', 'agendadas'], mode: 'BOTH', href: () => '/mis-visitas' },
  { label: 'VARA Visit', hint: 'Una persona verificada en la propiedad', keywords: ['visit', 'visita', 'visitas', 'presencial'], mode: 'BOTH', href: () => '/vara-visit' },
  { label: 'Mi propiedad', hint: 'Datos, fotos y descripción del aviso', keywords: ['propiedad', 'publicar', 'publicacion', 'aviso', 'datos'], mode: 'SELL', href: () => '/publicar' },
  { label: 'Revisar mi publicación', hint: 'Qué le falta a tu aviso', keywords: ['publicacion', 'revisar', 'aviso', 'completitud'], mode: 'SELL', href: () => '/revisar-publicacion' },
  { label: 'Fotos: recomendaciones', hint: 'Qué mejorar y cómo se vería', keywords: ['foto', 'fotos', 'imagen', 'imagenes', 'visualizar'], mode: 'SELL', href: () => '/fotos-venta' },
  { label: 'Recorrido en video', hint: 'Video con tus fotos y música', keywords: ['video', 'recorrido', 'musica', 'tour'], mode: 'SELL', href: () => '/video-presentacion' },
  { label: 'Ficha para interesados', hint: 'Property Pack para compartir', keywords: ['ficha', 'pack', 'property', 'pdf', 'compartir'], mode: 'SELL', href: () => '/property-pack' },
  { label: 'Interesados', hint: 'Quién consultó y en qué etapa está', keywords: ['interesado', 'interesados', 'consultas', 'leads', 'compradores'], mode: 'SELL', href: () => '/interesados' },
  { label: 'Ofertas', hint: 'Ofertas y contraofertas', keywords: ['oferta', 'ofertas', 'contraoferta', 'negociar'], mode: 'BOTH', href: () => '/ofertas' },
  { label: 'Visitas de vendedor', hint: 'Quién quiere visitar tu propiedad', keywords: ['visita', 'visitas', 'visitar', 'agenda'], mode: 'SELL', href: () => '/visitas-vendedor' },
  { label: 'Negociación', hint: 'Prepará cada conversación', keywords: ['negociacion', 'negociar', 'contraoferta', 'regatear'], mode: 'BOTH', href: () => '/negociacion' },
  { label: 'Profesionales', hint: 'Escribano, abogado, tasador', keywords: ['profesional', 'profesionales', 'escribano', 'abogado', 'tasador'], mode: 'BOTH', href: () => '/profesionales' },
  { label: 'Centro de acciones', hint: 'Qué hacer ahora', keywords: ['acciones', 'pendientes', 'que hago', 'tareas', 'proximo paso'], mode: 'BOTH', href: () => '/acciones' },
]

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

export function searchApp(query: string, ctx: SearchContext): SearchResult[] {
  const q = normalize(query)
  if (!q) return []
  const tokens = q.split(/\s+/).filter(Boolean)

  const scored = ENTRIES
    .filter(e => e.mode === 'BOTH' || e.mode === ctx.journey)
    .map(e => {
      const hay = [normalize(e.label), ...e.keywords.map(normalize)]
      const hit = tokens.every(t => hay.some(h => h.includes(t)))
      const starts = hay.some(h => h.startsWith(tokens[0]))
      return { e, score: hit ? (starts ? 2 : 1) : 0 }
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  const ops = ctx.operations ?? []
  const functions: SearchResult[] = scored.flatMap(({ e }): SearchResult[] => {
    // Con varias operaciones no se adivina cuál: un resultado por operación, con su nombre.
    if (e.opTab && ops.length > 1) {
      const repeated = (title: string) => ops.filter(o => o.title === title).length > 1
      return ops.map((o, i) => ({
        label: `${e.opTab!.base} de ${o.title}${repeated(o.title) ? ` (${i + 1})` : ''}`,
        hint: e.hint,
        href: `/operacion/${o.id}?tab=${e.opTab!.tab}`,
        kind: 'function' as const,
      }))
    }
    return [{ label: e.label, hint: e.hint, href: e.href(ctx), kind: 'function' }]
  })
  return [
    ...functions,
    { label: `Buscar “${query.trim()}” en la Guía`, hint: 'Artículos y explicaciones', href: `/guia?q=${encodeURIComponent(query.trim())}`, kind: 'guide' },
    { label: 'Preguntarle a VARA', hint: 'El asistente te responde con tu contexto', href: '/asistente', kind: 'assistant' },
  ]
}
