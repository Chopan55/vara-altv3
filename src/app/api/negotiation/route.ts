export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { log } from '@/lib/observability/logger'
import type { CountryCode } from '@/types'
import { requireAuth } from '@/lib/api/requireAuth'

export type NegotiationMode =
  | 'prepare'
  | 'reply'
  | 'analyze'
  | 'strategy'
  | 'call'
  | 'offer'
  | 'counter'
  | 'review'

export interface NegotiationContext {
  objetivo?: string
  target?: string
  walkAway?: string       // private — never appears in any suggested message
  batna?: string
  deadline?: string
  counterpartyRole?: string
  counterpartyStyle?: string
  negotiationHistory?: string
  currentOffer?: string
  channel?: string
  otherContext?: string
}

export interface CallPrep {
  objective: string
  opening: string
  questions: string[]
  doNotReveal: string[]
  scenarios: Array<{ trigger: string; response: string }>
  closing: string
}

export interface NegotiationBrief {
  objetivo: string
  target: string
  batna: string
  counterpartProfile: string
  knownInterests: string[]
  levers: string[]
  doNotReveal: string[]
  opening: string
  questions: string[]
  risks: string[]
}

export interface EmotionAlert {
  detected: boolean
  reframe?: string      // suggested internal reframe for the user
  breathe?: string      // short calming instruction (5-10 words)
  label?: string        // e.g. "Presión emocional detectada", "Tono agresivo"
}

export interface NegotiationResponse {
  mode: NegotiationMode
  suggestedReply?: string
  toneAdvice?: string
  whatNotToSay?: string[]
  keySignals?: string[]
  profileDetected?: string
  profileLabel?: string
  sentiment?: 'positivo' | 'negativo' | 'neutral' | 'ambiguo'
  whatChanged?: string[]
  whatDidNotChange?: string[]
  newInformation?: string[]
  nextAction: string
  analysis?: string
  strategy?: string
  callPrep?: CallPrep
  brief?: NegotiationBrief
  redFlags?: string[]
  tacticDetected?: string
  urgencyLevel: 'alta' | 'media' | 'baja'
  confidenceLevel: 'alta' | 'media' | 'baja'
  emotionAlert?: EmotionAlert
}

const BASE_SYSTEM_PROMPT_AR = `Sos VARA Negotiation Intelligence.

Tu propósito es ayudar a un usuario de VARA a navegar negociaciones vinculadas a operaciones inmobiliarias de manera inteligente, calmada, ética y efectiva.

Podés asistir a compradores, vendedores y participantes en sus comunicaciones con compradores, vendedores, inmobiliarias, escribanos, abogados, agrimensores, inspectores, bancos, mudanzas, constructores y cualquier otro profesional involucrado en la operación.

Tu objetivo NO es "ganarle" a la contraparte.
Tu objetivo es mejorar el resultado del usuario protegiendo simultáneamente:
VALOR + PROBABILIDAD DE ACUERDO + RIESGO + TIEMPO + RELACIÓN + CONFIANZA

PRINCIPIOS FUNDAMENTALES:
- Separar POSICIÓN ("quiero USD 500k") de INTERÉS ("necesito ese monto para cancelar una deuda")
- Buscar variables negociables más allá del precio: fecha, forma de pago, posesión, muebles, reparaciones, condiciones, documentación, garantías
- Buscar trade-offs: dar algo barato para el usuario que sea valioso para la contraparte
- Preferir concesiones condicionales: "Si X, entonces Y". Nunca concesiones unilaterales repetidas
- Nunca recomendar tácticas engañosas: ofertas falsas, deadlines inventados, compradores ficticios, información fabricada

SOBRE LA CONTRAPARTE:
- No diagnosticar psicológicamente a la contraparte
- Las etiquetas de estilo (agresivo, empático, racional, difícil) representan estrategias de interacción, no verdades psicológicas
- Cuando el estilo es desconocido, responder con tono CALMO + PROFESIONAL + CLARO + CURIOSO
- Para contrapartes que presionan: ralentizar, separar persona/problema, devolver control con preguntas calibradas
- Para contrapartes analíticas: datos, comparables, documentos, números claros
- Para contrapartes empáticas: reconocer intereses, mostrar colaboración, preservar relación

PRIVACIDAD:
- El WALK-AWAY POINT (límite privado) NUNCA debe aparecer en ningún mensaje sugerido ni ser revelado a la contraparte
- Distinguir información: PÚBLICA / COMPARTIDA / PRIVADA / SENSIBLE
- Solo usar la información privada para calibrar la estrategia interna

PREGUNTAS CALIBRADAS ÚTILES:
"¿Qué necesitaría cambiar para que esto funcione?"
"¿Qué parte de la propuesta les resulta más difícil?"
"¿Cómo podríamos acercarnos?"
"¿Cuál es el punto que más les está frenando?"

FORMATO POR CANAL:
- WHATSAPP: corto, conversacional, una idea por mensaje, sin paredes de texto
- EMAIL: estructurado, contexto → propuesta → razones → condiciones → próximo paso
- TELÉFONO: preparar objetivo, preguntas, límites y escenarios, no discursos largos
- LIVE: guidance conciso y táctico, sin distraer

DESPUÉS DE CADA INTERACCIÓN IMPORTANTE:
Siempre identificar qué cambió, qué no cambió, nueva información, compromisos, temas abiertos y acción recomendada.

ACCIONES QUE REQUIEREN APROBACIÓN EXPLÍCITA DEL USUARIO:
aceptar oferta, rechazar definitivamente, compromisos legales, firmas, pagos, modificar condiciones críticas.

Toda inferencia debe indicar su nivel de confianza: alta / media / baja.
Separar siempre: HECHO / OBSERVACIÓN / INFERENCIA / RECOMENDACIÓN.

CONTROL EMOCIONAL:
Cuando el mensaje recibido sea provocativo, agresivo, presionante, urgente en tono manipulador, o diseñado para generar ansiedad o reacción impulsiva, incluye en la respuesta JSON el campo "emotionAlert" con:
- "detected": true
- "label": una etiqueta corta del tipo de presión (ej: "Tono agresivo", "Deadline artificial", "Presión emocional", "Anclaje extremo")
- "reframe": una sola oración que ayude al usuario a ver la situación con calma y perspectiva
- "breathe": instrucción corta de 5-10 palabras para no responder en caliente (ej: "Esperá 15 minutos antes de responder.")
Si el mensaje es neutro o positivo, omitir el campo o poner "detected": false.`

function buildSystemPrompt(country?: CountryCode): string {
  if (country === 'MX') {
    return BASE_SYSTEM_PROMPT_AR
      .replace('escribanos', 'notarios')
      .replace('agrimensores', 'peritos valuadores')
  }
  return BASE_SYSTEM_PROMPT_AR
}

function buildModePrompt(mode: NegotiationMode, ctx: NegotiationContext): string {
  const ctxBlock = `
CONTEXTO DE LA NEGOCIACIÓN:
- Objetivo del usuario: ${ctx.objetivo ?? 'no especificado'}
- Target deseado: ${ctx.target ?? 'no especificado'}
- BATNA (mejor alternativa): ${ctx.batna ?? 'no especificado'}
- Deadline: ${ctx.deadline ?? 'no especificado'}
- Rol de contraparte: ${ctx.counterpartyRole ?? 'no especificado'}
- Estilo de contraparte: ${ctx.counterpartyStyle ?? 'desconocido'}
- Oferta actual: ${ctx.currentOffer ?? 'ninguna'}
- Canal: ${ctx.channel ?? 'no especificado'}
- Historial: ${ctx.negotiationHistory ?? 'ninguno'}
- Contexto adicional: ${ctx.otherContext ?? 'ninguno'}
${ctx.walkAway ? `- LÍMITE PRIVADO (solo para calibración interna, NUNCA revelar): ${ctx.walkAway}` : ''}`

  const modeInstructions: Record<NegotiationMode, string> = {
    prepare: `MODO: PREPARAR NEGOCIACIÓN
Generá un Pre-Negotiation Brief completo basado en el contexto disponible.
Devolvé JSON con:
{
  "mode": "prepare",
  "brief": {
    "objetivo": "...",
    "target": "...",
    "batna": "...",
    "counterpartProfile": "...",
    "knownInterests": ["...", "..."],
    "levers": ["...", "..."],
    "doNotReveal": ["...", "..."],
    "opening": "...",
    "questions": ["...", "..."],
    "risks": ["...", "..."]
  },
  "nextAction": "...",
  "urgencyLevel": "alta|media|baja",
  "confidenceLevel": "alta|media|baja"
}`,

    reply: `MODO: REDACTAR RESPUESTA
Analizá el mensaje recibido y generá una respuesta estratégica y lista para enviar.
Devolvé JSON con:
{
  "mode": "reply",
  "suggestedReply": "...",
  "toneAdvice": "...",
  "whatNotToSay": ["...", "..."],
  "keySignals": ["...", "..."],
  "profileDetected": "agresivo|empatico|racional|dificil|desconocido",
  "profileLabel": "...",
  "sentiment": "positivo|negativo|neutral|ambiguo",
  "whatChanged": ["...", "..."],
  "whatDidNotChange": ["...", "..."],
  "newInformation": ["...", "..."],
  "nextAction": "...",
  "redFlags": ["..."],
  "tacticDetected": "...",
  "urgencyLevel": "alta|media|baja",
  "confidenceLevel": "alta|media|baja"
}
La suggestedReply debe ser un mensaje real listo para enviar, no una plantilla. Adaptarla al canal.`,

    analyze: `MODO: ANALIZAR CONVERSACIÓN
Analizá lo que dijo la contraparte. Identificá intereses detrás de posiciones, tácticas y nueva información.
Devolvé JSON con:
{
  "mode": "analyze",
  "analysis": "...",
  "keySignals": ["...", "..."],
  "profileDetected": "...",
  "profileLabel": "...",
  "sentiment": "positivo|negativo|neutral|ambiguo",
  "whatChanged": ["...", "..."],
  "whatDidNotChange": ["...", "..."],
  "newInformation": ["...", "..."],
  "nextAction": "...",
  "redFlags": ["..."],
  "tacticDetected": "...",
  "urgencyLevel": "alta|media|baja",
  "confidenceLevel": "alta|media|baja"
}`,

    strategy: `MODO: ESTRATEGIA
Recomendá la mejor estrategia para la situación actual, considerando todos los factores disponibles.
Devolvé JSON con:
{
  "mode": "strategy",
  "strategy": "...",
  "keySignals": ["...", "..."],
  "whatNotToSay": ["...", "..."],
  "nextAction": "...",
  "urgencyLevel": "alta|media|baja",
  "confidenceLevel": "alta|media|baja"
}`,

    call: `MODO: PREPARAR LLAMADA
Generá una guía para una llamada próxima, no un discurso. Objetivo, apertura, preguntas, límites y escenarios.
Devolvé JSON con:
{
  "mode": "call",
  "callPrep": {
    "objective": "...",
    "opening": "...",
    "questions": ["...", "..."],
    "doNotReveal": ["...", "..."],
    "scenarios": [{"trigger": "...", "response": "..."}, ...],
    "closing": "..."
  },
  "nextAction": "...",
  "urgencyLevel": "alta|media|baja",
  "confidenceLevel": "alta|media|baja"
}`,

    offer: `MODO: REDACTAR OFERTA
Redactá una oferta inicial estratégica con justificación. Anclaje razonable y justificable.
Devolvé JSON con:
{
  "mode": "offer",
  "suggestedReply": "...",
  "toneAdvice": "...",
  "keySignals": ["...", "..."],
  "whatNotToSay": ["...", "..."],
  "nextAction": "...",
  "urgencyLevel": "alta|media|baja",
  "confidenceLevel": "alta|media|baja"
}`,

    counter: `MODO: CONTRAOFERTA
Preparar una contraoferta estratégica. No dividir simplemente la diferencia. Buscar trade-offs en variables no-precio.
Devolvé JSON con:
{
  "mode": "counter",
  "suggestedReply": "...",
  "toneAdvice": "...",
  "keySignals": ["...", "..."],
  "whatNotToSay": ["...", "..."],
  "nextAction": "...",
  "urgencyLevel": "alta|media|baja",
  "confidenceLevel": "alta|media|baja"
}`,

    review: `MODO: REVISAR ACUERDO
Revisá el texto o condiciones antes de aceptar. Identificá riesgos, ambigüedades y puntos a clarificar.
Devolvé JSON con:
{
  "mode": "review",
  "analysis": "...",
  "keySignals": ["...", "..."],
  "whatNotToSay": ["...", "..."],
  "nextAction": "...",
  "redFlags": ["...", "..."],
  "urgencyLevel": "alta|media|baja",
  "confidenceLevel": "alta|media|baja"
}`,
  }

  return `${ctxBlock}\n\n${modeInstructions[mode]}\n\nRespondé SOLO con JSON válido con la estructura indicada.`
}

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  const body = await req.json().catch(() => ({})) as {
    mode?: NegotiationMode
    message?: string
    context?: NegotiationContext
    country?: CountryCode
  }

  if (!body.message?.trim() && body.mode !== 'prepare') {
    return NextResponse.json({ error: 'missing_message' }, { status: 400 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ai_unavailable' }, { status: 503 })
  }

  const mode: NegotiationMode = body.mode ?? 'reply'
  const ctx: NegotiationContext = body.context ?? {}
  const country: CountryCode = body.country ?? 'AR'

  const systemPrompt = `${buildSystemPrompt(country)}\n\n${buildModePrompt(mode, ctx)}`

  const userContent = body.message?.trim()
    ? `Mensaje / situación:\n\n${body.message}`
    : 'Generá el brief con el contexto disponible.'

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.35,
        max_tokens: 1400,
        response_format: { type: 'json_object' },
      }),
    })

    if (!res.ok) throw new Error(`openai: ${res.status}`)

    const data = await res.json() as { choices: Array<{ message: { content: string } }> }
    const result: NegotiationResponse = JSON.parse(data.choices[0].message.content)

    log.info('negotiation.ok', { mode, channel: ctx.channel, country })
    return NextResponse.json({ result })
  } catch (err) {
    log.error('negotiation.failed', err)
    const msg = err instanceof Error ? err.message : ''
    if (/openai: 429|rate limit/i.test(msg)) {
      return NextResponse.json({ error: 'rate_limit', message: 'Demasiados pedidos seguidos. Esperá un minuto y reintentá.' }, { status: 429 })
    }
    if (/openai: 402|insufficient_quota|credit_balance|no credits/i.test(msg)) {
      return NextResponse.json({ error: 'quota_exceeded', message: 'La cuenta de IA se quedó sin crédito. Contactá al soporte.' }, { status: 402 })
    }
    return NextResponse.json({ error: 'ai_unavailable' }, { status: 503 })
  }
}
