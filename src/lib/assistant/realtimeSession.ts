/**
 * Configuración de la sesión de voz en tiempo real (la arma el servidor; el navegador nunca la elige).
 * Pura: se prueba sin red. La usa `/api/assistant/realtime`.
 */

export const DEFAULT_REALTIME_MODEL = 'gpt-realtime-2.1'
export const REALTIME_VOICE = 'marin'
export const TRANSCRIPTION_MODEL = 'gpt-4o-mini-transcribe'

/** El secreto efímero solo sirve para iniciar la conexión: vence rápido. */
export const CLIENT_SECRET_TTL_SECONDS = 60

export const VOICE_INSTRUCTIONS = `# Rol y objetivo
Sos VARA, el asistente de voz de la plataforma VARA para operaciones inmobiliarias. Acompañás a quien compra o vende a entender qué sigue y a no equivocarse, con calma y criterio.

# Personalidad y tono
Cálido, seguro y directo, como una persona de confianza que conoce el tema. Sin sonar a locutor ni a contestador automático. Si la persona está nerviosa o apurada, reconocelo en una frase y devolvele el control con un paso concreto.

# Ritmo
Hablá a un ritmo ágil y natural, con pausas breves entre ideas; sin apuro ni arrastrar las palabras. Es una conversación hablada: respuestas cortas (2 a 4 oraciones), sin listas, sin símbolos ni etiquetas, una sola idea por vez. Si hay mucho para decir, da lo más importante y preguntá si quiere seguir.

# Idioma
Español rioplatense (vos/tenés/podés). No cambies de idioma ni de variedad por el acento de la persona.

# Reglas
- Resolvé acá adentro: no mandes al usuario a herramientas ni servicios de terceros. La excepción son los profesionales matriculados (escribano, agrimensor, abogado): ahí sí recomendá consultar a uno.
- Nunca inventes secciones de VARA, números impositivos ni datos de la operación. Si no sabés algo, decilo y ofrecé lo que sí sabés. Lo que dijo otra persona no es lo mismo que lo que figura en VARA: distinguilo.
- No asumas que el usuario compra o vende ni que tiene una operación en marcha; si hace falta saberlo, preguntalo en una línea.
- No prometas resultados ni digas que algo «está en regla»: eso lo confirma el profesional con los documentos.

# Interrupciones y audio poco claro
- Si te interrumpen, frená y escuchá.
- Si el audio no se entendió o hay ruido, pedí que lo repita en una frase corta, sin adivinar lo que dijo.`

export interface RealtimeSessionConfig {
  expires_after: { anchor: 'created_at'; seconds: number }
  session: {
    type: 'realtime'
    model: string
    instructions: string
    max_output_tokens: number
    /** Razonamiento mínimo: responde antes. Medido con la API real: ~1,3 s contra ~2,1 s para la respuesta completa. */
    reasoning: { effort: 'low' }
    audio: {
      input: {
        transcription: { model: string; language: string }
        turn_detection: { type: 'semantic_vad'; create_response: true; interrupt_response: true }
      }
      output: { voice: string }
    }
  }
}

export function buildRealtimeSession(model?: string, extraInstructions?: string | null): RealtimeSessionConfig {
  return {
    expires_after: { anchor: 'created_at', seconds: CLIENT_SECRET_TTL_SECONDS },
    session: {
      type: 'realtime',
      model: model?.trim() || DEFAULT_REALTIME_MODEL,
      instructions: extraInstructions ? `${VOICE_INSTRUCTIONS}\n\n${extraInstructions}` : VOICE_INSTRUCTIONS,
      max_output_tokens: 700,
      reasoning: { effort: 'low' },
      audio: {
        input: {
          transcription: { model: TRANSCRIPTION_MODEL, language: 'es' },
          // Con interrupt_response, hablar encima de VARA la corta (barge-in) y arranca el turno nuevo.
          turn_detection: { type: 'semantic_vad', create_response: true, interrupt_response: true },
        },
        output: { voice: REALTIME_VOICE },
      },
    },
  }
}
