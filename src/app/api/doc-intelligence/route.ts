export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { isEnabled } from '@/lib/flags'
import { log } from '@/lib/observability/logger'
import { requireAiAccess } from '@/lib/api/aiAccess'
import { isPdfPath, sanitizeDocSummary, type DocSummary } from '@/lib/documents/summary'

export type { DocSummary }

/**
 * POST /api/doc-intelligence
 *
 * Lee un PDF de operación y extrae: titulares, cargas, restricciones, y
 * alertas que VARA puede mostrar al usuario.
 *
 * Body: { documentId: string }
 *
 * Requiere:
 *  - Sesión Supabase del dueño de la operación
 *  - Flag docIntelligence encendido (NEXT_PUBLIC_FLAGS=docIntelligence)
 *  - Variable de entorno OPENAI_API_KEY configurada en el servidor
 *
 * Respuestas:
 *   200 { summary: DocSummary }
 *   400 { error: 'missing_document_id' | 'not_a_pdf' }
 *   401 / 403 / 429 — mismo control de IA que el resto (cuenta habilitada y tope diario)
 *   403 { error: 'disabled' }
 *   404 { error: 'not_found' }
 *   503 { error: 'ai_unavailable' }    — OpenAI no configurado o sin crédito
 */

export async function POST(req: Request) {
  if (!isEnabled('docIntelligence')) {
    return NextResponse.json({ error: 'disabled' }, { status: 403 })
  }

  const access = await requireAiAccess('text')
  if (access.error) return access.error

  const body = await req.json().catch(() => ({})) as { documentId?: string }
  if (!body.documentId) {
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

  const { data: doc } = await supabase
    .from('operation_documents')
    .select('id, storage_path, category, operation_id')
    .eq('id', body.documentId)
    .maybeSingle()

  if (!doc) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (!doc.storage_path) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  // Solo PDF: una foto mandada como PDF falla en OpenAI y se leía como "IA no disponible".
  if (!isPdfPath(doc.storage_path)) {
    return NextResponse.json({ error: 'not_a_pdf' }, { status: 400 })
  }

  const { data: fileData, error: dlErr } = await supabase.storage
    .from('documents')
    .download(doc.storage_path)

  if (dlErr || !fileData) {
    log.error('doc.intelligence.download.failed', dlErr)
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    log.warn('doc.intelligence.no_api_key', 'OPENAI_API_KEY not configured')
    return NextResponse.json({ error: 'ai_unavailable' }, { status: 503 })
  }

  let fileId: string | null = null
  try {
    const formData = new FormData()
    formData.append('file', new Blob([await fileData.arrayBuffer()], { type: 'application/pdf' }), 'doc.pdf')
    formData.append('purpose', 'assistants')

    const uploadRes = await fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    })
    if (!uploadRes.ok) throw new Error(`file upload: ${uploadRes.status}`)
    fileId = ((await uploadRes.json()) as { id: string }).id

    const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Sos un asistente legal de bienes raíces argentino.
Extraés información de escrituras, boletos y documentos inmobiliarios.
Respondé SOLO en JSON con la estructura exacta que se pide, sin texto adicional.
Nunca inventés información que no está en el documento.`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Del siguiente documento extraé:
1. holders: nombres de titulares o partes firmantes (array de strings)
2. encumbrances: hipotecas, embargos, inhibiciones (array de strings, vacío si ninguno)
3. restrictions: usufructo, servidumbre, restricciones de dominio (array de strings)
4. alerts: qué debería revisar un profesional (array de strings)
5. excerpt: primeras 200 palabras del documento
6. readable: false si no pudiste leer texto del documento (por ejemplo, una imagen escaneada sin texto)

Respondé SOLO con JSON válido: {"holders":[],"encumbrances":[],"restrictions":[],"alerts":[],"excerpt":"","readable":true}`,
              },
              { type: 'file', file: { file_id: fileId } },
            ],
          },
        ],
        max_tokens: 1000,
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    })

    if (!chatRes.ok) throw new Error(`chat: ${chatRes.status}`)
    const chatData = await chatRes.json() as { choices: Array<{ message: { content: string } }> }
    const summary = sanitizeDocSummary(JSON.parse(chatData.choices[0].message.content))
    if (!summary) throw new Error('summary: respuesta inválida')

    // Persistir el análisis en Supabase para no repetir el análisis (best effort)
    void supabase.from('document_ai_summaries').upsert(
      { user_id: user.id, document_id: doc.id, summary, updated_at: new Date().toISOString() },
      { onConflict: 'document_id' },
    )

    log.info('doc.intelligence.ok', { documentId: body.documentId })
    return NextResponse.json({ summary })
  } catch (err) {
    log.error('doc.intelligence.failed', err)
    return NextResponse.json({ error: 'ai_unavailable' }, { status: 503 })
  } finally {
    // La escritura tiene DNI y domicilios: se borra de OpenAI siempre, también si el análisis falló.
    if (fileId) {
      fetch(`https://api.openai.com/v1/files/${fileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${apiKey}` },
      }).catch(() => {})
    }
  }
}
