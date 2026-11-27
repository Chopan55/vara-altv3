export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { isEnabled } from '@/lib/flags'
import { log } from '@/lib/observability/logger'
import { requireAiAccess } from '@/lib/api/aiAccess'
import { isPdfPath } from '@/lib/documents/summary'
import { MAX_PDF_BYTES, extractPages } from '@/lib/documents/extractPdf'
import { docModelParams, readWithCitations } from '@/lib/documents/readCited'

/**
 * POST /api/documents/read   { documentId }
 *
 * Lee un PDF de la operación y devuelve hallazgos con página y frase textual, comprobados contra el texto.
 * - El archivo NO se envía a OpenAI: el texto se extrae acá y solo ese texto viaja al modelo.
 * - Nada del contenido (texto, citas, nombres) se escribe en logs.
 * - No se guarda el resultado: se calcula al pedirlo.
 * Mismo interruptor que el lector anterior (docIntelligence): sin OK explícito queda apagado.
 */

const PRIMARY = process.env.OPENAI_DOC_MODEL?.trim() || 'gpt-5.4-mini'
const FALLBACK = 'gpt-4o-mini'

async function ask(apiKey: string, model: string, system: string, user: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      response_format: { type: 'json_object' },
      ...docModelParams(model),
    }),
    signal: AbortSignal.timeout(50_000),
  })
  if (!res.ok) throw new Error(`openai ${res.status}`)
  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
  return data.choices?.[0]?.message?.content ?? ''
}

export async function POST(req: Request) {
  if (!isEnabled('docIntelligence')) return NextResponse.json({ error: 'disabled' }, { status: 403 })

  const access = await requireAiAccess('text')
  if (access.error) return access.error

  const body = await req.json().catch(() => ({})) as { documentId?: unknown }
  if (typeof body.documentId !== 'string' || !body.documentId || body.documentId.length > 64) {
    return NextResponse.json({ error: 'missing_document_id' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  // RLS limita la lectura al dueño; además se exige explícitamente.
  const { data: doc } = await supabase
    .from('operation_documents')
    .select('id, storage_path')
    .eq('id', body.documentId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!doc?.storage_path) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (!isPdfPath(doc.storage_path)) return NextResponse.json({ error: 'not_a_pdf' }, { status: 400 })

  const { data: file, error: dlErr } = await supabase.storage.from('documents').download(doc.storage_path)
  if (dlErr || !file) {
    log.error('doc.read.download_failed', 'storage')
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  if (file.size > MAX_PDF_BYTES) return NextResponse.json({ error: 'too_large' }, { status: 413 })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    log.warn('doc.read.no_api_key', 'OPENAI_API_KEY not configured')
    return NextResponse.json({ error: 'ai_unavailable' }, { status: 503 })
  }

  try {
    const pages = await extractPages(new Uint8Array(await file.arrayBuffer()))
    const { summary, usedModel } = await readWithCitations(pages, async (system, userMsg) => {
      try { return await ask(apiKey, PRIMARY, system, userMsg) }
      catch (e) {
        // Sin acceso al modelo principal se usa el de respaldo; el mensaje de error no se registra (puede traer contenido).
        log.warn('doc.read.fallback', e instanceof Error ? e.message.slice(0, 40) : 'error')
        return ask(apiKey, FALLBACK, system, userMsg)
      }
    })
    log.info('doc.read.ok', { documentId: doc.id, pages: summary.pageCount, findings: summary.findings.length, usedModel })
    return NextResponse.json({ summary })
  } catch {
    // Nunca se registra el error completo: el parser de PDF puede incluir fragmentos del contenido.
    log.error('doc.read.failed', 'processing')
    return NextResponse.json({ error: 'ai_unavailable' }, { status: 503 })
  }
}
