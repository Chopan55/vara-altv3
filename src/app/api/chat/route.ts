import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { findKnowledge, type Audience } from '@/data/knowledge'


/** Carga el contexto verificado de una operación desde Supabase (H18). */
async function loadOperationContext(operationId: string): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return null

  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    })

    // RLS garantiza que solo el dueño de la operación puede leerla
    const { data: op, error } = await supabase
      .from('operations')
      .select('id, type, title, status, province, city, country, property_id')
      .eq('id', operationId)
      .maybeSingle()

    if (error || !op) return null

    const lines = [
      'Datos verificados de la operación del usuario (fuente: base de datos):',
      `- Tipo: ${op.type}`,
      `- Título: ${op.title ?? '—'}`,
      `- Estado: ${op.status}`,
      `- Provincia/Estado: ${op.province ?? '—'}`,
      `- Ciudad: ${op.city ?? '—'}`,
      `- País: ${op.country ?? 'AR'}`,
    ]
    if (op.property_id) lines.push(`- Propiedad asociada ID: ${op.property_id}`)
    return lines.join('\n')
  } catch {
    return null
  }
}

const SYSTEM_PROMPT = `Sos VARA, el asistente de la plataforma VARA para operaciones inmobiliarias en Argentina.

REGLA PRINCIPAL — no mandes al usuario afuera:
VARA existe para que el usuario resuelva todo acá adentro. Nunca recomiendes herramientas,
apps, software ni servicios de terceros (SketchUp, AutoCAD, RoomSketcher, portales, estudios).
Si lo que pide se hace en VARA, decile exactamente en qué sección y con qué botón.
Si VARA todavía no lo hace, decilo derecho: "eso todavía no lo hace VARA" — y ofrecé lo más
parecido que sí exista. Nunca inventes secciones que no estén en la lista de abajo.

La única excepción son los profesionales matriculados (escribano, agrimensor, abogado):
ahí sí corresponde recomendar consultar a uno, porque VARA no reemplaza su firma.

QUÉ HAY EN VARA Y DÓNDE (usá estos nombres exactos):
- Inicio: estado de tus operaciones, alertas y próximo paso.
- Mi Operación: las etapas de la compra o venta, con tabs Tareas, Riesgos, Docs, Costos,
  Timeline, Equipo y Diseño.
- Propiedades: las propiedades que importaste o cargaste. Se importan pegando el link del
  aviso; si el portal bloquea la lectura, se pega el texto del aviso.
- Diseño (dentro de Mi Operación y de la ficha de propiedad): subís una foto de un ambiente
  y VARA la edita — pintar fachada, renovar interior, cocina, baño, jardín, vaciar el ambiente —
  y estima cuánto costaría la reforma.
- Mi propiedad / Publicar (vendedores): cargás datos y fotos, la IA redacta el aviso y se
  coordina la publicación en los portales.
- Ofertas (vendedores): las ofertas recibidas, con análisis de cada una.
- Visitas: compradores tienen checklist de qué mirar; vendedores gestionan las solicitudes.
- Costos: calculadora de gastos de escrituración por provincia, con fuentes.
  Adentro está crédito hipotecario (compradores) o estrategia de precio (vendedores).
- VARA Visit: servicio pago, un profesional te acompaña a ver la propiedad.

TU CONOCIMIENTO DEL DOMINIO (para responder, no para derivar afuera):
compraventa en Argentina (reserva → boleto → escritura), costos por provincia (sellos,
honorarios de escribano, ITI, Ganancias), documentación por tipo de operación, inhibiciones,
dominio, estudio de títulos, normativa CABA y Buenos Aires, créditos UVA, negociación y señas,
riesgos típicos y cómo mitigarlos.

CÓMO RESPONDÉS:
- Español rioplatense (vos/tenés). Directo, claro, sin paja.
- Máximo 4 párrafos. Bullets si hay más de 3 ítems.
- Etiquetá según certeza: [HECHO], [ESTIMADO], [RECOMENDACIÓN], [CONSULTAR PROFESIONAL].
- Nunca inventes números impositivos: si no los tenés precisos, dá el rango y la fuente.
- Cuando corresponda, cerrá diciendo a qué sección de VARA ir.
- Si el usuario menciona su operación, usá ese contexto.`

export async function POST(req: NextRequest) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  try {
    const { messages, context, operationId } = await req.json()

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Mensajes inválidos' }, { status: 400 })
    }

    // Base de conocimiento: buscamos las entradas que matcheen la última pregunta
    // y se las damos al modelo como material propio de VARA.
    const lastUser = [...messages].reverse().find((m: { role: string }) => m.role === 'user')
    const audience: Audience | undefined =
      typeof context === 'string' && /vend/i.test(context) ? 'SELL'
      : typeof context === 'string' && /compr/i.test(context) ? 'BUY'
      : undefined

    const entries = typeof lastUser?.content === 'string'
      ? findKnowledge(lastUser.content, audience, 3)
      : []

    const kb = entries.length
      ? [
          '',
          'MATERIAL DE VARA sobre lo que te preguntan. Respondé con esto, es contenido propio:',
          ...entries.map(e => {
            const alerta = e.watchOut?.length
              ? ['Señales de alerta:', ...e.watchOut.map(w => `- ${w}`)].join('\n')
              : ''
            return [`### ${e.title}`, e.summary, e.body, alerta].filter(Boolean).join('\n')
          }),
        ].join('\n\n')
      : ''

    // Si se provee operationId, cargar contexto verificado desde Supabase (H18)
    const verifiedContext = typeof operationId === 'string' && operationId
      ? await loadOperationContext(operationId)
      : null

    const contextParts: string[] = [SYSTEM_PROMPT]
    if (verifiedContext) {
      contextParts.push('', verifiedContext)
    }
    // El context del cliente es adicional (info de página), no fuente de verdad
    if (typeof context === 'string' && context) {
      contextParts.push('', 'Contexto adicional de la pantalla actual (no verificado):', context)
    }
    const systemContent = contextParts.join('\n') + kb

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemContent },
        ...messages.slice(-12),
      ],
      max_tokens: 800,
      temperature: 0.4,
    })

    const reply = completion.choices[0]?.message?.content ?? 'No pude generar una respuesta. Intentá de nuevo.'
    return NextResponse.json({ reply })

  } catch (err) {
    console.error('[VARA Chat]', err)
    const msg = err instanceof Error ? err.message : ''
    if (/insufficient_quota|credit_balance|no credits/i.test(msg)) {
      return NextResponse.json({ error: 'La cuenta de IA se quedó sin crédito. Contactá al soporte.' }, { status: 402 })
    }
    if (/rate limit|429/i.test(msg)) {
      return NextResponse.json({ error: 'Demasiados pedidos seguidos. Esperá un minuto y reintentá.' }, { status: 429 })
    }
    return NextResponse.json({ error: 'Error al procesar tu consulta. Intentá de nuevo.' }, { status: 500 })
  }
}
