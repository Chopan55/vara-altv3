export const dynamic = 'force-dynamic'
import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'
import { findKnowledge, type Audience } from '@/data/knowledge'
import { requireAiAccess } from '@/lib/api/aiAccess'
import { cleanChatReply } from '@/lib/ai/cleanReply'
import { extractDraft } from '@/lib/ai/draft'
import { privateLimitText } from '@/lib/ai/privateLimit'
import { costFactsWithSource, costIntent, provinceFromContext, type CostSource } from '@/lib/ai/costFacts'
import { buildSources } from '@/lib/ai/sources'
import { scrubWalkAway } from '@/lib/negotiation/walkAway'
import { loadOperationContext, MX_ADDENDUM, VERIFIED_USAGE_RULES } from '@/lib/assistant/operationContext'


const SYSTEM_PROMPT = `Sos VARA, el acompañante inmobiliario de quien te consulta. Ayudás a buscar, comprar, vender y negociar con calma, claridad y criterio.

PERSONALIDAD Y ACOMPAÑAMIENTO:
- Empezá por lo que más le importa a la persona. Si expresa miedo, apuro o frustración, reconocé la preocupación concreta en una frase y retomá el control con un paso que pueda dar hoy.
- Hablá con calidez y seguridad cuando haya evidencia. En situaciones inciertas, distinguí lo que figura en VARA, lo que contó la persona y lo que conviene confirmar.
- Ayudá a decidir con un motivo claro y una acción concreta. Si falta información indispensable, avanzá lo que puedas y hacé una sola pregunta específica.
- Cuando la persona cuente algo que le dijo otro («me dijeron que está en regla», «me aseguraron que»), separá en una frase lo que dijo esa persona, lo que figura en VARA y lo que falta confirmar con documentos o con el profesional, y ofrecé preparar el mensaje para pedir esa confirmación.
- Evitá presionar para cerrar la operación, dar garantías o usar saludos y frases de empatía repetitivas.

NEGOCIACIÓN:
- Antes de recomendar una oferta, entendé el objetivo, el margen y la evidencia disponible. Explicá qué pedir o proponer y cómo cuidar la relación.
- Si te piden un mensaje, redactá uno breve, cordial y firme, listo para revisar y copiar. Usá marcadores entre corchetes para monto, fecha o condiciones que falten. Respetá los límites privados y no los reveles en un mensaje para la otra parte.
- Si hay presión para señar o firmar, ayudá a ganar tiempo con un pedido puntual y explicá qué corresponde verificar con el profesional a cargo.

BORRADORES (mensajes listos para revisar):
- Cuando la persona pida un mensaje, o cuando un mensaje sea el mejor próximo paso (al vendedor, a la inmobiliaria, al escribano, una contraoferta, un pedido de documentos o de tiempo), escribilo completo entre dos líneas que digan exactamente BORRADOR y FIN BORRADOR, cada una sola en su línea.
- Dentro del borrador: tono cordial y firme, breve, listo para copiar. Datos que falten, entre corchetes, por ejemplo [monto] o [fecha]. Nunca el tope de precio ni límites privados de la persona.
- Fuera del borrador, en una o dos frases: cuándo conviene mandarlo y qué revisar antes. El borrador se muestra aparte, debajo de tu respuesta: no digas «te dejo un borrador:» ni termines una frase con dos puntos anunciándolo. No uses rayas, comillas ni títulos alrededor del borrador. Si el mensaje ayuda, escribilo directamente: no preguntes «¿querés que lo prepare?». Un solo borrador por respuesta. VARA no lo envía: lo revisa y lo manda la persona.


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
- Español rioplatense (vos/tenés), salvo que la operación sea en México (ver abajo). Directo, claro, sin paja.
- Máximo 4 párrafos. Bullets si hay más de 3 ítems.
- Etiquetá según certeza: [HECHO], [ESTIMADO], [RECOMENDACIÓN], [CONSULTAR PROFESIONAL].
- Nunca inventes números impositivos: si no los tenés precisos, dá el rango y la fuente.
- Cuando corresponda, cerrá diciendo a qué sección de VARA ir.
- Si el usuario menciona su operación, usá ese contexto.
- Texto plano: sin asteriscos, sin títulos con # ni tablas. Para listas usá guiones o números.
- Si no hay una operación verificada en el contexto, NO asumas que el usuario compra, vende o tiene una operación en marcha. Si hace falta saberlo, preguntalo en una línea.`

export async function POST(req: NextRequest) {
  const auth = await requireAiAccess('text')
  if (auth.error) return auth.error

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  try {
    const { messages, context, operationId, includeNextStep } = await req.json()

    if (!Array.isArray(messages) || messages.length === 0 || !messages.every(message =>
      message && (message.role === 'assistant' || message.role === 'user') && typeof message.content === 'string'
    )) {
      return NextResponse.json({ error: 'Mensajes inválidos' }, { status: 400 })
    }

    // Base de conocimiento: buscamos las entradas que matcheen la última pregunta
    // y se las damos al modelo como material propio de VARA.
    const lastUser = [...messages].reverse().find((m: { role: string }) => m.role === 'user')
    const audienceHint: Audience | undefined =
      typeof context === 'string' && /vend/i.test(context) ? 'SELL'
      : typeof context === 'string' && /compr/i.test(context) ? 'BUY'
      : undefined

    // Si se provee operationId, cargar contexto verificado desde Supabase (H18).
    // El país de la operación decide la guía y la terminología.
    const verified = typeof operationId === 'string' && operationId
      ? await loadOperationContext(operationId, auth.userId)
      : null
    const country = verified?.country === 'MX' ? 'MX' : 'AR'

    const entries = typeof lastUser?.content === 'string'
      ? findKnowledge(lastUser.content, verified?.audience ?? audienceHint, 3, country)
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

    // Costos: los valores salen de la calculadora de VARA (misma función que la pantalla de Costos), no de la memoria del modelo.
    const asksCosts = typeof lastUser?.content === 'string' && costIntent(lastUser.content)
    const costResult = asksCosts
      ? costFactsWithSource({ province: verified?.province ?? provinceFromContext(context), country, audience: verified?.audience ?? audienceHint })
      : null
    const costBlock = costResult?.text ?? ''
    const costSource: CostSource | null = costResult?.source ?? null

    const contextParts: string[] = [SYSTEM_PROMPT]
    if (country === 'MX') contextParts.push('', MX_ADDENDUM)
    if (verified) {
      contextParts.push('', verified.text, VERIFIED_USAGE_RULES)
    }
    // Los datos del navegador orientan la consulta, con el mismo nivel de confianza que el mensaje del usuario.
    const screenHint = typeof context === 'string' && context.trim()
      ? [{ role: 'user' as const, content: 'Contexto adicional de mi pantalla (sin verificar): ' + context.slice(0, 500) }]
      : []
    const systemContent = contextParts.join('\n') + kb + (costBlock ? '\n\n' + costBlock : '')

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemContent },
        ...screenHint,
        ...messages.slice(-12).map(({ role, content }) => ({ role, content })),
      ],
      max_tokens: 1100,
      temperature: 0.4,
    })

    const reply = completion.choices[0]?.message?.content ?? 'No pude generar una respuesta. Intentá de nuevo.'
    const includeDocumentStatus = includeNextStep === true && verified !== null
    const nextStep = includeDocumentStatus && verified.documentCount !== null && verified.documentCount > 0
      ? { operationId, target: 'documents' }
      : undefined
    const documentsUnavailable = includeDocumentStatus && verified.documentCount === null
    // Si la persona contó su tope, ese monto se tapa en la respuesta y en el borrador aunque el modelo lo repita.
    const privateLimit = privateLimitText(messages)
    const { reply: visibleReply, draft } = extractDraft(scrubWalkAway(cleanChatReply(reply), privateLimit))
    const sources = buildSources({
      operation: verified ? { stage: verified.stage, documentCount: verified.documentCount } : null,
      cost: costSource,
      knowledgeTitles: entries.map(e => e.title),
    })
    return NextResponse.json({ reply: visibleReply, draft, nextStep, documentsUnavailable, sources })

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
