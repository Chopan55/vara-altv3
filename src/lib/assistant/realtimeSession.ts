/**
 * Configuración de la sesión de voz en tiempo real (la arma el servidor; el navegador nunca la elige).
 * Pura: se prueba sin red. La usa `/api/assistant/realtime`.
 */

import { contextBlock } from '@/lib/assistant/context'

export const DEFAULT_REALTIME_MODEL = 'gpt-realtime-2.1'
export const REALTIME_VOICE = 'marin'
export const TRANSCRIPTION_MODEL = 'gpt-4o-mini-transcribe'

/** El secreto efímero solo sirve para iniciar la conexión: vence rápido. */
export const CLIENT_SECRET_TTL_SECONDS = 60

export const VOICE_INSTRUCTIONS = `Sos VARA, el asistente de voz de la plataforma VARA para operaciones inmobiliarias en Argentina.

Hablás en español rioplatense (vos/tenés), con tono cálido, directo y claro. Es una conversación hablada: respuestas cortas
(2 a 4 oraciones), sin listas, sin símbolos ni etiquetas, y una sola idea por vez. Si hay mucho para decir, da lo más importante
y preguntá si quiere seguir.

Reglas:
- Resolvé acá adentro: no mandes al usuario a herramientas ni servicios de terceros. La excepción son los profesionales
  matriculados (escribano, agrimensor, abogado): ahí sí recomendá consultar a uno.
- Nunca inventes secciones de VARA, números impositivos ni datos de la operación. Si no sabés algo, decilo y ofrecé lo que sí sabés.
- No asumas que el usuario compra o vende ni que tiene una operación en marcha; si hace falta saberlo, preguntalo en una línea.
- Si el usuario te interrumpe, frená y escuchá.
- Si no se entendió el audio, pedí que lo repita en una frase corta.`

export interface RealtimeSessionConfig {
  expires_after: { anchor: 'created_at'; seconds: number }
  session: {
    type: 'realtime'
    model: string
    instructions: string
    max_output_tokens: number
    audio: {
      input: {
        transcription: { model: string; language: string }
        turn_detection: { type: 'semantic_vad'; create_response: true; interrupt_response: true }
      }
      output: { voice: string }
    }
  }
}

/** `context`: el mismo contexto de la operación que usa el chat de texto (ya sanitizado por el servidor). */
export function buildRealtimeSession(model?: string, context?: string | null): RealtimeSessionConfig {
  return {
    expires_after: { anchor: 'created_at', seconds: CLIENT_SECRET_TTL_SECONDS },
    session: {
      type: 'realtime',
      model: model?.trim() || DEFAULT_REALTIME_MODEL,
      instructions: context ? `${VOICE_INSTRUCTIONS}\n\n${contextBlock(context)}` : VOICE_INSTRUCTIONS,
      max_output_tokens: 700,
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
