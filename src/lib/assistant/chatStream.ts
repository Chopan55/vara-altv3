/**
 * Transmisión de la respuesta del chat (NDJSON): el servidor manda una línea JSON por evento.
 *   {"t":"d","v":"texto"}            → un pedazo de la respuesta, para mostrarlo ya
 *   {"t":"f", ...respuesta final}    → la respuesta completa y limpia (tope tapado, borrador separado, fuentes)
 *   {"t":"e","status":429,"error":…} → falló
 * Lo que se muestra mientras llega es provisorio: al llegar «f» se reemplaza por la respuesta final del servidor.
 * Todo acá es puro: se prueba sin red.
 */
import { cleanChatReply } from '@/lib/ai/cleanReply'
import { privateLimitText } from '@/lib/ai/privateLimit'
import { scrubWalkAway } from '@/lib/negotiation/walkAway'

export interface FinalPayload {
  reply: string
  draft?: string
  nextStep?: { operationId: string; target: 'documents' }
  documentsUnavailable?: boolean
  sources?: { kind: 'operation' | 'calculator' | 'knowledge' | 'general'; label: string; detail?: string; href?: string }[]
}

export type StreamEvent =
  | { t: 'd'; v: string }
  | ({ t: 'f' } & FinalPayload)
  | { t: 'e'; status: number; error: string }

/** Parte lo recibido en líneas completas; lo que quedó sin cerrar espera al próximo pedazo. */
export function splitNdjson(buffer: string, chunk: string): { lines: string[]; rest: string } {
  const parts = (buffer + chunk).split('\n')
  const rest = parts.pop() ?? ''
  return { lines: parts.filter(l => l.trim() !== ''), rest }
}

export function parseStreamEvent(line: string): StreamEvent | null {
  let data: unknown
  try { data = JSON.parse(line) } catch { return null }
  if (!data || typeof data !== 'object') return null
  const e = data as Record<string, unknown>
  if (e.t === 'd' && typeof e.v === 'string') return { t: 'd', v: e.v }
  if (e.t === 'f' && typeof e.reply === 'string') return e as unknown as StreamEvent
  if (e.t === 'e') {
    return { t: 'e', status: typeof e.status === 'number' ? e.status : 500, error: typeof e.error === 'string' ? e.error : 'Error al procesar tu consulta.' }
  }
  return null
}

/**
 * Texto provisorio mientras llega la respuesta: sin el borrador (que se muestra aparte en su tarjeta), sin etiquetas ni
 * markdown, y con el tope de la persona tapado. Si el final de lo recibido es el comienzo de la marca BORRADOR, se oculta.
 */
export function streamingDisplay(raw: string, messages: { role: string; content: string }[]): string {
  const text = raw.replace(/\r\n?/g, '\n')
  const marker = /^[ \t]*BORRADOR[ \t]*$/m.exec(text)
  let visible = marker ? text.slice(0, marker.index) : text
  const lastLine = visible.slice(visible.lastIndexOf('\n') + 1)
  if (!marker && lastLine.trim().length > 0 && 'BORRADOR'.startsWith(lastLine.trim())) {
    visible = visible.slice(0, visible.length - lastLine.length)
  }
  return scrubWalkAway(cleanChatReply(visible), privateLimitText(messages))
}

export type StreamOutcome =
  | { kind: 'final'; payload: FinalPayload }
  | { kind: 'error'; status: number; error: string }
  | { kind: 'cut' }

/**
 * Lee la respuesta transmitida hasta el final. `onText` recibe el texto provisorio ya limpio cada vez que llega un pedazo.
 * Si la conexión se corta sin respuesta final ni error, devuelve `cut` (nunca se muestra una respuesta a medias como si fuera completa).
 */
export async function readChatStream(
  body: ReadableStream<Uint8Array>,
  messages: { role: string; content: string }[],
  onText: (text: string) => void,
): Promise<StreamOutcome> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let raw = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      // Al terminar, se procesa también el remanente del decodificador y una última línea sin salto de línea.
      const split = done ? splitNdjson(buffer, decoder.decode() + '\n') : splitNdjson(buffer, decoder.decode(value, { stream: true }))
      buffer = split.rest
      for (const line of split.lines) {
        const event = parseStreamEvent(line)
        if (!event) continue
        if (event.t === 'd') { raw += event.v; onText(streamingDisplay(raw, messages)) }
        else if (event.t === 'f') { const { t: _t, ...payload } = event; return { kind: 'final', payload } }
        else return { kind: 'error', status: event.status, error: event.error }
      }
      if (done) break
    }
  } catch {
    return { kind: 'cut' }
  } finally {
    try { reader.releaseLock() } catch { /* ya liberado */ }
  }
  return { kind: 'cut' }
}
